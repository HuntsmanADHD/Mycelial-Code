/*
 * Mycelial Signal Runtime - Signal and Queue Operations
 * M2 Phase 1 Implementation
 *
 * Provides signal allocation, ring buffer queue, and lifecycle management.
 * Based on M2_SIGNAL_RUNTIME_SPEC.md
 */

#include "signal.h"
#include <string.h>

/* =============================================================================
 * SIGNAL ALLOCATION
 *
 * Design decisions:
 * - Signal headers are 32 bytes (cache-line friendly)
 * - Payloads are separately allocated and pointed to
 * - Reference counting enables zero-copy sharing
 * ============================================================================= */

/*
 * Allocate a signal struct (header only)
 *
 * Performance: ~40-60 cycles (heap_allocate + timestamp)
 *
 * @return: Pointer to signal, or NULL on failure
 */
Signal* signal_alloc(void) {
    Signal* sig = heap_allocate(sizeof(Signal));
    if (sig == NULL) {
        return NULL;
    }

    /* Initialize all fields to zero/defaults */
    sig->frequency_id = 0;
    sig->source_agent_id = 0;
    sig->flags = SIGNAL_FLAG_HEAP_ALLOCATED;
    sig->ref_count = 1;
    sig->payload_ptr = NULL;
    sig->payload_size = 0;
    sig->payload_capacity = 0;
    sig->timestamp = get_timestamp();

    return sig;
}

/*
 * Increment signal reference count
 *
 * Use when signal is shared between multiple queues (broadcast).
 *
 * @param sig: Signal to reference
 */
void signal_ref(Signal* sig) {
    if (sig != NULL) {
        sig->ref_count++;
    }
}

/*
 * Free a signal and its payload (if owned)
 *
 * Decrements ref_count. Only frees when count reaches zero.
 * This enables safe sharing of signals across multiple destinations.
 *
 * Performance: ~30-50 cycles
 *
 * @param sig: Signal to free
 */
void signal_free(Signal* sig) {
    if (sig == NULL) {
        return;
    }

    /* Decrement reference count */
    if (sig->ref_count > 0) {
        sig->ref_count--;
    }

    /* Only free when no more references */
    if (sig->ref_count > 0) {
        return;
    }

    /* Free payload if we own it */
    if ((sig->flags & SIGNAL_FLAG_OWNS_PAYLOAD) && sig->payload_ptr != NULL) {
        heap_free(sig->payload_ptr, sig->payload_capacity);
        sig->payload_ptr = NULL;
    }

    /* Free signal header if heap allocated */
    if (sig->flags & SIGNAL_FLAG_HEAP_ALLOCATED) {
        heap_free(sig, sizeof(Signal));
    }
}

/*
 * Create and populate a signal with payload
 *
 * This is the main signal creation function.
 * Copies payload data into a new heap allocation.
 *
 * Performance: ~100-150 cycles (alloc + memcpy)
 *
 * @param frequency_id: Signal type identifier
 * @param source_agent_id: ID of sending agent
 * @param payload: Pointer to payload data (will be copied)
 * @param payload_size: Size of payload in bytes
 * @return: Pointer to signal, or NULL on failure
 */
Signal* signal_create(uint32_t frequency_id, uint32_t source_agent_id,
                      const void* payload, uint32_t payload_size) {

    /* Validate payload size */
    if (payload_size > MAX_PAYLOAD_SIZE) {
        return NULL;
    }

    /* Allocate signal header */
    Signal* sig = signal_alloc();
    if (sig == NULL) {
        return NULL;
    }

    /* Fill in signal fields */
    sig->frequency_id = (uint16_t)frequency_id;
    sig->source_agent_id = (uint16_t)source_agent_id;

    /* Allocate and copy payload if present */
    if (payload != NULL && payload_size > 0) {
        /* Align payload capacity to 8 bytes */
        uint32_t capacity = (payload_size + 7) & ~((uint32_t)7);

        sig->payload_ptr = heap_allocate(capacity);
        if (sig->payload_ptr == NULL) {
            signal_free(sig);
            return NULL;
        }

        /* Copy payload data */
        memcpy(sig->payload_ptr, payload, payload_size);

        sig->payload_size = payload_size;
        sig->payload_capacity = capacity;
        sig->flags |= SIGNAL_FLAG_OWNS_PAYLOAD;
    }

    return sig;
}

/* =============================================================================
 * SIGNAL QUEUE (Ring Buffer)
 *
 * Design decisions:
 * - Power-of-2 capacity for fast modulo (bitwise AND)
 * - Store signal pointers (not signals) for O(1) operations
 * - Queue full: Return error (caller decides what to do)
 * - Lock-free single-producer single-consumer (no locks needed for now)
 * ============================================================================= */

/*
 * Create a new signal queue
 *
 * Performance: ~200 cycles (two heap allocations)
 *
 * @param capacity: Maximum number of signals (will be rounded to power of 2)
 * @return: Pointer to queue, or NULL on failure
 */
SignalQueue* signal_queue_create(uint32_t capacity) {
    /* Ensure capacity is power of 2 */
    if (!is_power_of_two(capacity)) {
        capacity = next_power_of_two(capacity);
    }

    /* Allocate queue struct */
    SignalQueue* queue = heap_allocate(sizeof(SignalQueue));
    if (queue == NULL) {
        return NULL;
    }

    /* Allocate buffer for signal pointers */
    size_t buffer_size = capacity * sizeof(Signal*);
    queue->buffer = heap_allocate(buffer_size);
    if (queue->buffer == NULL) {
        heap_free(queue, sizeof(SignalQueue));
        return NULL;
    }

    /* Initialize queue fields */
    queue->capacity = capacity;
    queue->mask = capacity - 1;
    queue->head = 0;
    queue->tail = 0;
    queue->count = 0;
    queue->total_enqueued = 0;
    queue->total_dequeued = 0;
    queue->dropped_count = 0;
    queue->owner_agent_id = 0;
    queue->flags = QUEUE_FLAG_ACTIVE;
    queue->reserved = 0;

    return queue;
}

/*
 * Destroy signal queue and free all signals in it
 *
 * @param queue: Queue to destroy
 */
void signal_queue_destroy(SignalQueue* queue) {
    if (queue == NULL) {
        return;
    }

    /* Free all signals still in queue */
    while (!signal_queue_is_empty(queue)) {
        Signal* sig = signal_queue_dequeue(queue);
        signal_free(sig);
    }

    /* Free buffer */
    if (queue->buffer != NULL) {
        heap_free(queue->buffer, queue->capacity * sizeof(Signal*));
    }

    /* Free queue struct */
    heap_free(queue, sizeof(SignalQueue));
}

/*
 * Enqueue signal into queue
 *
 * Design: Return error if full (don't block, don't drop oldest).
 * This lets the caller decide the overflow policy.
 *
 * Performance: ~15-25 cycles
 *
 * @param queue: Target queue
 * @param signal: Signal to enqueue
 * @return: SIGNAL_OK on success, SIGNAL_ERR_QUEUE_FULL if full
 */
int signal_queue_enqueue(SignalQueue* queue, Signal* signal) {
    if (queue == NULL) {
        return SIGNAL_ERR_NULL_POINTER;
    }

    if (signal == NULL) {
        return SIGNAL_ERR_NULL_POINTER;
    }

    /* Check if full */
    if (queue->count >= queue->capacity) {
        queue->dropped_count++;
        queue->flags |= QUEUE_FLAG_OVERFLOW;
        return SIGNAL_ERR_QUEUE_FULL;
    }

    /* Calculate tail index with wrap-around */
    uint32_t index = queue->tail & queue->mask;

    /* Store signal pointer */
    queue->buffer[index] = signal;

    /* Increment reference count (signal is now shared with queue) */
    signal_ref(signal);

    /* Update queue state */
    queue->tail++;
    queue->count++;
    queue->total_enqueued++;

    return SIGNAL_OK;
}

/*
 * Dequeue signal from queue
 *
 * Returns the signal but does NOT decrement ref_count.
 * Caller is responsible for calling signal_free() when done.
 *
 * Performance: ~12-20 cycles
 *
 * @param queue: Source queue
 * @return: Signal pointer, or NULL if empty
 */
Signal* signal_queue_dequeue(SignalQueue* queue) {
    if (queue == NULL) {
        return NULL;
    }

    /* Check if empty */
    if (queue->count == 0) {
        return NULL;
    }

    /* Calculate head index with wrap-around */
    uint32_t index = queue->head & queue->mask;

    /* Get signal pointer */
    Signal* sig = queue->buffer[index];

    /* Clear slot (helps with debugging) */
    queue->buffer[index] = NULL;

    /* Update queue state */
    queue->head++;
    queue->count--;
    queue->total_dequeued++;

    return sig;
}

/*
 * Peek at next signal without removing
 *
 * @param queue: Source queue
 * @return: Signal pointer, or NULL if empty
 */
Signal* signal_queue_peek(SignalQueue* queue) {
    if (queue == NULL || queue->count == 0) {
        return NULL;
    }

    uint32_t index = queue->head & queue->mask;
    return queue->buffer[index];
}

/* =============================================================================
 * QUEUE STATUS FUNCTIONS
 * ============================================================================= */

uint32_t signal_queue_count(SignalQueue* queue) {
    return (queue != NULL) ? queue->count : 0;
}

uint32_t signal_queue_capacity(SignalQueue* queue) {
    return (queue != NULL) ? queue->capacity : 0;
}

int signal_queue_is_full(SignalQueue* queue) {
    return (queue != NULL) ? (queue->count >= queue->capacity) : 1;
}

int signal_queue_is_empty(SignalQueue* queue) {
    return (queue != NULL) ? (queue->count == 0) : 1;
}

uint32_t signal_queue_get_dropped(SignalQueue* queue) {
    return (queue != NULL) ? queue->dropped_count : 0;
}

uint32_t signal_queue_get_total_enqueued(SignalQueue* queue) {
    return (queue != NULL) ? queue->total_enqueued : 0;
}

uint32_t signal_queue_get_total_dequeued(SignalQueue* queue) {
    return (queue != NULL) ? queue->total_dequeued : 0;
}

/* =============================================================================
 * SIGNAL LIFECYCLE HELPERS
 * ============================================================================= */

/*
 * Mark signal as processed
 *
 * Sets the PROCESSED flag and decrements ref_count.
 * Use after a handler has finished processing a signal.
 *
 * @param sig: Signal that was processed
 */
void signal_mark_processed(Signal* sig) {
    if (sig == NULL) {
        return;
    }

    sig->flags |= SIGNAL_FLAG_PROCESSED;
    signal_free(sig);  /* Decrements ref_count, frees if zero */
}

/*
 * Get signal payload pointer for reading
 *
 * @param sig: Signal to get payload from
 * @return: Pointer to payload, or NULL if no payload
 */
void* signal_get_payload(Signal* sig) {
    if (sig == NULL) {
        return NULL;
    }
    return sig->payload_ptr;
}

/*
 * Get signal payload size
 *
 * @param sig: Signal to get size from
 * @return: Payload size in bytes
 */
uint32_t signal_get_payload_size(Signal* sig) {
    if (sig == NULL) {
        return 0;
    }
    return sig->payload_size;
}

/*
 * Get signal frequency ID
 */
uint16_t signal_get_frequency(Signal* sig) {
    return (sig != NULL) ? sig->frequency_id : 0;
}

/*
 * Get signal source agent ID
 */
uint16_t signal_get_source(Signal* sig) {
    return (sig != NULL) ? sig->source_agent_id : 0;
}

/*
 * Get signal timestamp
 */
uint64_t signal_get_timestamp(Signal* sig) {
    return (sig != NULL) ? sig->timestamp : 0;
}

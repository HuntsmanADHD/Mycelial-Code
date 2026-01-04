/*
 * Mycelial Signal Runtime - Dispatch Table Implementation
 * M2 Phase 3 Implementation
 *
 * Provides signal dispatch to handler functions.
 * Based on M2_PATTERN_MATCHING_DISPATCH_SPEC.md
 */

#include "signal.h"
#include "dispatch.h"
#include <string.h>

/* =============================================================================
 * DISPATCH TABLE CREATION/DESTRUCTION
 * ============================================================================= */

/*
 * Create a dispatch table for an agent
 *
 * Performance: ~200 cycles (heap allocation)
 *
 * @param capacity: Maximum number of handlers
 * @param agent_id: ID of the agent this table belongs to
 * @return: Pointer to table, or NULL on failure
 */
DispatchTable* dispatch_table_create(uint32_t capacity, uint32_t agent_id) {
    /* Allocate table struct */
    DispatchTable* table = heap_allocate(sizeof(DispatchTable));
    if (table == NULL) {
        return NULL;
    }

    /* Allocate entries array */
    size_t entries_size = capacity * sizeof(DispatchEntry);
    table->entries = heap_allocate(entries_size);
    if (table->entries == NULL) {
        heap_free(table, sizeof(DispatchTable));
        return NULL;
    }

    /* Initialize entries to empty */
    memset(table->entries, 0, entries_size);

    /* Initialize table fields */
    table->entry_count = 0;
    table->capacity = capacity;
    table->default_handler = NULL;
    table->agent_state = NULL;
    table->agent_id = agent_id;
    table->lookup_count = 0;
    table->hit_count = 0;
    table->miss_count = 0;

    return table;
}

/*
 * Destroy dispatch table and free memory
 *
 * @param table: Table to destroy
 */
void dispatch_table_destroy(DispatchTable* table) {
    if (table == NULL) {
        return;
    }

    /* Free entries array */
    if (table->entries != NULL) {
        heap_free(table->entries, table->capacity * sizeof(DispatchEntry));
    }

    /* Free table struct */
    heap_free(table, sizeof(DispatchTable));
}

/* =============================================================================
 * HANDLER REGISTRATION
 * ============================================================================= */

/*
 * Register a handler in the dispatch table
 *
 * Handlers are stored in a simple array. For small tables (< 16 entries)
 * linear search is faster than hash table due to cache locality.
 *
 * Performance: ~50 cycles
 *
 * @param table: Dispatch table
 * @param frequency_id: Signal frequency to handle
 * @param handler: Handler function pointer
 * @param guard: Optional guard function (NULL if no guard)
 * @return: DISPATCH_OK on success
 */
int dispatch_register(DispatchTable* table, uint32_t frequency_id,
                      signal_handler_fn handler, guard_fn guard) {
    if (table == NULL || handler == NULL) {
        return DISPATCH_ERR_NULL_POINTER;
    }

    /* Check for existing entry with same frequency_id */
    for (uint32_t i = 0; i < table->entry_count; i++) {
        if ((table->entries[i].flags & DISPATCH_FLAG_ACTIVE) &&
            table->entries[i].frequency_id == frequency_id) {
            /* Update existing entry */
            table->entries[i].handler = handler;
            table->entries[i].guard = guard;
            if (guard != NULL) {
                table->entries[i].flags |= DISPATCH_FLAG_HAS_GUARD;
            } else {
                table->entries[i].flags &= ~DISPATCH_FLAG_HAS_GUARD;
            }
            return DISPATCH_OK;
        }
    }

    /* Check capacity */
    if (table->entry_count >= table->capacity) {
        return DISPATCH_ERR_ALLOC_FAILED;
    }

    /* Add new entry */
    DispatchEntry* entry = &table->entries[table->entry_count];
    entry->frequency_id = frequency_id;
    entry->flags = DISPATCH_FLAG_ACTIVE;
    entry->handler = handler;
    entry->guard = guard;

    if (guard != NULL) {
        entry->flags |= DISPATCH_FLAG_HAS_GUARD;
    }

    table->entry_count++;

    return DISPATCH_OK;
}

/*
 * Unregister a handler from the dispatch table
 *
 * @param table: Dispatch table
 * @param frequency_id: Signal frequency to unregister
 * @return: DISPATCH_OK on success, DISPATCH_ERR_NO_HANDLER if not found
 */
int dispatch_unregister(DispatchTable* table, uint32_t frequency_id) {
    if (table == NULL) {
        return DISPATCH_ERR_NULL_POINTER;
    }

    for (uint32_t i = 0; i < table->entry_count; i++) {
        if ((table->entries[i].flags & DISPATCH_FLAG_ACTIVE) &&
            table->entries[i].frequency_id == frequency_id) {
            /* Mark entry as inactive */
            table->entries[i].flags &= ~DISPATCH_FLAG_ACTIVE;
            return DISPATCH_OK;
        }
    }

    return DISPATCH_ERR_NO_HANDLER;
}

/*
 * Set default handler (called when no matching frequency found)
 *
 * @param table: Dispatch table
 * @param handler: Default handler function
 */
void dispatch_set_default(DispatchTable* table, signal_handler_fn handler) {
    if (table != NULL) {
        table->default_handler = handler;
    }
}

/*
 * Set agent state pointer (cached for fast dispatch)
 *
 * @param table: Dispatch table
 * @param state: Pointer to agent state
 */
void dispatch_set_state(DispatchTable* table, void* state) {
    if (table != NULL) {
        table->agent_state = state;
    }
}

/* =============================================================================
 * HANDLER LOOKUP
 * ============================================================================= */

/*
 * Look up handler for a frequency
 *
 * Linear search for small tables (< 16 entries).
 * Performance: O(n) but cache-friendly, ~10-20 cycles for small n
 *
 * @param table: Dispatch table
 * @param frequency_id: Signal frequency to look up
 * @return: Handler function pointer, or NULL if not found
 */
signal_handler_fn dispatch_lookup(DispatchTable* table, uint32_t frequency_id) {
    if (table == NULL) {
        return NULL;
    }

    /* Linear search through entries */
    for (uint32_t i = 0; i < table->entry_count; i++) {
        DispatchEntry* entry = &table->entries[i];

        if ((entry->flags & DISPATCH_FLAG_ACTIVE) &&
            entry->frequency_id == frequency_id) {
            return entry->handler;
        }
    }

    return NULL;
}

/*
 * Look up full dispatch entry for a frequency
 *
 * @param table: Dispatch table
 * @param frequency_id: Signal frequency to look up
 * @return: Dispatch entry pointer, or NULL if not found
 */
DispatchEntry* dispatch_lookup_entry(DispatchTable* table, uint32_t frequency_id) {
    if (table == NULL) {
        return NULL;
    }

    for (uint32_t i = 0; i < table->entry_count; i++) {
        DispatchEntry* entry = &table->entries[i];

        if ((entry->flags & DISPATCH_FLAG_ACTIVE) &&
            entry->frequency_id == frequency_id) {
            return entry;
        }
    }

    return NULL;
}

/* =============================================================================
 * DISPATCH INVOCATION
 * ============================================================================= */

/*
 * Execute handler for a signal
 *
 * Main dispatch function. Looks up handler, checks guard, invokes.
 *
 * Performance: ~30-50 cycles (lookup + guard + call)
 *
 * @param table: Dispatch table
 * @param signal: Signal to dispatch
 * @return: DISPATCH_OK on success, error code on failure
 */
int dispatch_invoke(DispatchTable* table, Signal* signal) {
    return dispatch_invoke_with_state(table, table->agent_state, signal);
}

/*
 * Execute handler with explicit state pointer
 *
 * @param table: Dispatch table
 * @param agent_state: Agent state pointer
 * @param signal: Signal to dispatch
 * @return: DISPATCH_OK on success, error code on failure
 */
int dispatch_invoke_with_state(DispatchTable* table, void* agent_state,
                               Signal* signal) {
    if (table == NULL || signal == NULL) {
        return DISPATCH_ERR_NULL_POINTER;
    }

    /* Update stats */
    table->lookup_count++;

    /* Look up dispatch entry */
    DispatchEntry* entry = dispatch_lookup_entry(table, signal->frequency_id);

    if (entry == NULL) {
        /* No handler found, try default */
        table->miss_count++;

        if (table->default_handler != NULL) {
            int result = table->default_handler(agent_state, signal);
            if (result != 0) {
                return DISPATCH_ERR_HANDLER_FAILED;
            }
            return DISPATCH_OK;
        }

        return DISPATCH_ERR_NO_HANDLER;
    }

    table->hit_count++;

    /* Check guard clause if present */
    if (entry->flags & DISPATCH_FLAG_HAS_GUARD) {
        if (entry->guard != NULL) {
            int guard_result = entry->guard(agent_state, signal);
            if (guard_result == 0) {
                /* Guard failed, signal not processed */
                return DISPATCH_ERR_GUARD_FAILED;
            }
        }
    }

    /* Invoke handler */
    int handler_result = entry->handler(agent_state, signal);
    if (handler_result != 0) {
        return DISPATCH_ERR_HANDLER_FAILED;
    }

    return DISPATCH_OK;
}

/* =============================================================================
 * DISPATCH STATISTICS
 * ============================================================================= */

uint32_t dispatch_get_lookup_count(DispatchTable* table) {
    return (table != NULL) ? table->lookup_count : 0;
}

uint32_t dispatch_get_hit_count(DispatchTable* table) {
    return (table != NULL) ? table->hit_count : 0;
}

uint32_t dispatch_get_miss_count(DispatchTable* table) {
    return (table != NULL) ? table->miss_count : 0;
}

void dispatch_reset_stats(DispatchTable* table) {
    if (table != NULL) {
        table->lookup_count = 0;
        table->hit_count = 0;
        table->miss_count = 0;
    }
}

/* =============================================================================
 * AGENT EVENT LOOP SUPPORT
 * ============================================================================= */

/*
 * Process all signals in an agent's queue
 *
 * Dequeues signals one at a time and dispatches to handlers.
 * Continues until queue is empty.
 *
 * @param table: Dispatch table for the agent
 * @param queue: Agent's input signal queue
 * @return: Number of signals processed
 */
int dispatch_process_queue(DispatchTable* table, SignalQueue* queue) {
    if (table == NULL || queue == NULL) {
        return 0;
    }

    int processed = 0;
    Signal* signal;

    /* Process all signals in queue */
    while ((signal = signal_queue_dequeue(queue)) != NULL) {
        /* Dispatch signal to handler */
        dispatch_invoke(table, signal);

        /* Free signal after processing */
        signal_free(signal);

        processed++;
    }

    return processed;
}

/*
 * Process up to N signals from queue
 *
 * Useful for fair scheduling when multiple agents need processing.
 *
 * @param table: Dispatch table
 * @param queue: Agent's input queue
 * @param max_signals: Maximum signals to process
 * @return: Number of signals actually processed
 */
int dispatch_process_batch(DispatchTable* table, SignalQueue* queue,
                           uint32_t max_signals) {
    if (table == NULL || queue == NULL) {
        return 0;
    }

    int processed = 0;
    Signal* signal;

    /* Process up to max_signals */
    while (processed < (int)max_signals &&
           (signal = signal_queue_dequeue(queue)) != NULL) {
        /* Dispatch signal to handler */
        dispatch_invoke(table, signal);

        /* Free signal after processing */
        signal_free(signal);

        processed++;
    }

    return processed;
}

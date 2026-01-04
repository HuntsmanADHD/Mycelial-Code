/*
 * Mycelial Signal Runtime - Header File
 * M2 Phase 1 Implementation
 *
 * This file defines the signal infrastructure for compiled Mycelial programs.
 * Based on M2_SIGNAL_RUNTIME_SPEC.md
 */

#ifndef MYCELIAL_SIGNAL_H
#define MYCELIAL_SIGNAL_H

#include <stdint.h>
#include <stddef.h>

/* =============================================================================
 * CONFIGURATION CONSTANTS
 * ============================================================================= */

#define SIGNAL_HEADER_SIZE      32
#define SIGNAL_QUEUE_CAPACITY   1024
#define MAX_PAYLOAD_SIZE        (64 * 1024)     /* 64KB max payload */
#define DEFAULT_HEAP_SIZE       (16 * 1024 * 1024)  /* 16MB default heap */
#define MAX_AGENTS              256
#define MAX_ROUTES              256

/* Signal flags */
#define SIGNAL_FLAG_OWNS_PAYLOAD    0x0001
#define SIGNAL_FLAG_HEAP_ALLOCATED  0x0002
#define SIGNAL_FLAG_PROCESSED       0x0004
#define SIGNAL_FLAG_BROADCAST       0x0008

/* Queue flags */
#define QUEUE_FLAG_ACTIVE           0x0001
#define QUEUE_FLAG_OVERFLOW         0x0002

/* Error codes */
#define SIGNAL_OK                   0
#define SIGNAL_ERR_QUEUE_FULL       1
#define SIGNAL_ERR_QUEUE_EMPTY      2
#define SIGNAL_ERR_NULL_POINTER     3
#define SIGNAL_ERR_ALLOC_FAILED     4
#define SIGNAL_ERR_PAYLOAD_TOO_LARGE 5
#define SIGNAL_ERR_NO_ROUTE         6

/* =============================================================================
 * SIGNAL STRUCTURE (32 bytes, cache-aligned)
 * ============================================================================= */

typedef struct Signal {
    uint16_t frequency_id;          /* 0x00: Signal type identifier */
    uint16_t source_agent_id;       /* 0x02: Sending agent ID */
    uint16_t flags;                 /* 0x04: Signal flags */
    uint16_t ref_count;             /* 0x06: Reference count for shared payloads */
    void*    payload_ptr;           /* 0x08: Pointer to payload data */
    uint32_t payload_size;          /* 0x10: Size of payload in bytes */
    uint32_t payload_capacity;      /* 0x14: Allocated capacity */
    uint64_t timestamp;             /* 0x18: CPU cycle counter (RDTSC) */
} Signal;

/* =============================================================================
 * SIGNAL QUEUE (Ring Buffer, 64 bytes)
 * ============================================================================= */

typedef struct SignalQueue {
    Signal** buffer;                /* 0x00: Ring buffer of signal pointers */
    uint32_t capacity;              /* 0x08: Max signals (power of 2) */
    uint32_t mask;                  /* 0x0C: capacity - 1 for fast modulo */
    uint32_t head;                  /* 0x10: Next to dequeue */
    uint32_t tail;                  /* 0x14: Next to enqueue */
    uint32_t count;                 /* 0x18: Currently queued */
    uint32_t total_enqueued;        /* 0x1C: Lifetime enqueue count */
    uint32_t total_dequeued;        /* 0x20: Lifetime dequeue count */
    uint32_t dropped_count;         /* 0x24: Signals dropped (overflow) */
    uint32_t owner_agent_id;        /* 0x28: Agent that owns this queue */
    uint32_t flags;                 /* 0x2C: Queue state flags */
    uint64_t reserved;              /* 0x30: Padding/future use */
} SignalQueue;

/* =============================================================================
 * ROUTING STRUCTURES
 * ============================================================================= */

typedef struct RoutingEntry {
    uint32_t source_agent_id;       /* Source agent */
    uint32_t frequency_id;          /* Signal frequency */
    uint32_t dest_count;            /* Number of destinations */
    uint32_t flags;                 /* Route flags */
    uint32_t* dest_agent_ids;       /* Array of destination agent IDs */
    SignalQueue** dest_queues;      /* Cached queue pointers for fast routing */
} RoutingEntry;

typedef struct RoutingTable {
    RoutingEntry* entries;          /* Hash table entries */
    uint32_t capacity;              /* Table size (power of 2) */
    uint32_t mask;                  /* capacity - 1 */
    uint32_t entry_count;           /* Active entries */
    uint32_t collision_count;       /* For performance stats */
} RoutingTable;

/* =============================================================================
 * HEAP STATE
 * ============================================================================= */

typedef struct HeapState {
    void*    base;                  /* Start of heap region */
    void*    current;               /* Current allocation point */
    void*    end;                   /* End of heap region */
    size_t   total_size;            /* Total heap size */
    size_t   used;                  /* Bytes currently allocated */
    size_t   peak_used;             /* Peak usage (watermark) */
    void*    free_list;             /* List of freed blocks for reuse */
} HeapState;

typedef struct FreeBlock {
    size_t size;                    /* Size of this free block */
    struct FreeBlock* next;         /* Next free block */
} FreeBlock;

/* =============================================================================
 * AGENT REGISTRY (for routing)
 * ============================================================================= */

typedef struct Agent {
    uint32_t agent_id;
    uint32_t agent_type;
    void* state_ptr;
    SignalQueue* input_queue;
    void* dispatch_table;
    uint32_t flags;
    uint32_t signal_count;
} Agent;

typedef struct AgentRegistry {
    Agent** agents;                 /* Array of agent pointers */
    uint32_t count;                 /* Number of agents */
    uint32_t capacity;              /* Max agents */
} AgentRegistry;

/* =============================================================================
 * MEMORY MANAGEMENT FUNCTIONS (memory.c)
 * ============================================================================= */

/* Initialize heap allocator (call once at startup)
 * Returns: 1 on success, 0 on failure */
int heap_init(size_t initial_size);

/* Allocate N bytes from heap
 * Returns: Pointer to allocated memory, or NULL on failure */
void* heap_allocate(size_t bytes);

/* Free previously allocated memory
 * Returns: 0 on success */
int heap_free(void* ptr, size_t bytes);

/* Get heap statistics */
size_t heap_get_used(void);
size_t heap_get_peak(void);
size_t heap_get_total(void);

/* =============================================================================
 * SIGNAL FUNCTIONS (signal.c)
 * ============================================================================= */

/* Allocate a signal struct (header only, no payload)
 * Returns: Pointer to signal, or NULL on failure */
Signal* signal_alloc(void);

/* Free a signal and its payload (if owned)
 * Decrements ref_count, frees when zero */
void signal_free(Signal* sig);

/* Increment reference count (for shared signals) */
void signal_ref(Signal* sig);

/* Create and populate a signal with payload
 * Copies payload data into new allocation
 * Returns: Pointer to signal, or NULL on failure */
Signal* signal_create(uint32_t frequency_id, uint32_t source_agent_id,
                      const void* payload, uint32_t payload_size);

/* Create signal queue with given capacity
 * Capacity must be power of 2
 * Returns: Pointer to queue, or NULL on failure */
SignalQueue* signal_queue_create(uint32_t capacity);

/* Destroy signal queue and free all signals in it */
void signal_queue_destroy(SignalQueue* queue);

/* Enqueue signal into queue
 * Increments signal ref_count
 * Returns: SIGNAL_OK on success, SIGNAL_ERR_QUEUE_FULL if full */
int signal_queue_enqueue(SignalQueue* queue, Signal* signal);

/* Dequeue signal from queue
 * Does NOT decrement ref_count (caller must call signal_free)
 * Returns: Signal pointer, or NULL if empty */
Signal* signal_queue_dequeue(SignalQueue* queue);

/* Peek at next signal without removing
 * Returns: Signal pointer, or NULL if empty */
Signal* signal_queue_peek(SignalQueue* queue);

/* Queue status functions */
uint32_t signal_queue_count(SignalQueue* queue);
uint32_t signal_queue_capacity(SignalQueue* queue);
int signal_queue_is_full(SignalQueue* queue);
int signal_queue_is_empty(SignalQueue* queue);

/* Get queue statistics */
uint32_t signal_queue_get_dropped(SignalQueue* queue);
uint32_t signal_queue_get_total_enqueued(SignalQueue* queue);
uint32_t signal_queue_get_total_dequeued(SignalQueue* queue);

/* Signal accessor functions */
void* signal_get_payload(Signal* sig);
uint32_t signal_get_payload_size(Signal* sig);
uint16_t signal_get_frequency(Signal* sig);
uint16_t signal_get_source(Signal* sig);
uint64_t signal_get_timestamp(Signal* sig);

/* Mark signal as processed (sets flag and decrements ref_count) */
void signal_mark_processed(Signal* sig);

/* =============================================================================
 * ROUTING FUNCTIONS (routing.c)
 * ============================================================================= */

/* Create routing table with given capacity
 * Capacity should be power of 2
 * Returns: Pointer to table, or NULL on failure */
RoutingTable* routing_table_create(uint32_t capacity);

/* Destroy routing table and free all entries */
void routing_table_destroy(RoutingTable* table);

/* Add a routing entry
 * Returns: SIGNAL_OK on success */
int routing_add_entry(RoutingTable* table, uint32_t source_agent_id,
                      uint32_t frequency_id, uint32_t dest_count,
                      const uint32_t* dest_agent_ids);

/* Lookup destinations for a signal
 * Returns: Array of destination agent IDs, count in out_count
 *          NULL if no route found */
uint32_t* routing_lookup(RoutingTable* table, uint32_t source_agent_id,
                         uint32_t frequency_id, uint32_t* out_count);

/* Route signal to all destinations
 * Enqueues signal into each destination agent's queue
 * Returns: Number of destinations reached */
int routing_broadcast(RoutingTable* table, Signal* signal,
                      AgentRegistry* agents);

/* Set cached queue pointers for fast routing
 * Call after all agents are created */
void routing_resolve_queues(RoutingTable* table, AgentRegistry* agents);

/* =============================================================================
 * AGENT REGISTRY FUNCTIONS
 * ============================================================================= */

/* Create agent registry
 * Returns: Pointer to registry, or NULL on failure */
AgentRegistry* agent_registry_create(uint32_t capacity);

/* Register an agent in the registry */
int agent_registry_add(AgentRegistry* registry, Agent* agent);

/* Get agent by ID
 * Returns: Agent pointer, or NULL if not found */
Agent* agent_registry_get(AgentRegistry* registry, uint32_t agent_id);

/* Get agent's input queue by ID */
SignalQueue* agent_get_queue(AgentRegistry* registry, uint32_t agent_id);

/* =============================================================================
 * CONVENIENCE FUNCTIONS
 * ============================================================================= */

/* Create and emit a signal (combines signal_create + routing_broadcast)
 * Returns: Number of destinations reached, or negative error code */
int emit_signal(RoutingTable* table, AgentRegistry* agents,
                uint32_t frequency_id, uint32_t source_agent_id,
                const void* payload, uint32_t payload_size);

/* =============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================= */

/* Get current CPU timestamp (RDTSC) */
static inline uint64_t get_timestamp(void) {
    uint32_t lo, hi;
    __asm__ __volatile__ ("rdtsc" : "=a" (lo), "=d" (hi));
    return ((uint64_t)hi << 32) | lo;
}

/* FNV-1a hash for routing table lookup */
static inline uint32_t fnv1a_hash(uint32_t agent_id, uint32_t freq_id) {
    uint32_t hash = 2166136261u;  /* FNV offset basis */
    hash ^= agent_id;
    hash *= 16777619u;            /* FNV prime */
    hash ^= freq_id;
    hash *= 16777619u;
    return hash;
}

/* Check if value is power of 2 */
static inline int is_power_of_two(uint32_t x) {
    return x && !(x & (x - 1));
}

/* Round up to next power of 2 */
static inline uint32_t next_power_of_two(uint32_t x) {
    x--;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    return x + 1;
}

#endif /* MYCELIAL_SIGNAL_H */

/*
 * Mycelial Signal Runtime - Routing Table
 * M2 Phase 1 Implementation
 *
 * Provides signal routing between agents.
 * Based on M2_SIGNAL_RUNTIME_SPEC.md and M2_TOPOLOGY_COMPILATION_SPEC.md
 */

#include "signal.h"
#include <string.h>

/* =============================================================================
 * ROUTING TABLE
 *
 * Design decisions:
 * - Hash table with FNV-1a hash for O(1) average lookup
 * - Linear probing for collision resolution
 * - Power-of-2 capacity for fast modulo
 * - Cache queue pointers for fast signal delivery
 * ============================================================================= */

/*
 * Create routing table
 *
 * @param capacity: Table size (will be rounded to power of 2)
 * @return: Pointer to table, or NULL on failure
 */
RoutingTable* routing_table_create(uint32_t capacity) {
    /* Ensure capacity is power of 2 */
    if (!is_power_of_two(capacity)) {
        capacity = next_power_of_two(capacity);
    }

    /* Allocate table struct */
    RoutingTable* table = heap_allocate(sizeof(RoutingTable));
    if (table == NULL) {
        return NULL;
    }

    /* Allocate entries array */
    size_t entries_size = capacity * sizeof(RoutingEntry);
    table->entries = heap_allocate(entries_size);
    if (table->entries == NULL) {
        heap_free(table, sizeof(RoutingTable));
        return NULL;
    }

    /* Initialize all entries to empty (source_agent_id = 0 means empty) */
    memset(table->entries, 0, entries_size);

    /* Initialize table fields */
    table->capacity = capacity;
    table->mask = capacity - 1;
    table->entry_count = 0;
    table->collision_count = 0;

    return table;
}

/*
 * Destroy routing table and free all entries
 *
 * @param table: Table to destroy
 */
void routing_table_destroy(RoutingTable* table) {
    if (table == NULL) {
        return;
    }

    /* Free destination arrays in each entry */
    for (uint32_t i = 0; i < table->capacity; i++) {
        RoutingEntry* entry = &table->entries[i];
        if (entry->source_agent_id != 0) {
            if (entry->dest_agent_ids != NULL) {
                heap_free(entry->dest_agent_ids,
                         entry->dest_count * sizeof(uint32_t));
            }
            if (entry->dest_queues != NULL) {
                heap_free(entry->dest_queues,
                         entry->dest_count * sizeof(SignalQueue*));
            }
        }
    }

    /* Free entries array */
    heap_free(table->entries, table->capacity * sizeof(RoutingEntry));

    /* Free table struct */
    heap_free(table, sizeof(RoutingTable));
}

/*
 * Find entry slot for (source_agent_id, frequency_id)
 *
 * Uses linear probing. Returns slot index.
 * If entry exists, returns its slot. Otherwise returns first empty slot.
 *
 * @param table: Routing table
 * @param source_agent_id: Source agent
 * @param frequency_id: Signal frequency
 * @param out_found: Set to 1 if existing entry found, 0 if empty slot
 * @return: Slot index
 */
static uint32_t find_slot(RoutingTable* table, uint32_t source_agent_id,
                          uint32_t frequency_id, int* out_found) {
    uint32_t hash = fnv1a_hash(source_agent_id, frequency_id);
    uint32_t index = hash & table->mask;
    uint32_t start = index;

    *out_found = 0;

    do {
        RoutingEntry* entry = &table->entries[index];

        /* Empty slot */
        if (entry->source_agent_id == 0) {
            return index;
        }

        /* Matching entry */
        if (entry->source_agent_id == source_agent_id &&
            entry->frequency_id == frequency_id) {
            *out_found = 1;
            return index;
        }

        /* Collision - try next slot */
        table->collision_count++;
        index = (index + 1) & table->mask;

    } while (index != start);

    /* Table full - return last checked index */
    return index;
}

/*
 * Add a routing entry
 *
 * If an entry for (source, frequency) already exists, it is updated.
 *
 * Performance: ~30-50 cycles (hash + probe + copy)
 *
 * @param table: Routing table
 * @param source_agent_id: Source agent ID
 * @param frequency_id: Signal frequency ID
 * @param dest_count: Number of destination agents
 * @param dest_agent_ids: Array of destination agent IDs
 * @return: SIGNAL_OK on success
 */
int routing_add_entry(RoutingTable* table, uint32_t source_agent_id,
                      uint32_t frequency_id, uint32_t dest_count,
                      const uint32_t* dest_agent_ids) {
    if (table == NULL || dest_agent_ids == NULL || dest_count == 0) {
        return SIGNAL_ERR_NULL_POINTER;
    }

    /* Check if table is full */
    if (table->entry_count >= table->capacity) {
        return SIGNAL_ERR_ALLOC_FAILED;
    }

    /* Find slot */
    int found;
    uint32_t index = find_slot(table, source_agent_id, frequency_id, &found);
    RoutingEntry* entry = &table->entries[index];

    /* If updating existing entry, free old arrays */
    if (found) {
        if (entry->dest_agent_ids != NULL) {
            heap_free(entry->dest_agent_ids,
                     entry->dest_count * sizeof(uint32_t));
        }
        if (entry->dest_queues != NULL) {
            heap_free(entry->dest_queues,
                     entry->dest_count * sizeof(SignalQueue*));
        }
    }

    /* Fill in entry fields */
    entry->source_agent_id = source_agent_id;
    entry->frequency_id = frequency_id;
    entry->dest_count = dest_count;
    entry->flags = 0;

    /* Allocate and copy destination IDs */
    size_t ids_size = dest_count * sizeof(uint32_t);
    entry->dest_agent_ids = heap_allocate(ids_size);
    if (entry->dest_agent_ids == NULL) {
        return SIGNAL_ERR_ALLOC_FAILED;
    }
    memcpy(entry->dest_agent_ids, dest_agent_ids, ids_size);

    /* Allocate queue pointer cache (will be resolved later) */
    entry->dest_queues = heap_allocate(dest_count * sizeof(SignalQueue*));
    if (entry->dest_queues == NULL) {
        heap_free(entry->dest_agent_ids, ids_size);
        entry->dest_agent_ids = NULL;
        return SIGNAL_ERR_ALLOC_FAILED;
    }
    memset(entry->dest_queues, 0, dest_count * sizeof(SignalQueue*));

    /* Increment count if new entry */
    if (!found) {
        table->entry_count++;
    }

    return SIGNAL_OK;
}

/*
 * Lookup destinations for a signal
 *
 * Performance: ~20-30 cycles (hash + probe)
 *
 * @param table: Routing table
 * @param source_agent_id: Source agent ID
 * @param frequency_id: Signal frequency ID
 * @param out_count: Output - number of destinations
 * @return: Array of destination agent IDs, or NULL if not found
 */
uint32_t* routing_lookup(RoutingTable* table, uint32_t source_agent_id,
                         uint32_t frequency_id, uint32_t* out_count) {
    if (table == NULL || out_count == NULL) {
        if (out_count) *out_count = 0;
        return NULL;
    }

    int found;
    uint32_t index = find_slot(table, source_agent_id, frequency_id, &found);

    if (!found) {
        *out_count = 0;
        return NULL;
    }

    RoutingEntry* entry = &table->entries[index];
    *out_count = entry->dest_count;
    return entry->dest_agent_ids;
}

/*
 * Get routing entry by source/frequency
 *
 * @param table: Routing table
 * @param source_agent_id: Source agent ID
 * @param frequency_id: Signal frequency ID
 * @return: Routing entry, or NULL if not found
 */
static RoutingEntry* routing_get_entry(RoutingTable* table,
                                       uint32_t source_agent_id,
                                       uint32_t frequency_id) {
    if (table == NULL) {
        return NULL;
    }

    int found;
    uint32_t index = find_slot(table, source_agent_id, frequency_id, &found);

    if (!found) {
        return NULL;
    }

    return &table->entries[index];
}

/*
 * Route signal to all destinations
 *
 * Uses cached queue pointers for fast delivery.
 * Falls back to agent registry lookup if cache not populated.
 *
 * Performance: ~50-100 cycles per destination
 *
 * @param table: Routing table
 * @param signal: Signal to route
 * @param agents: Agent registry (for queue lookup)
 * @return: Number of destinations reached
 */
int routing_broadcast(RoutingTable* table, Signal* signal,
                      AgentRegistry* agents) {
    if (table == NULL || signal == NULL) {
        return 0;
    }

    /* Get routing entry */
    RoutingEntry* entry = routing_get_entry(table,
                                            signal->source_agent_id,
                                            signal->frequency_id);
    if (entry == NULL) {
        return 0;  /* No route for this signal */
    }

    int delivered = 0;

    /* Enqueue signal to each destination */
    for (uint32_t i = 0; i < entry->dest_count; i++) {
        SignalQueue* queue = entry->dest_queues[i];

        /* If queue not cached, look it up */
        if (queue == NULL && agents != NULL) {
            queue = agent_get_queue(agents, entry->dest_agent_ids[i]);
            entry->dest_queues[i] = queue;  /* Cache for next time */
        }

        if (queue != NULL) {
            int result = signal_queue_enqueue(queue, signal);
            if (result == SIGNAL_OK) {
                delivered++;
            }
        }
    }

    /* Set broadcast flag if multiple destinations */
    if (entry->dest_count > 1) {
        signal->flags |= SIGNAL_FLAG_BROADCAST;
    }

    return delivered;
}

/*
 * Resolve cached queue pointers for all routes
 *
 * Call this after all agents have been created.
 * Caches queue pointers for fast routing.
 *
 * @param table: Routing table
 * @param agents: Agent registry
 */
void routing_resolve_queues(RoutingTable* table, AgentRegistry* agents) {
    if (table == NULL || agents == NULL) {
        return;
    }

    for (uint32_t i = 0; i < table->capacity; i++) {
        RoutingEntry* entry = &table->entries[i];

        if (entry->source_agent_id == 0) {
            continue;  /* Empty slot */
        }

        for (uint32_t j = 0; j < entry->dest_count; j++) {
            entry->dest_queues[j] = agent_get_queue(agents,
                                                    entry->dest_agent_ids[j]);
        }
    }
}

/* =============================================================================
 * AGENT REGISTRY
 *
 * Simple array-based registry for agent lookup by ID.
 * ============================================================================= */

/*
 * Create agent registry
 *
 * @param capacity: Maximum number of agents
 * @return: Pointer to registry, or NULL on failure
 */
AgentRegistry* agent_registry_create(uint32_t capacity) {
    AgentRegistry* registry = heap_allocate(sizeof(AgentRegistry));
    if (registry == NULL) {
        return NULL;
    }

    registry->agents = heap_allocate(capacity * sizeof(Agent*));
    if (registry->agents == NULL) {
        heap_free(registry, sizeof(AgentRegistry));
        return NULL;
    }

    memset(registry->agents, 0, capacity * sizeof(Agent*));

    registry->count = 0;
    registry->capacity = capacity;

    return registry;
}

/*
 * Register an agent in the registry
 *
 * @param registry: Agent registry
 * @param agent: Agent to register
 * @return: SIGNAL_OK on success
 */
int agent_registry_add(AgentRegistry* registry, Agent* agent) {
    if (registry == NULL || agent == NULL) {
        return SIGNAL_ERR_NULL_POINTER;
    }

    if (agent->agent_id >= registry->capacity) {
        return SIGNAL_ERR_ALLOC_FAILED;
    }

    registry->agents[agent->agent_id] = agent;

    if (agent->agent_id >= registry->count) {
        registry->count = agent->agent_id + 1;
    }

    return SIGNAL_OK;
}

/*
 * Get agent by ID
 *
 * @param registry: Agent registry
 * @param agent_id: ID of agent to find
 * @return: Agent pointer, or NULL if not found
 */
Agent* agent_registry_get(AgentRegistry* registry, uint32_t agent_id) {
    if (registry == NULL || agent_id >= registry->capacity) {
        return NULL;
    }

    return registry->agents[agent_id];
}

/*
 * Get agent's input queue by ID
 *
 * @param registry: Agent registry
 * @param agent_id: ID of agent
 * @return: Queue pointer, or NULL if not found
 */
SignalQueue* agent_get_queue(AgentRegistry* registry, uint32_t agent_id) {
    Agent* agent = agent_registry_get(registry, agent_id);
    if (agent == NULL) {
        return NULL;
    }
    return agent->input_queue;
}

/* =============================================================================
 * CONVENIENCE FUNCTIONS
 * ============================================================================= */

/*
 * Create and emit a signal
 *
 * Combines signal_create + routing_broadcast.
 *
 * @param table: Routing table
 * @param agents: Agent registry
 * @param frequency_id: Signal type
 * @param source_agent_id: Sending agent
 * @param payload: Payload data
 * @param payload_size: Payload size
 * @return: Number of destinations reached, or negative error code
 */
int emit_signal(RoutingTable* table, AgentRegistry* agents,
                uint32_t frequency_id, uint32_t source_agent_id,
                const void* payload, uint32_t payload_size) {

    /* Create signal */
    Signal* sig = signal_create(frequency_id, source_agent_id,
                                payload, payload_size);
    if (sig == NULL) {
        return -SIGNAL_ERR_ALLOC_FAILED;
    }

    /* Route to destinations */
    int delivered = routing_broadcast(table, sig, agents);

    /* If no destinations, free the signal */
    if (delivered == 0) {
        signal_free(sig);
        return 0;
    }

    /* Signal ownership transferred to queues via ref_count */
    /* Decrement our reference */
    signal_free(sig);

    return delivered;
}

/*
 * Mycelial Signal Runtime - Agent Registry & Topology Implementation
 * M2 Phase 4 Implementation
 *
 * Provides enhanced agent registration and network topology initialization.
 * Based on M2_TOPOLOGY_COMPILATION_SPEC.md
 */

#include "signal.h"
#include "dispatch.h"
#include "agents.h"
#include <string.h>
#include <stdio.h>

/* =============================================================================
 * STRING UTILITIES
 * ============================================================================= */

/*
 * Simple string copy with length limit
 */
static char* str_copy(const char* src) {
    if (src == NULL) {
        return NULL;
    }

    size_t len = 0;
    while (src[len] != '\0' && len < 255) {
        len++;
    }

    char* dest = heap_allocate(len + 1);
    if (dest == NULL) {
        return NULL;
    }

    for (size_t i = 0; i < len; i++) {
        dest[i] = src[i];
    }
    dest[len] = '\0';

    return dest;
}

/*
 * Simple string comparison
 */
static int str_equal(const char* a, const char* b) {
    if (a == NULL || b == NULL) {
        return a == b;
    }

    while (*a && *b && *a == *b) {
        a++;
        b++;
    }

    return *a == *b;
}

/*
 * Simple string hash (FNV-1a)
 */
static uint32_t str_hash(const char* str) {
    if (str == NULL) {
        return 0;
    }

    uint32_t hash = 2166136261u;
    while (*str) {
        hash ^= (uint8_t)*str++;
        hash *= 16777619u;
    }
    return hash;
}

/* =============================================================================
 * AGENT REGISTRY CREATION
 * ============================================================================= */

/*
 * Create a new agent registry
 *
 * @param capacity: Maximum number of agents
 * @return: Pointer to registry, or NULL on failure
 */
AgentRegistry2* registry_create(uint32_t capacity) {
    if (capacity == 0) {
        capacity = 64;  /* Default capacity */
    }

    /* Allocate registry struct */
    AgentRegistry2* registry = heap_allocate(sizeof(AgentRegistry2));
    if (registry == NULL) {
        return NULL;
    }

    /* Allocate agent info array */
    registry->agents = heap_allocate(capacity * sizeof(AgentInfo));
    if (registry->agents == NULL) {
        heap_free(registry, sizeof(AgentRegistry2));
        return NULL;
    }
    memset(registry->agents, 0, capacity * sizeof(AgentInfo));

    /* Allocate name lookup table */
    registry->agent_names = heap_allocate(capacity * sizeof(char*));
    if (registry->agent_names == NULL) {
        heap_free(registry->agents, capacity * sizeof(AgentInfo));
        heap_free(registry, sizeof(AgentRegistry2));
        return NULL;
    }
    memset(registry->agent_names, 0, capacity * sizeof(char*));

    /* Initialize fields */
    registry->agent_count = 0;
    registry->capacity = capacity;
    registry->name_to_id = NULL;  /* Optional - can add later for faster lookup */
    registry->name_table_size = 0;
    registry->routing = NULL;
    registry->flags = 0;
    registry->total_signals = 0;

    return registry;
}

/*
 * Destroy registry and free all resources
 */
void registry_destroy(AgentRegistry2* registry) {
    if (registry == NULL) {
        return;
    }

    /* Free each agent's resources */
    for (uint32_t i = 0; i < registry->capacity; i++) {
        AgentInfo* agent = &registry->agents[i];

        if (agent->flags & AGENT_FLAG_ACTIVE) {
            /* Free agent name */
            if (agent->name != NULL) {
                size_t len = 0;
                while (agent->name[len]) len++;
                heap_free((void*)agent->name, len + 1);
            }

            /* Free agent state */
            if (agent->state != NULL && agent->state_size > 0) {
                heap_free(agent->state, agent->state_size);
            }

            /* Destroy queue */
            if (agent->queue != NULL) {
                signal_queue_destroy(agent->queue);
            }

            /* Destroy dispatch table */
            if (agent->dispatch != NULL) {
                dispatch_table_destroy(agent->dispatch);
            }
        }
    }

    /* Free routing table */
    if (registry->routing != NULL) {
        routing_table_destroy(registry->routing);
    }

    /* Free name lookup table */
    if (registry->agent_names != NULL) {
        heap_free(registry->agent_names, registry->capacity * sizeof(char*));
    }

    /* Free agents array */
    heap_free(registry->agents, registry->capacity * sizeof(AgentInfo));

    /* Free registry struct */
    heap_free(registry, sizeof(AgentRegistry2));
}

/* =============================================================================
 * AGENT REGISTRATION
 * ============================================================================= */

/*
 * Register an agent in the registry
 */
int registry_register(AgentRegistry2* registry, uint32_t agent_id,
                      const char* name, void* state, size_t state_size,
                      SignalQueue* queue, DispatchTable* dispatch) {
    if (registry == NULL) {
        return TOPOLOGY_ERR_NULL_POINTER;
    }

    if (agent_id == 0 || agent_id > registry->capacity) {
        return TOPOLOGY_ERR_CAPACITY;
    }

    /* Check if agent already exists */
    AgentInfo* agent = &registry->agents[agent_id - 1];  /* 1-indexed to 0-indexed */
    if (agent->flags & AGENT_FLAG_ACTIVE) {
        return TOPOLOGY_ERR_AGENT_EXISTS;
    }

    /* Copy agent name */
    char* name_copy = str_copy(name);
    if (name != NULL && name_copy == NULL) {
        return TOPOLOGY_ERR_ALLOC_FAILED;
    }

    /* Fill in agent info */
    agent->agent_id = agent_id;
    agent->agent_type = 0;
    agent->name = name_copy;
    agent->state = state;
    agent->state_size = state_size;
    agent->queue = queue;
    agent->dispatch = dispatch;
    agent->flags = AGENT_FLAG_ACTIVE;
    agent->signal_count = 0;
    agent->queue_capacity = (queue != NULL) ? signal_queue_capacity(queue) : 0;

    if (state != NULL) {
        agent->flags |= AGENT_FLAG_INITIALIZED;
    }

    if (dispatch != NULL) {
        agent->flags |= AGENT_FLAG_HAS_HANDLERS;
    }

    /* Update name lookup table */
    if (agent_id <= registry->capacity && registry->agent_names != NULL) {
        registry->agent_names[agent_id - 1] = agent->name;
    }

    /* Update count */
    if (agent_id > registry->agent_count) {
        registry->agent_count = agent_id;
    }

    return TOPOLOGY_OK;
}

/* =============================================================================
 * AGENT LOOKUP
 * ============================================================================= */

/*
 * Get agent info by ID
 */
AgentInfo* registry_get_agent(AgentRegistry2* registry, uint32_t agent_id) {
    if (registry == NULL || agent_id == 0 || agent_id > registry->capacity) {
        return NULL;
    }

    AgentInfo* agent = &registry->agents[agent_id - 1];
    if (!(agent->flags & AGENT_FLAG_ACTIVE)) {
        return NULL;
    }

    return agent;
}

/*
 * Get agent by name
 */
AgentInfo* registry_get_agent_by_name(AgentRegistry2* registry, const char* name) {
    if (registry == NULL || name == NULL) {
        return NULL;
    }

    /* Linear search through agents */
    for (uint32_t i = 0; i < registry->capacity; i++) {
        AgentInfo* agent = &registry->agents[i];
        if ((agent->flags & AGENT_FLAG_ACTIVE) && str_equal(agent->name, name)) {
            return agent;
        }
    }

    return NULL;
}

/*
 * Get agent's signal queue
 */
SignalQueue* registry_get_queue(AgentRegistry2* registry, uint32_t agent_id) {
    AgentInfo* agent = registry_get_agent(registry, agent_id);
    return (agent != NULL) ? agent->queue : NULL;
}

/*
 * Get agent's dispatch table
 */
DispatchTable* registry_get_dispatch(AgentRegistry2* registry, uint32_t agent_id) {
    AgentInfo* agent = registry_get_agent(registry, agent_id);
    return (agent != NULL) ? agent->dispatch : NULL;
}

/*
 * Get number of registered agents
 */
uint32_t registry_get_count(AgentRegistry2* registry) {
    return (registry != NULL) ? registry->agent_count : 0;
}

/*
 * Get agent name by ID
 */
const char* registry_get_name(AgentRegistry2* registry, uint32_t agent_id) {
    AgentInfo* agent = registry_get_agent(registry, agent_id);
    return (agent != NULL) ? agent->name : NULL;
}

/* =============================================================================
 * FREQUENCY REGISTRY
 * ============================================================================= */

FrequencyRegistry* frequency_registry_create(uint32_t capacity) {
    if (capacity == 0) {
        capacity = 64;
    }

    FrequencyRegistry* registry = heap_allocate(sizeof(FrequencyRegistry));
    if (registry == NULL) {
        return NULL;
    }

    registry->frequencies = heap_allocate(capacity * sizeof(FrequencyInfo));
    if (registry->frequencies == NULL) {
        heap_free(registry, sizeof(FrequencyRegistry));
        return NULL;
    }
    memset(registry->frequencies, 0, capacity * sizeof(FrequencyInfo));

    registry->frequency_count = 0;
    registry->capacity = capacity;

    return registry;
}

int frequency_register(FrequencyRegistry* registry, uint32_t frequency_id,
                       const char* name, uint32_t payload_size) {
    if (registry == NULL || frequency_id == 0) {
        return TOPOLOGY_ERR_NULL_POINTER;
    }

    if (frequency_id > registry->capacity) {
        return TOPOLOGY_ERR_CAPACITY;
    }

    FrequencyInfo* freq = &registry->frequencies[frequency_id - 1];
    freq->frequency_id = frequency_id;
    freq->name = str_copy(name);
    freq->payload_size = payload_size;
    freq->flags = 0;

    if (frequency_id > registry->frequency_count) {
        registry->frequency_count = frequency_id;
    }

    return TOPOLOGY_OK;
}

FrequencyInfo* frequency_get(FrequencyRegistry* registry, uint32_t frequency_id) {
    if (registry == NULL || frequency_id == 0 || frequency_id > registry->capacity) {
        return NULL;
    }
    return &registry->frequencies[frequency_id - 1];
}

FrequencyInfo* frequency_get_by_name(FrequencyRegistry* registry, const char* name) {
    if (registry == NULL || name == NULL) {
        return NULL;
    }

    for (uint32_t i = 0; i < registry->frequency_count; i++) {
        if (str_equal(registry->frequencies[i].name, name)) {
            return &registry->frequencies[i];
        }
    }

    return NULL;
}

/* =============================================================================
 * TOPOLOGY INITIALIZATION
 * ============================================================================= */

/*
 * Allocate and zero-initialize agent state
 */
void* agent_state_alloc(size_t state_size) {
    if (state_size == 0) {
        return NULL;
    }
    return heap_allocate(state_size);  /* Already zeroed by heap_allocate */
}

/*
 * Free agent state
 */
void agent_state_free(void* state, size_t state_size) {
    if (state != NULL && state_size > 0) {
        heap_free(state, state_size);
    }
}

/*
 * Initialize a single agent
 */
int topology_init_agent(AgentRegistry2* registry, AgentInfo* info) {
    if (registry == NULL || info == NULL) {
        return TOPOLOGY_ERR_NULL_POINTER;
    }

    /* Allocate state if size specified but state is NULL */
    void* state = info->state;
    if (state == NULL && info->state_size > 0) {
        state = agent_state_alloc(info->state_size);
        if (state == NULL) {
            return TOPOLOGY_ERR_ALLOC_FAILED;
        }
    }

    /* Create signal queue if not provided */
    SignalQueue* queue = info->queue;
    if (queue == NULL) {
        uint32_t capacity = info->queue_capacity;
        if (capacity == 0) {
            capacity = 256;  /* Default queue size */
        }
        queue = signal_queue_create(capacity);
        if (queue == NULL) {
            if (state != NULL && info->state == NULL) {
                agent_state_free(state, info->state_size);
            }
            return TOPOLOGY_ERR_ALLOC_FAILED;
        }
    }

    /* Create dispatch table if not provided */
    DispatchTable* dispatch = info->dispatch;
    if (dispatch == NULL) {
        dispatch = dispatch_table_create(16, info->agent_id);
        if (dispatch == NULL) {
            if (info->queue == NULL) {
                signal_queue_destroy(queue);
            }
            if (state != NULL && info->state == NULL) {
                agent_state_free(state, info->state_size);
            }
            return TOPOLOGY_ERR_ALLOC_FAILED;
        }
        dispatch_set_state(dispatch, state);
    }

    /* Register agent */
    int result = registry_register(registry, info->agent_id, info->name,
                                   state, info->state_size, queue, dispatch);
    if (result != TOPOLOGY_OK) {
        if (info->dispatch == NULL) {
            dispatch_table_destroy(dispatch);
        }
        if (info->queue == NULL) {
            signal_queue_destroy(queue);
        }
        if (state != NULL && info->state == NULL) {
            agent_state_free(state, info->state_size);
        }
        return result;
    }

    return TOPOLOGY_OK;
}

/*
 * Build routing tables from socket definitions
 */
int topology_build_routes(AgentRegistry2* registry, SocketDef* sockets,
                          uint32_t socket_count) {
    if (registry == NULL) {
        return TOPOLOGY_ERR_NULL_POINTER;
    }

    /* Create routing table if not exists */
    if (registry->routing == NULL) {
        registry->routing = routing_table_create(socket_count * 2);
        if (registry->routing == NULL) {
            return TOPOLOGY_ERR_ALLOC_FAILED;
        }
    }

    /* Add each socket as a routing entry */
    for (uint32_t i = 0; i < socket_count; i++) {
        SocketDef* socket = &sockets[i];

        /* Validate agents exist */
        if (registry_get_agent(registry, socket->source_agent_id) == NULL) {
            return TOPOLOGY_ERR_AGENT_NOT_FOUND;
        }
        if (registry_get_agent(registry, socket->dest_agent_id) == NULL) {
            return TOPOLOGY_ERR_AGENT_NOT_FOUND;
        }

        /* Add routing entry */
        uint32_t dest_ids[1] = { socket->dest_agent_id };
        int result = routing_add_entry(registry->routing,
                                       socket->source_agent_id,
                                       socket->frequency_id,
                                       1, dest_ids);
        if (result != SIGNAL_OK) {
            return TOPOLOGY_ERR_ALLOC_FAILED;
        }
    }

    return TOPOLOGY_OK;
}

/*
 * Resolve all queue pointers in routing table
 */
void topology_resolve_routes(AgentRegistry2* registry) {
    if (registry == NULL || registry->routing == NULL) {
        return;
    }

    /* Build a temporary AgentRegistry (old format) for routing_resolve_queues */
    AgentRegistry temp_registry;
    Agent* temp_agents[256];  /* Stack-allocated for simplicity */
    Agent agent_wrappers[256];

    temp_registry.agents = temp_agents;
    temp_registry.count = registry->agent_count;
    temp_registry.capacity = 256;

    memset(temp_agents, 0, sizeof(temp_agents));

    /* Create wrapper agents for each registered agent */
    for (uint32_t i = 0; i < registry->capacity && i < 256; i++) {
        AgentInfo* info = &registry->agents[i];
        if (info->flags & AGENT_FLAG_ACTIVE) {
            agent_wrappers[info->agent_id] = (Agent){
                .agent_id = info->agent_id,
                .agent_type = info->agent_type,
                .state_ptr = info->state,
                .input_queue = info->queue,
                .dispatch_table = info->dispatch,
                .flags = info->flags,
                .signal_count = info->signal_count
            };
            temp_agents[info->agent_id] = &agent_wrappers[info->agent_id];
        }
    }

    routing_resolve_queues(registry->routing, &temp_registry);
}

/*
 * Initialize network from topology definition
 */
AgentRegistry2* topology_init(NetworkTopology* topology) {
    if (topology == NULL || topology->agent_count == 0) {
        return NULL;
    }

    /* Create registry */
    AgentRegistry2* registry = registry_create(topology->agent_count + 1);
    if (registry == NULL) {
        return NULL;
    }

    /* Initialize each agent */
    for (uint32_t i = 0; i < topology->agent_count; i++) {
        int result = topology_init_agent(registry, &topology->agents[i]);
        if (result != TOPOLOGY_OK) {
            registry_destroy(registry);
            return NULL;
        }
    }

    /* Build routing tables */
    if (topology->socket_count > 0) {
        int result = topology_build_routes(registry, topology->sockets,
                                           topology->socket_count);
        if (result != TOPOLOGY_OK) {
            registry_destroy(registry);
            return NULL;
        }

        /* Resolve queue pointers */
        topology_resolve_routes(registry);
    }

    return registry;
}

/*
 * Shutdown and cleanup network
 */
void topology_shutdown(AgentRegistry2* registry) {
    registry_destroy(registry);
}

/* =============================================================================
 * DEBUG FUNCTIONS
 * ============================================================================= */

void registry_print(AgentRegistry2* registry) {
    if (registry == NULL) {
        printf("Registry: NULL\n");
        return;
    }

    printf("Agent Registry (%u agents, capacity %u):\n",
           registry->agent_count, registry->capacity);

    for (uint32_t i = 0; i < registry->capacity; i++) {
        AgentInfo* agent = &registry->agents[i];
        if (agent->flags & AGENT_FLAG_ACTIVE) {
            printf("  Agent %u: name='%s', state=%p, queue=%p, dispatch=%p\n",
                   agent->agent_id,
                   agent->name ? agent->name : "(null)",
                   agent->state,
                   (void*)agent->queue,
                   (void*)agent->dispatch);
        }
    }
}

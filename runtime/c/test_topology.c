/*
 * Mycelial Signal Runtime - Topology Test Program
 * M2 Phase 4 Implementation Tests
 *
 * Tests for agent registry, topology initialization, and routing setup.
 */

#include "signal.h"
#include "dispatch.h"
#include "agents.h"
#include <stdio.h>
#include <string.h>

/* =============================================================================
 * TEST STRUCTURES
 * ============================================================================= */

/* Simulated agent states */
typedef struct {
    uint32_t ready;
    uint32_t data_sent;
} SourceState;

typedef struct {
    uint32_t received;
    uint32_t last_value;
} SinkState;

/* Test frequency IDs */
#define FREQ_INIT       1
#define FREQ_DATA       2
#define FREQ_ACK        3

/* Test agent IDs */
#define AGENT_SOURCE    1
#define AGENT_SINK      2

/* =============================================================================
 * TEST HANDLERS
 * ============================================================================= */

/*
 * Handler: on signal(init, _) { state.ready = 1; emit data { value: 100 } }
 */
int handle_init(void* agent_state, Signal* signal) {
    SourceState* state = (SourceState*)agent_state;
    (void)signal;

    state->ready = 1;
    state->data_sent = 100;

    return 0;
}

/*
 * Handler: on signal(data, d) { state.received = d.value }
 */
int handle_data(void* agent_state, Signal* signal) {
    SinkState* state = (SinkState*)agent_state;
    uint32_t* payload = (uint32_t*)signal_get_payload(signal);

    if (payload != NULL) {
        state->received = 1;
        state->last_value = *payload;
    }

    return 0;
}

/* =============================================================================
 * TESTS
 * ============================================================================= */

int test_registry_create(void) {
    printf("\n=== Test: Registry Create ===\n");

    AgentRegistry2* registry = registry_create(16);
    if (registry == NULL) {
        printf("FAIL: registry_create returned NULL\n");
        return 1;
    }
    printf("PASS: Created registry with capacity 16\n");

    if (registry_get_count(registry) != 0) {
        printf("FAIL: New registry should have 0 agents\n");
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Registry has 0 agents\n");

    registry_destroy(registry);
    printf("PASS: Registry create test\n");
    return 0;
}

int test_agent_registration(void) {
    printf("\n=== Test: Agent Registration ===\n");

    AgentRegistry2* registry = registry_create(16);

    /* Register source agent */
    SourceState* source_state = (SourceState*)agent_state_alloc(sizeof(SourceState));
    SignalQueue* source_queue = signal_queue_create(64);
    DispatchTable* source_dispatch = dispatch_table_create(16, AGENT_SOURCE);

    int result = registry_register(registry, AGENT_SOURCE, "source",
                                   source_state, sizeof(SourceState),
                                   source_queue, source_dispatch);
    if (result != TOPOLOGY_OK) {
        printf("FAIL: registry_register failed with code %d\n", result);
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Registered source agent\n");

    /* Register sink agent */
    SinkState* sink_state = (SinkState*)agent_state_alloc(sizeof(SinkState));
    SignalQueue* sink_queue = signal_queue_create(64);
    DispatchTable* sink_dispatch = dispatch_table_create(16, AGENT_SINK);

    result = registry_register(registry, AGENT_SINK, "sink",
                               sink_state, sizeof(SinkState),
                               sink_queue, sink_dispatch);
    if (result != TOPOLOGY_OK) {
        printf("FAIL: registry_register failed with code %d\n", result);
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Registered sink agent\n");

    /* Verify count */
    if (registry_get_count(registry) != 2) {
        printf("FAIL: Expected 2 agents, got %u\n", registry_get_count(registry));
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Registry has 2 agents\n");

    registry_destroy(registry);
    printf("PASS: Agent registration test\n");
    return 0;
}

int test_agent_lookup(void) {
    printf("\n=== Test: Agent Lookup ===\n");

    AgentRegistry2* registry = registry_create(16);

    /* Register agents */
    registry_register(registry, AGENT_SOURCE, "source",
                      agent_state_alloc(sizeof(SourceState)), sizeof(SourceState),
                      signal_queue_create(64), dispatch_table_create(16, AGENT_SOURCE));

    registry_register(registry, AGENT_SINK, "sink",
                      agent_state_alloc(sizeof(SinkState)), sizeof(SinkState),
                      signal_queue_create(64), dispatch_table_create(16, AGENT_SINK));

    /* Lookup by ID */
    AgentInfo* source = registry_get_agent(registry, AGENT_SOURCE);
    if (source == NULL) {
        printf("FAIL: Could not find source agent by ID\n");
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Found source agent by ID\n");

    if (source->agent_id != AGENT_SOURCE) {
        printf("FAIL: Wrong agent ID\n");
        registry_destroy(registry);
        return 1;
    }

    /* Lookup by name */
    AgentInfo* sink = registry_get_agent_by_name(registry, "sink");
    if (sink == NULL) {
        printf("FAIL: Could not find sink agent by name\n");
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Found sink agent by name\n");

    /* Get queue */
    SignalQueue* queue = registry_get_queue(registry, AGENT_SOURCE);
    if (queue == NULL) {
        printf("FAIL: Could not get source queue\n");
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Got source queue\n");

    /* Get dispatch */
    DispatchTable* dispatch = registry_get_dispatch(registry, AGENT_SINK);
    if (dispatch == NULL) {
        printf("FAIL: Could not get sink dispatch table\n");
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Got sink dispatch table\n");

    /* Lookup non-existent */
    if (registry_get_agent(registry, 99) != NULL) {
        printf("FAIL: Should not find non-existent agent\n");
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Non-existent agent returns NULL\n");

    registry_destroy(registry);
    printf("PASS: Agent lookup test\n");
    return 0;
}

int test_topology_init(void) {
    printf("\n=== Test: Topology Init ===\n");

    /* Define network topology */
    AgentInfo agents[2] = {
        {
            .agent_id = AGENT_SOURCE,
            .name = "source",
            .state_size = sizeof(SourceState),
            .queue_capacity = 64
        },
        {
            .agent_id = AGENT_SINK,
            .name = "sink",
            .state_size = sizeof(SinkState),
            .queue_capacity = 64
        }
    };

    SocketDef sockets[1] = {
        {
            .source_agent_id = AGENT_SOURCE,
            .frequency_id = FREQ_DATA,
            .dest_agent_id = AGENT_SINK
        }
    };

    NetworkTopology topology = {
        .agents = agents,
        .agent_count = 2,
        .sockets = sockets,
        .socket_count = 1,
        .network_name = "test_network"
    };

    /* Initialize network */
    AgentRegistry2* registry = topology_init(&topology);
    if (registry == NULL) {
        printf("FAIL: topology_init returned NULL\n");
        return 1;
    }
    printf("PASS: Initialized network topology\n");

    /* Verify agents */
    if (registry_get_count(registry) != 2) {
        printf("FAIL: Expected 2 agents\n");
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: Network has 2 agents\n");

    /* Verify state allocated */
    AgentInfo* source = registry_get_agent(registry, AGENT_SOURCE);
    if (source == NULL || source->state == NULL) {
        printf("FAIL: Source state not allocated\n");
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: Source state allocated at %p\n", source->state);

    /* Verify queue created */
    if (source->queue == NULL) {
        printf("FAIL: Source queue not created\n");
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: Source queue created\n");

    /* Verify dispatch created */
    if (source->dispatch == NULL) {
        printf("FAIL: Source dispatch not created\n");
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: Source dispatch created\n");

    /* Verify routing table */
    if (registry->routing == NULL) {
        printf("FAIL: Routing table not created\n");
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: Routing table created\n");

    topology_shutdown(registry);
    printf("PASS: Topology init test\n");
    return 0;
}

int test_routing_setup(void) {
    printf("\n=== Test: Routing Setup ===\n");

    /* Create registry manually */
    AgentRegistry2* registry = registry_create(16);

    /* Register agents */
    SourceState* source_state = (SourceState*)agent_state_alloc(sizeof(SourceState));
    SinkState* sink_state = (SinkState*)agent_state_alloc(sizeof(SinkState));

    registry_register(registry, AGENT_SOURCE, "source",
                      source_state, sizeof(SourceState),
                      signal_queue_create(64), dispatch_table_create(16, AGENT_SOURCE));

    registry_register(registry, AGENT_SINK, "sink",
                      sink_state, sizeof(SinkState),
                      signal_queue_create(64), dispatch_table_create(16, AGENT_SINK));

    /* Build routes */
    SocketDef sockets[1] = {
        { AGENT_SOURCE, FREQ_DATA, AGENT_SINK, 0 }
    };

    int result = topology_build_routes(registry, sockets, 1);
    if (result != TOPOLOGY_OK) {
        printf("FAIL: topology_build_routes failed with code %d\n", result);
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Built routing table\n");

    /* Resolve routes */
    topology_resolve_routes(registry);
    printf("PASS: Resolved route queue pointers\n");

    /* Verify routing works - create signal and route it */
    uint32_t value = 42;
    Signal* sig = signal_create(FREQ_DATA, AGENT_SOURCE, &value, sizeof(value));
    if (sig == NULL) {
        printf("FAIL: Could not create signal\n");
        registry_destroy(registry);
        return 1;
    }

    /* Use existing routing system */
    AgentRegistry old_registry;
    Agent source_agent = {
        .agent_id = AGENT_SOURCE,
        .input_queue = registry_get_queue(registry, AGENT_SOURCE)
    };
    Agent sink_agent = {
        .agent_id = AGENT_SINK,
        .input_queue = registry_get_queue(registry, AGENT_SINK)
    };
    Agent* agent_ptrs[3] = { NULL, &source_agent, &sink_agent };
    old_registry.agents = agent_ptrs;
    old_registry.count = 3;
    old_registry.capacity = 3;

    int delivered = routing_broadcast(registry->routing, sig, &old_registry);
    signal_free(sig);

    if (delivered != 1) {
        printf("FAIL: Expected 1 delivery, got %d\n", delivered);
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Signal routed to 1 destination\n");

    /* Verify signal in sink queue */
    SignalQueue* sink_queue = registry_get_queue(registry, AGENT_SINK);
    if (signal_queue_is_empty(sink_queue)) {
        printf("FAIL: Sink queue is empty\n");
        registry_destroy(registry);
        return 1;
    }

    Signal* received = signal_queue_dequeue(sink_queue);
    if (received == NULL) {
        printf("FAIL: Could not dequeue signal\n");
        registry_destroy(registry);
        return 1;
    }

    uint32_t* recv_value = (uint32_t*)signal_get_payload(received);
    if (*recv_value != 42) {
        printf("FAIL: Expected value 42, got %u\n", *recv_value);
        signal_free(received);
        registry_destroy(registry);
        return 1;
    }
    printf("PASS: Received correct value: %u\n", *recv_value);

    signal_free(received);
    registry_destroy(registry);
    printf("PASS: Routing setup test\n");
    return 0;
}

int test_end_to_end(void) {
    printf("\n=== Test: End-to-End Signal Flow ===\n");

    /*
     * Simulate the test from the spec:
     * source emits data { value: 100 }
     * sink receives and processes it
     * Verify sink.received == 100
     */

    /* Create network */
    AgentInfo agents[2] = {
        { .agent_id = 1, .name = "source", .state_size = sizeof(SourceState), .queue_capacity = 64 },
        { .agent_id = 2, .name = "sink", .state_size = sizeof(SinkState), .queue_capacity = 64 }
    };

    SocketDef sockets[1] = {
        { .source_agent_id = 1, .frequency_id = FREQ_DATA, .dest_agent_id = 2 }
    };

    NetworkTopology topology = {
        .agents = agents,
        .agent_count = 2,
        .sockets = sockets,
        .socket_count = 1
    };

    AgentRegistry2* registry = topology_init(&topology);
    if (registry == NULL) {
        printf("FAIL: Could not initialize network\n");
        return 1;
    }
    printf("PASS: Network initialized\n");

    /* Register handler on sink */
    DispatchTable* sink_dispatch = registry_get_dispatch(registry, 2);
    AgentInfo* sink_info = registry_get_agent(registry, 2);
    dispatch_set_state(sink_dispatch, sink_info->state);
    dispatch_register(sink_dispatch, FREQ_DATA, handle_data, NULL);
    printf("PASS: Registered data handler on sink\n");

    /* Source emits data signal */
    uint32_t value = 100;
    Signal* sig = signal_create(FREQ_DATA, 1, &value, sizeof(value));

    /* Create temp old registry for routing */
    AgentRegistry old_registry;
    Agent source_agent = { .agent_id = 1, .input_queue = registry_get_queue(registry, 1) };
    Agent sink_agent = { .agent_id = 2, .input_queue = registry_get_queue(registry, 2) };
    Agent* agent_ptrs[3] = { NULL, &source_agent, &sink_agent };
    old_registry.agents = agent_ptrs;
    old_registry.count = 3;
    old_registry.capacity = 3;

    int delivered = routing_broadcast(registry->routing, sig, &old_registry);
    signal_free(sig);

    if (delivered != 1) {
        printf("FAIL: Signal not delivered\n");
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: Signal delivered to sink\n");

    /* Sink processes signal */
    int processed = dispatch_process_queue(sink_dispatch, registry_get_queue(registry, 2));
    if (processed != 1) {
        printf("FAIL: Expected 1 processed, got %d\n", processed);
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: Sink processed 1 signal\n");

    /* Verify sink state */
    SinkState* sink_state = (SinkState*)sink_info->state;
    if (sink_state->received != 1) {
        printf("FAIL: sink.received should be 1\n");
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: sink.received = %u\n", sink_state->received);

    if (sink_state->last_value != 100) {
        printf("FAIL: Expected last_value 100, got %u\n", sink_state->last_value);
        topology_shutdown(registry);
        return 1;
    }
    printf("PASS: sink.last_value = %u\n", sink_state->last_value);

    topology_shutdown(registry);
    printf("PASS: End-to-end test\n");
    return 0;
}

int test_frequency_registry(void) {
    printf("\n=== Test: Frequency Registry ===\n");

    FrequencyRegistry* registry = frequency_registry_create(16);
    if (registry == NULL) {
        printf("FAIL: frequency_registry_create returned NULL\n");
        return 1;
    }
    printf("PASS: Created frequency registry\n");

    /* Register frequencies */
    frequency_register(registry, FREQ_INIT, "init", 0);
    frequency_register(registry, FREQ_DATA, "data", sizeof(uint32_t));
    frequency_register(registry, FREQ_ACK, "ack", 0);

    /* Lookup by ID */
    FrequencyInfo* data = frequency_get(registry, FREQ_DATA);
    if (data == NULL) {
        printf("FAIL: Could not find data frequency\n");
        return 1;
    }
    printf("PASS: Found data frequency by ID\n");

    /* Lookup by name */
    FrequencyInfo* ack = frequency_get_by_name(registry, "ack");
    if (ack == NULL || ack->frequency_id != FREQ_ACK) {
        printf("FAIL: Could not find ack frequency by name\n");
        return 1;
    }
    printf("PASS: Found ack frequency by name\n");

    printf("PASS: Frequency registry test\n");
    return 0;
}

int test_registry_print(void) {
    printf("\n=== Test: Registry Print ===\n");

    AgentRegistry2* registry = registry_create(8);
    registry_register(registry, 1, "lexer", NULL, 0,
                      signal_queue_create(32), dispatch_table_create(8, 1));
    registry_register(registry, 2, "parser", NULL, 0,
                      signal_queue_create(32), dispatch_table_create(8, 2));
    registry_register(registry, 3, "typechecker", NULL, 0,
                      signal_queue_create(32), dispatch_table_create(8, 3));

    printf("--- Debug output ---\n");
    registry_print(registry);
    printf("--- End debug output ---\n");

    registry_destroy(registry);
    printf("PASS: Registry print test\n");
    return 0;
}

/* =============================================================================
 * MAIN
 * ============================================================================= */

int main(void) {
    printf("==========================================\n");
    printf("Mycelial Topology Runtime - Test Suite\n");
    printf("==========================================\n");

    int failures = 0;

    failures += test_registry_create();
    failures += test_agent_registration();
    failures += test_agent_lookup();
    failures += test_topology_init();
    failures += test_routing_setup();
    failures += test_end_to_end();
    failures += test_frequency_registry();
    failures += test_registry_print();

    printf("\n==========================================\n");
    if (failures == 0) {
        printf("ALL TESTS PASSED!\n");
    } else {
        printf("FAILED: %d test(s) failed\n", failures);
    }
    printf("==========================================\n");

    /* Print final heap stats */
    printf("\nFinal heap stats:\n");
    printf("  Used: %zu bytes\n", heap_get_used());
    printf("  Peak: %zu bytes\n", heap_get_peak());
    printf("  Total: %zu bytes\n", heap_get_total());

    return failures;
}

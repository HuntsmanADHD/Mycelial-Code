/*
 * Mycelial Signal Runtime - Test Program
 * Verifies basic functionality of signal, queue, and routing operations.
 */

#include "signal.h"
#include <stdio.h>
#include <string.h>

/* Test payload structure */
typedef struct {
    int value;
    char message[32];
} TestPayload;

/* Test frequency and agent IDs */
#define FREQ_TEST       1
#define FREQ_RESPONSE   2
#define AGENT_SENDER    1
#define AGENT_RECEIVER  2

int test_heap(void) {
    printf("\n=== Test: Heap Allocation ===\n");

    /* Heap should auto-initialize */
    void* ptr1 = heap_allocate(1024);
    if (ptr1 == NULL) {
        printf("FAIL: heap_allocate returned NULL\n");
        return 1;
    }
    printf("PASS: Allocated 1024 bytes at %p\n", ptr1);

    void* ptr2 = heap_allocate(2048);
    if (ptr2 == NULL) {
        printf("FAIL: Second heap_allocate returned NULL\n");
        return 1;
    }
    printf("PASS: Allocated 2048 bytes at %p\n", ptr2);

    printf("Heap used: %zu bytes, peak: %zu bytes\n",
           heap_get_used(), heap_get_peak());

    heap_free(ptr1, 1024);
    heap_free(ptr2, 2048);

    printf("After free, heap used: %zu bytes\n", heap_get_used());
    printf("PASS: Heap allocation test\n");
    return 0;
}

int test_signal_create(void) {
    printf("\n=== Test: Signal Create/Free ===\n");

    /* Create signal without payload */
    Signal* sig1 = signal_alloc();
    if (sig1 == NULL) {
        printf("FAIL: signal_alloc returned NULL\n");
        return 1;
    }
    printf("PASS: Created empty signal at %p\n", (void*)sig1);
    printf("  - ref_count: %u, timestamp: %lu\n",
           sig1->ref_count, sig1->timestamp);

    signal_free(sig1);
    printf("PASS: Freed empty signal\n");

    /* Create signal with payload */
    TestPayload data = { .value = 42 };
    strncpy(data.message, "Hello Mycelial!", sizeof(data.message) - 1);

    Signal* sig2 = signal_create(FREQ_TEST, AGENT_SENDER, &data, sizeof(data));
    if (sig2 == NULL) {
        printf("FAIL: signal_create returned NULL\n");
        return 1;
    }
    printf("PASS: Created signal with payload at %p\n", (void*)sig2);
    printf("  - freq: %u, source: %u, size: %u\n",
           sig2->frequency_id, sig2->source_agent_id, sig2->payload_size);

    /* Verify payload */
    TestPayload* payload = signal_get_payload(sig2);
    if (payload == NULL || payload->value != 42) {
        printf("FAIL: Payload data incorrect\n");
        return 1;
    }
    printf("PASS: Payload value = %d, message = '%s'\n",
           payload->value, payload->message);

    signal_free(sig2);
    printf("PASS: Signal create/free test\n");
    return 0;
}

int test_signal_queue(void) {
    printf("\n=== Test: Signal Queue ===\n");

    /* Create queue with capacity 16 */
    SignalQueue* queue = signal_queue_create(16);
    if (queue == NULL) {
        printf("FAIL: signal_queue_create returned NULL\n");
        return 1;
    }
    printf("PASS: Created queue with capacity %u\n", queue->capacity);

    /* Verify empty */
    if (!signal_queue_is_empty(queue)) {
        printf("FAIL: New queue should be empty\n");
        return 1;
    }
    printf("PASS: New queue is empty\n");

    /* Enqueue signals */
    for (int i = 0; i < 10; i++) {
        int value = i * 100;
        Signal* sig = signal_create(FREQ_TEST, AGENT_SENDER, &value, sizeof(value));
        if (sig == NULL) {
            printf("FAIL: Could not create signal %d\n", i);
            return 1;
        }

        int result = signal_queue_enqueue(queue, sig);
        if (result != SIGNAL_OK) {
            printf("FAIL: Enqueue failed with code %d\n", result);
            return 1;
        }

        /* We handed off to queue, decrement our ref */
        signal_free(sig);
    }
    printf("PASS: Enqueued 10 signals\n");
    printf("  - count: %u, total_enqueued: %u\n",
           signal_queue_count(queue), signal_queue_get_total_enqueued(queue));

    /* Dequeue and verify */
    int expected = 0;
    Signal* sig;
    while ((sig = signal_queue_dequeue(queue)) != NULL) {
        int* value = signal_get_payload(sig);
        if (*value != expected) {
            printf("FAIL: Expected %d, got %d\n", expected, *value);
            return 1;
        }
        expected += 100;
        signal_free(sig);
    }
    printf("PASS: Dequeued all signals in correct order\n");
    printf("  - total_dequeued: %u\n", signal_queue_get_total_dequeued(queue));

    /* Verify empty again */
    if (!signal_queue_is_empty(queue)) {
        printf("FAIL: Queue should be empty after dequeue all\n");
        return 1;
    }
    printf("PASS: Queue is empty after dequeue\n");

    /* Test queue full */
    for (int i = 0; i < 20; i++) {
        Signal* s = signal_create(1, 1, &i, sizeof(i));
        int result = signal_queue_enqueue(queue, s);
        if (i < 16 && result != SIGNAL_OK) {
            printf("FAIL: Enqueue %d should succeed\n", i);
            signal_free(s);
            return 1;
        }
        if (i >= 16 && result != SIGNAL_ERR_QUEUE_FULL) {
            printf("FAIL: Enqueue %d should fail (queue full)\n", i);
            signal_free(s);
            return 1;
        }
        signal_free(s);
    }
    printf("PASS: Queue overflow correctly detected\n");
    printf("  - dropped: %u\n", signal_queue_get_dropped(queue));

    signal_queue_destroy(queue);
    printf("PASS: Signal queue test\n");
    return 0;
}

int test_routing(void) {
    printf("\n=== Test: Routing Table ===\n");

    /* Create routing table */
    RoutingTable* table = routing_table_create(64);
    if (table == NULL) {
        printf("FAIL: routing_table_create returned NULL\n");
        return 1;
    }
    printf("PASS: Created routing table\n");

    /* Create agent registry */
    AgentRegistry* agents = agent_registry_create(MAX_AGENTS);
    if (agents == NULL) {
        printf("FAIL: agent_registry_create returned NULL\n");
        return 1;
    }
    printf("PASS: Created agent registry\n");

    /* Create agents with queues */
    Agent agent1 = {
        .agent_id = AGENT_SENDER,
        .agent_type = 1,
        .input_queue = signal_queue_create(64)
    };
    Agent agent2 = {
        .agent_id = AGENT_RECEIVER,
        .agent_type = 2,
        .input_queue = signal_queue_create(64)
    };

    agent_registry_add(agents, &agent1);
    agent_registry_add(agents, &agent2);
    printf("PASS: Registered 2 agents\n");

    /* Add route: AGENT_SENDER.FREQ_TEST -> AGENT_RECEIVER */
    uint32_t dests[] = { AGENT_RECEIVER };
    int result = routing_add_entry(table, AGENT_SENDER, FREQ_TEST, 1, dests);
    if (result != SIGNAL_OK) {
        printf("FAIL: routing_add_entry failed with code %d\n", result);
        return 1;
    }
    printf("PASS: Added routing entry\n");

    /* Resolve queue pointers */
    routing_resolve_queues(table, agents);
    printf("PASS: Resolved queue pointers\n");

    /* Lookup route */
    uint32_t count;
    uint32_t* found = routing_lookup(table, AGENT_SENDER, FREQ_TEST, &count);
    if (found == NULL || count != 1 || found[0] != AGENT_RECEIVER) {
        printf("FAIL: Route lookup incorrect\n");
        return 1;
    }
    printf("PASS: Route lookup found %u destination(s)\n", count);

    /* Broadcast signal */
    TestPayload data = { .value = 999 };
    strncpy(data.message, "Routed message", sizeof(data.message) - 1);

    Signal* sig = signal_create(FREQ_TEST, AGENT_SENDER, &data, sizeof(data));
    int delivered = routing_broadcast(table, sig, agents);
    signal_free(sig);

    if (delivered != 1) {
        printf("FAIL: Expected 1 delivery, got %d\n", delivered);
        return 1;
    }
    printf("PASS: Broadcast delivered to %d destination(s)\n", delivered);

    /* Verify signal arrived in receiver's queue */
    Signal* received = signal_queue_dequeue(agent2.input_queue);
    if (received == NULL) {
        printf("FAIL: No signal in receiver queue\n");
        return 1;
    }

    TestPayload* recv_data = signal_get_payload(received);
    if (recv_data->value != 999) {
        printf("FAIL: Received wrong value: %d\n", recv_data->value);
        return 1;
    }
    printf("PASS: Receiver got signal with value %d\n", recv_data->value);

    signal_free(received);

    /* Cleanup */
    signal_queue_destroy(agent1.input_queue);
    signal_queue_destroy(agent2.input_queue);
    routing_table_destroy(table);

    printf("PASS: Routing test\n");
    return 0;
}

int test_emit_signal(void) {
    printf("\n=== Test: emit_signal (convenience) ===\n");

    /* Create infrastructure */
    RoutingTable* table = routing_table_create(64);
    AgentRegistry* agents = agent_registry_create(MAX_AGENTS);

    Agent sender = { .agent_id = 1, .input_queue = signal_queue_create(64) };
    Agent recv1 = { .agent_id = 2, .input_queue = signal_queue_create(64) };
    Agent recv2 = { .agent_id = 3, .input_queue = signal_queue_create(64) };

    agent_registry_add(agents, &sender);
    agent_registry_add(agents, &recv1);
    agent_registry_add(agents, &recv2);

    /* Add broadcast route: sender -> [recv1, recv2] */
    uint32_t dests[] = { 2, 3 };
    routing_add_entry(table, 1, FREQ_TEST, 2, dests);
    routing_resolve_queues(table, agents);

    /* Use emit_signal convenience function */
    int value = 12345;
    int delivered = emit_signal(table, agents, FREQ_TEST, 1, &value, sizeof(value));

    if (delivered != 2) {
        printf("FAIL: Expected 2 deliveries, got %d\n", delivered);
        return 1;
    }
    printf("PASS: emit_signal delivered to %d destinations\n", delivered);

    /* Verify both receivers got the signal */
    Signal* s1 = signal_queue_dequeue(recv1.input_queue);
    Signal* s2 = signal_queue_dequeue(recv2.input_queue);

    if (s1 == NULL || s2 == NULL) {
        printf("FAIL: Receivers didn't get signals\n");
        return 1;
    }

    int* v1 = signal_get_payload(s1);
    int* v2 = signal_get_payload(s2);

    if (*v1 != 12345 || *v2 != 12345) {
        printf("FAIL: Wrong values: %d, %d\n", *v1, *v2);
        return 1;
    }
    printf("PASS: Both receivers got correct value (12345)\n");

    signal_free(s1);
    signal_free(s2);

    /* Cleanup */
    signal_queue_destroy(sender.input_queue);
    signal_queue_destroy(recv1.input_queue);
    signal_queue_destroy(recv2.input_queue);
    routing_table_destroy(table);

    printf("PASS: emit_signal test\n");
    return 0;
}

int main(void) {
    printf("======================================\n");
    printf("Mycelial Signal Runtime - Test Suite\n");
    printf("======================================\n");

    int failures = 0;

    failures += test_heap();
    failures += test_signal_create();
    failures += test_signal_queue();
    failures += test_routing();
    failures += test_emit_signal();

    printf("\n======================================\n");
    if (failures == 0) {
        printf("ALL TESTS PASSED!\n");
    } else {
        printf("FAILED: %d test(s) failed\n", failures);
    }
    printf("======================================\n");

    /* Print final heap stats */
    printf("\nFinal heap stats:\n");
    printf("  Used: %zu bytes\n", heap_get_used());
    printf("  Peak: %zu bytes\n", heap_get_peak());
    printf("  Total: %zu bytes\n", heap_get_total());

    return failures;
}

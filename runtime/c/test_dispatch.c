/*
 * Mycelial Signal Runtime - Dispatch Test Program
 * M2 Phase 3 Implementation Tests
 *
 * Tests for dispatch table creation, handler registration, lookup, and invocation.
 */

#include "signal.h"
#include "dispatch.h"
#include <stdio.h>
#include <string.h>

/* =============================================================================
 * TEST STRUCTURES AND CONSTANTS
 * ============================================================================= */

/* Test payload structure */
typedef struct {
    int value;
    char message[32];
} TestPayload;

/* Test agent state structure */
typedef struct {
    int count;
    int last_value;
    int handler_calls;
    int guard_passes;
    int guard_fails;
} TestAgentState;

/* Test frequency IDs */
#define FREQ_INCREMENT      1
#define FREQ_DECREMENT      2
#define FREQ_RESET          3
#define FREQ_GUARDED        4
#define FREQ_UNHANDLED      99

/* =============================================================================
 * TEST HANDLERS
 *
 * These simulate generated handler functions from compiled Mycelial code.
 * ============================================================================= */

/*
 * Handler: on signal(increment, p) { state.count += p.value }
 */
int handle_increment(void* agent_state, Signal* signal) {
    TestAgentState* state = (TestAgentState*)agent_state;
    TestPayload* payload = (TestPayload*)signal_get_payload(signal);

    if (payload == NULL) {
        return -1;
    }

    state->count += payload->value;
    state->last_value = payload->value;
    state->handler_calls++;

    return 0;
}

/*
 * Handler: on signal(decrement, p) { state.count -= p.value }
 */
int handle_decrement(void* agent_state, Signal* signal) {
    TestAgentState* state = (TestAgentState*)agent_state;
    TestPayload* payload = (TestPayload*)signal_get_payload(signal);

    if (payload == NULL) {
        return -1;
    }

    state->count -= payload->value;
    state->last_value = payload->value;
    state->handler_calls++;

    return 0;
}

/*
 * Handler: on signal(reset, _) { state.count = 0 }
 */
int handle_reset(void* agent_state, Signal* signal) {
    TestAgentState* state = (TestAgentState*)agent_state;
    (void)signal;  /* Unused */

    state->count = 0;
    state->last_value = 0;
    state->handler_calls++;

    return 0;
}

/*
 * Handler: on signal(guarded, p) where p.value > 10 { ... }
 * The guard is a separate function.
 */
int handle_guarded(void* agent_state, Signal* signal) {
    TestAgentState* state = (TestAgentState*)agent_state;
    TestPayload* payload = (TestPayload*)signal_get_payload(signal);

    if (payload == NULL) {
        return -1;
    }

    state->count = payload->value;
    state->guard_passes++;
    state->handler_calls++;

    return 0;
}

/*
 * Guard: p.value > 10
 */
int guard_value_gt_10(void* agent_state, Signal* signal) {
    (void)agent_state;  /* Unused */
    TestPayload* payload = (TestPayload*)signal_get_payload(signal);

    if (payload == NULL) {
        return 0;
    }

    return payload->value > 10 ? 1 : 0;
}

/*
 * Default handler for unmatched signals
 */
int handle_default(void* agent_state, Signal* signal) {
    TestAgentState* state = (TestAgentState*)agent_state;
    (void)signal;

    state->handler_calls++;
    return 0;
}

/* =============================================================================
 * TESTS
 * ============================================================================= */

int test_dispatch_table_create(void) {
    printf("\n=== Test: Dispatch Table Create ===\n");

    DispatchTable* table = dispatch_table_create(16, 1);
    if (table == NULL) {
        printf("FAIL: dispatch_table_create returned NULL\n");
        return 1;
    }
    printf("PASS: Created dispatch table for agent 1\n");

    if (table->capacity != 16) {
        printf("FAIL: Expected capacity 16, got %u\n", table->capacity);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Table capacity is %u\n", table->capacity);

    if (table->entry_count != 0) {
        printf("FAIL: Expected 0 entries, got %u\n", table->entry_count);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Table has 0 entries\n");

    dispatch_table_destroy(table);
    printf("PASS: Dispatch table create test\n");
    return 0;
}

int test_handler_registration(void) {
    printf("\n=== Test: Handler Registration ===\n");

    DispatchTable* table = dispatch_table_create(16, 1);
    if (table == NULL) {
        printf("FAIL: dispatch_table_create returned NULL\n");
        return 1;
    }

    /* Register handlers */
    int result = dispatch_register(table, FREQ_INCREMENT, handle_increment, NULL);
    if (result != DISPATCH_OK) {
        printf("FAIL: dispatch_register failed with code %d\n", result);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Registered increment handler\n");

    result = dispatch_register(table, FREQ_DECREMENT, handle_decrement, NULL);
    if (result != DISPATCH_OK) {
        printf("FAIL: dispatch_register failed with code %d\n", result);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Registered decrement handler\n");

    result = dispatch_register(table, FREQ_RESET, handle_reset, NULL);
    if (result != DISPATCH_OK) {
        printf("FAIL: dispatch_register failed with code %d\n", result);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Registered reset handler\n");

    if (table->entry_count != 3) {
        printf("FAIL: Expected 3 entries, got %u\n", table->entry_count);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Table has %u entries\n", table->entry_count);

    dispatch_table_destroy(table);
    printf("PASS: Handler registration test\n");
    return 0;
}

int test_handler_lookup(void) {
    printf("\n=== Test: Handler Lookup ===\n");

    DispatchTable* table = dispatch_table_create(16, 1);
    dispatch_register(table, FREQ_INCREMENT, handle_increment, NULL);
    dispatch_register(table, FREQ_DECREMENT, handle_decrement, NULL);
    dispatch_register(table, FREQ_RESET, handle_reset, NULL);

    /* Look up registered handlers */
    signal_handler_fn handler;

    handler = dispatch_lookup(table, FREQ_INCREMENT);
    if (handler != handle_increment) {
        printf("FAIL: Lookup for INCREMENT returned wrong handler\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Found increment handler\n");

    handler = dispatch_lookup(table, FREQ_DECREMENT);
    if (handler != handle_decrement) {
        printf("FAIL: Lookup for DECREMENT returned wrong handler\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Found decrement handler\n");

    handler = dispatch_lookup(table, FREQ_RESET);
    if (handler != handle_reset) {
        printf("FAIL: Lookup for RESET returned wrong handler\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Found reset handler\n");

    /* Look up unregistered handler */
    handler = dispatch_lookup(table, FREQ_UNHANDLED);
    if (handler != NULL) {
        printf("FAIL: Lookup for UNHANDLED should return NULL\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Unhandled frequency returns NULL\n");

    dispatch_table_destroy(table);
    printf("PASS: Handler lookup test\n");
    return 0;
}

int test_dispatch_invoke(void) {
    printf("\n=== Test: Dispatch Invoke ===\n");

    /* Create dispatch table and agent state */
    DispatchTable* table = dispatch_table_create(16, 1);
    TestAgentState state = { .count = 0, .last_value = 0, .handler_calls = 0 };
    dispatch_set_state(table, &state);

    dispatch_register(table, FREQ_INCREMENT, handle_increment, NULL);
    dispatch_register(table, FREQ_DECREMENT, handle_decrement, NULL);
    dispatch_register(table, FREQ_RESET, handle_reset, NULL);

    /* Create and dispatch increment signal */
    TestPayload payload = { .value = 10 };
    strncpy(payload.message, "increment", sizeof(payload.message) - 1);

    Signal* sig = signal_create(FREQ_INCREMENT, 1, &payload, sizeof(payload));
    if (sig == NULL) {
        printf("FAIL: signal_create returned NULL\n");
        dispatch_table_destroy(table);
        return 1;
    }

    int result = dispatch_invoke(table, sig);
    if (result != DISPATCH_OK) {
        printf("FAIL: dispatch_invoke failed with code %d\n", result);
        signal_free(sig);
        dispatch_table_destroy(table);
        return 1;
    }
    signal_free(sig);

    if (state.count != 10) {
        printf("FAIL: Expected count 10, got %d\n", state.count);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Increment handler executed, count = %d\n", state.count);

    /* Dispatch another increment */
    payload.value = 5;
    sig = signal_create(FREQ_INCREMENT, 1, &payload, sizeof(payload));
    dispatch_invoke(table, sig);
    signal_free(sig);

    if (state.count != 15) {
        printf("FAIL: Expected count 15, got %d\n", state.count);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Second increment, count = %d\n", state.count);

    /* Dispatch decrement */
    payload.value = 3;
    sig = signal_create(FREQ_DECREMENT, 1, &payload, sizeof(payload));
    dispatch_invoke(table, sig);
    signal_free(sig);

    if (state.count != 12) {
        printf("FAIL: Expected count 12, got %d\n", state.count);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Decrement, count = %d\n", state.count);

    /* Dispatch reset */
    sig = signal_create(FREQ_RESET, 1, NULL, 0);
    dispatch_invoke(table, sig);
    signal_free(sig);

    if (state.count != 0) {
        printf("FAIL: Expected count 0, got %d\n", state.count);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Reset, count = %d\n", state.count);

    if (state.handler_calls != 4) {
        printf("FAIL: Expected 4 handler calls, got %d\n", state.handler_calls);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Handler called %d times\n", state.handler_calls);

    dispatch_table_destroy(table);
    printf("PASS: Dispatch invoke test\n");
    return 0;
}

int test_guard_clause(void) {
    printf("\n=== Test: Guard Clause ===\n");

    DispatchTable* table = dispatch_table_create(16, 1);
    TestAgentState state = { .count = 0, .guard_passes = 0, .guard_fails = 0 };
    dispatch_set_state(table, &state);

    /* Register handler with guard: p.value > 10 */
    dispatch_register(table, FREQ_GUARDED, handle_guarded, guard_value_gt_10);

    /* Test with value > 10 (should pass guard) */
    TestPayload payload = { .value = 15 };
    Signal* sig = signal_create(FREQ_GUARDED, 1, &payload, sizeof(payload));

    int result = dispatch_invoke(table, sig);
    signal_free(sig);

    if (result != DISPATCH_OK) {
        printf("FAIL: Guard should pass for value 15\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Guard passed for value 15\n");

    if (state.count != 15 || state.guard_passes != 1) {
        printf("FAIL: Handler should have executed\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Handler executed, count = %d\n", state.count);

    /* Test with value <= 10 (should fail guard) */
    payload.value = 5;
    sig = signal_create(FREQ_GUARDED, 1, &payload, sizeof(payload));

    result = dispatch_invoke(table, sig);
    signal_free(sig);

    if (result != DISPATCH_ERR_GUARD_FAILED) {
        printf("FAIL: Guard should fail for value 5, got code %d\n", result);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Guard failed for value 5\n");

    /* State should not have changed */
    if (state.count != 15) {
        printf("FAIL: State should not have changed after guard fail\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: State unchanged after guard fail\n");

    dispatch_table_destroy(table);
    printf("PASS: Guard clause test\n");
    return 0;
}

int test_default_handler(void) {
    printf("\n=== Test: Default Handler ===\n");

    DispatchTable* table = dispatch_table_create(16, 1);
    TestAgentState state = { .count = 0, .handler_calls = 0 };
    dispatch_set_state(table, &state);

    /* Register only increment, set default handler */
    dispatch_register(table, FREQ_INCREMENT, handle_increment, NULL);
    dispatch_set_default(table, handle_default);

    /* Dispatch unhandled signal */
    Signal* sig = signal_create(FREQ_UNHANDLED, 1, NULL, 0);
    int result = dispatch_invoke(table, sig);
    signal_free(sig);

    if (result != DISPATCH_OK) {
        printf("FAIL: Default handler should have been called\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Default handler invoked\n");

    if (state.handler_calls != 1) {
        printf("FAIL: Expected 1 handler call, got %d\n", state.handler_calls);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Default handler recorded call\n");

    dispatch_table_destroy(table);
    printf("PASS: Default handler test\n");
    return 0;
}

int test_process_queue(void) {
    printf("\n=== Test: Process Queue ===\n");

    DispatchTable* table = dispatch_table_create(16, 1);
    TestAgentState state = { .count = 0, .handler_calls = 0 };
    dispatch_set_state(table, &state);

    dispatch_register(table, FREQ_INCREMENT, handle_increment, NULL);

    /* Create queue and enqueue signals */
    SignalQueue* queue = signal_queue_create(64);
    if (queue == NULL) {
        printf("FAIL: signal_queue_create returned NULL\n");
        dispatch_table_destroy(table);
        return 1;
    }

    /* Enqueue 5 increment signals */
    for (int i = 1; i <= 5; i++) {
        TestPayload payload = { .value = i * 10 };
        Signal* sig = signal_create(FREQ_INCREMENT, 1, &payload, sizeof(payload));
        signal_queue_enqueue(queue, sig);
        signal_free(sig);  /* Queue has its own ref */
    }
    printf("PASS: Enqueued 5 signals\n");

    /* Process all signals */
    int processed = dispatch_process_queue(table, queue);

    if (processed != 5) {
        printf("FAIL: Expected 5 processed, got %d\n", processed);
        signal_queue_destroy(queue);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Processed %d signals\n", processed);

    /* Verify final count: 10 + 20 + 30 + 40 + 50 = 150 */
    if (state.count != 150) {
        printf("FAIL: Expected count 150, got %d\n", state.count);
        signal_queue_destroy(queue);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Final count = %d\n", state.count);

    signal_queue_destroy(queue);
    dispatch_table_destroy(table);
    printf("PASS: Process queue test\n");
    return 0;
}

int test_process_batch(void) {
    printf("\n=== Test: Process Batch ===\n");

    DispatchTable* table = dispatch_table_create(16, 1);
    TestAgentState state = { .count = 0, .handler_calls = 0 };
    dispatch_set_state(table, &state);

    dispatch_register(table, FREQ_INCREMENT, handle_increment, NULL);

    /* Create queue and enqueue signals */
    SignalQueue* queue = signal_queue_create(64);

    /* Enqueue 10 signals */
    for (int i = 1; i <= 10; i++) {
        TestPayload payload = { .value = i };
        Signal* sig = signal_create(FREQ_INCREMENT, 1, &payload, sizeof(payload));
        signal_queue_enqueue(queue, sig);
        signal_free(sig);
    }
    printf("PASS: Enqueued 10 signals\n");

    /* Process only 3 signals (batch) */
    int processed = dispatch_process_batch(table, queue, 3);

    if (processed != 3) {
        printf("FAIL: Expected 3 processed, got %d\n", processed);
        signal_queue_destroy(queue);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Processed batch of %d signals\n", processed);

    /* Count should be 1 + 2 + 3 = 6 */
    if (state.count != 6) {
        printf("FAIL: Expected count 6, got %d\n", state.count);
        signal_queue_destroy(queue);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Count after batch = %d\n", state.count);

    /* 7 signals should remain */
    if (signal_queue_count(queue) != 7) {
        printf("FAIL: Expected 7 remaining, got %u\n", signal_queue_count(queue));
        signal_queue_destroy(queue);
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: %u signals remaining in queue\n", signal_queue_count(queue));

    signal_queue_destroy(queue);
    dispatch_table_destroy(table);
    printf("PASS: Process batch test\n");
    return 0;
}

int test_dispatch_stats(void) {
    printf("\n=== Test: Dispatch Stats ===\n");

    DispatchTable* table = dispatch_table_create(16, 1);
    TestAgentState state = { 0 };
    dispatch_set_state(table, &state);

    dispatch_register(table, FREQ_INCREMENT, handle_increment, NULL);
    dispatch_set_default(table, handle_default);

    /* Dispatch some signals */
    TestPayload payload = { .value = 1 };

    for (int i = 0; i < 5; i++) {
        Signal* sig = signal_create(FREQ_INCREMENT, 1, &payload, sizeof(payload));
        dispatch_invoke(table, sig);
        signal_free(sig);
    }

    for (int i = 0; i < 3; i++) {
        Signal* sig = signal_create(FREQ_UNHANDLED, 1, &payload, sizeof(payload));
        dispatch_invoke(table, sig);
        signal_free(sig);
    }

    /* Check stats */
    if (dispatch_get_lookup_count(table) != 8) {
        printf("FAIL: Expected 8 lookups, got %u\n", dispatch_get_lookup_count(table));
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Lookup count = %u\n", dispatch_get_lookup_count(table));

    if (dispatch_get_hit_count(table) != 5) {
        printf("FAIL: Expected 5 hits, got %u\n", dispatch_get_hit_count(table));
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Hit count = %u\n", dispatch_get_hit_count(table));

    if (dispatch_get_miss_count(table) != 3) {
        printf("FAIL: Expected 3 misses, got %u\n", dispatch_get_miss_count(table));
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Miss count = %u\n", dispatch_get_miss_count(table));

    /* Reset stats */
    dispatch_reset_stats(table);
    if (dispatch_get_lookup_count(table) != 0) {
        printf("FAIL: Stats should be reset\n");
        dispatch_table_destroy(table);
        return 1;
    }
    printf("PASS: Stats reset\n");

    dispatch_table_destroy(table);
    printf("PASS: Dispatch stats test\n");
    return 0;
}

/* =============================================================================
 * MAIN
 * ============================================================================= */

int main(void) {
    printf("==========================================\n");
    printf("Mycelial Dispatch Runtime - Test Suite\n");
    printf("==========================================\n");

    int failures = 0;

    failures += test_dispatch_table_create();
    failures += test_handler_registration();
    failures += test_handler_lookup();
    failures += test_dispatch_invoke();
    failures += test_guard_clause();
    failures += test_default_handler();
    failures += test_process_queue();
    failures += test_process_batch();
    failures += test_dispatch_stats();

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

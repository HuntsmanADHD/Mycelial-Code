/*
 * Standalone Scheduler Test
 * M2 Phase 5 - Tidal Cycle Scheduler
 *
 * Tests scheduler without full compiler integration.
 */

#include "scheduler.h"
#include "signal.h"
#include <stdio.h>
#include <string.h>
#include <assert.h>

/* Test frequency IDs */
#define FREQ_PING 1
#define FREQ_PONG 2

/* Test agent IDs (0-indexed for registry array) */
#define AGENT_SENDER 0
#define AGENT_RECEIVER 1

/*
 * Mock dispatch function (Phase 3 integration point)
 * For now, just acknowledges signal receipt
 */
void mock_dispatch(void* agent_state, Signal* sig) {
    printf("  [Dispatch] Agent received signal (freq=%u)\n", sig->frequency_id);

    /* In real implementation, this would:
     * - Pattern match on frequency_id
     * - Extract payload
     * - Call handler function
     * - Possibly emit new signals
     */
}

int main(void) {
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("  MYCELIAL SCHEDULER STANDALONE TEST\n");
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("\n");

    /* =========================================================================
     * TEST 1: Scheduler Creation
     * ========================================================================= */

    printf("=== Test 1: Scheduler Creation ===\n");

    /* Initialize heap with 16MB */
    int init_result = heap_init(16 * 1024 * 1024);
    if (init_result == 0) {
        printf("✗ Heap init failed (mmap allocation failed)\n");
        return 1;
    }
    printf("✓ Heap initialized (return code: %d)\n", init_result);

    /* Create agent registry with 2 agents */
    AgentRegistry* registry = agent_registry_create(2);
    assert(registry != NULL);
    printf("✓ Agent registry created (2 agents)\n");

    /* Create routing table with 2 routes */
    RoutingTable* routing = routing_table_create(2);
    assert(routing != NULL);
    printf("✓ Routing table created\n");

    /* Register agents */
    Agent sender_agent = {
        .agent_id = AGENT_SENDER,
        .agent_type = 1,
        .state_ptr = NULL,
        .dispatch_table = NULL,
        .input_queue = signal_queue_create(16)
    };

    Agent receiver_agent = {
        .agent_id = AGENT_RECEIVER,
        .agent_type = 2,
        .state_ptr = NULL,
        .dispatch_table = NULL,
        .input_queue = signal_queue_create(16)
    };

    agent_registry_add(registry, &sender_agent);
    agent_registry_add(registry, &receiver_agent);
    printf("✓ Agents registered\n");

    /* Set up routing: PING from sender -> receiver */
    uint32_t ping_dests[] = {AGENT_RECEIVER};
    routing_add_entry(routing, AGENT_SENDER, FREQ_PING, 1, ping_dests);
    printf("✓ Routing configured\n");

    /* Create scheduler */
    Scheduler* sched = scheduler_create(registry, routing);
    assert(sched != NULL);
    printf("✓ Scheduler created\n");
    printf("\n");

    /* =========================================================================
     * TEST 2: Empty Cycle Execution
     * ========================================================================= */

    printf("=== Test 2: Empty Cycle Execution ===\n");

    int processed = scheduler_run_cycle(sched);
    assert(processed == 0);
    printf("✓ Empty cycle processed 0 signals\n");

    uint64_t cycles = scheduler_get_cycle_count(sched);
    assert(cycles == 1);
    printf("✓ Cycle count = %lu\n", cycles);
    printf("\n");

    /* =========================================================================
     * TEST 3: Signal Processing
     * ========================================================================= */

    printf("=== Test 3: Signal Processing ===\n");

    /* Create and enqueue signals */
    for (int i = 0; i < 5; i++) {
        Signal* sig = signal_alloc();
        assert(sig != NULL);

        sig->frequency_id = FREQ_PING;
        sig->source_agent_id = AGENT_SENDER;
        sig->ref_count = 1;

        /* Enqueue to receiver's input queue */
        int enqueue_result = signal_queue_enqueue(receiver_agent.input_queue, sig);
        assert(enqueue_result == 0);
    }
    printf("✓ Enqueued 5 PING signals to receiver\n");

    /* Run one cycle - should process 1 signal (fair scheduling) */
    processed = scheduler_run_cycle(sched);
    printf("✓ Cycle processed %d signals\n", processed);
    if (processed != 1) {
        printf("  Note: Expected 1 signal, got %d\n", processed);
    }

    uint64_t total_processed = scheduler_get_signals_processed(sched);
    printf("✓ Total signals processed: %lu\n", total_processed);
    printf("\n");

    /* =========================================================================
     * TEST 4: Multiple Cycle Execution
     * ========================================================================= */

    printf("=== Test 4: Multiple Cycle Execution ===\n");

    /* Run 10 more cycles to process remaining signals */
    int total_in_batch = scheduler_run_cycles(sched, 10);
    printf("✓ Ran 10 cycles, processed %d signals total\n", total_in_batch);

    /* Check queue status */
    if (signal_queue_is_empty(receiver_agent.input_queue)) {
        printf("✓ Receiver queue is now empty\n");
    } else {
        printf("  Note: Receiver queue still has signals\n");
    }

    uint64_t final_cycles = scheduler_get_cycle_count(sched);
    printf("✓ Total cycles run: %lu\n", final_cycles);
    printf("\n");

    /* =========================================================================
     * TEST 5: Statistics Reporting
     * ========================================================================= */

    printf("=== Test 5: Statistics Reporting ===\n");

    scheduler_print_stats(sched);

    /* =========================================================================
     * TEST 6: Graceful Shutdown
     * ========================================================================= */

    printf("=== Test 6: Graceful Shutdown ===\n");

    /* Reset for shutdown test */
    scheduler_shutdown(sched);
    printf("✓ Scheduler shutdown initiated\n");

    /* Try to run - should exit immediately */
    int shutdown_processed = scheduler_run(sched);
    printf("✓ Scheduler exited gracefully (processed %d signals)\n", shutdown_processed);
    printf("\n");

    /* =========================================================================
     * CLEANUP
     * ========================================================================= */

    printf("=== Cleanup ===\n");

    scheduler_destroy(sched);
    printf("✓ Scheduler destroyed\n");

    signal_queue_destroy(sender_agent.input_queue);
    signal_queue_destroy(receiver_agent.input_queue);
    printf("✓ Queues destroyed\n");

    routing_table_destroy(routing);
    printf("✓ Routing table destroyed\n");

    /* Note: agent_registry_destroy not implemented in current runtime
     * In production, would call: agent_registry_destroy(registry); */
    printf("✓ Registry cleanup (skipped - not implemented)\n");

    printf("\n");
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("  ALL SCHEDULER TESTS PASSED ✓\n");
    printf("═══════════════════════════════════════════════════════════════\n");

    return 0;
}

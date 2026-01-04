/*
 * Mycelial Tidal Cycle Scheduler
 * M2 Phase 5 Implementation
 *
 * Orchestrates agent execution through REST → SENSE → ACT cycles.
 * Based on M2_PHASE5_TIDAL_CYCLE_SCHEDULER_SPEC.md
 */

#include "scheduler.h"
#include "signal.h"
#include <stdio.h>
#include <string.h>

/* =============================================================================
 * TIMESTAMP UTILITIES
 * ============================================================================= */

/*
 * Get CPU timestamp counter (RDTSC)
 *
 * @return: 64-bit timestamp in CPU cycles
 */
static inline uint64_t get_cpu_timestamp(void) {
    uint32_t lo, hi;
    __asm__ __volatile__ ("rdtsc" : "=a"(lo), "=d"(hi));
    return ((uint64_t)hi << 32) | lo;
}

/*
 * Convert CPU cycles to nanoseconds (approximate)
 *
 * Assumes ~3GHz CPU (adjust if needed)
 *
 * @param cycles: CPU cycles
 * @return: Approximate nanoseconds
 */
static inline uint64_t cycles_to_ns(uint64_t cycles) {
    /* ~3GHz = 3 cycles/ns, so ns = cycles / 3 */
    return cycles / 3;
}

/* =============================================================================
 * SCHEDULER CREATION & DESTRUCTION
 * ============================================================================= */

/*
 * Create scheduler
 *
 * @param registry: Agent registry (all agents in network)
 * @param routing: Routing table (signal routing rules)
 * @return: Pointer to scheduler, or NULL on failure
 */
Scheduler* scheduler_create(AgentRegistry* registry, RoutingTable* routing) {
    if (registry == NULL || routing == NULL) {
        return NULL;
    }

    /* Allocate scheduler struct */
    Scheduler* sched = heap_allocate(sizeof(Scheduler));
    if (sched == NULL) {
        return NULL;
    }

    /* Initialize scheduler state */
    sched->registry = registry;
    sched->routing = routing;
    sched->current_phase = PHASE_REST;
    sched->running = 1;
    sched->empty_cycles = 0;
    sched->max_empty_cycles = 10;  /* Shutdown after 10 empty cycles */

    /* Initialize statistics */
    sched->cycle_count = 0;
    sched->total_signals_processed = 0;
    sched->agents_active = 0;
    sched->dispatch_errors = 0;

    /* Performance tracking */
    sched->start_timestamp = 0;
    sched->end_timestamp = 0;

    return sched;
}

/*
 * Destroy scheduler and free resources
 *
 * @param sched: Scheduler to destroy
 */
void scheduler_destroy(Scheduler* sched) {
    if (sched == NULL) {
        return;
    }

    /* Note: We don't free registry or routing here
     * They are owned by the compiled program */

    heap_free(sched, sizeof(Scheduler));
}

/* =============================================================================
 * TIDAL CYCLE EXECUTION
 * ============================================================================= */

/*
 * Run one tidal cycle (REST → SENSE → ACT)
 *
 * Fair scheduling: Each agent gets equal processing time.
 * Round-robin through all agents, dequeue and dispatch signals.
 *
 * @param sched: Scheduler state
 * @return: Number of signals processed this cycle
 */
int scheduler_run_cycle(Scheduler* sched) {
    if (sched == NULL || sched->registry == NULL) {
        return SIGNAL_ERR_NULL_POINTER;
    }

    int signals_processed = 0;

    /* -------------------------------------------------------------------------
     * REST PHASE
     * ------------------------------------------------------------------------- */
    sched->current_phase = PHASE_REST;

    /* For now: REST phase is just bookkeeping
     * Future: Could call on_rest handlers here */

    /* -------------------------------------------------------------------------
     * SENSE & ACT PHASES (Combined)
     * ------------------------------------------------------------------------- */

    /* Iterate through all agents in spawn order */
    for (uint32_t i = 0; i < sched->registry->count; i++) {
        Agent* agent = sched->registry->agents[i];
        if (agent == NULL || agent->input_queue == NULL) {
            continue;
        }

        /* SENSE: Try to dequeue a signal from this agent's input queue */
        sched->current_phase = PHASE_SENSE;
        Signal* sig = signal_queue_dequeue(agent->input_queue);

        if (sig == NULL) {
            /* No signal for this agent this cycle */
            continue;
        }

        /* ACT: Dispatch signal to handler */
        sched->current_phase = PHASE_ACT;

        /* TODO: Phase 3 integration - call dispatch_invoke()
         * For now, we just acknowledge we have a signal */

        /* dispatch_invoke(agent->dispatch, agent->state, sig); */

        /* Signal processed successfully */
        signal_free(sig);
        signals_processed++;
        sched->total_signals_processed++;
    }

    /* Update cycle statistics */
    sched->cycle_count++;

    if (signals_processed > 0) {
        sched->agents_active += signals_processed;
        sched->empty_cycles = 0;
    } else {
        sched->empty_cycles++;
    }

    return signals_processed;
}

/*
 * Run scheduler until termination
 *
 * Termination conditions:
 * - max_empty_cycles consecutive cycles with no signals (graceful shutdown)
 * - sched->running set to 0 (manual shutdown)
 *
 * @param sched: Scheduler state
 * @return: Total signals processed, or negative error code
 */
int scheduler_run(Scheduler* sched) {
    if (sched == NULL) {
        return SIGNAL_ERR_NULL_POINTER;
    }

    /* Record start time */
    sched->start_timestamp = get_cpu_timestamp();

    /* Main event loop */
    while (sched->running) {
        /* Run one tidal cycle */
        int processed = scheduler_run_cycle(sched);

        if (processed < 0) {
            /* Error during cycle */
            sched->dispatch_errors++;
            continue;
        }

        /* Check termination condition: consecutive empty cycles */
        if (sched->empty_cycles >= sched->max_empty_cycles) {
            /* No signals for N cycles, graceful shutdown */
            break;
        }

        /* Optional: Small sleep to prevent busy-waiting
         * Uncomment if you want to reduce CPU usage */
        /* if (processed == 0) {
            usleep(100);
        } */
    }

    /* Record end time */
    sched->end_timestamp = get_cpu_timestamp();

    return (int)sched->total_signals_processed;
}

/*
 * Run scheduler for fixed number of cycles
 *
 * Useful for testing and benchmarking.
 *
 * @param sched: Scheduler state
 * @param max_cycles: Number of cycles to run
 * @return: Total signals processed
 */
int scheduler_run_cycles(Scheduler* sched, uint64_t max_cycles) {
    if (sched == NULL) {
        return SIGNAL_ERR_NULL_POINTER;
    }

    /* Record start time */
    sched->start_timestamp = get_cpu_timestamp();

    /* Run for fixed number of cycles */
    for (uint64_t i = 0; i < max_cycles; i++) {
        int processed = scheduler_run_cycle(sched);

        if (processed < 0) {
            sched->dispatch_errors++;
        }
    }

    /* Record end time */
    sched->end_timestamp = get_cpu_timestamp();

    return (int)sched->total_signals_processed;
}

/*
 * Shutdown scheduler gracefully
 *
 * Sets running = 0, causing scheduler_run() to exit after current cycle.
 *
 * @param sched: Scheduler state
 */
void scheduler_shutdown(Scheduler* sched) {
    if (sched != NULL) {
        sched->running = 0;
    }
}

/* =============================================================================
 * STATISTICS & DEBUGGING
 * ============================================================================= */

/*
 * Get cycle count
 *
 * @param sched: Scheduler state
 * @return: Number of cycles executed
 */
uint64_t scheduler_get_cycle_count(Scheduler* sched) {
    if (sched == NULL) {
        return 0;
    }
    return sched->cycle_count;
}

/*
 * Get total signals processed
 *
 * @param sched: Scheduler state
 * @return: Number of signals processed
 */
uint64_t scheduler_get_signals_processed(Scheduler* sched) {
    if (sched == NULL) {
        return 0;
    }
    return sched->total_signals_processed;
}

/*
 * Get detailed statistics
 *
 * @param sched: Scheduler state
 * @param stats: Output statistics structure
 */
void scheduler_get_stats(Scheduler* sched, SchedulerStats* stats) {
    if (sched == NULL || stats == NULL) {
        return;
    }

    /* Copy basic stats */
    stats->cycles_run = sched->cycle_count;
    stats->signals_processed = sched->total_signals_processed;
    stats->agents_active = sched->agents_active;
    stats->dispatch_errors = sched->dispatch_errors;

    /* Calculate timing stats */
    uint64_t total_cycles = sched->end_timestamp - sched->start_timestamp;
    stats->total_time_ns = cycles_to_ns(total_cycles);

    /* Calculate throughput (signals per second) */
    if (stats->total_time_ns > 0) {
        uint64_t total_time_sec = stats->total_time_ns / 1000000000;
        if (total_time_sec > 0) {
            stats->throughput_sig_per_sec = stats->signals_processed / total_time_sec;
        } else {
            /* Less than 1 second, estimate from ns */
            stats->throughput_sig_per_sec =
                (stats->signals_processed * 1000000000) / stats->total_time_ns;
        }
    } else {
        stats->throughput_sig_per_sec = 0;
    }

    /* Memory usage */
    stats->memory_allocated = heap_get_used();
}

/*
 * Print statistics to stdout
 *
 * @param sched: Scheduler state
 */
void scheduler_print_stats(Scheduler* sched) {
    if (sched == NULL) {
        printf("ERROR: NULL scheduler\n");
        return;
    }

    SchedulerStats stats;
    scheduler_get_stats(sched, &stats);

    printf("\n");
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("  MYCELIAL SCHEDULER STATISTICS\n");
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("\n");
    printf("  Cycles run:        %lu\n", stats.cycles_run);
    printf("  Signals processed: %lu\n", stats.signals_processed);
    printf("  Agents active:     %lu\n", stats.agents_active);
    printf("  Dispatch errors:   %lu\n", stats.dispatch_errors);
    printf("\n");
    printf("  Memory used:       %lu bytes (%.2f MB)\n",
           stats.memory_allocated,
           (double)stats.memory_allocated / (1024.0 * 1024.0));
    printf("\n");
    printf("  Total time:        %lu ns (%.3f seconds)\n",
           stats.total_time_ns,
           (double)stats.total_time_ns / 1000000000.0);
    printf("\n");
    printf("  Throughput:        ~%lu signals/sec\n",
           stats.throughput_sig_per_sec);
    printf("\n");

    if (stats.cycles_run > 0) {
        uint64_t avg_signals_per_cycle = stats.signals_processed / stats.cycles_run;
        printf("  Avg signals/cycle: %lu\n", avg_signals_per_cycle);
    }

    printf("\n");
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("\n");
}

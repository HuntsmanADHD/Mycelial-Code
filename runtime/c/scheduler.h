/*
 * Mycelial Tidal Cycle Scheduler
 * M2 Phase 5 Implementation
 *
 * Orchestrates agent execution through REST → SENSE → ACT cycles.
 * Based on M2_PHASE5_TIDAL_CYCLE_SCHEDULER_SPEC.md
 */

#ifndef MYCELIAL_SCHEDULER_H
#define MYCELIAL_SCHEDULER_H

#include <stdint.h>
#include "signal.h"

/* =============================================================================
 * TIDAL CYCLE PHASES
 * ============================================================================= */

typedef enum {
    PHASE_REST = 0,   /* Agents idle, prepare for next cycle */
    PHASE_SENSE = 1,  /* Agents read from input queues */
    PHASE_ACT = 2     /* Agents execute handlers, emit signals */
} TidalPhase;

/* =============================================================================
 * SCHEDULER STATE
 * ============================================================================= */

typedef struct {
    /* Network topology */
    AgentRegistry* registry;        /* All agent instances */
    RoutingTable* routing;          /* Signal routing table */

    /* Execution state */
    TidalPhase current_phase;       /* Current phase of tidal cycle */
    int running;                    /* 1 = running, 0 = shutdown */
    int empty_cycles;               /* Consecutive cycles with no signals */
    int max_empty_cycles;           /* Shutdown after this many empty cycles */

    /* Statistics */
    uint64_t cycle_count;           /* Total tidal cycles executed */
    uint64_t total_signals_processed; /* Total signals dispatched */
    uint64_t agents_active;         /* Agents that received signals */
    uint64_t dispatch_errors;       /* Errors during dispatch */

    /* Performance tracking */
    uint64_t start_timestamp;       /* RDTSC at scheduler start */
    uint64_t end_timestamp;         /* RDTSC at scheduler end */
} Scheduler;

/* =============================================================================
 * SCHEDULER STATISTICS
 * ============================================================================= */

typedef struct {
    uint64_t cycles_run;
    uint64_t signals_processed;
    uint64_t agents_active;
    uint64_t dispatch_errors;
    uint64_t memory_allocated;
    uint64_t total_time_ns;
    uint64_t throughput_sig_per_sec;
} SchedulerStats;

/* =============================================================================
 * SCHEDULER API
 * ============================================================================= */

/*
 * Create scheduler
 *
 * @param registry: Agent registry (all agents in network)
 * @param routing: Routing table (signal routing rules)
 * @return: Pointer to scheduler, or NULL on failure
 */
Scheduler* scheduler_create(AgentRegistry* registry, RoutingTable* routing);

/*
 * Destroy scheduler and free resources
 *
 * @param sched: Scheduler to destroy
 */
void scheduler_destroy(Scheduler* sched);

/*
 * Run one tidal cycle (REST → SENSE → ACT)
 *
 * Processes all queued signals for all agents.
 *
 * @param sched: Scheduler state
 * @return: Number of signals processed this cycle
 */
int scheduler_run_cycle(Scheduler* sched);

/*
 * Run scheduler until termination
 *
 * Runs cycles until one of:
 * - max_empty_cycles consecutive cycles with no signals
 * - sched->running set to 0
 *
 * @param sched: Scheduler state
 * @return: Total signals processed, or negative error code
 */
int scheduler_run(Scheduler* sched);

/*
 * Run scheduler for fixed number of cycles
 *
 * @param sched: Scheduler state
 * @param max_cycles: Number of cycles to run
 * @return: Total signals processed
 */
int scheduler_run_cycles(Scheduler* sched, uint64_t max_cycles);

/*
 * Shutdown scheduler gracefully
 *
 * Sets running = 0, causing scheduler_run() to exit.
 *
 * @param sched: Scheduler state
 */
void scheduler_shutdown(Scheduler* sched);

/* =============================================================================
 * STATISTICS & DEBUGGING
 * ============================================================================= */

/*
 * Get cycle count
 *
 * @param sched: Scheduler state
 * @return: Number of cycles executed
 */
uint64_t scheduler_get_cycle_count(Scheduler* sched);

/*
 * Get total signals processed
 *
 * @param sched: Scheduler state
 * @return: Number of signals processed
 */
uint64_t scheduler_get_signals_processed(Scheduler* sched);

/*
 * Get detailed statistics
 *
 * @param sched: Scheduler state
 * @param stats: Output statistics structure
 */
void scheduler_get_stats(Scheduler* sched, SchedulerStats* stats);

/*
 * Print statistics to stdout
 *
 * @param sched: Scheduler state
 */
void scheduler_print_stats(Scheduler* sched);

#endif /* MYCELIAL_SCHEDULER_H */

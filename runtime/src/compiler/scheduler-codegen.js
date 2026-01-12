/**
 * Scheduler Code Generator
 *
 * Generates the main execution loop and tidal cycle scheduler.
 * This is the "runtime" part of the compiled program that orchestrates
 * agent execution, signal routing, and the tidal cycle phases.
 *
 * Components Generated:
 * 1. _start: Program entry point
 * 2. init_agents: Initialize agent states
 * 3. init_queues: Set up signal queues
 * 4. tidal_cycle_loop: Main execution loop
 * 5. sense_phase: Dequeue signals from all agents
 * 6. act_phase: Dispatch signals to handlers
 * 7. emit_signal: Helper to enqueue signals
 * 8. Termination logic
 *
 * Execution Flow:
 * _start -> init_agents -> init_queues -> inject_initial_signals ->
 * [tidal_cycle_loop: sense -> act -> check_termination] -> exit
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-10
 */

class SchedulerCodeGenerator {
  constructor(symbolTable) {
    this.symbolTable = symbolTable;
    this.maxCycles = 1000;  // Safety limit
    this.emptyThreshold = 10;  // Cycles with no signals before termination
  }

  /**
   * Generate complete scheduler code
   * @returns {string} Complete assembly code for scheduler
   */
  generateScheduler() {
    const sections = [];

    sections.push(this.generateHeader());
    sections.push(this.generateEntryPoint());
    sections.push(this.generateInitAgents());
    sections.push(this.generateInitQueues());
    sections.push(this.generateInjectInitialSignal());
    sections.push(this.generateTidalCycleLoop());
    sections.push(this.generateSensePhase());
    sections.push(this.generateActPhase());
    sections.push(this.generateDrainOutputs());
    sections.push(this.generateEmitSignal());
    sections.push(this.generateEnqueueSignal());
    sections.push(this.generateTerminationCheck());
    sections.push(this.generateExit());

    return sections.join('\n\n');
  }

  /**
   * Generate header and documentation
   */
  generateHeader() {
    return `# ================================================================
# Mycelial Scheduler & Main Loop
# Generated for network: ${this.symbolTable.network.name}
# Agents: ${this.symbolTable.agents.size}
# Handlers: ${this.symbolTable.handlers.length}
# ================================================================`;
  }

  /**
   * Generate program entry point
   */
  generateEntryPoint() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Program Entry Point`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`.globl _start`);
    lines.push(`_start:`);
    lines.push(`    # Initialize`);
    lines.push(`    call init_agents`);
    lines.push(`    call init_queues`);
    lines.push(``);
    lines.push(`    # Inject initial signal(s) to start execution`);
    lines.push(`    call inject_initial_signal`);
    lines.push(``);
    lines.push(`    # Enter main tidal cycle loop`);
    lines.push(`    call tidal_cycle_loop`);
    lines.push(``);
    lines.push(`    # Exit with status 0`);
    lines.push(`    xor rdi, rdi`);
    lines.push(`    jmp do_exit`);

    return lines.join('\n');
  }

  /**
   * Generate agent state initialization
   */
  generateInitAgents() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Initialize Agent States`);
    lines.push(`# All agent states are initialized in the .data section`);
    lines.push(`# This function is a no-op but kept for future runtime initialization`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`init_agents:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # No runtime initialization needed - all done in .data section`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate signal queue initialization
   */
  generateInitQueues() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Initialize Signal Queues`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`init_queues:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);

    // Initialize queue for each agent
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      lines.push(`    # Initialize ${agentId} queue`);
      lines.push(`    lea rdi, [queue_${agentId}]`);
      lines.push(`    xor rax, rax`);
      lines.push(`    mov [rdi + 0], rax    # head = 0`);
      lines.push(`    mov [rdi + 8], rax    # tail = 0`);
      lines.push(`    mov [rdi + 16], rax   # count = 0`);
      lines.push(``);
    }

    // Initialize queues for fruiting bodies
    for (const fbName of this.symbolTable.fruitingBodies) {
      lines.push(`    # Initialize ${fbName} queue (fruiting body)`);
      lines.push(`    lea rdi, [queue_${fbName}]`);
      lines.push(`    xor rax, rax`);
      lines.push(`    mov [rdi + 0], rax    # head = 0`);
      lines.push(`    mov [rdi + 8], rax    # tail = 0`);
      lines.push(`    mov [rdi + 16], rax   # count = 0`);
      lines.push(``);
    }

    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate initial signal injection
   */
  generateInjectInitialSignal() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Inject Initial Signal`);
    lines.push(`# Starts execution by sending a signal to the first agent`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`inject_initial_signal:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);

    // Find the first agent that receives from input fruiting body
    let foundInitialTarget = false;
    for (const [key, dests] of this.symbolTable.routingTable.entries()) {
      if (key.startsWith('input.')) {
        const [source, frequency] = key.split('.');
        for (const destAgent of dests) {
          lines.push(`    # Inject ${frequency} signal to ${destAgent}`);
          lines.push(`    lea rdi, [initial_payload]    # payload (empty for now)`);
          lines.push(`    lea rsi, [queue_${destAgent}]`);
          lines.push(`    call enqueue_signal_simple`);
          foundInitialTarget = true;
          break;
        }
        if (foundInitialTarget) break;
      }
    }

    if (!foundInitialTarget) {
      lines.push(`    # No initial signal needed (no input connections)`);
    }

    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate main tidal cycle loop
   */
  generateTidalCycleLoop() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Tidal Cycle Loop`);
    lines.push(`# Main execution loop: SENSE -> ACT -> Check Termination`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`tidal_cycle_loop:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    // Allocate: 8 bytes for signal count (at -0x8) + 8 byte padding + 8 bytes per agent for signal pointers
    // Max offset will be -(16 + agents * 8), so we need at least that much space
    const maxOffset = 16 + (this.symbolTable.agents.size * 8);
    // Round up to multiple of 16 for stack alignment
    const stackSpace = Math.ceil(maxOffset / 16) * 16;
    lines.push(`    sub rsp, ${stackSpace}    # space for signal count and ${this.symbolTable.agents.size} signal pointers`);
    lines.push(``);
    lines.push(`    # Initialize cycle counter`);
    lines.push(`    xor r14, r14    # r14 = cycle_count`);
    lines.push(`    xor r15, r15    # r15 = empty_count`);
    lines.push(``);
    lines.push(`.tidal_cycle:`);
    lines.push(`    # Check max cycles`);
    lines.push(`    cmp r14, ${this.maxCycles}`);
    lines.push(`    jge .exit_max_cycles`);
    lines.push(``);
    lines.push(`    # Increment cycle counter`);
    lines.push(`    inc r14`);
    lines.push(``);
    lines.push(`    # SENSE phase: dequeue signals`);
    lines.push(`    call sense_phase`);
    lines.push(`    mov [rbp - 8], rax    # store signals_processed`);
    lines.push(``);
    lines.push(`    # Check if any signals were processed`);
    lines.push(`    test rax, rax`);
    lines.push(`    jz .no_signals`);
    lines.push(``);
    lines.push(`    # Reset empty counter`);
    lines.push(`    xor r15, r15`);
    lines.push(``);
    lines.push(`    # ACT phase: execute handlers`);
    lines.push(`    call act_phase`);
    lines.push(``);
    lines.push(`    # OUTPUT phase: drain and print output signals`);
    lines.push(`    call drain_outputs`);
    lines.push(``);
    lines.push(`    # Continue loop`);
    lines.push(`    jmp .tidal_cycle`);
    lines.push(``);
    lines.push(`.no_signals:`);
    lines.push(`    # Increment empty counter`);
    lines.push(`    inc r15`);
    lines.push(``);
    lines.push(`    # Check if we've been empty long enough`);
    lines.push(`    cmp r15, ${this.emptyThreshold}`);
    lines.push(`    jl .tidal_cycle    # keep trying`);
    lines.push(``);
    lines.push(`.exit_quiescence:`);
    lines.push(`    # Exiting: reached quiescence (no signals for ${this.emptyThreshold} cycles)`);
    lines.push(`    mov rsp, rbp`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.exit_max_cycles:`);
    lines.push(`    # Exiting: reached max cycles (${this.maxCycles})`);
    lines.push(`    mov rsp, rbp`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate SENSE phase (dequeue signals)
   */
  generateSensePhase() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# SENSE Phase`);
    lines.push(`# Dequeue one signal from each agent's queue`);
    lines.push(`# Returns: rax = number of signals dequeued`);
    lines.push(`# ================================================================`);
    lines.push(``);
    // NOTE: sense_phase does NOT create its own stack frame!
    // It uses the caller's (tidal_cycle_loop's) stack frame to store signals
    // so that act_phase can access them.
    lines.push(`sense_phase:`);
    lines.push(`    # Zero out signal slots to avoid garbage values`);
    lines.push(`    xor rax, rax`);
    lines.push(`    mov [rbp - 16], rax    # V signal slot`);
    lines.push(`    mov [rbp - 24], rax    # P signal slot`);
    lines.push(`    mov [rbp - 32], rax    # F signal slot`);
    lines.push(``);
    lines.push(`    xor r12, r12    # r12 = signals_count`);
    lines.push(``);

    // Dequeue from each agent
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      const agentIndex = Array.from(this.symbolTable.agents.keys()).indexOf(agentId);
      const stackOffset = 16 + (8 * (agentIndex + 1));  // Start at -16, then -24, -32, etc.

      lines.push(`    # Try to dequeue from ${agentId}`);
      lines.push(`    lea rdi, [queue_${agentId}]`);
      lines.push(`    call dequeue_signal`);
      lines.push(`    test rax, rax`);
      lines.push(`    jz .skip_${agentId}`);
      lines.push(`    mov [rbp - ${stackOffset}], rax    # store signal`);
      lines.push(`    inc r12`);
      lines.push(`.skip_${agentId}:`);
      lines.push(``);
    }

    lines.push(`    mov rax, r12    # return signals count`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate ACT phase (dispatch to handlers)
   */
  generateActPhase() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# ACT Phase`);
    lines.push(`# Execute handlers for dequeued signals`);
    lines.push(`# ================================================================`);
    lines.push(``);
    // NOTE: act_phase does NOT create its own stack frame!
    // It reads signals from the caller's (tidal_cycle_loop's) stack frame
    // where sense_phase stored them.
    lines.push(`act_phase:`);
    lines.push(``);

    // For each agent, check if it has a signal and dispatch
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      const agentIndex = Array.from(this.symbolTable.agents.keys()).indexOf(agentId);
      const stackOffset = 16 + (8 * (agentIndex + 1));  // Match sense_phase offsets

      lines.push(`    # Check ${agentId}`);
      lines.push(`    mov rdi, [rbp - ${stackOffset}]    # load signal`);
      lines.push(`    test rdi, rdi`);
      lines.push(`    jz .skip_act_${agentId}`);
      lines.push(``);

      // Get handlers for this agent
      const agentHandlers = this.symbolTable.handlers.filter(h => h.agent === agentId);

      if (agentHandlers.length === 1) {
        // Single handler - direct call
        lines.push(`    call ${agentHandlers[0].label}`);
      } else if (agentHandlers.length > 1) {
        // Multiple handlers - dispatch based on frequency
        lines.push(`    # Dispatch based on frequency (TODO: frequency matching)`);
        for (const handler of agentHandlers) {
          lines.push(`    call ${handler.label}    # ${handler.frequency}`);
        }
      }

      lines.push(`.skip_act_${agentId}:`);
      lines.push(``);
    }

    // Execute timed handlers based on current cycle number (in r14)
    if (this.symbolTable.timedHandlers.length > 0) {
      lines.push(`    # Execute timed handlers for current cycle`);

      // Group timed handlers by cycle number for efficiency
      const handlersByCycle = new Map();
      for (const th of this.symbolTable.timedHandlers) {
        // Extract cycle number from literal expression
        let cycleNum = th.cycleNumber;
        if (typeof cycleNum === 'object' && cycleNum.type === 'literal') {
          cycleNum = cycleNum.value;
        }

        if (!handlersByCycle.has(cycleNum)) {
          handlersByCycle.set(cycleNum, []);
        }
        handlersByCycle.get(cycleNum).push(th);
      }

      // Generate cycle checks
      for (const [cycleNumber, handlers] of handlersByCycle.entries()) {
        lines.push(`    # Check cycle ${cycleNumber}`);
        lines.push(`    cmp r14, ${cycleNumber}`);
        lines.push(`    jne .skip_cycle_${cycleNumber}`);

        for (const handler of handlers) {
          lines.push(`    call ${handler.label}    # ${handler.agent}`);
        }

        lines.push(`.skip_cycle_${cycleNumber}:`);
        lines.push(``);
      }
    }

    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate drain_outputs phase
   * Drains and prints all signals from output fruiting body queues
   */
  generateDrainOutputs() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# OUTPUT Phase - Drain and print output signals`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`drain_outputs:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12    # save registers`);
    lines.push(`    push r13`);
    lines.push(``);

    // Find all output fruiting bodies and their frequencies
    const outputQueueInfo = [];
    for (const [key, dests] of this.symbolTable.routingTable.entries()) {
      const [source, frequency] = key.split('.');
      for (const dest of dests) {
        if (dest.startsWith('output') || dest.endsWith('_output')) {
          const queueLabel = `queue_${dest}`;
          const existing = outputQueueInfo.find(q => q.queueLabel === queueLabel);
          if (!existing) {
            outputQueueInfo.push({ queueLabel, frequency });
          }
        }
      }
    }

    if (outputQueueInfo.length === 0) {
      lines.push(`    # No output queues to drain`);
    } else {
      for (const { queueLabel, frequency } of outputQueueInfo) {
        lines.push(`    # Drain ${queueLabel} (frequency: ${frequency})`);
        lines.push(`.drain_${queueLabel}:`);
        lines.push(`    lea rdi, [${queueLabel}]`);
        lines.push(`    call dequeue_signal`);
        lines.push(`    test rax, rax`);
        lines.push(`    jz .done_${queueLabel}`);
        lines.push(``);
        lines.push(`    # Signal dequeued - print it`);
        lines.push(`    mov r12, rax    # save signal pointer`);
        lines.push(``);
        lines.push(`    # Print output signal marker`);
        lines.push(`    lea rdi, [output_prefix]`);
        lines.push(`    call builtin_print`);
        lines.push(``);

        // Get frequency definition to determine field layout
        const freqDef = this.symbolTable.frequencies.get(frequency);
        if (freqDef) {
          // Calculate offsets for each field with proper alignment
          let currentOffset = 0;
          const fieldOffsets = [];

          for (const field of freqDef.fields) {
            const typeSize = this.getTypeSize(field.type);

            // Add padding for alignment if needed
            if (typeSize === 8 && currentOffset % 8 !== 0) {
              currentOffset += 8 - (currentOffset % 8);
            } else if (typeSize === 4 && currentOffset % 4 !== 0) {
              currentOffset += 4 - (currentOffset % 4);
            }

            fieldOffsets.push({ name: field.name, type: field.type, offset: currentOffset });
            currentOffset += typeSize;
          }

          // Print only string fields (they usually contain the full formatted message)
          let hasStringField = false;
          for (const fieldInfo of fieldOffsets) {
            if (fieldInfo.type === 'string') {
              lines.push(`    # Print field ${fieldInfo.name} (string at offset ${fieldInfo.offset})`);
              lines.push(`    mov rax, [r12 + ${fieldInfo.offset}]    # load ${fieldInfo.name}`);
              lines.push(`    mov rdi, rax`);
              lines.push(`    call builtin_print`);
              lines.push(``);
              hasStringField = true;
            }
          }

          // If no string fields, print all numeric fields
          if (!hasStringField) {
            for (const fieldInfo of fieldOffsets) {
              if (fieldInfo.type === 'i64' || fieldInfo.type === 'u64') {
                lines.push(`    # Print field ${fieldInfo.name} (i64 at offset ${fieldInfo.offset})`);
                lines.push(`    mov rdi, [r12 + ${fieldInfo.offset}]    # load ${fieldInfo.name}`);
                lines.push(`    call builtin_print_i64`);
                lines.push(`    lea rdi, [space_str]`);
                lines.push(`    call builtin_print`);
                lines.push(``);
              } else if (fieldInfo.type === 'i32' || fieldInfo.type === 'u32') {
                lines.push(`    # Print field ${fieldInfo.name} (i32 at offset ${fieldInfo.offset})`);
                lines.push(`    movsxd rdi, DWORD PTR [r12 + ${fieldInfo.offset}]    # load ${fieldInfo.name}`);
                lines.push(`    call builtin_print_i64`);
                lines.push(`    lea rdi, [space_str]`);
                lines.push(`    call builtin_print`);
                lines.push(``);
              }
            }
          }
        } else {
          // Fallback: assume first field is a string
          lines.push(`    # Print signal payload (frequency definition not found)`);
          lines.push(`    mov rax, [r12]    # load first field`);
          lines.push(`    mov rdi, rax`);
          lines.push(`    call builtin_print`);
          lines.push(``);
        }

        lines.push(`    # Print newline`);
        lines.push(`    lea rdi, [newline_str]`);
        lines.push(`    call builtin_print`);
        lines.push(``);
        lines.push(`    jmp .drain_${queueLabel}    # check for more signals`);
        lines.push(``);
        lines.push(`.done_${queueLabel}:`);
        lines.push(``);
      }
    }

    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Get type size in bytes
   */
  getTypeSize(type) {
    if (type === 'string' || type === 'vec' || type.startsWith('vec<') || type.startsWith('map<')) {
      return 8; // Pointer
    } else if (type === 'i64' || type === 'u64' || type === 'f64') {
      return 8;
    } else if (type === 'i32' || type === 'u32' || type === 'f32') {
      return 4;
    } else if (type === 'i16' || type === 'u16') {
      return 2;
    } else if (type === 'i8' || type === 'u8' || type === 'bool') {
      return 1;
    }
    return 8; // Default to pointer size
  }

  /**
   * Generate emit_signal helper
   */
  generateEmitSignal() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Emit Signal Helper`);
    lines.push(`# Arguments: rdi = source agent ID, rsi = frequency ID, rdx = payload`);
    lines.push(`# Routes signal to destinations based on routing table`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`emit_signal:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12`);
    lines.push(`    push r13`);
    lines.push(`    push r14`);
    lines.push(``);
    lines.push(`    mov r12, rdi    # source agent`);
    lines.push(`    mov r13, rsi    # frequency`);
    lines.push(`    mov r14, rdx    # payload`);
    lines.push(``);
    lines.push(`    # TODO: Route based on routing table`);
    lines.push(`    # For now, simplified routing`);
    lines.push(``);

    // Generate routing logic based on routing table
    for (const [key, dests] of this.symbolTable.routingTable.entries()) {
      const [source, freq] = key.split('.');

      for (const dest of dests) {
        lines.push(`    # Route ${source}.${freq} -> ${dest}`);
        lines.push(`    # (check if r12 == ${source} && r13 == ${freq})`);
        lines.push(`    lea rsi, [queue_${dest}]`);
        lines.push(`    mov rdi, r14    # payload`);
        lines.push(`    call enqueue_signal_simple`);
        lines.push(``);
      }
    }

    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate enqueue_signal helper
   */
  generateEnqueueSignal() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Enqueue Signal (Simple Version)`);
    lines.push(`# Arguments: rdi = payload, rsi = queue pointer`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`enqueue_signal_simple:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Store payload pointer in head field (simple version)`);
    lines.push(`    mov [rsi + 0], rdi    # store payload in head`);
    lines.push(`    mov rax, [rsi + 16]    # load count`);
    lines.push(`    inc rax`);
    lines.push(`    mov [rsi + 16], rax    # store count`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`# Dequeue signal (returns pointer or 0)`);
    lines.push(`dequeue_signal:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    mov rax, [rdi + 16]    # load count`);
    lines.push(`    test rax, rax`);
    lines.push(`    jz .empty`);
    lines.push(``);
    lines.push(`    # Retrieve payload from head field`);
    lines.push(`    mov rax, [rdi + 0]    # load payload pointer`);
    lines.push(`    push rax    # save payload`);
    lines.push(`    mov rax, [rdi + 16]    # load count`);
    lines.push(`    dec rax`);
    lines.push(`    mov [rdi + 16], rax    # decrement count`);
    lines.push(`    pop rax    # restore payload pointer`);
    lines.push(`    jmp .done`);
    lines.push(``);
    lines.push(`.empty:`);
    lines.push(`    xor rax, rax    # return 0`);
    lines.push(``);
    lines.push(`.done:`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate termination check
   */
  generateTerminationCheck() {
    return `# Termination check is integrated into tidal_cycle_loop`;
  }

  /**
   * Generate exit code
   */
  generateExit() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Exit Program`);
    lines.push(`# ================================================================`);
    lines.push(``);
    lines.push(`do_exit:`);
    lines.push(`    # rdi already contains exit code`);
    lines.push(`    mov rax, 60    # syscall: exit`);
    lines.push(`    syscall`);

    return lines.join('\n');
  }
}

module.exports = { SchedulerCodeGenerator };

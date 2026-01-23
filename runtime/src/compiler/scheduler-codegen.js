/**
 * Mycelial Scheduler Code Generator
 *
 * Generates the main loop and tidal cycle scheduler.
 * Implements the REST-SENSE-ACT execution model:
 * 1. REST: Initialize all agents
 * 2. SENSE: Inject initial signal(s)
 * 3. ACT: Tidal cycles until all queues are empty
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-15
 */

class SchedulerCodegen {
  constructor(symbolTable) {
    this.symbolTable = symbolTable;
    this.maxSignalsPerCycle = 1000;
    this.signalStructSize = 64; // Bytes per signal (8 byte header + 56 byte payload)
    this.queueCapacity = 100000; // Max signals per queue (increased for self-compilation with 57k+ tokens)
  }

  /**
   * Generate the complete scheduler including _start and main loop
   */
  generateScheduler() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Main Scheduler - Tidal Cycle Execution`);
    lines.push(`# Implements REST-SENSE-ACT model`);
    lines.push(`# ================================================================`);
    lines.push(``);

    // Generate _start entry point
    lines.push(...this.generateStart());

    // Generate CLI argument parser
    lines.push(...this.generateCliParser());

    // Generate initialization (REST phase)
    lines.push(...this.generateRestPhase());

    // Generate initial signal injection (SENSE phase)
    lines.push(...this.generateInitialSignalInjection());

    // Generate tidal cycle loop (ACT phase)
    lines.push(...this.generateTidalCycle());

    // Generate exit sequence
    lines.push(...this.generateExit());

    return lines;
  }

  /**
   * Generate _start entry point
   */
  generateStart() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Entry Point`);
    lines.push(`# ================================================================`);
    lines.push(`_start:`);
    lines.push(`    # Parse command-line arguments`);
    lines.push(`    # Stack layout: [argc][argv[0]][argv[1]]...`);
    lines.push(`    pop rdi                  # rdi = argc`);
    lines.push(`    mov rsi, rsp             # rsi = argv`);
    lines.push(`    push rdi                 # Save argc`);
    lines.push(`    push rsi                 # Save argv`);
    lines.push(`    call init_argv           # Initialize argc/argv for builtins`);
    lines.push(`    pop rsi                  # Restore argv`);
    lines.push(`    pop rdi                  # Restore argc`);
    lines.push(`    call parse_cli_args      # Parse and store args`);
    lines.push(``);
    lines.push(`    # Initialize program`);
    lines.push(`    call init_agents         # REST phase: initialize all agents`);
    lines.push(`    call inject_initial      # SENSE phase: inject initial signal(s)`);
    lines.push(`    call tidal_cycle_loop    # ACT phase: run until completion`);
    lines.push(`    call exit_program        # Exit cleanly`);
    lines.push(``);

    return lines;
  }

  /**
   * Generate REST phase - initialize all agents
   */
  generateRestPhase() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# REST Phase - Agent Initialization`);
    lines.push(`# Initializes queues and calls REST handler for each agent`);
    lines.push(`# ================================================================`);
    lines.push(`init_agents:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);

    // Initialize heap
    lines.push(`    # Initialize heap`);
    lines.push(`    lea rax, [heap_arena]`);
    lines.push(`    mov [heap_ptr], rax`);
    lines.push(`    lea rax, [heap_arena + 104857600]  # 100MB heap`);
    lines.push(`    mov [heap_end], rax`);
    lines.push(``);

    // Queue pointers are already initialized to 0 in .data section
    // No need to initialize them here with the simplified queue implementation
    lines.push(``);

    // Pre-initialize vector and map fields for each agent
    lines.push(`    # Pre-initialize vector and map fields`);
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      const stateOffset = this.symbolTable.getAgentStateOffset(agentId);
      const stateFields = agent.stateFields || [];

      for (const field of stateFields) {
        // Check if field type is a vector or map
        const fieldType = field.type;
        let initFunction = null;

        if (typeof fieldType === 'string') {
          if (fieldType.startsWith('vec<') || fieldType === 'vec') {
            initFunction = 'builtin_vec_new';
          } else if (fieldType.startsWith('map<') || fieldType === 'map') {
            initFunction = 'builtin_map_new';
          }
        } else if (fieldType && fieldType.generic === 'vec') {
          initFunction = 'builtin_vec_new';
        } else if (fieldType && fieldType.generic === 'map') {
          initFunction = 'builtin_map_new';
        }

        if (initFunction) {
          lines.push(`    # Initialize ${agentId}.${field.name} (${fieldType})`);
          lines.push(`    call ${initFunction}`);
          lines.push(`    lea rbx, [agent_state_base + ${stateOffset + field.offset}]`);
          lines.push(`    mov [rbx], rax       # Store pointer at offset ${field.offset}`);
        }
      }
    }
    lines.push(``);

    // Call REST handler for each agent
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      const stateOffset = this.symbolTable.getAgentStateOffset(agentId);
      lines.push(`    # Initialize agent ${agentId}`);
      lines.push(`    lea rdi, [agent_state_base + ${stateOffset}]`);
      lines.push(`    call handler_${agentId}_rest`);
    }

    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return lines;
  }

  /**
   * Generate initial signal injection
   */
  generateInitialSignalInjection() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# SENSE Phase - Initial Signal Injection`);
    lines.push(`# Injects initial signal to start execution`);
    lines.push(`# ================================================================`);
    lines.push(`inject_initial:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);

    // Find fruiting bodies that are inputs
    let hasInputs = false;
    let startupFrequency = null;
    let startupTarget = null;

    for (const [fbName, fbInfo] of this.symbolTable.fruitingBodies.entries()) {
      if (fbInfo.input) {
        hasInputs = true;
        // Find which frequency this is
        const routes = this.symbolTable.routingTable.filter(r => r.source === fbName);
        if (routes.length > 0) {
          const frequency = routes[0].frequency;
          const target = routes[0].target;
          startupFrequency = frequency;
          startupTarget = target;

          lines.push(`    # Inject initial signal to ${fbName} -> ${target} (${frequency})`);
          lines.push(``);

          // Allocate memory for signal payload
          const freqInfo = this.symbolTable.frequencies.get(frequency);
          const payloadSize = freqInfo ? freqInfo.size : 16;

          lines.push(`    # Allocate signal payload (${payloadSize} bytes)`);
          lines.push(`    push rdi`);
          lines.push(`    mov rdi, ${payloadSize}`);
          lines.push(`    call builtin_heap_alloc`);
          lines.push(`    pop rdi`);
          lines.push(`    mov r15, rax             # r15 = payload pointer`);
          lines.push(``);

          // Fill payload with CLI args
          if (frequency === 'startup') {
            lines.push(`    # Fill startup signal payload`);
            lines.push(`    mov rax, [cli_arg_source]   # Load source_file`);
            lines.push(`    mov [r15 + 0], rax       # Store at offset 0`);
            lines.push(`    mov rax, [cli_arg_output]   # Load output_file`);
            lines.push(`    mov [r15 + 8], rax       # Store at offset 8`);
          } else {
            lines.push(`    # Zero-initialize payload`);
            lines.push(`    mov qword ptr [r15], 0`);
          }
          lines.push(``);

          // Enqueue signal to per-source queue
          lines.push(`    # Enqueue signal to ${fbName} -> ${target} (${frequency}) queue`);
          lines.push(`    lea rdi, [signal_queue_${fbName}_${frequency}]`);
          lines.push(`    mov rsi, r15             # Signal payload`);
          lines.push(`    call queue_enqueue`);
          lines.push(``);
        }
      }
    }

    if (!hasInputs) {
      lines.push(`    # No input fruiting bodies - signals come from REST handlers`);
    }

    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return lines;
  }

  /**
   * Generate tidal cycle main loop
   */
  generateTidalCycle() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# ACT Phase - Tidal Cycle Loop`);
    lines.push(`# Processes signals until all queues are empty`);
    lines.push(`# ================================================================`);
    lines.push(`tidal_cycle_loop:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12              # Cycle counter`);
    lines.push(`    push r13              # Signal counter`);
    lines.push(``);

    lines.push(`    xor r12, r12          # r12 = cycle counter`);
    lines.push(``);

    // Main loop
    lines.push(`.cycle_start:`);
    lines.push(`    # Check if we've exceeded max cycles (safety)`);
    lines.push(`    cmp r12, 100000`);
    lines.push(`    jge .cycle_max_reached`);
    lines.push(``);

    lines.push(`    # Increment cycle counter`);
    lines.push(`    inc r12`);
    lines.push(``);

    // Process signals for each source-frequency pair
    lines.push(`    # Process all pending signals`);
    lines.push(`    xor r13, r13          # r13 = signals processed this cycle`);
    lines.push(``);

    // Group routes by source-frequency pair and process each
    const routesSeen = new Set();
    for (const route of this.symbolTable.routingTable) {
      const key = `${route.source}_${route.frequency}`;
      if (!routesSeen.has(key)) {
        routesSeen.add(key);
        lines.push(`    # Process ${route.frequency} signals from ${route.source}`);
        lines.push(`    call process_${key}_signals`);
        lines.push(`    add r13, rax          # Add to signal count`);
        lines.push(``);
      }
    }

    // Check if any signals were processed
    lines.push(`    # If no signals processed, we're done`);
    lines.push(`    test r13, r13`);
    lines.push(`    jz .cycle_complete`);
    lines.push(``);

    // Continue to next cycle
    lines.push(`    jmp .cycle_start`);
    lines.push(``);

    // Exit conditions
    lines.push(`.cycle_complete:`);
    lines.push(`    # All queues empty - execution complete`);
    lines.push(`    mov rax, r12          # Return cycle count`);
    lines.push(`    jmp .cycle_exit`);
    lines.push(``);

    lines.push(`.cycle_max_reached:`);
    lines.push(`    # Max cycles reached - safety exit`);
    lines.push(`    # Print warning`);
    lines.push(`    push rdi`);
    lines.push(`    lea rdi, [max_cycles_warning]`);
    lines.push(`    call builtin_println`);
    lines.push(`    pop rdi`);
    lines.push(`    mov rax, -1           # Return -1 to indicate timeout`);
    lines.push(``);

    lines.push(`.cycle_exit:`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return lines;
  }

  /**
   * Generate signal processing functions for each source-frequency pair
   * This prevents routing loops by processing signals from each source separately
   */
  generateSignalProcessors() {
    const lines = [];

    // Group routes by source-frequency pair
    const routesBySourceFreq = new Map();
    for (const route of this.symbolTable.routingTable) {
      const key = `${route.source}_${route.frequency}`;
      if (!routesBySourceFreq.has(key)) {
        routesBySourceFreq.set(key, []);
      }
      routesBySourceFreq.get(key).push(route);
    }

    // Generate a processor for each source-frequency pair
    for (const [key, routes] of routesBySourceFreq.entries()) {
      const freqName = routes[0].frequency;
      const sourceName = routes[0].source;

      lines.push(`# ================================================================`);
      lines.push(`# Process ${freqName} Signals from ${sourceName}`);
      lines.push(`# Returns: rax = number of signals processed`);
      lines.push(`# ================================================================`);
      lines.push(`process_${key}_signals:`);
      lines.push(`    push rbp`);
      lines.push(`    mov rbp, rsp`);
      lines.push(`    push r12              # Agent state pointer`);
      lines.push(`    push r13              # Signal payload pointer`);
      lines.push(`    push r14              # Signals processed counter`);
      lines.push(``);

      lines.push(`    xor r14, r14          # r14 = signals processed`);
      lines.push(``);

      // Check queue for signals
      lines.push(`.process_${key}_loop:`);
      lines.push(`    # Check if queue has signals`);
      lines.push(`    lea rdi, [signal_queue_${key}]`);
      lines.push(`    call queue_has_signals`);
      lines.push(`    test rax, rax`);
      lines.push(`    jz .process_${key}_done`);
      lines.push(``);

      // Dequeue signal
      lines.push(`    # Dequeue signal`);
      lines.push(`    lea rdi, [signal_queue_${key}]`);
      lines.push(`    lea rsi, [signal_buffer]`);
      lines.push(`    call queue_dequeue`);
      lines.push(`    mov r13, rax          # r13 = signal payload pointer`);
      lines.push(``);

      // Dispatch to all targets for this source-frequency combination
      for (const route of routes) {
        const agentId = route.target;

        // Skip fruiting bodies (output points)
        if (this.symbolTable.fruitingBodies.has(agentId)) {
          lines.push(`    # Signal to fruiting body ${agentId} - output`);
          lines.push(`    # TODO: Handle output to fruiting body`);
          continue;
        }

        const stateOffset = this.symbolTable.getAgentStateOffset(agentId);
        lines.push(`    # Dispatch to ${agentId} (from ${sourceName})`);
        lines.push(`    lea r12, [agent_state_base + ${stateOffset}]`);
        lines.push(`    mov rdi, r12          # Agent state`);
        lines.push(`    mov rsi, r13          # Signal payload`);
        lines.push(`    call handler_${agentId}_${freqName}`);
        lines.push(``);
      }

      lines.push(`    # Increment processed counter`);
      lines.push(`    inc r14`);
      lines.push(`    jmp .process_${key}_loop`);
      lines.push(``);

      lines.push(`.process_${key}_done:`);
      lines.push(`    mov rax, r14          # Return signals processed`);
      lines.push(`    pop r14`);
      lines.push(`    pop r13`);
      lines.push(`    pop r12`);
      lines.push(`    pop rbp`);
      lines.push(`    ret`);
      lines.push(``);
    }

    return lines;
  }

  /**
   * Generate queue management functions
   */
  generateQueueFunctions() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Signal Queue Management Functions`);
    lines.push(`# ================================================================`);
    lines.push(``);

    // queue_has_signals - check if queue has any signals
    lines.push(`# Check if queue has signals`);
    lines.push(`# Arguments: rdi = queue pointer`);
    lines.push(`# Returns: rax = 1 if has signals, 0 if empty`);
    lines.push(`# Queue structure: [head_idx: 8][tail_idx: 8][buffer: array]`);
    lines.push(`queue_has_signals:`);
    lines.push(`    mov rax, [rdi + 0]    # head_idx`);
    lines.push(`    mov rbx, [rdi + 8]    # tail_idx`);
    lines.push(`    cmp rax, rbx          # head == tail means empty`);
    lines.push(`    je .queue_empty`);
    lines.push(`    mov rax, 1            # Not empty`);
    lines.push(`    ret`);
    lines.push(`.queue_empty:`);
    lines.push(`    xor rax, rax          # Empty`);
    lines.push(`    ret`);
    lines.push(``);

    // queue_dequeue - remove signal from queue
    lines.push(`# Dequeue signal from queue`);
    lines.push(`# Arguments: rdi = queue pointer, rsi = destination buffer (unused)`);
    lines.push(`# Returns: rax = pointer to dequeued signal payload`);
    lines.push(`# Queue structure: [head_idx: 8][tail_idx: 8][buffer: array of ${this.queueCapacity} pointers]`);
    lines.push(`queue_dequeue:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Check if empty`);
    lines.push(`    mov rax, [rdi + 0]    # head_idx`);
    lines.push(`    mov rbx, [rdi + 8]    # tail_idx`);
    lines.push(`    cmp rax, rbx`);
    lines.push(`    je .dequeue_error     # head == tail means empty`);
    lines.push(``);
    lines.push(`    # Get payload pointer from buffer[head_idx]`);
    lines.push(`    mov rcx, rax          # rcx = head_idx`);
    lines.push(`    shl rcx, 3            # rcx = head_idx * 8 (pointer size)`);
    lines.push(`    add rcx, 16           # rcx = offset (skip head/tail)`);
    lines.push(`    mov rax, [rdi + rcx]  # Load payload pointer`);
    lines.push(`    push rax              # Save payload pointer`);
    lines.push(``);
    lines.push(`    # Increment head_idx (with wraparound)`);
    lines.push(`    mov rax, [rdi + 0]    # head_idx`);
    lines.push(`    inc rax`);
    lines.push(`    cmp rax, ${this.queueCapacity}`);
    lines.push(`    jl .dequeue_no_wrap`);
    lines.push(`    xor rax, rax          # Wrap to 0`);
    lines.push(`.dequeue_no_wrap:`);
    lines.push(`    mov [rdi + 0], rax    # Store new head_idx`);
    lines.push(``);
    lines.push(`    pop rax               # Return payload pointer`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.dequeue_error:`);
    lines.push(`    xor rax, rax          # Return NULL`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // queue_enqueue - add signal to queue
    lines.push(`# Enqueue signal to queue`);
    lines.push(`# Arguments: rdi = queue pointer, rsi = signal data pointer`);
    lines.push(`# Returns: rax = 0 on success, -1 on error (queue full)`);
    lines.push(`# Queue structure: [head_idx: 8][tail_idx: 8][buffer: array of ${this.queueCapacity} pointers]`);
    lines.push(`queue_enqueue:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Calculate next_tail = (tail_idx + 1) % capacity`);
    lines.push(`    mov rax, [rdi + 8]    # tail_idx`);
    lines.push(`    inc rax`);
    lines.push(`    cmp rax, ${this.queueCapacity}`);
    lines.push(`    jl .enqueue_no_wrap`);
    lines.push(`    xor rax, rax          # Wrap to 0`);
    lines.push(`.enqueue_no_wrap:`);
    lines.push(``);
    lines.push(`    # Check if full: next_tail == head_idx`);
    lines.push(`    mov rbx, [rdi + 0]    # head_idx`);
    lines.push(`    cmp rax, rbx`);
    lines.push(`    je .enqueue_error     # Queue full`);
    lines.push(``);
    lines.push(`    # Store payload in buffer[tail_idx]`);
    lines.push(`    mov rbx, [rdi + 8]    # tail_idx`);
    lines.push(`    shl rbx, 3            # tail_idx * 8`);
    lines.push(`    add rbx, 16           # offset (skip head/tail)`);
    lines.push(`    mov [rdi + rbx], rsi  # Store payload pointer`);
    lines.push(``);
    lines.push(`    # Update tail_idx`);
    lines.push(`    mov [rdi + 8], rax    # Store new tail_idx`);
    lines.push(``);
    lines.push(`    xor rax, rax          # Return 0 (success)`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.enqueue_error:`);
    lines.push(`    mov rax, -1           # Return -1 (queue full)`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return lines;
  }

  /**
   * Generate CLI argument parsing
   */
  generateCliParser() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Parse CLI Arguments`);
    lines.push(`# Arguments: rdi = argc, rsi = argv`);
    lines.push(`# Stores: cli_arg_source, cli_arg_output`);
    lines.push(`# ================================================================`);
    lines.push(`parse_cli_args:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);

    lines.push(`    # Check if source_file provided (argc >= 2)`);
    lines.push(`    cmp rdi, 2`);
    lines.push(`    jl .use_default_source`);
    lines.push(`    mov rax, [rsi + 8]    # argv[1] = source_file`);
    lines.push(`    mov [cli_arg_source], rax`);
    lines.push(`    jmp .check_output`);
    lines.push(``);
    lines.push(`.use_default_source:`);
    lines.push(`    lea rax, [default_source]`);
    lines.push(`    mov [cli_arg_source], rax`);
    lines.push(``);
    lines.push(`.check_output:`);
    lines.push(`    # Check if output_file provided (argc >= 3)`);
    lines.push(`    cmp rdi, 3`);
    lines.push(`    jl .use_default_output`);
    lines.push(`    mov rax, [rsi + 16]   # argv[2] = output_file`);
    lines.push(`    mov [cli_arg_output], rax`);
    lines.push(`    jmp .parse_done`);
    lines.push(``);
    lines.push(`.use_default_output:`);
    lines.push(`    lea rax, [default_output]`);
    lines.push(`    mov [cli_arg_output], rax`);
    lines.push(``);
    lines.push(`.parse_done:`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return lines;
  }

  /**
   * Generate exit sequence
   */
  generateExit() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Exit Program`);
    lines.push(`# ================================================================`);
    lines.push(`exit_program:`);
    lines.push(`    # Exit with code 0 - use libc exit to flush stdio buffers`);
    lines.push(`    xor rdi, rdi          # Exit code 0`);
    lines.push(`    call exit             # Call libc exit (flushes buffers)`);
    lines.push(``);

    return lines;
  }

  /**
   * Generate signal queue data structures
   */
  generateQueueDataStructures() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Signal Queue Data Structures`);
    lines.push(`# Each queue: [head_idx: 8][tail_idx: 8][buffer: ${this.queueCapacity} * 8 bytes]`);
    lines.push(`# ================================================================`);
    lines.push(`.data`);
    lines.push(``);

    // CLI argument storage
    lines.push(`# CLI argument storage`);
    lines.push(`cli_arg_source:`);
    lines.push(`    .quad 0               # Pointer to source file path`);
    lines.push(`cli_arg_output:`);
    lines.push(`    .quad 0               # Pointer to output file path`);
    lines.push(``);

    lines.push(`# Default file paths`);
    lines.push(`default_source:`);
    lines.push(`    .asciz "test.mycelial"`);
    lines.push(`default_output:`);
    lines.push(`    .asciz "a.out"`);
    lines.push(``);
    lines.push(`# Warning/debug messages`);
    lines.push(`max_cycles_warning:`);
    lines.push(`    .asciz "[WARNING] Max tidal cycles (10) reached - possible infinite loop"`);
    lines.push(`startup_msg:`);
    lines.push(`    .asciz "[DEBUG] Program starting..."`);
    lines.push(`cli_parsed_msg:`);
    lines.push(`    .asciz "[DEBUG] CLI args parsed"`);
    lines.push(`init_done_msg:`);
    lines.push(`    .asciz "[DEBUG] Agents initialized"`);
    lines.push(`starting_tidal_msg:`);
    lines.push(`    .asciz "[DEBUG] Starting tidal cycle loop..."`);
    lines.push(`cycle_start_msg:`);
    lines.push(`    .asciz "[CYCLE]"`);
    lines.push(``);

    // Create a queue for each agent-frequency pair (to prevent routing loops)
    // This includes all combinations since any agent may emit any frequency
    // Ring buffer: [head_idx][tail_idx][buffer array]
    const queuesSeen = new Set();

    // Generate queues for all agent × frequency combinations
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      for (const [freqName, freqInfo] of this.symbolTable.frequencies.entries()) {
        const queueName = `${agentId}_${freqName}`;
        if (!queuesSeen.has(queueName)) {
          queuesSeen.add(queueName);
          lines.push(`signal_queue_${queueName}:`);
          lines.push(`    .quad 0                          # head_idx (initialized to 0)`);
          lines.push(`    .quad 0                          # tail_idx (initialized to 0)`);
          lines.push(`    .skip ${this.queueCapacity * 8}  # buffer: ${this.queueCapacity} pointers`);
          lines.push(``);
        }
      }
    }

    // Also create queues for fruiting body (input) sources
    for (const [fbName, fbInfo] of this.symbolTable.fruitingBodies.entries()) {
      for (const [freqName, freqInfo] of this.symbolTable.frequencies.entries()) {
        const queueName = `${fbName}_${freqName}`;
        if (!queuesSeen.has(queueName)) {
          queuesSeen.add(queueName);
          lines.push(`signal_queue_${queueName}:`);
          lines.push(`    .quad 0                          # head_idx (initialized to 0)`);
          lines.push(`    .quad 0                          # tail_idx (initialized to 0)`);
          lines.push(`    .skip ${this.queueCapacity * 8}  # buffer: ${this.queueCapacity} pointers`);
          lines.push(``);
        }
      }
    }

    // Create buffer space for each queue
    lines.push(`.bss`);
    for (const [freqName, freqInfo] of this.symbolTable.frequencies.entries()) {
      const bufferSize = this.maxSignalsPerCycle * this.signalStructSize;
      lines.push(`signal_buffer_${freqName}:`);
      lines.push(`    .skip ${bufferSize}    # Buffer for ${freqName} signals`);
      lines.push(``);
    }

    // General signal buffer for dequeued signals
    lines.push(`signal_buffer:`);
    lines.push(`    .skip ${this.signalStructSize}    # Temporary signal buffer`);
    lines.push(``);

    // Agent state base
    lines.push(`.data`);
    lines.push(`agent_state_base:`);
    lines.push(`    .skip ${this.symbolTable.totalStateSize}    # All agent states`);
    lines.push(``);

    return lines;
  }

  /**
   * Generate initial signal injection helper
   */
  generateInitialSignalHelper() {
    const lines = [];

    lines.push(`# ================================================================`);
    lines.push(`# Enqueue Initial Signal`);
    lines.push(`# Arguments: rdi = queue pointer`);
    lines.push(`# ================================================================`);
    lines.push(`enqueue_initial_signal:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Create a dummy signal with zero payload`);
    lines.push(`    lea rsi, [signal_buffer]`);
    lines.push(`    call queue_enqueue`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return lines;
  }
}

module.exports = { SchedulerCodegen };

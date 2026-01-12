/**
 * Handler Code Generator
 *
 * Generates complete handler functions from Mycelial handler definitions.
 * Produces properly structured x86-64 functions with:
 * - Function prologue (stack frame setup)
 * - Agent state initialization
 * - Signal payload extraction
 * - Handler body compilation
 * - Function epilogue (cleanup and return)
 *
 * Calling Convention (System V AMD64 ABI):
 * - First argument (rdi): Pointer to signal payload
 * - Return value (rax): Handler status (0 = success)
 * - Callee-saved registers: rbx, r12-r15, rbp
 *
 * Register Usage:
 * - r12: Agent state base pointer (callee-saved)
 * - r13: Signal payload pointer (callee-saved)
 * - r14-r15: Reserved for statement compiler
 * - rbp: Frame pointer
 * - rsp: Stack pointer
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-10
 */

class HandlerCodeGenerator {
  constructor(symbolTable, expressionCompiler, statementCompiler) {
    this.symbolTable = symbolTable;
    this.exprCompiler = expressionCompiler;
    this.stmtCompiler = statementCompiler;
  }

  /**
   * Generate a complete handler function
   * @param {string} agentId - Agent instance ID
   * @param {Object} handlerDef - Handler definition from AST
   * @returns {Object} { label, code, context }
   */
  generateHandler(agentId, handlerDef) {
    const agent = this.symbolTable.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Generate handler label based on type
    let handlerLabel;
    if (handlerDef.type === 'cycle') {
      // Extract cycle number from literal expression if needed
      let cycleNum = handlerDef.cycleNumber;
      if (typeof cycleNum === 'object' && cycleNum.type === 'literal') {
        cycleNum = cycleNum.value;
      }
      handlerLabel = `handler_${agentId}_cycle${cycleNum}`;
    } else {
      handlerLabel = `handler_${agentId}_${handlerDef.frequency}`;
    }

    // Create compilation context
    const context = {
      agentId: agentId,
      agent: agent,
      handlerType: handlerDef.type,
      cycleNumber: handlerDef.cycleNumber || null,
      signalFrequency: handlerDef.frequency,
      signalBinding: handlerDef.binding || null,
      locals: {},
      localStackOffset: 0
    };

    const lines = [];

    // Add handler header comment
    lines.push(`# ================================================================`);
    lines.push(`# Handler: ${handlerLabel}`);
    lines.push(`# Agent: ${agentId} (type: ${agent.type})`);
    if (handlerDef.type === 'cycle') {
      // Extract cycle number from literal expression if needed
      let cycleNum = handlerDef.cycleNumber;
      if (typeof cycleNum === 'object' && cycleNum.type === 'literal') {
        cycleNum = cycleNum.value;
      }
      lines.push(`# Type: Timed handler (cycle ${cycleNum})`);
    } else {
      lines.push(`# Signal: ${handlerDef.frequency}`);
      if (handlerDef.binding) {
        lines.push(`# Binding: ${handlerDef.binding}`);
      }
    }
    lines.push(`# ================================================================`);
    lines.push(``);

    // Function label
    lines.push(`${handlerLabel}:`);

    // Generate prologue
    const prologueCode = this.generatePrologue(context);
    lines.push(prologueCode);

    // Generate agent state setup
    const stateSetupCode = this.generateStateSetup(context);
    lines.push(stateSetupCode);

    // Generate signal payload setup (only for signal handlers)
    if (handlerDef.type !== 'cycle') {
      const payloadSetupCode = this.generatePayloadSetup(context);
      lines.push(payloadSetupCode);
    }

    // Compile guard condition (if present)
    if (handlerDef.guard) {
      const guardCode = this.generateGuard(handlerDef.guard, context);
      lines.push(guardCode);
    }

    // Compile handler body
    const bodyCode = this.generateBody(handlerDef.body, context);
    lines.push(bodyCode);

    // Generate epilogue
    const epilogueCode = this.generateEpilogue(context);
    lines.push(epilogueCode);

    lines.push(``);

    return {
      label: handlerLabel,
      code: lines.join('\n'),
      context: context
    };
  }

  /**
   * Generate function prologue
   * Sets up stack frame and saves registers
   */
  generatePrologue(context) {
    const lines = [];

    lines.push(`    # Prologue`);
    lines.push(`    push rbp                  # save base pointer`);
    lines.push(`    mov rbp, rsp              # set up stack frame`);

    // Calculate local variable space needed
    // For now, allocate a fixed amount (can optimize later)
    const localSpace = 64; // 64 bytes for local variables
    if (localSpace > 0) {
      lines.push(`    sub rsp, ${localSpace}            # allocate local space`);
    }

    // Save callee-saved registers we're using (r12-r15)
    // r14 and r15 are used by tidal_cycle_loop for cycle/empty counters
    lines.push(`    push r12                  # save r12 (will use for state)`);
    lines.push(`    push r13                  # save r13 (will use for payload)`);
    lines.push(`    push r14                  # save r14 (used by emit statements)`);
    lines.push(`    push r15                  # save r15 (reserved)`);
    lines.push(``);

    return lines.join('\n');
  }

  /**
   * Generate agent state setup
   * Loads agent state base address into r12
   */
  generateStateSetup(context) {
    const lines = [];
    const agentId = context.agentId;

    lines.push(`    # Agent state setup`);
    lines.push(`    lea r12, [agent_${agentId}_state]    # r12 = agent state base`);
    lines.push(``);

    return lines.join('\n');
  }

  /**
   * Generate signal payload setup
   * Extracts payload pointer from rdi and stores in r13
   */
  generatePayloadSetup(context) {
    const lines = [];

    if (context.signalBinding) {
      lines.push(`    # Signal payload setup`);
      lines.push(`    mov r13, rdi              # r13 = signal payload (${context.signalBinding})`);
      lines.push(``);
    }

    return lines.join('\n');
  }

  /**
   * Generate guard condition check
   * If guard fails, skip handler body
   */
  generateGuard(guardExpr, context) {
    const lines = [];
    const skipLabel = `.guard_skip_${this.makeUniqueId()}`;

    lines.push(`    # Guard condition`);

    // Compile guard expression
    const guardCode = this.exprCompiler.compile(guardExpr, context);
    lines.push(guardCode);

    // Test result
    lines.push(`    test rax, rax             # check guard`);
    lines.push(`    jz ${skipLabel}           # skip if guard fails`);
    lines.push(``);

    // Store skip label in context for epilogue
    context.guardSkipLabel = skipLabel;

    return lines.join('\n');
  }

  /**
   * Generate handler body
   * Compiles all statements in the handler
   */
  generateBody(body, context) {
    const lines = [];

    lines.push(`    # Handler body`);

    // Body is an array of statements
    if (Array.isArray(body)) {
      for (const stmt of body) {
        const stmtCode = this.stmtCompiler.compile(stmt, context);
        if (stmtCode) {
          lines.push(stmtCode);
        }
      }
    } else if (body) {
      // Single statement
      const stmtCode = this.stmtCompiler.compile(body, context);
      if (stmtCode) {
        lines.push(stmtCode);
      }
    }

    lines.push(``);

    // Add guard skip label if guard was present
    if (context.guardSkipLabel) {
      lines.push(`${context.guardSkipLabel}:`);
    }

    return lines.join('\n');
  }

  /**
   * Generate function epilogue
   * Restores registers and returns
   */
  generateEpilogue(context) {
    const lines = [];

    lines.push(`    # Epilogue`);

    // Restore callee-saved registers (in reverse order of pushing)
    lines.push(`    pop r15                   # restore r15`);
    lines.push(`    pop r14                   # restore r14`);
    lines.push(`    pop r13                   # restore r13`);
    lines.push(`    pop r12                   # restore r12`);

    // Restore stack frame
    lines.push(`    mov rsp, rbp              # restore stack pointer`);
    lines.push(`    pop rbp                   # restore base pointer`);

    // Return success
    lines.push(`    xor rax, rax              # return 0 (success)`);
    lines.push(`    ret                       # return`);

    return lines.join('\n');
  }

  /**
   * Generate unique ID for labels
   */
  makeUniqueId() {
    if (!this._uniqueCounter) {
      this._uniqueCounter = 0;
    }
    return this._uniqueCounter++;
  }

  /**
   * Generate all handlers for an agent
   * @param {string} agentId - Agent instance ID
   * @returns {Array} Array of handler objects
   */
  generateAllHandlers(agentId) {
    const agent = this.symbolTable.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const handlers = [];
    const typeDef = agent.typeDef;

    // Generate code for each handler
    for (const handlerDef of typeDef.handlers) {
      if (handlerDef.type === 'signal' || handlerDef.type === 'cycle') {
        const handler = this.generateHandler(agentId, handlerDef);
        handlers.push(handler);
      }
    }

    return handlers;
  }

  /**
   * Generate handlers for all agents in the network
   * @returns {Array} Array of all handler objects
   */
  generateAllNetworkHandlers() {
    const allHandlers = [];

    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      const agentHandlers = this.generateAllHandlers(agentId);
      allHandlers.push(...agentHandlers);
    }

    return allHandlers;
  }
}

module.exports = { HandlerCodeGenerator };

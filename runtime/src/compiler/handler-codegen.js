/**
 * Mycelial Handler Code Generator
 *
 * Generates complete handler functions with prologues, epilogues, and body.
 * Each handler is a callable x86-64 function that executes agent logic.
 *
 * Handler calling convention:
 * - rdi: agent state pointer
 * - rsi: signal payload pointer (for signal handlers)
 * - Returns: void
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-15
 */

const { StatementCompiler } = require('./statement-compiler.js');

class HandlerCodegen {
  constructor(symbolTable, agentId, sharedLabelCounter = null) {
    this.symbolTable = symbolTable;
    this.agentId = agentId;
    // Use shared label counter if provided, otherwise create local one
    this.labelCounter = sharedLabelCounter || { count: 0 };
    this.stmtCompiler = new StatementCompiler(symbolTable, agentId, this.labelCounter);
  }

  /**
   * Generate a unique label
   */
  genLabel(prefix) {
    return `${prefix}_${this.labelCounter.count++}`;
  }

  /**
   * Generate REST handler (initialization)
   * Called once when the agent is spawned
   */
  generateRestHandler() {
    const lines = [];
    const agent = this.symbolTable.agents.get(this.agentId);

    if (!agent) {
      throw new Error(`Unknown agent: ${this.agentId}`);
    }

    const restBody = agent.handlers.rest;
    if (!restBody) {
      // No REST handler defined, generate empty one
      return this.generateEmptyRestHandler();
    }

    const handlerName = `handler_${this.agentId}_rest`;

    lines.push(`# ================================================================`);
    lines.push(`# REST Handler: ${this.agentId}`);
    lines.push(`# Initializes agent state`);
    lines.push(`# Arguments: rdi = agent state pointer`);
    lines.push(`# ================================================================`);
    lines.push(`${handlerName}:`);

    // Prologue
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12              # Save r12`);
    lines.push(`    push r13              # Save r13`);
    lines.push(`    push r14              # Save r14`);
    lines.push(`    push r15              # Save r15`);
    lines.push(``);

    // Set up agent state pointer
    lines.push(`    # Set up agent state pointer`);
    lines.push(`    mov r12, rdi          # r12 = agent state base`);
    lines.push(``);

    // Reset local variables for this handler
    this.stmtCompiler.exprCompiler.setHandlerContext(null, null);
    this.stmtCompiler.setFunctionContext(handlerName);

    // Compile handler body
    lines.push(`    # Handler body`);
    lines.push(...this.stmtCompiler.compileBlock(restBody));
    lines.push(``);

    // Allocate stack space for local variables if needed
    const stackSpace = this.stmtCompiler.exprCompiler.maxStackOffset;
    if (stackSpace > 0) {
      // Insert stack allocation after prologue
      const allocLine = `    sub rsp, ${stackSpace}        # Allocate space for local variables`;
      lines.splice(8, 0, allocLine);  // Insert after push r15
      lines.splice(9, 0, ``);
    }

    // Epilogue - return label must come first so early returns jump here
    lines.push(`.${handlerName}_return:`);
    lines.push(`    # Epilogue`);

    // Deallocate stack space for local variables if needed
    if (stackSpace > 0) {
      lines.push(`    add rsp, ${stackSpace}        # Deallocate local variables`);
    }

    lines.push(`    pop r15`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return { name: handlerName, code: lines };
  }

  /**
   * Generate empty REST handler
   */
  generateEmptyRestHandler() {
    const lines = [];
    const handlerName = `handler_${this.agentId}_rest`;

    lines.push(`# ================================================================`);
    lines.push(`# Empty REST Handler: ${this.agentId}`);
    lines.push(`# ================================================================`);
    lines.push(`${handlerName}:`);
    lines.push(`    ret`);
    lines.push(``);

    return { name: handlerName, code: lines };
  }

  /**
   * Generate signal handler
   * Called when the agent receives a signal of a specific frequency
   */
  generateSignalHandler(frequency) {
    const lines = [];
    const agent = this.symbolTable.agents.get(this.agentId);

    if (!agent) {
      throw new Error(`Unknown agent: ${this.agentId}`);
    }

    const handlerInfo = agent.handlers.signal.get(frequency);
    if (!handlerInfo) {
      throw new Error(`No handler for frequency ${frequency} on agent ${this.agentId}`);
    }

    const handlerName = `handler_${this.agentId}_${frequency}`;
    const paramName = handlerInfo.paramName || 'msg';

    lines.push(`# ================================================================`);
    lines.push(`# Signal Handler: ${this.agentId} on ${frequency}`);
    lines.push(`# Handles incoming signals of frequency ${frequency}`);
    lines.push(`# Arguments: rdi = agent state pointer, rsi = signal payload pointer`);
    lines.push(`# Parameter: ${paramName}`);
    lines.push(`# ================================================================`);
    lines.push(`${handlerName}:`);

    // Prologue
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12              # Save r12`);
    lines.push(`    push r13              # Save r13`);
    lines.push(`    push r14              # Save r14`);
    lines.push(`    push r15              # Save r15`);
    lines.push(``);

    // Set up pointers
    lines.push(`    # Set up pointers`);
    lines.push(`    mov r12, rdi          # r12 = agent state base`);
    lines.push(`    mov r13, rsi          # r13 = signal payload pointer`);
    lines.push(``);

    // Set handler context for signal parameter access
    this.stmtCompiler.setHandlerContext(frequency, paramName);
    this.stmtCompiler.setFunctionContext(handlerName);

    // Compile handler body
    lines.push(`    # Handler body`);
    lines.push(...this.stmtCompiler.compileBlock(handlerInfo.body));
    lines.push(``);

    // Allocate stack space for local variables if needed
    const stackSpace = this.stmtCompiler.exprCompiler.maxStackOffset;
    if (stackSpace > 0) {
      // Insert stack allocation after prologue
      const allocLine = `    sub rsp, ${stackSpace}        # Allocate space for local variables`;
      lines.splice(9, 0, allocLine);  // Insert after push r15
      lines.splice(10, 0, ``);
    }

    // Epilogue - return label must come first so early returns jump here
    lines.push(`.${handlerName}_return:`);
    lines.push(`    # Epilogue`);

    // Deallocate stack space for local variables if needed
    if (stackSpace > 0) {
      lines.push(`    add rsp, ${stackSpace}        # Deallocate local variables`);
    }

    lines.push(`    pop r15`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return { name: handlerName, code: lines };
  }

  /**
   * Generate a rule function (helper function)
   * Rules are local functions that can be called by handlers
   */
  generateRuleFunction(ruleName) {
    const lines = [];
    const agent = this.symbolTable.agents.get(this.agentId);

    if (!agent) {
      throw new Error(`Unknown agent: ${this.agentId}`);
    }

    const rule = agent.rules.get(ruleName);
    if (!rule) {
      throw new Error(`Unknown rule: ${ruleName}`);
    }

    const functionName = `rule_${this.agentId}_${ruleName}`;

    lines.push(`# ================================================================`);
    lines.push(`# Rule: ${this.agentId}.${ruleName}`);
    lines.push(`# Parameters: ${rule.params.map(p => `${p.name}: ${p.type}`).join(', ')}`);
    lines.push(`# Returns: ${rule.returnType}`);
    lines.push(`# ================================================================`);
    lines.push(`${functionName}:`);

    // Set up parameter context FIRST (before generating prologue)
    // This way we know how much stack space we need
    // For rules, stack frame offset is 32 (4 saved registers * 8 bytes each)
    this.stmtCompiler.exprCompiler.setHandlerContext(null, null);
    this.stmtCompiler.exprCompiler.setStackFrameOffset(32);
    this.stmtCompiler.setFunctionContext(functionName);

    // Add parameters as local variables to calculate stack space needed
    const argRegs = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
    console.error(`[DEBUG] Rule ${ruleName} has ${rule.params.length} params:`, JSON.stringify(rule.params));
    for (let i = 0; i < rule.params.length; i++) {
      const param = rule.params[i];
      // Pass type information for parameters so field access works
      console.error(`[DEBUG] Adding param ${param.name} with type ${param.type}`);
      this.stmtCompiler.exprCompiler.addLocalVar(param.name, 8, param.type);
    }

    // Compile rule body (this might add more local variables)
    const bodyLines = this.stmtCompiler.compileBlock(rule.body);

    // Now we know the stack space needed
    const stackSpace = this.stmtCompiler.exprCompiler.maxStackOffset;

    // Generate prologue with correct stack allocation
    // Standard prologue: push rbp, set rbp, save callee-saved regs, THEN allocate locals
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12              # Save r12`);
    lines.push(`    push r13              # Save r13`);
    lines.push(`    push r14              # Save r14`);
    lines.push(`    push r15              # Save r15`);
    if (stackSpace > 0) {
      lines.push(`    sub rsp, ${stackSpace}        # Allocate space for local variables`);
    }
    lines.push(``);

    // Note: r12 should already point to agent state (from caller)
    lines.push(`    # Agent state pointer is in r12 (from caller)`);
    lines.push(``);

    // Generate parameter initialization
    // Note: offsets include stack frame offset set above
    for (let i = 0; i < rule.params.length; i++) {
      const param = rule.params[i];
      const offset = this.stmtCompiler.exprCompiler.tempVars.get(param.name) + this.stmtCompiler.exprCompiler.stackFrameOffset;
      lines.push(`    # Parameter ${param.name}: ${param.type}`);

      if (i < 6) {
        // Parameters 0-5 come from registers
        lines.push(`    mov [rbp - ${offset}], ${argRegs[i]}`);
      } else {
        // Parameters 6+ come from stack (above saved rbp)
        // Stack layout: ... [arg7] [arg6] [return addr] [saved rbp] <- rbp
        // Offset from rbp: 16 + (param_index - 6) * 8
        const stackParamOffset = 16 + (i - 6) * 8;
        lines.push(`    mov rax, [rbp + ${stackParamOffset}]  # Load from stack`);
        lines.push(`    mov [rbp - ${offset}], rax            # Store to local`);
      }
    }
    lines.push(``);

    // Add rule body
    lines.push(`    # Rule body`);
    lines.push(...bodyLines);
    lines.push(``);

    // Epilogue
    lines.push(`.${functionName}_return:`);
    lines.push(`    # Epilogue`);

    // Deallocate stack space for local variables if needed
    if (stackSpace > 0) {
      lines.push(`    add rsp, ${stackSpace}        # Deallocate local variables`);
    }

    lines.push(`    pop r15`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    return { name: functionName, code: lines };
  }

  /**
   * Generate all handlers for this agent
   */
  generateAllHandlers() {
    const handlers = [];
    const agent = this.symbolTable.agents.get(this.agentId);

    if (!agent) {
      throw new Error(`Unknown agent: ${this.agentId}`);
    }

    // Generate rule functions first (so they can be called by handlers)
    if (agent.rules) {
      for (const ruleName of agent.rules.keys()) {
        handlers.push(this.generateRuleFunction(ruleName));
      }
    }

    // Generate REST handler
    handlers.push(this.generateRestHandler());

    // Generate signal handlers
    for (const frequency of agent.handlers.signal.keys()) {
      handlers.push(this.generateSignalHandler(frequency));
    }

    // TODO: Generate timer handlers

    // Collect string literals from the statement compiler's expression compiler
    for (const handler of handlers) {
      handler.stringLiterals = this.stmtCompiler.exprCompiler.stringLiterals;
    }

    return handlers;
  }

  /**
   * Generate handler dispatch table
   * Maps (frequency -> handler function pointer)
   */
  generateDispatchTable() {
    const lines = [];
    const agent = this.symbolTable.agents.get(this.agentId);

    if (!agent) {
      throw new Error(`Unknown agent: ${this.agentId}`);
    }

    lines.push(`# ================================================================`);
    lines.push(`# Dispatch Table: ${this.agentId}`);
    lines.push(`# Maps frequency ID to handler function pointer`);
    lines.push(`# ================================================================`);
    lines.push(`.data`);
    lines.push(`dispatch_table_${this.agentId}:`);

    // Create array of function pointers indexed by frequency ID
    const freqCount = this.symbolTable.frequencies.size;
    const handlers = new Array(freqCount).fill(null);

    // Fill in signal handlers
    for (const [frequency, handlerInfo] of agent.handlers.signal.entries()) {
      const freqInfo = this.symbolTable.frequencies.get(frequency);
      if (freqInfo) {
        handlers[freqInfo.id] = `handler_${this.agentId}_${frequency}`;
      }
    }

    // Generate the table
    for (let i = 0; i < freqCount; i++) {
      if (handlers[i]) {
        lines.push(`    .quad ${handlers[i]}`);
      } else {
        lines.push(`    .quad 0              # No handler for frequency ${i}`);
      }
    }

    lines.push(``);

    return lines;
  }
}

module.exports = { HandlerCodegen };

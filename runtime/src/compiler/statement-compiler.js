/**
 * Statement Compiler
 *
 * Compiles Mycelial statements to x86-64 assembly.
 * Works together with ExpressionCompiler for complete code generation.
 *
 * Supported Statements:
 * - Assignment: state.field = expr
 * - Emit: emit frequency { payload }
 * - Conditional: if (condition) { ... } else { ... }
 * - Report: report key: value
 * - Block: sequence of statements
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-10
 */

class StatementCompiler {
  constructor(symbolTable, expressionCompiler) {
    this.symbolTable = symbolTable;
    this.exprCompiler = expressionCompiler;
    this.labelCounter = 0;
  }

  /**
   * Compile a statement to assembly
   * @param {Object} stmt - Statement AST node
   * @param {Object} context - Compilation context
   * @returns {string} Assembly code
   */
  compile(stmt, context) {
    if (!stmt) {
      return '';
    }

    // Handle arrays of statements (blocks)
    if (Array.isArray(stmt)) {
      const lines = [];
      for (const s of stmt) {
        const code = this.compile(s, context);
        if (code) {
          lines.push(code);
        }
      }
      return lines.join('\n');
    }

    if (!stmt.type) {
      throw new Error(`Statement has no type field: ${JSON.stringify(stmt)}`);
    }

    switch (stmt.type) {
      case 'assignment':
        return this.compileAssignment(stmt, context);

      case 'let':
        return this.compileLet(stmt, context);

      case 'emit':
        return this.compileEmit(stmt, context);

      case 'if':
        return this.compileIf(stmt, context);

      case 'report':
        return this.compileReport(stmt, context);

      case 'block':
        return this.compileBlock(stmt, context);

      case 'while':
        return this.compileWhile(stmt, context);

      case 'for':
        return this.compileFor(stmt, context);

      case 'return':
        return this.compileReturn(stmt, context);

      default:
        throw new Error(`Unsupported statement type: ${stmt.type}`);
    }
  }

  /**
   * Compile assignment statement: state.field = expr
   */
  compileAssignment(stmt, context) {
    const lines = [];
    const target = stmt.target;
    const value = stmt.value;

    // Handle array/map element assignment: map[key] = value
    if (target.type === 'array-access') {
      lines.push(`    # assignment to array/map element`);

      // Evaluate the container (map or vector)
      const containerCode = this.exprCompiler.compile(target.object, context);
      lines.push(containerCode);
      lines.push(`    mov r14, rax    # save container pointer`);

      // Evaluate the index/key
      const indexCode = this.exprCompiler.compile(target.index, context);
      lines.push(indexCode);
      lines.push(`    mov r15, rax    # save index/key`);

      // Evaluate the value
      const valueCode = this.exprCompiler.compile(value, context);
      lines.push(valueCode);

      // Call map_set(map, key, value) or vec_set(vec, index, value)
      // For now, assume it's a map (most common case in map_reduce.mycelial)
      lines.push(`    mov rdx, rax    # value`);
      lines.push(`    mov rsi, r15    # key/index`);
      lines.push(`    mov rdi, r14    # container`);
      lines.push(`    call builtin_map_set`);

      return lines.join('\n');
    }

    // Support both 'state-access' and 'field-access' with state object
    const isStateAccess = (target.type === 'state-access') ||
                          (target.type === 'field-access' &&
                           target.object.type === 'variable' &&
                           target.object.name === 'state');

    if (isStateAccess) {
      const fieldName = target.field;
      const agent = this.symbolTable.agents.get(context.agentId);

      if (!agent) {
        throw new Error(`Agent not found: ${context.agentId}`);
      }

      // Find field offset
      const stateFields = agent.typeDef.state;
      let offset = 0;
      let found = false;

      for (const field of stateFields) {
        if (field.name === fieldName) {
          found = true;
          break;
        }
        offset += this.symbolTable.getTypeSize(field.type);
      }

      if (!found) {
        throw new Error(`State field not found: ${fieldName}`);
      }

      // Evaluate value expression
      const valueCode = this.exprCompiler.compile(value, context);
      lines.push(valueCode);

      // Store result to state field
      lines.push(`    mov [r12 + ${offset}], rax    # state.${fieldName} = ...`);

    } else {
      throw new Error(`Unsupported assignment target: ${JSON.stringify(target)}`);
    }

    return lines.join('\n');
  }

  /**
   * Compile let statement: let variable = expr
   * Allocates a local variable on the stack
   */
  compileLet(stmt, context) {
    const lines = [];
    const varName = stmt.name;
    const value = stmt.value;

    // Ensure context has locals tracking
    if (!context.locals) {
      context.locals = {};
    }
    if (context.localStackOffset === undefined) {
      context.localStackOffset = 0;
    }

    // Allocate stack space for local variable (8 bytes)
    context.localStackOffset += 8;
    const offset = context.localStackOffset;

    // Store local variable location
    context.locals[varName] = {
      offset: offset,
      type: 'local'
    };

    // Evaluate the expression
    const valueCode = this.exprCompiler.compile(value, context);
    lines.push(valueCode);

    // Store result on stack (relative to rbp)
    lines.push(`    mov [rbp - ${offset}], rax    # let ${varName}`);

    return lines.join('\n');
  }

  /**
   * Compile emit statement: emit frequency { payload }
   */
  compileEmit(stmt, context) {
    const lines = [];
    const frequency = stmt.frequency;
    const payload = stmt.payload;

    lines.push(`    # emit ${frequency} { ... }`);

    // Build signal payload structure
    // For now, simplified: allocate space and store fields

    // Get frequency definition
    const freqDef = this.symbolTable.frequencies.get(frequency);
    if (!freqDef) {
      throw new Error(`Unknown frequency: ${frequency}`);
    }

    // Calculate payload size
    let payloadSize = 0;
    for (const field of freqDef.fields) {
      payloadSize += this.symbolTable.getTypeSize(field.type);
    }
    payloadSize = Math.ceil(payloadSize / 8) * 8; // 8-byte align

    // Allocate space from heap for payload (persists after handler returns)
    if (payloadSize > 0) {
      lines.push(`    mov rdi, ${payloadSize}    # size to allocate`);
      lines.push(`    call builtin_heap_alloc    # allocate from heap`);
      lines.push(`    mov r14, rax    # payload pointer`);

      // Compile each payload field
      let fieldOffset = 0;
      for (const field of freqDef.fields) {
        const fieldSize = this.symbolTable.getTypeSize(field.type);

        // Add alignment padding before field
        if (fieldSize === 8 && fieldOffset % 8 !== 0) {
          const padding = 8 - (fieldOffset % 8);
          fieldOffset += padding;
        } else if (fieldSize === 4 && fieldOffset % 4 !== 0) {
          const padding = 4 - (fieldOffset % 4);
          fieldOffset += padding;
        }

        if (payload[field.name]) {
          // Evaluate field expression
          const fieldExpr = payload[field.name];
          const fieldCode = this.exprCompiler.compile(fieldExpr, context);
          lines.push(fieldCode);

          // Store to payload
          lines.push(`    mov [r14 + ${fieldOffset}], rax    # ${field.name}`);
        }

        fieldOffset += fieldSize;
      }
    }

    // Route signal to destination queues (compile-time routing)
    // Look up destinations in routing table
    const routingKey = `${context.agentId}.${frequency}`;
    const destinations = this.symbolTable.routingTable.get(routingKey);

    if (destinations && destinations.length > 0) {
      lines.push(`    # emit ${frequency} from ${context.agentId} to ${destinations.join(', ')}`);

      // Enqueue payload to each destination
      for (const dest of destinations) {
        if (payloadSize > 0) {
          lines.push(`    mov rdi, r14    # payload pointer`);
        } else {
          lines.push(`    xor rdi, rdi    # null payload`);
        }
        lines.push(`    lea rsi, [queue_${dest}]    # destination queue`);
        lines.push(`    call enqueue_signal_simple    # enqueue to ${dest}`);
      }
    } else {
      lines.push(`    # WARNING: No route for ${context.agentId}.${frequency}`);
    }

    // Note: payload is heap-allocated, no stack cleanup needed

    return lines.join('\n');
  }

  /**
   * Compile if statement: if (condition) { then } else { otherwise }
   */
  compileIf(stmt, context) {
    const lines = [];
    const condition = stmt.condition;
    // Parser uses 'body' for then block, not 'then'
    const thenBlock = stmt.body || stmt.then;
    const elseBlock = stmt.else || stmt.elseBody;

    const elseLabel = this.makeLabel('if_else');
    const endLabel = this.makeLabel('if_end');

    lines.push(`    # if (...) { ... }`);

    // Evaluate condition
    const condCode = this.exprCompiler.compile(condition, context);
    lines.push(condCode);

    // Test condition
    lines.push(`    test rax, rax`);
    if (elseBlock) {
      lines.push(`    jz ${elseLabel}    # jump if false`);
    } else {
      lines.push(`    jz ${endLabel}    # jump if false`);
    }

    // Then block
    if (thenBlock) {
      const thenCode = this.compile(thenBlock, context);
      lines.push(thenCode);
    }

    if (elseBlock) {
      lines.push(`    jmp ${endLabel}    # skip else`);

      // Else block
      lines.push(`${elseLabel}:`);
      const elseCode = this.compile(elseBlock, context);
      lines.push(elseCode);
    }

    lines.push(`${endLabel}:`);

    return lines.join('\n');
  }

  /**
   * Compile while statement: while (condition) { body }
   */
  compileWhile(stmt, context) {
    const lines = [];
    const condition = stmt.condition;
    const body = stmt.body;

    const loopLabel = this.makeLabel('while_loop');
    const endLabel = this.makeLabel('while_end');

    lines.push(`    # while (...) { ... }`);
    lines.push(`${loopLabel}:`);

    // Evaluate condition
    const condCode = this.exprCompiler.compile(condition, context);
    lines.push(condCode);

    // Test condition
    lines.push(`    test rax, rax`);
    lines.push(`    jz ${endLabel}    # exit if false`);

    // Body
    if (body) {
      const bodyCode = this.compile(body, context);
      lines.push(bodyCode);
    }

    // Loop back
    lines.push(`    jmp ${loopLabel}`);
    lines.push(`${endLabel}:`);

    return lines.join('\n');
  }

  /**
   * Compile for loop: for i in start..end { body }
   */
  compileFor(stmt, context) {
    const lines = [];
    const iterVar = stmt.item;  // Iterator variable name
    const collection = stmt.collection;  // Range or array expression
    const body = stmt.body;

    // For now, only support range expressions (start..end)
    if (collection.type !== 'range') {
      throw new Error(`For loops currently only support range expressions (start..end). Got: ${collection.type}`);
    }

    const startExpr = collection.start;
    const endExpr = collection.end;

    const loopLabel = this.makeLabel('for_loop');
    const checkLabel = this.makeLabel('for_check');
    const endLabel = this.makeLabel('for_end');

    lines.push(`    # for ${iterVar} in ${JSON.stringify(startExpr)}..${JSON.stringify(endExpr)}`);

    // Evaluate start expression
    const startCode = this.exprCompiler.compile(startExpr, context);
    lines.push(startCode);

    // Allocate loop variable on stack
    lines.push(`    push rax    # initialize loop variable ${iterVar}`);

    // Track loop variable in context
    const savedLocals = context.locals || {};
    context.locals = { ...savedLocals };  // Copy locals
    const varOffset = (context.stackOffset || 0) + 8;
    context.locals[iterVar] = { offset: varOffset, type: 'i64' };
    context.stackOffset = varOffset;

    // Evaluate end expression (save in rbx)
    const endCode = this.exprCompiler.compile(endExpr, context);
    lines.push(endCode);
    lines.push(`    mov rbx, rax    # save end value`);

    // Jump to condition check
    lines.push(`    jmp ${checkLabel}`);

    // Loop body
    lines.push(`${loopLabel}:`);
    if (body) {
      const bodyCode = this.compile(body, context);
      lines.push(bodyCode);
    }

    // Increment loop variable
    lines.push(`    add QWORD PTR [rsp], 1    # ${iterVar}++`);

    // Check condition: loop variable < end
    lines.push(`${checkLabel}:`);
    lines.push(`    mov rax, [rsp]    # load ${iterVar}`);
    lines.push(`    cmp rax, rbx    # compare ${iterVar} < end`);
    lines.push(`    jl ${loopLabel}    # continue if ${iterVar} < end`);

    // Clean up loop variable
    lines.push(`${endLabel}:`);
    lines.push(`    add rsp, 8    # pop loop variable`);

    // Restore context
    context.locals = savedLocals;
    context.stackOffset = (context.stackOffset || 8) - 8;

    return lines.join('\n');
  }

  /**
   * Compile report statement: report key: value
   */
  compileReport(stmt, context) {
    const lines = [];
    const key = stmt.key;
    const value = stmt.value;

    lines.push(`    # report ${key}: ...`);

    // Evaluate value expression
    const valueCode = this.exprCompiler.compile(value, context);
    lines.push(valueCode);

    // Store to agent reports
    // For now, simplified: just compute the value
    // Full implementation would store in reports data structure
    lines.push(`    # TODO: store report value to agent_${context.agentId}_reports.${key}`);

    return lines.join('\n');
  }

  /**
   * Compile block (sequence of statements)
   */
  compileBlock(stmt, context) {
    const lines = [];
    const statements = stmt.statements || stmt.body || [];

    for (const s of statements) {
      const stmtCode = this.compile(s, context);
      if (stmtCode) {
        lines.push(stmtCode);
      }
    }

    return lines.join('\n');
  }

  /**
   * Compile return statement
   */
  compileReturn(stmt, context) {
    const lines = [];

    if (stmt.value) {
      // Evaluate return value
      const valueCode = this.exprCompiler.compile(stmt.value, context);
      lines.push(valueCode);
    } else {
      lines.push(`    xor rax, rax    # return 0`);
    }

    // Return from function (handler)
    lines.push(`    mov rsp, rbp`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate unique label
   */
  makeLabel(prefix) {
    return `.${prefix}_${this.labelCounter++}`;
  }
}

module.exports = { StatementCompiler };

/**
 * Mycelial Statement Compiler
 *
 * Compiles Mycelial statements to x86-64 assembly code.
 * Uses the ExpressionCompiler for all expression evaluation.
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-15
 */

const { ExpressionCompiler } = require('./expression-compiler.js');

class StatementCompiler {
  constructor(symbolTable, agentId, sharedLabelCounter = null) {
    this.symbolTable = symbolTable;
    this.agentId = agentId;
    // Use shared label counter if provided, otherwise create local one
    this.labelCounter = sharedLabelCounter || { count: 0 };
    this.exprCompiler = new ExpressionCompiler(symbolTable, agentId, this.labelCounter);
    // Set circular reference so expression compiler can call statement compiler for match expressions
    this.exprCompiler.setStatementCompiler(this);
    // Handler context for signal handlers
    this.currentFrequency = null;
    this.currentParamName = null;
    // Function context (for return statements)
    this.currentFunctionName = null;  // e.g., "handler_C_rest" or "rule_C_add"
    // Loop context (for break/continue)
    // Each entry: {breakLabel, continueLabel, stackCleanup} where stackCleanup is bytes to add to rsp
    this.loopStack = [];
  }

  /**
   * Set handler context for signal handler compilation
   */
  setHandlerContext(frequency, paramName) {
    this.currentFrequency = frequency;
    this.currentParamName = paramName;
    this.exprCompiler.setHandlerContext(frequency, paramName);
  }

  /**
   * Set function context (for return label)
   */
  setFunctionContext(functionName) {
    this.currentFunctionName = functionName;
  }

  /**
   * Generate a unique label
   */
  genLabel(prefix) {
    return `${prefix}_${this.labelCounter.count++}`;
  }

  /**
   * Compile a statement and return assembly code
   */
  compile(stmt) {
    const lines = [];

    switch (stmt.type) {
      case 'assignment':
        lines.push(...this.compileAssignment(stmt));
        break;

      case 'let':
        lines.push(...this.compileLetDeclaration(stmt));
        break;

      case 'if':
        lines.push(...this.compileIf(stmt));
        break;

      case 'while':
        lines.push(...this.compileWhile(stmt));
        break;

      case 'emit':
        lines.push(...this.compileEmit(stmt));
        break;

      case 'print':
      case 'println':
      case 'print_i64':
        lines.push(...this.compilePrint(stmt));
        break;

      case 'return':
        lines.push(...this.compileReturn(stmt));
        break;

      case 'break':
        lines.push(...this.compileBreak(stmt));
        break;

      case 'continue':
        lines.push(...this.compileContinue(stmt));
        break;

      case 'expression-statement':
        lines.push(...this.compileExpressionStatement(stmt));
        break;

      case 'report':
        lines.push(...this.compileReport(stmt));
        break;

      case 'match':
        lines.push(...this.compileMatch(stmt));
        break;

      case 'for':
        lines.push(...this.compileFor(stmt));
        break;

      case 'for-kv':
        lines.push(...this.compileForKV(stmt));
        break;

      default:
        throw new Error(`Unsupported statement type: ${stmt.type}`);
    }

    return lines;
  }

  /**
   * Compile multiple statements
   */
  compileBlock(statements) {
    const lines = [];

    // Handle both array of statements and body object with statements property
    const stmtArray = Array.isArray(statements) ? statements :
                      (statements && statements.statements) ? statements.statements : [];

    for (const stmt of stmtArray) {
      lines.push(...this.compile(stmt));
    }

    return lines;
  }

  /**
   * Compile assignment statement (state.field = expr)
   */
  compileAssignment(stmt) {
    const lines = [];

    lines.push(`    # Assignment: ${stmt.target.field || 'var'} = ...`);

    // Compile the right-hand side expression
    lines.push(...this.exprCompiler.compile(stmt.value));

    // Now rax contains the value to assign
    // Determine the target location
    if (stmt.target.type === 'state-access') {
      // State field assignment
      const fieldName = stmt.target.field;
      const fieldOffset = this.symbolTable.getStateFieldOffset(this.agentId, fieldName);

      if (fieldOffset === null) {
        throw new Error(`Unknown state field: ${fieldName}`);
      }

      // Get field type to determine correct mov instruction size
      const agent = this.symbolTable.agents.get(this.agentId);
      const field = agent?.stateFields?.find(f => f.name === fieldName);
      const fieldType = field?.type;

      // Check if the field type is an inline struct (not a pointer type)
      const typeInfo = this.symbolTable.types.get(fieldType);
      if (typeInfo && typeInfo.kind === 'struct') {
        // Inline struct - copy contents from heap-allocated struct to state memory
        // rax contains pointer to heap-allocated struct
        lines.push(`    # Copy inline struct ${fieldType} to state.${fieldName}`);
        lines.push(`    mov rbx, rax          # Source struct pointer`);
        lines.push(`    lea rcx, [r12 + ${fieldOffset}]  # Destination in state`);

        // Copy each 8-byte chunk of the struct
        const structSize = typeInfo.size;
        for (let offset = 0; offset < structSize; offset += 8) {
          lines.push(`    mov rax, [rbx + ${offset}]`);
          lines.push(`    mov [rcx + ${offset}], rax`);
        }
      } else {
        // Determine mov instruction based on type size
        let movInstr = 'mov';
        let reg = 'rax';

        if (typeof fieldType === 'string') {
          if (fieldType === 'u8' || fieldType === 'i8') {
            movInstr = 'mov byte ptr';
            reg = 'al';
          } else if (fieldType === 'u32' || fieldType === 'i32') {
            movInstr = 'mov dword ptr';
            reg = 'eax';
          } else if (fieldType === 'u16' || fieldType === 'i16') {
            movInstr = 'mov word ptr';
            reg = 'ax';
          }
          // For u64, i64, strings, pointers, vec<>, map<> - use default 64-bit mov
        } else if (fieldType?.base === 'boolean') {
          // Booleans currently stored as 8 bytes for simplicity
          // Could optimize to: movInstr = 'mov byte ptr'; reg = 'al';
        }

        lines.push(`    ${movInstr} [r12 + ${fieldOffset}], ${reg}`);
      }

    } else if (stmt.target.type === 'variable') {
      // Local variable assignment
      const varName = stmt.target.name;

      // Debug: Check if varName is null or undefined
      if (varName === null || varName === undefined) {
        console.error('[DEBUG] Assignment target with null/undefined name:', JSON.stringify(stmt.target));
        throw new Error(`Assignment target has null/undefined name. Full target: ${JSON.stringify(stmt.target)}`);
      }

      const varOffset = this.exprCompiler.getLocalVarOffset(varName);

      if (varOffset === undefined) {
        throw new Error(`Unknown variable: ${varName}`);
      }

      const actualOffset = varOffset + this.exprCompiler.stackFrameOffset;
      lines.push(`    mov [rbp - ${actualOffset}], rax`);

    } else if (stmt.target.type === 'field-access') {
      // Nested field access assignment (e.g., state.context.field = value)
      // Save value to assign
      lines.push(`    push rax              # Save value to assign`);

      // Compile the address of the field
      // The field-access target is like: object.field
      // We need to get a pointer to the object, then offset by field offset
      lines.push(...this.compileFieldAccessAddress(stmt.target));

      // Now rbx contains the address of the field
      // Restore value and store it
      lines.push(`    pop rax               # Restore value`);
      lines.push(`    mov [rbx], rax        # Store to field`);

    } else if (stmt.target.type === 'array-access') {
      // Array/Map element assignment: arr[index] = value or map[key] = value
      // Determine if this is a vector or map by checking the object's type
      const objectExpr = stmt.target.object;
      let isMap = false;

      // Check if object is a state field
      if (objectExpr.type === 'state-access') {
        // state.field[index] - check the state field type
        const fieldName = objectExpr.field;
        const agent = this.symbolTable.agents.get(this.agentId);
        if (agent && agent.stateFields) {
          const field = agent.stateFields.find(f => f.name === fieldName);
          if (field && field.type) {
            // Handle both string types ("map<K,V>") and object types ({generic: "map"})
            if (typeof field.type === 'string') {
              isMap = field.type.startsWith('map<') || field.type === 'map';
            } else if (field.type.generic) {
              isMap = field.type.generic === 'map';
            }
          }
        }
      } else if (objectExpr.type === 'field-access' &&
                 objectExpr.object && objectExpr.object.name === 'state') {
        // Alternative syntax: check if it's state.field
        const fieldName = objectExpr.field;
        const agent = this.symbolTable.agents.get(this.agentId);
        if (agent && agent.stateFields) {
          const field = agent.stateFields.find(f => f.name === fieldName);
          if (field && field.type) {
            if (typeof field.type === 'string') {
              isMap = field.type.startsWith('map<') || field.type === 'map';
            } else if (field.type.generic) {
              isMap = field.type.generic === 'map';
            }
          }
        }
      }

      // Save value to assign
      lines.push(`    push rax              # Save value to assign`);

      // Compile array/map expression
      lines.push(`    # Evaluate ${isMap ? 'map' : 'array'}`);
      lines.push(...this.exprCompiler.compile(stmt.target.object));
      lines.push(`    push rax              # Save ${isMap ? 'map' : 'array'} pointer`);

      // Compile index/key expression
      lines.push(`    # Evaluate ${isMap ? 'key' : 'index'}`);
      lines.push(...this.exprCompiler.compile(stmt.target.index));
      lines.push(`    mov rsi, rax          # ${isMap ? 'key' : 'index'} in rsi`);

      // Restore array/map and value
      lines.push(`    pop rdi               # ${isMap ? 'map' : 'array'} in rdi`);
      lines.push(`    pop rdx               # value in rdx`);

      // Call appropriate builtin
      if (isMap) {
        lines.push(`    call builtin_map_set  # map_set(map, key, value)`);
      } else {
        lines.push(`    call builtin_vec_set  # vec_set(vec, index, value)`);
      }

    } else {
      throw new Error(`Unsupported assignment target: ${stmt.target.type}`);
    }

    return lines;
  }

  /**
   * Compile let declaration (let x = expr)
   */
  compileLetDeclaration(stmt) {
    const lines = [];

    lines.push(`    # let ${stmt.name} = ...`);

    // Compile the initializer expression
    lines.push(...this.exprCompiler.compile(stmt.value));

    // Detect type from explicit annotation or value expression
    let typeName = null;

    // Check for explicit type annotation first (e.g., let x: Type = ...)
    if (stmt.typeAnnotation) {
      typeName = stmt.typeAnnotation;
    } else if (stmt.value.type === 'struct-literal') {
      typeName = stmt.value.structName;
    } else if (stmt.value.type === 'function-call') {
      // For function calls that return structs, we'd need type inference
      // For now, check if it's a rule with a known return type
      const ruleName = stmt.value.name;
      if (this.symbolTable.isRule(this.agentId, ruleName)) {
        const rule = this.symbolTable.getRule(this.agentId, ruleName);
        if (rule && rule.returnType) {
          typeName = rule.returnType;
        }
      }
      // Check for string-returning built-in functions
      const stringReturningFuncs = [
        'format', 'string_concat', 'substring', 'to_string',
        'read_file', 'read_line', 'input', 'string_char_at',
        'string_trim', 'string_to_lower', 'string_to_upper'
      ];
      if (stringReturningFuncs.includes(ruleName)) {
        typeName = 'string';
      }
    } else if (stmt.value.type === 'literal' && typeof stmt.value.value === 'string') {
      // String literal
      typeName = 'string';
    }

    // Allocate stack space and store the value
    const offset = this.exprCompiler.addLocalVar(stmt.name, 8, typeName);
    const actualOffset = offset + this.exprCompiler.stackFrameOffset;
    lines.push(`    mov [rbp - ${actualOffset}], rax`);

    return lines;
  }

  /**
   * Compile if statement
   */
  compileIf(stmt) {
    const lines = [];

    const elseLabel = this.genLabel('if_else');
    const endLabel = this.genLabel('if_end');

    lines.push(`    # if statement`);

    // Compile condition
    lines.push(...this.exprCompiler.compile(stmt.condition));

    // Test result and jump if false
    lines.push(`    test rax, rax`);
    if (stmt.else) {
      lines.push(`    jz ${elseLabel}`);
    } else {
      lines.push(`    jz ${endLabel}`);
    }

    // Compile then branch (body property)
    lines.push(`    # then branch`);
    lines.push(...this.compileBlock(stmt.body));

    if (stmt.else) {
      lines.push(`    jmp ${endLabel}`);

      // Compile else branch
      lines.push(`${elseLabel}:`);
      lines.push(`    # else branch`);
      lines.push(...this.compileBlock(stmt.else));
    }

    lines.push(`${endLabel}:`);

    return lines;
  }

  /**
   * Compile while loop
   */
  compileWhile(stmt) {
    const lines = [];

    const loopLabel = this.genLabel('while_loop');
    const endLabel = this.genLabel('while_end');

    lines.push(`    # while loop`);
    lines.push(`${loopLabel}:`);

    // Compile condition
    lines.push(...this.exprCompiler.compile(stmt.condition));

    // Test result and exit if false
    lines.push(`    test rax, rax`);
    lines.push(`    jz ${endLabel}`);

    // Push loop context for break/continue (while loop has no stack allocation)
    this.loopStack.push({ breakLabel: endLabel, continueLabel: loopLabel, stackCleanup: 0 });

    // Compile loop body
    lines.push(...this.compileBlock(stmt.body));

    // Pop loop context
    this.loopStack.pop();

    // Jump back to condition
    lines.push(`    jmp ${loopLabel}`);

    lines.push(`${endLabel}:`);

    return lines;
  }

  /**
   * Compile emit statement
   */
  compileEmit(stmt) {
    const lines = [];

    lines.push(`    # emit ${stmt.frequency}`);

    // Get frequency info
    const freqInfo = this.symbolTable.frequencies.get(stmt.frequency);
    if (!freqInfo) {
      throw new Error(`Unknown frequency: ${stmt.frequency}`);
    }

    lines.push(`    # Allocate payload for frequency ${stmt.frequency} (${freqInfo.size} bytes)`);

    // Allocate space for the payload
    lines.push(`    mov rdi, ${freqInfo.size}  # Payload size`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    push rax               # Save payload pointer`);
    lines.push(``);

    // Fill in payload fields
    if (stmt.payload) {
      for (const [fieldName, fieldExpr] of Object.entries(stmt.payload)) {
        const fieldOffset = this.symbolTable.getFrequencyFieldOffset(stmt.frequency, fieldName);
        if (fieldOffset === null) {
          throw new Error(`Unknown field ${fieldName} in frequency ${stmt.frequency}`);
        }
        const fieldType = this.symbolTable.getFrequencyFieldType(stmt.frequency, fieldName);

        lines.push(`    # Payload field: ${fieldName} at offset ${fieldOffset}`);
        lines.push(...this.exprCompiler.compile(fieldExpr));
        lines.push(`    mov rbx, [rsp]         # Get payload pointer`);

        // Use appropriate store instruction based on field type
        if (fieldType === 'u32' || fieldType === 'i32') {
          lines.push(`    mov dword ptr [rbx + ${fieldOffset}], eax  # Write 32-bit field`);
        } else if (fieldType === 'u64' || fieldType === 'i64') {
          lines.push(`    mov qword ptr [rbx + ${fieldOffset}], rax  # Write 64-bit field`);
        } else if (fieldType === 'u16' || fieldType === 'i16') {
          lines.push(`    mov word ptr [rbx + ${fieldOffset}], ax   # Write 16-bit field`);
        } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool' || fieldType === 'boolean') {
          lines.push(`    mov byte ptr [rbx + ${fieldOffset}], al   # Write 8-bit field`);
        } else {
          // Default to 64-bit for pointers and other types
          lines.push(`    mov qword ptr [rbx + ${fieldOffset}], rax  # Write pointer/64-bit field`);
        }
      }
    }
    lines.push(``);

    // Enqueue signal to per-agent queue (prevents routing loops)
    lines.push(`    # Enqueue signal to frequency ${stmt.frequency} from ${this.agentId}`);
    lines.push(`    lea rdi, [signal_queue_${this.agentId}_${stmt.frequency}]  # Queue address`);
    lines.push(`    pop rsi                # Payload pointer`);
    lines.push(`    call queue_enqueue`);
    lines.push(``);

    return lines;
  }

  /**
   * Compile print statement
   */
  compilePrint(stmt) {
    const lines = [];

    if (stmt.type === 'println') {
      lines.push(`    # println`);

      if (stmt.args && stmt.args.length > 0) {
        // Print the argument first
        lines.push(...this.exprCompiler.compile(stmt.args[0]));
        lines.push(`    mov rdi, rax`);
        lines.push(`    call builtin_print`);
      }

      // Then print newline
      lines.push(`    lea rdi, [newline_str(%rip)]`);
      lines.push(`    call builtin_print`);

    } else if (stmt.type === 'print') {
      lines.push(`    # print`);

      if (stmt.args && stmt.args.length > 0) {
        lines.push(...this.exprCompiler.compile(stmt.args[0]));
        lines.push(`    mov rdi, rax`);
        lines.push(`    call builtin_print`);
      }

    } else if (stmt.type === 'print_i64') {
      lines.push(`    # print_i64`);

      if (stmt.args && stmt.args.length > 0) {
        lines.push(...this.exprCompiler.compile(stmt.args[0]));
        lines.push(`    mov rdi, rax`);
        lines.push(`    call builtin_print_i64`);
      }
    }

    return lines;
  }

  /**
   * Compile expression statement (e.g., function calls)
   */
  compileExpressionStatement(stmt) {
    const lines = [];

    // Check if it's a print function call
    if (stmt.expression && stmt.expression.type === 'function-call') {
      const funcName = stmt.expression.name;

      if (funcName === 'print' || funcName === 'println' || funcName === 'print_i64') {
        lines.push(`    # ${funcName}()`);

        if (stmt.expression.args && stmt.expression.args.length > 0) {
          // Compile the argument
          lines.push(...this.exprCompiler.compile(stmt.expression.args[0]));
          lines.push(`    mov rdi, rax`);
          lines.push(`    call builtin_${funcName}`);
        }

        return lines;
      }
    }

    // Otherwise, just evaluate the expression
    lines.push(`    # expression statement`);
    lines.push(...this.exprCompiler.compile(stmt.expression));

    return lines;
  }

  /**
   * Compile return statement
   */
  compileReturn(stmt) {
    const lines = [];

    lines.push(`    # return`);

    if (stmt.value) {
      // Compile return value expression
      lines.push(...this.exprCompiler.compile(stmt.value));
    } else {
      // Return void (0)
      lines.push(`    xor rax, rax`);
    }

    // If inside loops, clean up stack allocations from all enclosing loops
    // before jumping to the return label
    if (this.loopStack.length > 0) {
      let totalCleanup = 0;
      for (const loop of this.loopStack) {
        totalCleanup += loop.stackCleanup || 0;
      }
      if (totalCleanup > 0) {
        lines.push(`    add rsp, ${totalCleanup}  # Clean up stack for early return from loop`);
      }
    }

    // Jump to function epilogue
    const returnLabel = this.currentFunctionName ? `.${this.currentFunctionName}_return` : `.handler_return`;
    lines.push(`    jmp ${returnLabel}`);

    return lines;
  }

  /**
   * Compile break statement
   * Jumps to the end of the current loop
   */
  compileBreak(stmt) {
    const lines = [];

    if (this.loopStack.length === 0) {
      throw new Error('break statement outside of loop');
    }

    const currentLoop = this.loopStack[this.loopStack.length - 1];
    lines.push(`    # break`);
    lines.push(`    jmp ${currentLoop.breakLabel}`);

    return lines;
  }

  /**
   * Compile continue statement
   * Jumps back to the start of the current loop
   */
  compileContinue(stmt) {
    const lines = [];

    if (this.loopStack.length === 0) {
      throw new Error('continue statement outside of loop');
    }

    const currentLoop = this.loopStack[this.loopStack.length - 1];
    lines.push(`    # continue`);
    lines.push(`    jmp ${currentLoop.continueLabel}`);

    return lines;
  }

  /**
   * Compile report statement
   * Prints report output to stdout
   */
  compileReport(stmt) {
    const lines = [];
    lines.push(`    # report ${stmt.name}: ${stmt.value ? 'expression' : 'no value'}`);

    if (stmt.value) {
      // Check if value is a struct literal (e.g., report status { message: "text" })
      if (stmt.value.type === 'struct-literal') {
        // Extract the first field (typically "message")
        const fields = stmt.value.fields;
        const firstField = Object.values(fields)[0];
        if (firstField) {
          lines.push(...this.exprCompiler.compile(firstField));
          lines.push(`    mov rdi, rax`);
          lines.push(`    call builtin_println`);
        }
      } else {
        // Simple value expression
        lines.push(...this.exprCompiler.compile(stmt.value));
        lines.push(`    mov rdi, rax`);
        lines.push(`    call builtin_println`);
      }
    }

    return lines;
  }

  /**
   * Compile match statement
   * match expr {
   *   Pattern1 | Pattern2 => { body }
   *   Pattern3 => { body }
   *   _ => { body }
   * }
   */
  compileMatch(stmt) {
    const lines = [];

    lines.push(`    # match statement`);

    // Evaluate the match value
    lines.push(...this.exprCompiler.compile(stmt.value));
    lines.push(`    push rax              # Save match value on stack`);
    lines.push(``);

    const matchEndLabel = this.genLabel('match_end');

    // Generate labels for each arm
    const armBodyLabels = stmt.arms.map((_, i) => this.genLabel(`match_body_${i}`));
    const armCheckLabels = stmt.arms.map((_, i) => this.genLabel(`match_check_${i}`));

    // Generate code for each arm
    for (let i = 0; i < stmt.arms.length; i++) {
      const arm = stmt.arms[i];
      const bodyLabel = armBodyLabels[i];
      const checkLabel = armCheckLabels[i];
      const nextCheckLabel = (i + 1 < stmt.arms.length) ? armCheckLabels[i + 1] : matchEndLabel;

      lines.push(`${checkLabel}:`);

      // Check each pattern in this arm (OR logic)
      for (let p = 0; p < arm.patterns.length; p++) {
        const pattern = arm.patterns[p];

        // Restore match value for comparison
        lines.push(`    mov rax, [rsp]        # Load match value`);

        if (pattern.type === 'identifier') {
          // Identifier pattern: either wildcard (_) or variable binding
          if (pattern.name === '_') {
            // Wildcard always matches
            lines.push(`    # Wildcard pattern - always matches`);
            lines.push(`    jmp ${bodyLabel}`);
          } else {
            // Variable binding - bind the value and always match
            // For now, we don't support variable bindings in patterns
            // Treat as wildcard
            lines.push(`    # Identifier pattern '${pattern.name}' - always matches (binding not yet implemented)`);
            lines.push(`    jmp ${bodyLabel}`);
          }
        } else if (pattern.type === 'literal') {
          // Literal pattern: compare with match value
          const value = pattern.value;
          if (typeof value === 'number') {
            lines.push(`    cmp rax, ${value}     # Compare with literal ${value}`);
            lines.push(`    je ${bodyLabel}`);
          } else if (typeof value === 'string') {
            // String comparison using builtin_string_eq
            lines.push(`    push rax              # Save match value`);

            // Create string literal for pattern
            const label = this.exprCompiler.genLabel('str');
            this.exprCompiler.stringLiterals.push({ label, value });

            lines.push(`    lea rsi, [rip + ${label}]  # Pattern string`);
            lines.push(`    mov rdi, [rsp + 8]    # Match value (compensate for extra push)`);
            lines.push(`    call builtin_string_eq`);
            lines.push(`    pop rbx               # Clean up saved value`);
            lines.push(`    test rax, rax`);
            lines.push(`    jnz ${bodyLabel}       # Jump if strings equal`);
          } else if (typeof value === 'boolean') {
            const numValue = value ? 1 : 0;
            lines.push(`    cmp rax, ${numValue}  # Compare with ${value}`);
            lines.push(`    je ${bodyLabel}`);
          }
        } else if (pattern.type === 'enum-variant') {
          // Enum variant pattern: compare with ordinal value
          const enumType = pattern.enumType;
          const variantName = pattern.variant;

          const enumInfo = this.symbolTable.types.get(enumType);
          if (!enumInfo || enumInfo.kind !== 'enum') {
            throw new Error(`Unknown enum type: ${enumType}`);
          }

          const variantInfo = enumInfo.variants.get(variantName);
          if (!variantInfo) {
            throw new Error(`Unknown variant ${variantName} in enum ${enumType}`);
          }

          const ordinal = variantInfo.ordinal;

          // Check if simple enum or tagged union
          if (!variantInfo.dataType) {
            // Simple enum - just compare ordinals
            lines.push(`    cmp rax, ${ordinal}   # Compare with ${enumType}::${variantName}`);
            lines.push(`    je ${bodyLabel}`);
          } else {
            // Tagged union - load and compare tag
            lines.push(`    # Check tagged union for ${enumType}::${variantName}`);
            lines.push(`    mov rcx, [rax]        # Load tag from offset 0`);
            lines.push(`    cmp rcx, ${ordinal}   # Compare tag`);
            lines.push(`    je ${bodyLabel}`);
          }
        } else if (pattern.type === 'enum-pattern') {
          // Enum pattern with bindings
          const enumType = pattern.enumType;
          const variantName = pattern.variant;
          const bindings = pattern.bindings || [];

          const enumInfo = this.symbolTable.types.get(enumType);
          if (!enumInfo || enumInfo.kind !== 'enum') {
            throw new Error(`Unknown enum type: ${enumType}`);
          }

          const variantInfo = enumInfo.variants.get(variantName);
          if (!variantInfo) {
            throw new Error(`Unknown variant ${variantName} in enum ${enumType}`);
          }

          const ordinal = variantInfo.ordinal;
          const dataType = variantInfo.dataType;

          // Check if this is a simple enum (no data) or tagged union
          if (!dataType) {
            // Simple enum - just compare ordinals
            lines.push(`    cmp rax, ${ordinal}   # Compare with ${enumType}::${variantName}`);
            lines.push(`    je ${bodyLabel}`);
          } else {
            // Tagged union - need to load and check tag
            lines.push(`    # Check tagged union for ${enumType}::${variantName}`);
            lines.push(`    mov rbx, rax          # Save union pointer`);
            lines.push(`    mov rcx, [rax]        # Load tag from offset 0`);
            lines.push(`    cmp rcx, ${ordinal}   # Compare tag with ${variantName} ordinal`);
            lines.push(`    je ${bodyLabel}`);
          }
        } else if (pattern.type === 'tuple-pattern') {
          // Tuple patterns match against tuple values (compiled as vectors)
          // Need to check each sub-pattern, especially enum variant tags
          lines.push(`    # Tuple pattern with ${pattern.patterns.length} elements`);
          lines.push(`    mov r14, rax          # Save tuple vector pointer in r14`);

          let allChecksSimple = true;

          // Check each sub-pattern
          for (let i = 0; i < pattern.patterns.length; i++) {
            const subPattern = pattern.patterns[i];

            if (subPattern.type === 'enum-pattern' || subPattern.type === 'enum-variant') {
              allChecksSimple = false;
              const enumType = subPattern.enumType;
              const variantName = subPattern.variant;

              const enumInfo = this.symbolTable.types.get(enumType);
              if (!enumInfo || enumInfo.kind !== 'enum') {
                throw new Error(`Unknown enum type: ${enumType}`);
              }

              const variantInfo = enumInfo.variants.get(variantName);
              if (!variantInfo) {
                throw new Error(`Unknown variant ${variantName} in enum ${enumType}`);
              }

              const ordinal = variantInfo.ordinal;
              const hasData = !!variantInfo.dataType;

              // Extract element i from tuple
              lines.push(`    # Check tuple element ${i}: ${enumType}::${variantName}`);
              lines.push(`    mov rdi, r14          # Tuple vector pointer`);
              lines.push(`    mov rsi, ${i}         # Element index`);
              lines.push(`    call builtin_vec_get`);

              if (hasData) {
                // Tagged union - load and check tag
                lines.push(`    mov rcx, [rax]        # Load tag from offset 0`);
                lines.push(`    cmp rcx, ${ordinal}   # Compare with ${variantName} ordinal`);
                lines.push(`    jne ${nextCheckLabel} # If not matching, try next arm`);
              } else {
                // Simple enum - compare value directly
                lines.push(`    cmp rax, ${ordinal}   # Compare with ${variantName} ordinal`);
                lines.push(`    jne ${nextCheckLabel} # If not matching, try next arm`);
              }
            }
            // For simple identifier patterns, no runtime check needed
          }

          // All checks passed, jump to body
          if (allChecksSimple) {
            // No enum patterns to check, just match on length (assume ok for now)
            lines.push(`    jmp ${bodyLabel}      # All sub-patterns are simple, assume match`);
          } else {
            lines.push(`    jmp ${bodyLabel}      # All enum variant checks passed`);
          }
        } else {
          throw new Error(`Unsupported pattern type: ${pattern.type}`);
        }
      }

      // If no patterns matched, jump to next arm's pattern checks
      lines.push(`    jmp ${nextCheckLabel}`);
      lines.push(``);

      // Arm body
      lines.push(`${bodyLabel}:`);

      // Handle pattern bindings for this arm
      // We need to extract data from enum variants and bind to local variables
      const savedStackOffset = this.exprCompiler.stackOffset;

      for (const pattern of arm.patterns) {
        if (pattern.type === 'enum-pattern' && pattern.bindings && pattern.bindings.length > 0) {
          const enumType = pattern.enumType;
          const variantName = pattern.variant;
          const bindings = pattern.bindings;

          const enumInfo = this.symbolTable.types.get(enumType);
          const variantInfo = enumInfo?.variants.get(variantName);

          if (variantInfo && variantInfo.dataType) {
            // Extract data from tagged union
            lines.push(`    # Extract data for pattern ${enumType}::${variantName}`);
            lines.push(`    mov rax, [rsp]        # Get tagged union pointer`);
            lines.push(`    mov rbx, [rax + 8]    # Load data from offset 8`);

            // Bind to first binding name (we support single binding for now)
            if (bindings.length > 0) {
              const bindingName = bindings[0];

              // Allocate stack space for the binding
              const offset = this.exprCompiler.addLocalVar(bindingName, 8, variantInfo.dataType);
              const actualOffset = offset + this.exprCompiler.stackFrameOffset;

              lines.push(`    mov [rbp - ${actualOffset}], rbx  # Bind to ${bindingName}`);
            }
          }
        } else if (pattern.type === 'tuple-pattern') {
          // Extract tuple elements and bind to pattern variables
          lines.push(`    # Extract tuple elements`);
          lines.push(`    mov r14, [rsp]        # Get tuple pointer (vector)`);

          // For each sub-pattern, extract the corresponding element
          for (let i = 0; i < pattern.patterns.length; i++) {
            const subPattern = pattern.patterns[i];

            // Extract element i from tuple
            lines.push(`    # Extract tuple element ${i}`);
            lines.push(`    mov rdi, r14          # Tuple vector pointer`);
            lines.push(`    mov rsi, ${i}         # Element index`);
            lines.push(`    call builtin_vec_get`);

            // Handle different sub-pattern types
            if (subPattern.type === 'identifier') {
              // Simple identifier binding
              const bindingName = subPattern.name;
              const offset = this.exprCompiler.addLocalVar(bindingName, 8);
              const actualOffset = offset + this.exprCompiler.stackFrameOffset;
              lines.push(`    mov [rbp - ${actualOffset}], rax  # Bind to ${bindingName}`);

            } else if (subPattern.type === 'enum-pattern') {
              // Enum pattern with bindings
              const bindings = subPattern.bindings || [];
              if (bindings.length > 0) {
                const enumType = subPattern.enumType;
                const variantName = subPattern.variant;

                // Get enum variant info for type
                const enumInfo = this.symbolTable.types.get(enumType);
                const variantInfo = enumInfo?.variants.get(variantName);
                const dataType = variantInfo?.dataType;

                if (dataType) {
                  // Tagged union - extract data from offset 8
                  lines.push(`    mov rbx, rax          # Enum variant pointer`);
                  lines.push(`    mov rcx, [rbx + 8]    # Extract data from tagged union`);

                  // Bind first binding
                  const bindingName = bindings[0];
                  const offset = this.exprCompiler.addLocalVar(bindingName, 8, dataType);
                  const actualOffset = offset + this.exprCompiler.stackFrameOffset;
                  lines.push(`    mov [rbp - ${actualOffset}], rcx  # Bind to ${bindingName}`);
                } else {
                  // Simple enum - just bind the value itself
                  const bindingName = bindings[0];
                  const offset = this.exprCompiler.addLocalVar(bindingName, 8);
                  const actualOffset = offset + this.exprCompiler.stackFrameOffset;
                  lines.push(`    mov [rbp - ${actualOffset}], rax  # Bind to ${bindingName}`);
                }
              }
            }
          }
        }
      }

      lines.push(`    add rsp, 8            # Pop match value`);
      lines.push(...this.compileBlock(arm.body));

      // Clean up local variables added for this arm
      this.exprCompiler.stackOffset = savedStackOffset;

      lines.push(`    jmp ${matchEndLabel}  # Exit match`);
      lines.push(``);
    }

    lines.push(`${matchEndLabel}:`);
    lines.push(`    # Match complete (assumes exhaustive patterns - wildcard _ required)`);

    return lines;
  }

  /**
   * Compile for loop: for item in collection { body }
   * Transforms to:
   *   let __i = 0
   *   let __len = vec_len(collection)
   *   while __i < __len {
   *     let item = vec_get(collection, __i)
   *     body
   *     __i = __i + 1
   *   }
   */
  compileFor(stmt) {
    const lines = [];
    const itemName = stmt.item;

    // Check if this is a range for-loop: for i in 0..10
    if (stmt.collection.type === 'range') {
      return this.compileForRange(stmt);
    }

    lines.push(`    # for ${itemName} in collection`);

    // Evaluate collection once and save it
    lines.push(...this.exprCompiler.compile(stmt.collection));
    lines.push(`    push rax              # Save collection pointer`);

    // Get collection length
    lines.push(`    mov rdi, rax`);
    lines.push(`    call builtin_vec_len`);
    lines.push(`    push rax              # Save length`);

    // Initialize loop counter
    lines.push(`    xor rax, rax          # i = 0`);
    const counterVar = this.exprCompiler.addLocalVar('__for_counter', 8);
    const counterOffset = counterVar + this.exprCompiler.stackFrameOffset;
    lines.push(`    mov [rbp - ${counterOffset}], rax`);

    // Loop labels
    const loopLabel = this.genLabel('for_loop');
    const endLabel = this.genLabel('for_end');

    lines.push(`${loopLabel}:`);

    // Check loop condition: i < length
    lines.push(`    mov rax, [rbp - ${counterOffset}]  # Load i`);
    lines.push(`    mov rbx, [rsp]        # Load length`);
    lines.push(`    cmp rax, rbx`);
    lines.push(`    jge ${endLabel}`);

    // Get item: vec_get(collection, i)
    lines.push(`    # Get current item`);
    lines.push(`    mov rsi, rax          # index in rsi`);
    lines.push(`    mov rdi, [rsp + 8]    # collection pointer in rdi`);
    lines.push(`    call builtin_vec_get`);

    // Try to infer element type from explicit annotation or collection
    let elementType = null;

    // Check for explicit type annotation first (e.g., for item: Type in ...)
    if (stmt.itemType) {
      elementType = stmt.itemType;
    } else {
      // Fall back to type inference from collection
      let collectionType = null;

      if (stmt.collection.type === 'field-access') {
        if (stmt.collection.object.type === 'variable' &&
            stmt.collection.object.name === 'state') {
          // state.fieldname - check field type
          const fieldName = stmt.collection.field;
          collectionType = this.symbolTable.getStateFieldType(this.agentId, fieldName);
        } else if (stmt.collection.object.type === 'variable') {
          // variable.field - check if variable has known type
          const varName = stmt.collection.object.name;
          const varType = this.exprCompiler.tempVarTypes.get(varName);

          if (varType) {
            // Look up field type in struct definition
            const structInfo = this.symbolTable.types.get(varType);
            if (structInfo && structInfo.kind === 'struct') {
              const field = structInfo.fields.find(f => f.name === stmt.collection.field);
              if (field) {
                collectionType = field.type;
              }
            }
          }
        }
      } else if (stmt.collection.type === 'variable') {
        // Direct variable - check if it has a known type
        const varName = stmt.collection.name;
        collectionType = this.exprCompiler.tempVarTypes.get(varName);
      }

      // Extract element type from vec<Type> notation
      if (collectionType && collectionType.startsWith('vec<') && collectionType.endsWith('>')) {
        elementType = collectionType.slice(4, -1);
      }
    }

    // Store item in local variable with type info
    const itemVar = this.exprCompiler.addLocalVar(itemName, 8, elementType);
    const itemOffset = itemVar + this.exprCompiler.stackFrameOffset;
    lines.push(`    mov [rbp - ${itemOffset}], rax  # Store item`);

    // Push loop context for break/continue (for loop allocates 16 bytes: collection + length)
    this.loopStack.push({ breakLabel: endLabel, continueLabel: `${loopLabel}_continue`, stackCleanup: 16 });

    // Compile loop body
    lines.push(...this.compileBlock(stmt.body));

    // Pop loop context
    this.loopStack.pop();

    // Continue label for continue statements
    lines.push(`${loopLabel}_continue:`);

    // Increment counter
    lines.push(`    mov rax, [rbp - ${counterOffset}]`);
    lines.push(`    inc rax`);
    lines.push(`    mov [rbp - ${counterOffset}], rax`);
    lines.push(`    jmp ${loopLabel}`);

    lines.push(`${endLabel}:`);

    // Clean up stack
    lines.push(`    add rsp, 16           # Pop length and collection`);

    return lines;
  }

  /**
   * Compile range for-loop: for i in start..end { body }
   * Generates:
   *   i = start
   *   while i < end {
   *     body
   *     i = i + 1
   *   }
   */
  compileForRange(stmt) {
    const lines = [];
    const itemName = stmt.item;
    const range = stmt.collection;

    lines.push(`    # for ${itemName} in ${range.start}..${range.end}`);

    // Compile and save the end value first
    lines.push(`    # Evaluate range end`);
    lines.push(...this.exprCompiler.compile(range.end));
    lines.push(`    push rax              # Save end value`);

    // Compile and store the start value as the loop variable
    lines.push(`    # Initialize loop variable to start`);
    lines.push(...this.exprCompiler.compile(range.start));

    // Create local variable for the loop counter
    const itemVar = this.exprCompiler.addLocalVar(itemName, 8);
    const itemOffset = itemVar + this.exprCompiler.stackFrameOffset;
    lines.push(`    mov [rbp - ${itemOffset}], rax  # ${itemName} = start`);

    // Loop labels
    const loopLabel = this.genLabel('range_loop');
    const endLabel = this.genLabel('range_end');

    lines.push(`${loopLabel}:`);

    // Check loop condition: itemName < end
    lines.push(`    mov rax, [rbp - ${itemOffset}]  # Load ${itemName}`);
    lines.push(`    mov rbx, [rsp]        # Load end value`);
    lines.push(`    cmp rax, rbx`);
    lines.push(`    jge ${endLabel}       # Exit if ${itemName} >= end`);

    // Push loop context for break/continue (for range loop allocates 8 bytes: end value)
    this.loopStack.push({ breakLabel: endLabel, continueLabel: `${loopLabel}_continue`, stackCleanup: 8 });

    // Compile loop body
    lines.push(...this.compileBlock(stmt.body));

    // Pop loop context
    this.loopStack.pop();

    // Continue label for continue statements
    lines.push(`${loopLabel}_continue:`);

    // Increment counter
    lines.push(`    mov rax, [rbp - ${itemOffset}]`);
    lines.push(`    inc rax`);
    lines.push(`    mov [rbp - ${itemOffset}], rax  # ${itemName}++`);
    lines.push(`    jmp ${loopLabel}`);

    lines.push(`${endLabel}:`);

    // Clean up stack
    lines.push(`    add rsp, 8            # Pop end value`);

    return lines;
  }

  /**
   * Compile for-kv loop (key-value iteration over map)
   * for key, value in map { ... }
   */
  compileForKV(stmt) {
    const lines = [];
    const keyName = stmt.key;
    const valueName = stmt.value;

    lines.push(`    # for ${keyName}, ${valueName} in map`);

    // Evaluate map once and save it
    lines.push(...this.exprCompiler.compile(stmt.collection));
    lines.push(`    push rax              # Save map pointer`);

    // Get map keys as a vector
    lines.push(`    mov rdi, rax`);
    lines.push(`    call builtin_map_keys`);
    lines.push(`    push rax              # Save keys vector`);

    // Get keys vector length
    lines.push(`    mov rdi, rax`);
    lines.push(`    call builtin_vec_len`);
    lines.push(`    push rax              # Save length`);

    // Initialize loop counter
    lines.push(`    xor rax, rax          # i = 0`);
    const counterVar = this.exprCompiler.addLocalVar('__forkv_counter', 8);
    const counterOffset = counterVar + this.exprCompiler.stackFrameOffset;
    lines.push(`    mov [rbp - ${counterOffset}], rax`);

    // Loop labels
    const loopLabel = this.genLabel('forkv_loop');
    const endLabel = this.genLabel('forkv_end');

    lines.push(`${loopLabel}:`);

    // Check loop condition: i < length
    lines.push(`    mov rax, [rbp - ${counterOffset}]  # Load i`);
    lines.push(`    mov rbx, [rsp]        # Load length`);
    lines.push(`    cmp rax, rbx`);
    lines.push(`    jge ${endLabel}`);

    // Get current key: vec_get(keys, i)
    lines.push(`    # Get current key`);
    lines.push(`    mov rsi, rax          # index in rsi`);
    lines.push(`    mov rdi, [rsp + 8]    # keys vector in rdi`);
    lines.push(`    call builtin_vec_get`);

    // Store key in local variable with type info
    const keyType = stmt.keyType || null;
    const keyVar = this.exprCompiler.addLocalVar(keyName, 8, keyType);
    const keyOffset = keyVar + this.exprCompiler.stackFrameOffset;
    lines.push(`    mov [rbp - ${keyOffset}], rax  # Store key`);

    // Get corresponding value: map_get(map, key)
    lines.push(`    # Get corresponding value`);
    lines.push(`    mov rsi, rax          # key in rsi`);
    lines.push(`    mov rdi, [rsp + 16]   # map pointer in rdi`);
    lines.push(`    call builtin_map_get`);

    // Store value in local variable with type info
    const valueType = stmt.valueType || null;
    const valueVar = this.exprCompiler.addLocalVar(valueName, 8, valueType);
    const valueOffset = valueVar + this.exprCompiler.stackFrameOffset;
    lines.push(`    mov [rbp - ${valueOffset}], rax  # Store value`);

    // Push loop context for break/continue (for-kv loop allocates 24 bytes: length + keys + map)
    this.loopStack.push({ breakLabel: endLabel, continueLabel: `${loopLabel}_continue`, stackCleanup: 24 });

    // Compile loop body
    lines.push(...this.compileBlock(stmt.body));

    // Pop loop context
    this.loopStack.pop();

    // Continue label for continue statements
    lines.push(`${loopLabel}_continue:`);

    // Increment counter
    lines.push(`    mov rax, [rbp - ${counterOffset}]`);
    lines.push(`    inc rax`);
    lines.push(`    mov [rbp - ${counterOffset}], rax`);
    lines.push(`    jmp ${loopLabel}`);

    lines.push(`${endLabel}:`);

    // Clean up stack
    lines.push(`    add rsp, 24           # Pop length, keys, and map`);

    return lines;
  }

  /**
   * Compile field access to get address (not value)
   * Returns address in rbx register
   */
  compileFieldAccessAddress(expr) {
    const lines = [];

    if (expr.object.type === 'variable' && expr.object.name === 'state') {
      // state.field - simple state field access
      const fieldName = expr.field;
      const fieldOffset = this.symbolTable.getStateFieldOffset(this.agentId, fieldName);

      if (fieldOffset === null) {
        console.error('[DEBUG] compileFieldAccessAddress: unknown state field');
        console.error('[DEBUG] Field name:', fieldName);
        console.error('[DEBUG] Full expression:', JSON.stringify(expr));
        console.error('[DEBUG] Agent ID:', this.agentId);
        throw new Error(`Unknown state field: ${fieldName}`);
      }

      lines.push(`    lea rbx, [r12 + ${fieldOffset}]  # Address of state.${fieldName}`);

    } else if (expr.object.type === 'variable') {
      // local_var.field - field of a local variable
      const varName = expr.object.name;

      // Debug: Check if varName is null or undefined
      if (varName === null || varName === undefined) {
        console.error('[DEBUG] Field access on variable with null/undefined name:', JSON.stringify(expr.object));
        console.error('[DEBUG] Full field access expression:', JSON.stringify(expr));
        throw new Error(`Field access on variable with null/undefined name. Full expression: ${JSON.stringify(expr)}`);
      }

      const varOffset = this.exprCompiler.getLocalVarOffset(varName);

      if (varOffset === undefined) {
        throw new Error(`Unknown variable: ${varName}`);
      }

      // Load the value (should be a pointer to a struct)
      const actualOffset = varOffset + this.exprCompiler.stackFrameOffset;
      lines.push(`    mov rax, [rbp - ${actualOffset}]  # Load ${varName}`);

      // Get field offset
      const varType = this.exprCompiler.tempVarTypes.get(varName);
      if (varType) {
        const structInfo = this.symbolTable.types.get(varType);
        if (structInfo && structInfo.kind === 'struct') {
          const field = structInfo.fields.find(f => f.name === expr.field);
          if (field) {
            lines.push(`    lea rbx, [rax + ${field.offset}]  # Address of ${varName}.${expr.field}`);
          } else {
            throw new Error(`Unknown field ${expr.field} in struct ${varType}`);
          }
        } else {
          throw new Error(`Variable ${varName} is not a struct type`);
        }
      } else {
        throw new Error(`Cannot determine type of variable ${varName}`);
      }

    } else if (expr.object.type === 'state-access') {
      // state.field1.field2 - nested state field access
      const parentField = expr.object.field;
      const fieldName = expr.field;

      // Get parent field offset and type
      const parentOffset = this.symbolTable.getStateFieldOffset(this.agentId, parentField);
      const parentType = this.symbolTable.getStateFieldType(this.agentId, parentField);

      if (parentOffset === null) {
        throw new Error(`Unknown state field: ${parentField}`);
      }

      // Load parent field value (should be pointer or inline struct)
      lines.push(`    mov rax, [r12 + ${parentOffset}]  # Load state.${parentField}`);

      // Get child field offset in parent struct
      if (parentType) {
        const structInfo = this.symbolTable.types.get(parentType);
        if (structInfo && structInfo.kind === 'struct') {
          const field = structInfo.fields.find(f => f.name === fieldName);
          if (field) {
            lines.push(`    lea rbx, [rax + ${field.offset}]  # Address of ${parentField}.${fieldName}`);
          } else {
            throw new Error(`Unknown field ${fieldName} in struct ${parentType}`);
          }
        } else {
          throw new Error(`Type ${parentType} is not a struct`);
        }
      } else {
        throw new Error(`Cannot determine type of state.${parentField}`);
      }

    } else if (expr.object.type === 'field-access') {
      // Nested field access: obj.field1.field2
      // First get the value of obj.field1 (which should be a pointer or inline struct)
      lines.push(...this.exprCompiler.compile(expr.object));
      // Now rax contains the pointer to the parent struct
      // Get field offset in that struct
      const fieldName = expr.field;

      // Try to determine the struct type
      let structType = null;
      if (expr.object.object.type === 'variable' && expr.object.object.name === 'state') {
        const parentField = expr.object.field;
        structType = this.symbolTable.getStateFieldType(this.agentId, parentField);
      } else if (expr.object.object.type === 'variable') {
        const varName = expr.object.object.name;
        const varType = this.exprCompiler.tempVarTypes.get(varName);
        if (varType) {
          const structInfo = this.symbolTable.types.get(varType);
          if (structInfo && structInfo.kind === 'struct') {
            const parentField = expr.object.field;
            const field = structInfo.fields.find(f => f.name === parentField);
            if (field) {
              structType = field.type;
            }
          }
        }
      }

      if (structType) {
        const structInfo = this.symbolTable.types.get(structType);
        if (structInfo && structInfo.kind === 'struct') {
          const field = structInfo.fields.find(f => f.name === fieldName);
          if (field) {
            lines.push(`    lea rbx, [rax + ${field.offset}]  # Address of ${fieldName}`);
          } else {
            throw new Error(`Unknown field ${fieldName} in struct ${structType}`);
          }
        } else {
          throw new Error(`Type ${structType} is not a struct`);
        }
      } else {
        throw new Error(`Cannot determine struct type for field access`);
      }

    } else {
      throw new Error(`Unsupported field access pattern in assignment: ${expr.object.type}`);
    }

    return lines;
  }

  /**
   * Get the expression compiler for direct access
   */
  getExpressionCompiler() {
    return this.exprCompiler;
  }
}

module.exports = { StatementCompiler };

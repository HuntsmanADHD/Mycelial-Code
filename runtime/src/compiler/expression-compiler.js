/**
 * Expression Compiler
 *
 * Compiles Mycelial expressions to x86-64 assembly.
 * Implements register allocation and type-aware code generation.
 *
 * Register Convention:
 * - rax: Primary accumulator (return value)
 * - rbx, rcx, rdx: Temporary registers
 * - rdi, rsi, rdx, rcx, r8, r9: Function arguments (System V ABI)
 * - r12: Agent state base pointer
 * - r13: Signal payload pointer
 * - r14, r15: Reserved for future use
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-10
 */

class ExpressionCompiler {
  constructor(symbolTable) {
    this.symbolTable = symbolTable;
    this.labelCounter = 0;
    this.stringLiterals = new Map();  // string -> label
    this.stringCounter = 0;
  }

  /**
   * Compile an expression to assembly
   * @param {Object} expr - Expression AST node
   * @param {Object} context - Compilation context (agent, handler, locals)
   * @returns {string} Assembly code that leaves result in rax
   */
  compile(expr, context) {
    if (!expr) {
      throw new Error('Expression is null or undefined');
    }

    switch (expr.type) {
      case 'literal':
        return this.compileLiteral(expr, context);

      case 'variable':
        return this.compileVariable(expr, context);

      case 'field-access':
      case 'state-access':
        return this.compileFieldAccess(expr, context);

      case 'binary-op':
        return this.compileBinaryOp(expr, context);

      case 'binary':
        // Parser generates 'binary' type with 'op' field
        return this.compileBinary(expr, context);

      case 'unary-op':
      case 'unary':
        return this.compileUnaryOp(expr, context);

      case 'function-call':
        return this.compileFunctionCall(expr, context);

      case 'comparison':
        return this.compileComparison(expr, context);

      case 'logical-op':
        return this.compileLogicalOp(expr, context);

      case 'array-literal':
        return this.compileArrayLiteral(expr, context);

      case 'array-access':
        return this.compileArrayAccess(expr, context);

      case 'map-literal':
        return this.compileMapLiteral(expr, context);

      case 'method-call':
        return this.compileMethodCall(expr, context);

      case 'range':
        // Range is only used as part of other constructs (for loops, slicing)
        // If we encounter it standalone, it's an error
        throw new Error('Range expressions are not supported as standalone expressions');

      default:
        throw new Error(`Unsupported expression type: ${expr.type}`);
    }
  }

  /**
   * Compile literal values (numbers, strings, booleans)
   */
  compileLiteral(expr, context) {
    const value = expr.value;
    const lines = [];

    if (typeof value === 'number') {
      // Integer or float literal
      if (Number.isInteger(value)) {
        lines.push(`    mov rax, ${value}    # literal: ${value}`);
      } else {
        // Float: need to load from .rodata
        const label = this.addFloatLiteral(value);
        lines.push(`    movsd xmm0, [${label}]    # literal: ${value}`);
        lines.push(`    # TODO: convert float to integer representation in rax`);
      }
    } else if (typeof value === 'string') {
      // String literal: store address in rax
      const label = this.addStringLiteral(value);
      lines.push(`    lea rax, [${label}]    # literal: "${value}"`);
    } else if (typeof value === 'boolean') {
      // Boolean: 0 or 1
      lines.push(`    mov rax, ${value ? 1 : 0}    # literal: ${value}`);
    } else {
      throw new Error(`Unsupported literal type: ${typeof value}`);
    }

    return lines.join('\n');
  }

  /**
   * Compile variable reference
   */
  compileVariable(expr, context) {
    const varName = expr.name;
    const lines = [];

    // Check if it's the signal binding (e.g., 'g' in 'on signal(greeting, g)')
    if (context.signalBinding === varName) {
      lines.push(`    mov rax, r13    # ${varName} (signal payload)`);
      return lines.join('\n');
    }

    // Check if it's a local variable
    if (context.locals && context.locals[varName]) {
      const offset = context.locals[varName].offset;
      lines.push(`    mov rax, [rbp - ${offset}]    # ${varName} (local)`);
      return lines.join('\n');
    }

    throw new Error(`Unknown variable: ${varName}`);
  }

  /**
   * Compile field access (e.g., state.counter, g.name)
   */
  compileFieldAccess(expr, context) {
    const lines = [];
    const object = expr.object;
    const fieldName = expr.field;

    // Handle state.field (object might be a variable or a string for state-access)
    const isStateAccess = (object.type === 'variable' && object.name === 'state') ||
                          (typeof object === 'string' && object === 'state');

    if (isStateAccess) {
      const agent = this.symbolTable.agents.get(context.agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${context.agentId}`);
      }

      // Find field offset in agent state
      const stateFields = agent.typeDef.state;
      let offset = 0;
      let found = false;

      for (const field of stateFields) {
        // Determine actual size in state (pointers are 8 bytes)
        const isPointerType = field.type === 'string' ||
                              field.type.startsWith('vec<') ||
                              field.type.startsWith('map<');
        const actualSize = isPointerType ? 8 : this.symbolTable.getTypeSize(field.type);

        // Add alignment padding before this field if needed
        if (actualSize >= 8 && offset % 8 !== 0) {
          offset += 8 - (offset % 8); // Align to 8 bytes
        } else if (actualSize === 4 && offset % 4 !== 0) {
          offset += 4 - (offset % 4); // Align to 4 bytes
        } else if (actualSize === 2 && offset % 2 !== 0) {
          offset += 1; // Align to 2 bytes
        }

        if (field.name === fieldName) {
          found = true;
          break;
        }
        offset += actualSize;
      }

      if (!found) {
        throw new Error(`State field not found: ${fieldName}`);
      }

      lines.push(`    mov rax, [r12 + ${offset}]    # state.${fieldName}`);
      return lines.join('\n');
    }

    // Handle variable.field (e.g., g.name for signal payload)
    if (object.type === 'variable') {
      // First, get the object pointer
      const objectCode = this.compile(object, context);
      lines.push(objectCode);

      // Now rax contains the object pointer
      // For signal payloads, fields are stored at fixed offsets
      // We need to look up the frequency definition
      if (context.signalBinding === object.name && context.signalFrequency) {
        const freq = this.symbolTable.frequencies.get(context.signalFrequency);
        if (!freq) {
          throw new Error(`Frequency not found: ${context.signalFrequency}`);
        }

        let offset = 0;
        let found = false;

        for (const field of freq.fields) {
          // Determine actual size in payload (pointers are 8 bytes)
          const isPointerType = field.type === 'string' ||
                                field.type.startsWith('vec<') ||
                                field.type.startsWith('map<');
          const actualSize = isPointerType ? 8 : this.symbolTable.getTypeSize(field.type);

          // Add alignment padding before this field if needed
          if (actualSize >= 8 && offset % 8 !== 0) {
            offset += 8 - (offset % 8); // Align to 8 bytes
          } else if (actualSize === 4 && offset % 4 !== 0) {
            offset += 4 - (offset % 4); // Align to 4 bytes
          } else if (actualSize === 2 && offset % 2 !== 0) {
            offset += 1; // Align to 2 bytes
          }

          if (field.name === fieldName) {
            found = true;
            break;
          }
          offset += actualSize;
        }

        if (!found) {
          throw new Error(`Field not found in ${context.signalFrequency}: ${fieldName}`);
        }

        lines.push(`    mov rax, [rax + ${offset}]    # ${object.name}.${fieldName}`);
        return lines.join('\n');
      }
    }

    throw new Error(`Unsupported field access: ${JSON.stringify(expr)}`);
  }

  /**
   * Compile binary operations (+, -, *, /, %)
   */
  compileBinaryOp(expr, context) {
    const lines = [];
    const left = expr.left;
    const right = expr.right;
    const op = expr.operator;

    // Evaluate left operand -> rax
    const leftCode = this.compile(left, context);
    lines.push(leftCode);
    lines.push(`    push rax    # save left operand`);

    // Evaluate right operand -> rax
    const rightCode = this.compile(right, context);
    lines.push(rightCode);
    lines.push(`    mov rbx, rax    # right operand in rbx`);
    lines.push(`    pop rax    # restore left operand`);

    // Perform operation
    switch (op) {
      case '+':
        lines.push(`    add rax, rbx    # ${op}`);
        break;
      case '-':
        lines.push(`    sub rax, rbx    # ${op}`);
        break;
      case '*':
        lines.push(`    imul rax, rbx    # ${op}`);
        break;
      case '/':
        lines.push(`    cqo    # sign-extend rax to rdx:rax`);
        lines.push(`    idiv rbx    # ${op} (quotient in rax)`);
        break;
      case '%':
        lines.push(`    cqo    # sign-extend rax to rdx:rax`);
        lines.push(`    idiv rbx    # ${op}`);
        lines.push(`    mov rax, rdx    # remainder in rdx, move to rax`);
        break;
      default:
        throw new Error(`Unsupported binary operator: ${op}`);
    }

    return lines.join('\n');
  }

  /**
   * Compile binary expressions (parser format with 'op' field)
   * Dispatches to appropriate handler based on operator type
   */
  compileBinary(expr, context) {
    const op = expr.op;

    // Determine operator category and delegate
    if (['+', '-', '*', '/', '%'].includes(op)) {
      // Arithmetic operators
      return this.compileBinaryOp({ ...expr, operator: op }, context);
    } else if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
      // Comparison operators
      return this.compileComparison({ ...expr, operator: op }, context);
    } else if (['&&', '||'].includes(op)) {
      // Logical operators
      return this.compileLogicalOp({ ...expr, operator: op }, context);
    } else {
      throw new Error(`Unsupported binary operator: ${op}`);
    }
  }

  /**
   * Compile unary operations (-, !)
   */
  compileUnaryOp(expr, context) {
    const lines = [];
    const operand = expr.operand;
    const op = expr.operator || expr.op;  // Support both 'operator' and 'op' fields

    // Evaluate operand -> rax
    const operandCode = this.compile(operand, context);
    lines.push(operandCode);

    switch (op) {
      case '-':
        lines.push(`    neg rax    # unary ${op}`);
        break;
      case '!':
        lines.push(`    test rax, rax    # logical NOT`);
        lines.push(`    sete al    # set if equal to zero`);
        lines.push(`    movzx rax, al    # zero-extend to 64-bit`);
        break;
      default:
        throw new Error(`Unsupported unary operator: ${op}`);
    }

    return lines.join('\n');
  }

  /**
   * Compile comparison operations (==, !=, <, >, <=, >=)
   */
  compileComparison(expr, context) {
    const lines = [];
    const left = expr.left;
    const right = expr.right;
    const op = expr.operator;

    // Evaluate left -> rax
    const leftCode = this.compile(left, context);
    lines.push(leftCode);
    lines.push(`    push rax    # save left`);

    // Evaluate right -> rax
    const rightCode = this.compile(right, context);
    lines.push(rightCode);
    lines.push(`    mov rbx, rax    # right in rbx`);
    lines.push(`    pop rax    # restore left`);

    // Compare
    lines.push(`    cmp rax, rbx    # compare`);

    // Set result based on comparison
    const setInstructions = {
      '==': 'sete',
      '!=': 'setne',
      '<': 'setl',
      '>': 'setg',
      '<=': 'setle',
      '>=': 'setge'
    };

    const setInstr = setInstructions[op];
    if (!setInstr) {
      throw new Error(`Unsupported comparison operator: ${op}`);
    }

    lines.push(`    ${setInstr} al    # set if ${op}`);
    lines.push(`    movzx rax, al    # zero-extend to 64-bit`);

    return lines.join('\n');
  }

  /**
   * Compile logical operations (&&, ||)
   */
  compileLogicalOp(expr, context) {
    const lines = [];
    const left = expr.left;
    const right = expr.right;
    const op = expr.operator;

    if (op === '&&') {
      // Short-circuit AND
      const falseLabel = this.makeLabel('and_false');
      const endLabel = this.makeLabel('and_end');

      // Evaluate left
      const leftCode = this.compile(left, context);
      lines.push(leftCode);
      lines.push(`    test rax, rax    # check left`);
      lines.push(`    jz ${falseLabel}    # short-circuit if false`);

      // Evaluate right
      const rightCode = this.compile(right, context);
      lines.push(rightCode);
      lines.push(`    test rax, rax`);
      lines.push(`    jz ${falseLabel}`);

      // Both true
      lines.push(`    mov rax, 1`);
      lines.push(`    jmp ${endLabel}`);

      // False case
      lines.push(`${falseLabel}:`);
      lines.push(`    xor rax, rax    # result = 0`);

      lines.push(`${endLabel}:`);

    } else if (op === '||') {
      // Short-circuit OR
      const trueLabel = this.makeLabel('or_true');
      const endLabel = this.makeLabel('or_end');

      // Evaluate left
      const leftCode = this.compile(left, context);
      lines.push(leftCode);
      lines.push(`    test rax, rax`);
      lines.push(`    jnz ${trueLabel}    # short-circuit if true`);

      // Evaluate right
      const rightCode = this.compile(right, context);
      lines.push(rightCode);
      lines.push(`    test rax, rax`);
      lines.push(`    jnz ${trueLabel}`);

      // Both false
      lines.push(`    xor rax, rax    # result = 0`);
      lines.push(`    jmp ${endLabel}`);

      // True case
      lines.push(`${trueLabel}:`);
      lines.push(`    mov rax, 1`);

      lines.push(`${endLabel}:`);

    } else {
      throw new Error(`Unsupported logical operator: ${op}`);
    }

    return lines.join('\n');
  }

  /**
   * Compile function calls (builtins)
   */
  compileFunctionCall(expr, context) {
    const lines = [];
    const funcName = expr.name;
    const args = expr.args || [];

    // Special case: format() for string interpolation
    if (funcName === 'format') {
      return this.compileFormat(expr, context);
    }

    // Special case: len() - needs type-aware dispatch
    if (funcName === 'len' && args.length === 1) {
      return this.compileLen(args[0], context);
    }

    // System V AMD64 calling convention:
    // Arguments in: rdi, rsi, rdx, rcx, r8, r9
    // Return value in: rax
    const argRegs = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];

    if (args.length > 6) {
      throw new Error(`Too many arguments for function call: ${funcName}`);
    }

    // Evaluate arguments in reverse order and push to stack
    for (let i = args.length - 1; i >= 0; i--) {
      const argCode = this.compile(args[i], context);
      lines.push(argCode);
      lines.push(`    push rax    # arg ${i}`);
    }

    // Pop arguments into registers
    for (let i = 0; i < args.length; i++) {
      lines.push(`    pop ${argRegs[i]}    # arg ${i}`);
    }

    // Call builtin function
    lines.push(`    call builtin_${funcName}    # ${funcName}()`);
    lines.push(`    # result in rax`);

    return lines.join('\n');
  }

  /**
   * Compile len() with type-aware dispatch
   * Determines if argument is a string or vector and calls the appropriate builtin
   */
  compileLen(argExpr, context) {
    const lines = [];

    // Try to infer the type of the argument
    let argType = this.inferType(argExpr, context);

    // Compile the argument
    const argCode = this.compile(argExpr, context);
    lines.push(argCode);
    lines.push(`    mov rdi, rax    # argument to len()`);

    // Dispatch to the correct builtin based on type
    if (argType && argType.startsWith('vec<')) {
      lines.push(`    call builtin_vec_len    # len() for vector`);
    } else if (argType === 'string') {
      lines.push(`    call builtin_string_len    # len() for string`);
    } else {
      // Fallback: use string_len (original behavior)
      lines.push(`    call builtin_string_len    # len() default to string`);
    }

    return lines.join('\n');
  }

  /**
   * Infer the type of an expression
   * Returns type string like 'string', 'vec<i64>', 'i32', etc.
   */
  inferType(expr, context) {
    if (!expr) return null;

    switch (expr.type) {
      case 'literal':
        if (typeof expr.value === 'string') return 'string';
        if (typeof expr.value === 'number') {
          return Number.isInteger(expr.value) ? 'i64' : 'f64';
        }
        if (typeof expr.value === 'boolean') return 'bool';
        return null;

      case 'array-literal':
        return 'vec<i64>'; // Default to vec<i64>

      case 'field-access':
      case 'state-access':
        // Try to look up field type from frequency or agent state
        const fieldName = expr.field;

        // Check if this is a signal payload field
        if (expr.object && expr.object.type === 'variable' && context.signalBinding === expr.object.name) {
          const freq = this.symbolTable.frequencies.get(context.signalFrequency);
          if (freq) {
            const field = freq.fields.find(f => f.name === fieldName);
            if (field) {
              return field.type;
            }
          }
        }

        // Check if this is a state field
        if ((expr.object && expr.object.type === 'variable' && expr.object.name === 'state') ||
            (typeof expr.object === 'string' && expr.object === 'state')) {
          const agent = this.symbolTable.agents.get(context.agentId);
          if (agent && agent.typeDef.state) {
            const field = agent.typeDef.state.find(f => f.name === fieldName);
            if (field) {
              return field.type;
            }
          }
        }
        return null;

      case 'variable':
        // Check locals
        if (context.locals && context.locals[expr.name]) {
          return context.locals[expr.name].type;
        }
        return null;

      case 'array-access':
        // Infer type of array access (map[key] or vec[index])
        const objectType = this.inferType(expr.object, context);
        if (objectType) {
          // Extract value type from map<K, V> or vec<T>
          if (objectType.startsWith('map<')) {
            // Extract value type from map<K, V>
            const match = objectType.match(/map<[^,]+,\s*(.+)>$/);
            if (match) {
              return match[1].trim();
            }
          } else if (objectType.startsWith('vec<')) {
            // Extract element type from vec<T>
            const match = objectType.match(/vec<(.+)>$/);
            if (match) {
              return match[1].trim();
            }
          }
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Compile format() string interpolation
   */
  compileFormat(expr, context) {
    const lines = [];
    const args = expr.args || [];

    if (args.length === 0) {
      throw new Error('format() requires at least one argument');
    }

    // For now, simple implementation:
    // format("Hello, {}!", name) -> concatenate strings
    // This is a placeholder - proper implementation needs string builder

    // Evaluate format string
    const formatCode = this.compile(args[0], context);
    lines.push(formatCode);
    lines.push(`    push rax    # format string`);

    // Evaluate remaining arguments
    for (let i = 1; i < args.length; i++) {
      const argCode = this.compile(args[i], context);
      lines.push(argCode);
      lines.push(`    push rax    # arg ${i}`);
    }

    // Call format helper
    lines.push(`    mov rdi, ${args.length}    # number of args`);
    lines.push(`    call builtin_format    # format string`);
    lines.push(`    add rsp, ${args.length * 8}    # clean up stack`);

    return lines.join('\n');
  }

  /**
   * Compile array literal: [1, 2, 3]
   * Creates a vector and pushes all elements
   */
  compileArrayLiteral(expr, context) {
    const lines = [];
    const elements = expr.elements || [];

    // Create new vector
    lines.push(`    # array literal with ${elements.length} elements`);
    lines.push(`    call builtin_vec_new`);
    lines.push(`    mov rbx, rax    # save vector pointer in rbx`);

    // Push each element
    for (let i = 0; i < elements.length; i++) {
      // Evaluate element expression
      const elemCode = this.compile(elements[i], context);
      lines.push(elemCode);

      // Push to vector
      lines.push(`    mov rsi, rax    # element value`);
      lines.push(`    mov rdi, rbx    # vector pointer`);
      lines.push(`    call builtin_vec_push`);
    }

    // Return vector pointer
    lines.push(`    mov rax, rbx    # return vector pointer`);

    return lines.join('\n');
  }

  /**
   * Compile array access: vec[index] or vec[start..end]
   * Calls vec_get(vec, index) or vec_slice(vec, start, end)
   */
  compileArrayAccess(expr, context) {
    const lines = [];
    const object = expr.object;
    const index = expr.index;

    // Check if this is a slice operation (index is a range)
    if (index.type === 'range') {
      // Slice: vec[start..end]
      lines.push(`    # array slice`);

      // Evaluate vector expression
      const objCode = this.compile(object, context);
      lines.push(objCode);
      lines.push(`    mov r14, rax    # save vector pointer`);

      // Evaluate start expression
      const startCode = this.compile(index.start, context);
      lines.push(startCode);
      lines.push(`    mov r15, rax    # save start`);

      // Evaluate end expression
      const endCode = this.compile(index.end, context);
      lines.push(endCode);

      // Call vec_slice(vec, start, end)
      lines.push(`    mov rdx, rax    # end`);
      lines.push(`    mov rsi, r15    # start`);
      lines.push(`    mov rdi, r14    # vector pointer`);
      lines.push(`    call builtin_vec_slice`);

      return lines.join('\n');
    }

    // Regular index access: vec[index] or map[key]
    // Determine if object is a map or vector by checking its type
    let isMap = false;

    // Check if object is a field access (state.field_name)
    if (object.type === 'field-access') {
      const baseObject = object.object;  // {type: 'state'} or {type: 'variable', name: 'x'}
      const fieldName = object.field;     // 'partial_results'

      // Check agent state fields (state can be represented as {type: 'state'} or {type: 'variable', name: 'state'})
      const isStateAccess = baseObject.type === 'state' || (baseObject.type === 'variable' && baseObject.name === 'state');

      if (isStateAccess && context.agentId) {
        const agent = this.symbolTable.agents.get(context.agentId);
        if (agent && agent.typeDef.state) {
          const field = agent.typeDef.state.find(f => f.name === fieldName);
          if (field && field.type.startsWith('map<')) {
            isMap = true;
          }
        }
      }
    }

    // Evaluate object expression
    const objCode = this.compile(object, context);
    lines.push(objCode);
    lines.push(`    mov r14, rax    # save ${isMap ? 'map' : 'vector'} pointer in r14`);

    // Evaluate index expression
    const idxCode = this.compile(index, context);
    lines.push(idxCode);

    // Call appropriate get function based on type
    if (isMap) {
      lines.push(`    mov rsi, rax    # key`);
      lines.push(`    mov rdi, r14    # map pointer`);
      lines.push(`    call builtin_map_get`);
    } else {
      lines.push(`    mov rsi, rax    # index`);
      lines.push(`    mov rdi, r14    # vector pointer`);
      lines.push(`    call builtin_vec_get`);
    }

    return lines.join('\n');
  }

  /**
   * Compile map literal: {}
   * For now, only supports empty map literals
   */
  compileMapLiteral(expr, context) {
    const lines = [];
    const entries = expr.entries || [];

    if (entries.length > 0) {
      throw new Error('Map literals with entries not yet supported');
    }

    // Create new empty map
    lines.push(`    # map literal (empty)`);
    lines.push(`    call builtin_map_new`);
    lines.push(`    # rax now contains map pointer`);

    return lines.join('\n');
  }

  /**
   * Compile method call: obj.method(args)
   * Parser represents this as { type: 'method-call', object: { type: 'field-access', object: obj, field: 'method' }, args }
   */
  compileMethodCall(expr, context) {
    const lines = [];

    // Extract method name and receiver object
    // expr.object is a field-access where field is the method name
    if (expr.object.type !== 'field-access') {
      throw new Error(`Method call object must be field-access, got ${expr.object.type}`);
    }

    const methodName = expr.object.field;
    const receiver = expr.object.object;
    const args = expr.args || [];

    lines.push(`    # method call: .${methodName}()`);

    // Compile receiver (the object the method is called on)
    const receiverCode = this.compile(receiver, context);
    lines.push(receiverCode);
    lines.push(`    mov r14, rax    # save receiver in r14`);

    // Compile arguments (evaluate in order, save on stack)
    const argRegs = ['rsi', 'rdx', 'rcx', 'r8', 'r9'];

    if (args.length > argRegs.length) {
      throw new Error(`Method calls with more than ${argRegs.length} arguments not yet supported`);
    }

    // Evaluate arguments and save in r15 (for single arg), or on stack for multiple
    const savedArgs = [];
    for (let i = 0; i < args.length; i++) {
      const argCode = this.compile(args[i], context);
      lines.push(argCode);

      if (i === 0 && args.length === 1) {
        lines.push(`    mov r15, rax    # save arg0`);
      } else {
        lines.push(`    push rax    # save arg${i}`);
        savedArgs.push(i);
      }
    }

    // Pop arguments into registers (in reverse order)
    for (let i = savedArgs.length - 1; i >= 0; i--) {
      lines.push(`    pop ${argRegs[savedArgs[i]]}    # arg${savedArgs[i]}`);
    }

    // First argument goes in rsi (or r15 if it was saved there)
    if (args.length === 1) {
      lines.push(`    mov rsi, r15    # arg0`);
    }

    // Receiver goes in rdi
    lines.push(`    mov rdi, r14    # receiver`);

    // Map method names to builtin functions
    const methodMap = {
      // Map methods
      'contains_key': 'builtin_map_has',
      'has': 'builtin_map_has',
      'get': 'builtin_map_get',
      'set': 'builtin_map_set',
      'delete': 'builtin_map_delete',
      'remove': 'builtin_map_delete',

      // Vector methods
      'push': 'builtin_vec_push',
      'pop': 'builtin_vec_pop',
      'len': 'builtin_vec_len',
    };

    const builtinName = methodMap[methodName];
    if (!builtinName) {
      throw new Error(`Unknown method: ${methodName}`);
    }

    lines.push(`    call ${builtinName}`);
    lines.push(`    # rax contains return value`);

    return lines.join('\n');
  }

  /**
   * Add string literal to .rodata section
   */
  addStringLiteral(str) {
    if (this.stringLiterals.has(str)) {
      return this.stringLiterals.get(str);
    }

    const label = `.str_${this.stringCounter++}`;
    this.stringLiterals.set(str, label);
    return label;
  }

  /**
   * Add float literal to .rodata section
   */
  addFloatLiteral(value) {
    // TODO: Track float literals
    return `.float_${Math.abs(value).toString().replace('.', '_')}`;
  }

  /**
   * Generate unique label
   */
  makeLabel(prefix) {
    return `.${prefix}_${this.labelCounter++}`;
  }

  /**
   * Get string literals for .rodata section
   */
  getStringLiterals() {
    return this.stringLiterals;
  }
}

module.exports = { ExpressionCompiler };

/**
 * Mycelial Expression Compiler
 *
 * Compiles Mycelial expressions to x86-64 assembly code.
 * Result is left in rax register (or xmm0 for floats).
 *
 * Register allocation:
 * - rax: primary result/accumulator
 * - rbx, rcx, rdx: temporary values
 * - r12: agent state base pointer (set by handler prologue)
 * - r13: signal payload pointer (for message field access)
 * - rdi, rsi, rdx, rcx, r8, r9: function arguments
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-15
 */

class ExpressionCompiler {
  constructor(symbolTable, agentId, sharedLabelCounter = null) {
    this.symbolTable = symbolTable;
    this.agentId = agentId;
    // Use shared label counter if provided, otherwise create local one
    this.labelCounter = sharedLabelCounter || { count: 0 };
    this.tempVars = new Map(); // local variable name -> stack offset
    this.tempVarTypes = new Map(); // local variable name -> type name
    this.stackOffset = 0; // Current stack offset for locals
    this.stackFrameOffset = 0; // Base offset for stack frame (for saved registers)
    this.stringLiterals = []; // Array of {label, value} for string literals
    // Handler context for signal handlers
    this.currentFrequency = null;
    this.currentParamName = null;
  }

  /**
   * Set statement compiler reference (for circular dependency)
   */
  setStatementCompiler(stmtCompiler) {
    this.stmtCompiler = stmtCompiler;
  }

  /**
   * Set handler context for signal handler compilation
   */
  setHandlerContext(frequency, paramName) {
    this.currentFrequency = frequency;
    this.currentParamName = paramName;
    // Reset local variables for new handler
    this.tempVars.clear();
    this.tempVarTypes.clear();
    this.stackOffset = 0;
    this.stackFrameOffset = 0;
  }

  /**
   * Set stack frame offset (for saved registers in function prologue)
   */
  setStackFrameOffset(offset) {
    this.stackFrameOffset = offset;
  }

  /**
   * Generate a unique label
   */
  genLabel(prefix) {
    return `${prefix}_${this.labelCounter.count++}`;
  }

  /**
   * Compile an expression and return assembly code
   * Result is left in rax
   */
  compile(expr) {
    const lines = [];

    switch (expr.type) {
      case 'literal':
        lines.push(...this.compileLiteral(expr));
        break;

      case 'variable':
        lines.push(...this.compileVariable(expr));
        break;

      case 'state-access':
      case 'field-access':
        lines.push(...this.compileFieldAccess(expr));
        break;

      case 'binary':
        lines.push(...this.compileBinary(expr));
        break;

      case 'unary':
        lines.push(...this.compileUnary(expr));
        break;

      case 'function-call':
        lines.push(...this.compileFunctionCall(expr));
        break;

      case 'cast':
      case 'type-cast':
        lines.push(...this.compileCast(expr));
        break;

      case 'struct-literal':
        lines.push(...this.compileStructLiteral(expr));
        break;

      case 'enum-variant':
        lines.push(...this.compileEnumVariant(expr));
        break;

      case 'array-access':
        lines.push(...this.compileArrayAccess(expr));
        break;

      case 'enum-variant-constructor':
        lines.push(...this.compileEnumVariantConstructor(expr));
        break;

      case 'if-expression':
        lines.push(...this.compileIfExpression(expr));
        break;

      case 'array-literal':
        lines.push(...this.compileArrayLiteral(expr));
        break;

      case 'tuple-expression':
        // Tuples are compiled as arrays/vectors
        lines.push(...this.compileTupleExpression(expr));
        break;

      case 'match':
        // Match expression - delegate to statement compiler and get result in rax
        lines.push(...this.stmtCompiler.compileMatch(expr));
        break;

      default:
        throw new Error(`Unsupported expression type: ${expr.type}`);
    }

    return lines;
  }

  /**
   * Compile a literal value
   */
  compileLiteral(expr) {
    const lines = [];

    // Check for null first (before typeof, since typeof null === 'object')
    if (expr.value === null) {
      // Null pointer represented as 0
      lines.push(`    mov rax, 0            # null`);
    } else if (typeof expr.value === 'number') {
      // Integer or float literal
      lines.push(`    mov rax, ${expr.value}`);
    } else if (typeof expr.value === 'string') {
      // String literal - create a .rodata entry
      const label = this.genLabel('str');
      this.stringLiterals.push({ label, value: expr.value });
      console.error(`[DEBUG] ExpressionCompiler: Created string literal "${expr.value}" -> ${label}`);
      lines.push(`    lea rax, [rip + ${label}]`);
    } else if (typeof expr.value === 'boolean') {
      lines.push(`    mov rax, ${expr.value ? 1 : 0}`);
    } else {
      throw new Error(`Unsupported literal type: ${typeof expr.value}`);
    }

    return lines;
  }

  /**
   * Compile a variable reference
   */
  compileVariable(expr) {
    const lines = [];
    const varName = expr.name;

    // Debug: Check if varName is null or undefined
    if (varName === null || varName === undefined) {
      console.error('[DEBUG] Variable expression with null/undefined name:', JSON.stringify(expr));
      throw new Error(`Variable expression has null/undefined name. Full expression: ${JSON.stringify(expr)}`);
    }

    // Check if it's the signal parameter (direct reference to payload pointer)
    if (varName === this.currentParamName && this.currentFrequency) {
      // Return the signal payload pointer itself (r13)
      lines.push(`    mov rax, r13          # Load signal parameter pointer`);
    }
    // Check if it's a local variable
    else if (this.tempVars.has(varName)) {
      const offset = this.tempVars.get(varName) + this.stackFrameOffset;
      lines.push(`    mov rax, [rbp - ${offset}]`);
    } else {
      const err = new Error(`Unknown variable: ${varName}`);
      console.error('[DEBUG] Stack trace for unknown variable error:');
      console.error(err.stack);
      throw err;
    }

    return lines;
  }

  /**
   * Compile field access (state.field or msg.field)
   */
  compileFieldAccess(expr) {
    const lines = [];

    if (expr.type === 'state-access') {
      // State field access: state.fieldName
      const fieldName = expr.field;
      const fieldOffset = this.symbolTable.getStateFieldOffset(this.agentId, fieldName);

      if (fieldOffset === null) {
        throw new Error(`Unknown state field: ${fieldName}`);
      }

      // r12 holds the agent state base pointer
      lines.push(`    mov rax, [r12 + ${fieldOffset}]`);

    } else if (expr.type === 'field-access') {
      // Check if object is a variable or nested field access
      if (expr.object.type === 'variable') {
        const objName = expr.object.name;

        if (objName === 'state') {
          // state.field
          const fieldOffset = this.symbolTable.getStateFieldOffset(this.agentId, expr.field);
          if (fieldOffset === null) {
            console.error(`[DEBUG] Failed state field access: state.${expr.field} in agent ${this.agentId}`);
            console.error('[DEBUG] Available state fields:', Array.from(this.symbolTable.agents.get(this.agentId)?.state?.keys() || []));
            console.error('[DEBUG] Full expression:', JSON.stringify(expr));
            throw new Error(`Unknown state field: ${expr.field}`);
          }
          const fieldType = this.symbolTable.getStateFieldType(this.agentId, expr.field);

          // Use appropriate load instruction based on field type
          if (fieldType === 'u32' || fieldType === 'i32') {
            lines.push(`    mov eax, [r12 + ${fieldOffset}]  # Load 32-bit state field`);
          } else if (fieldType === 'u64' || fieldType === 'i64') {
            lines.push(`    mov rax, [r12 + ${fieldOffset}]  # Load 64-bit state field`);
          } else if (fieldType === 'u16' || fieldType === 'i16') {
            lines.push(`    movzx eax, word ptr [r12 + ${fieldOffset}]  # Load 16-bit state field`);
          } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool') {
            lines.push(`    movzx eax, byte ptr [r12 + ${fieldOffset}]  # Load 8-bit state field`);
          } else {
            // Default to 64-bit for pointers and other types
            lines.push(`    mov rax, [r12 + ${fieldOffset}]  # Load state field (pointer/64-bit)`);
          }

        } else if (objName === this.currentParamName && this.currentFrequency) {
          // Signal parameter field access (d.id, d.payload, etc.)
          // r13 holds the payload pointer
          const fieldOffset = this.symbolTable.getFrequencyFieldOffset(this.currentFrequency, expr.field);
          if (fieldOffset === null) {
            throw new Error(`Unknown field ${expr.field} in frequency ${this.currentFrequency}`);
          }
          const fieldType = this.symbolTable.getFrequencyFieldType(this.currentFrequency, expr.field);
          lines.push(`    # Access ${objName}.${expr.field} from ${this.currentFrequency} payload`);

          // Use appropriate load instruction based on field type
          if (fieldType === 'u32' || fieldType === 'i32') {
            lines.push(`    mov eax, [r13 + ${fieldOffset}]  # Load 32-bit value`);
          } else if (fieldType === 'u64' || fieldType === 'i64') {
            lines.push(`    mov rax, [r13 + ${fieldOffset}]  # Load 64-bit value`);
          } else if (fieldType === 'u16' || fieldType === 'i16') {
            lines.push(`    movzx eax, word ptr [r13 + ${fieldOffset}]  # Load 16-bit value`);
          } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool') {
            lines.push(`    movzx eax, byte ptr [r13 + ${fieldOffset}]  # Load 8-bit value`);
          } else {
            // Default to 64-bit for pointers and other types
            lines.push(`    mov rax, [r13 + ${fieldOffset}]  # Load pointer/64-bit value`);
          }
        } else if (this.tempVars.has(objName)) {
          // Local struct variable field access
          const varType = this.tempVarTypes.get(objName);
          if (!varType) {
            console.error(`[DEBUG] Failed field access: ${objName}.${expr.field}`);
            console.error(`[DEBUG] Available tempVars:`, Array.from(this.tempVars.keys()));
            console.error(`[DEBUG] Available tempVarTypes:`, Array.from(this.tempVarTypes.entries()));
            throw new Error(`Cannot access field of untyped variable: ${objName}`);
          }

          // Get struct type info
          const structInfo = this.symbolTable.types.get(varType);
          if (!structInfo) {
            throw new Error(`Unknown struct type: ${varType} for variable ${objName}`);
          }

          if (structInfo.kind !== 'struct') {
            throw new Error(`Cannot access field of non-struct type: ${varType}`);
          }

          // Find field in struct
          const field = structInfo.fields.find(f => f.name === expr.field);
          if (!field) {
            throw new Error(`Unknown field ${expr.field} in struct ${varType}`);
          }

          lines.push(`    # Access ${objName}.${expr.field} (local struct variable)`);

          // Load struct pointer from stack
          const varOffset = this.tempVars.get(objName) + this.stackFrameOffset;
          lines.push(`    mov rax, [rbp - ${varOffset}]  # Load struct pointer`);

          // Load field from struct
          const fieldOffset = field.offset;
          const fieldType = field.type;

          if (fieldType === 'u32' || fieldType === 'i32') {
            lines.push(`    mov eax, [rax + ${fieldOffset}]  # Load 32-bit field`);
          } else if (fieldType === 'u16' || fieldType === 'i16') {
            lines.push(`    movzx eax, word ptr [rax + ${fieldOffset}]  # Load 16-bit field`);
          } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool') {
            lines.push(`    movzx eax, byte ptr [rax + ${fieldOffset}]  # Load 8-bit field`);
          } else {
            // Default to 64-bit for pointers and i64/u64
            lines.push(`    mov rax, [rax + ${fieldOffset}]  # Load 64-bit field`);
          }
        } else {
          // Unknown variable field access
          console.error(`[DEBUG] Unknown variable ${objName} in field access`);
          console.error(`[DEBUG] tempVars.has('${objName}'):`, this.tempVars.has(objName));
          console.error(`[DEBUG] tempVars keys:`, Array.from(this.tempVars.keys()));
          console.error(`[DEBUG] currentParamName:`, this.currentParamName);
          console.error(`[DEBUG] currentFrequency:`, this.currentFrequency);
          throw new Error(`Unknown variable ${objName} in field access`);
        }
      } else {
        // Nested field access - compile object first, then access field
        // e.g., tokens[i].field or getToken().field
        lines.push(`    # Nested field access`);

        // Compile the object expression (returns struct pointer in rax)
        lines.push(...this.compile(expr.object));

        // Now we need to know the type of the result to access the field
        // For now, we'll try to infer the type from the object expression
        let structType = null;

        if (expr.object.type === 'array-access') {
          // Array access: try to infer element type from the array variable
          if (expr.object.object.type === 'field-access' &&
              expr.object.object.object.type === 'variable' &&
              expr.object.object.object.name === 'state') {
            // state.fieldname[index] - the field is a vector of structs
            const stateFieldName = expr.object.object.field;
            const stateFieldType = this.symbolTable.getStateFieldType(this.agentId, stateFieldName);

            // Extract element type from vec<Type> notation
            if (stateFieldType && stateFieldType.startsWith('vec<') && stateFieldType.endsWith('>')) {
              structType = stateFieldType.slice(4, -1);
            }
          } else if (expr.object.object.type === 'variable') {
            // local_var[index] - check if it's a typed local variable
            const varName = expr.object.object.name;
            const varType = this.tempVarTypes.get(varName);
            if (varType && varType.startsWith('vec<') && varType.endsWith('>')) {
              structType = varType.slice(4, -1);
            }
          }
        } else if (expr.object.type === 'function-call') {
          // Function call: check if it's a rule with a known return type
          const ruleName = expr.object.name;
          if (this.symbolTable.isRule(this.agentId, ruleName)) {
            const rule = this.symbolTable.getRule(this.agentId, ruleName);
            if (rule && rule.returnType) {
              structType = rule.returnType;
            }
          }
        } else if (expr.object.type === 'field-access' &&
                   expr.object.object.type === 'variable' &&
                   expr.object.object.name === 'state') {
          // state.field.subfield - look up state field type
          const stateFieldName = expr.object.field;
          structType = this.symbolTable.getStateFieldType(this.agentId, stateFieldName);
        } else if (expr.object.type === 'variable') {
          // Simple variable - check if it's a typed local variable
          const varName = expr.object.name;
          structType = this.tempVarTypes.get(varName);
        }

        if (!structType) {
          throw new Error(`Cannot infer type for nested field access: ${JSON.stringify(expr.object)}`);
        }

        // Now we have the struct type, look up the field
        const structInfo = this.symbolTable.types.get(structType);
        if (!structInfo) {
          throw new Error(`Unknown struct type: ${structType}`);
        }

        if (structInfo.kind !== 'struct') {
          throw new Error(`Type ${structType} is not a struct`);
        }

        const field = structInfo.fields.find(f => f.name === expr.field);
        if (!field) {
          throw new Error(`Unknown field ${expr.field} in struct ${structType}`);
        }

        // rax now contains the struct pointer, load the field
        const fieldOffset = field.offset;
        const fieldType = field.type;

        if (fieldType === 'u32' || fieldType === 'i32') {
          lines.push(`    mov eax, [rax + ${fieldOffset}]  # Load 32-bit field`);
        } else if (fieldType === 'u16' || fieldType === 'i16') {
          lines.push(`    movzx eax, word ptr [rax + ${fieldOffset}]  # Load 16-bit field`);
        } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool') {
          lines.push(`    movzx eax, byte ptr [rax + ${fieldOffset}]  # Load 8-bit field`);
        } else {
          // Default to 64-bit for pointers and i64/u64
          lines.push(`    mov rax, [rax + ${fieldOffset}]  # Load 64-bit field`);
        }
      }
    }

    return lines;
  }

  /**
   * Compile binary operation
   */
  compileBinary(expr) {
    const lines = [];
    const op = expr.op;

    // Debug: Check for null variables in binary expression
    function hasNullVar(e) {
      if (!e) return false;
      if (e.type === 'variable' && (e.name === null || e.name === undefined)) return true;
      if (e.left && hasNullVar(e.left)) return true;
      if (e.right && hasNullVar(e.right)) return true;
      return false;
    }

    if (hasNullVar(expr)) {
      console.error('[DEBUG] Binary expression contains null variable:');
      console.error('[DEBUG] Full expression:', JSON.stringify(expr, null, 2));
    }

    // Arithmetic and bitwise operations: +, -, *, /, %, &, |, ^, <<, >>
    if (['+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>'].includes(op)) {
      lines.push(`    # Binary operation: ${op}`);

      // Compile left side, result in rax
      lines.push(...this.compile(expr.left));
      lines.push(`    push rax  # Save left side`);

      // Compile right side, result in rax
      lines.push(...this.compile(expr.right));
      lines.push(`    mov rbx, rax  # Right side to rbx`);
      lines.push(`    pop rax  # Restore left side`);

      // Perform operation
      switch (op) {
        case '+':
          lines.push(`    add rax, rbx`);
          break;
        case '-':
          lines.push(`    sub rax, rbx`);
          break;
        case '*':
          lines.push(`    imul rax, rbx`);
          break;
        case '/':
          lines.push(`    xor rdx, rdx  # Clear rdx for division`);
          lines.push(`    idiv rbx`);
          break;
        case '%':
          lines.push(`    xor rdx, rdx  # Clear rdx for division`);
          lines.push(`    idiv rbx`);
          lines.push(`    mov rax, rdx  # Remainder is in rdx`);
          break;
        case '&':
          lines.push(`    and rax, rbx  # Bitwise AND`);
          break;
        case '|':
          lines.push(`    or rax, rbx   # Bitwise OR`);
          break;
        case '^':
          lines.push(`    xor rax, rbx  # Bitwise XOR`);
          break;
        case '<<':
          lines.push(`    mov rcx, rbx  # Shift count to rcx`);
          lines.push(`    shl rax, cl   # Shift left`);
          break;
        case '>>':
          lines.push(`    mov rcx, rbx  # Shift count to rcx`);
          lines.push(`    sar rax, cl   # Arithmetic shift right`);
          break;
      }
    }
    // Comparison operations: ==, !=, <, >, <=, >=
    else if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
      lines.push(`    # Comparison: ${op}`);

      // Compile left side
      lines.push(...this.compile(expr.left));
      lines.push(`    push rax`);

      // Compile right side
      // Debug: Check if right side is a variable with null name
      if (expr.right.type === 'variable' && (expr.right.name === null || expr.right.name === undefined)) {
        console.error('[DEBUG] Binary expression with null variable on right side:');
        console.error('[DEBUG] Full binary expression:', JSON.stringify(expr));
        console.error('[DEBUG] Operator:', op);
        console.error('[DEBUG] Left:', JSON.stringify(expr.left));
        console.error('[DEBUG] Right:', JSON.stringify(expr.right));
      }
      lines.push(...this.compile(expr.right));
      lines.push(`    mov rbx, rax`);
      lines.push(`    pop rax`);

      // Compare and set result
      lines.push(`    cmp rax, rbx`);

      const trueLabel = this.genLabel('cmp_true');
      const endLabel = this.genLabel('cmp_end');

      switch (op) {
        case '==':
          lines.push(`    je ${trueLabel}`);
          break;
        case '!=':
          lines.push(`    jne ${trueLabel}`);
          break;
        case '<':
          lines.push(`    jl ${trueLabel}`);
          break;
        case '>':
          lines.push(`    jg ${trueLabel}`);
          break;
        case '<=':
          lines.push(`    jle ${trueLabel}`);
          break;
        case '>=':
          lines.push(`    jge ${trueLabel}`);
          break;
      }

      lines.push(`    mov rax, 0  # False`);
      lines.push(`    jmp ${endLabel}`);
      lines.push(`${trueLabel}:`);
      lines.push(`    mov rax, 1  # True`);
      lines.push(`${endLabel}:`);
    }
    // Logical operations: &&, ||
    else if (['&&', '||'].includes(op)) {
      lines.push(`    # Logical operation: ${op}`);

      if (op === '&&') {
        // Short-circuit AND
        const falseLabel = this.genLabel('and_false');
        const endLabel = this.genLabel('and_end');

        lines.push(...this.compile(expr.left));
        lines.push(`    test rax, rax`);
        lines.push(`    jz ${falseLabel}  # Left is false, skip right`);

        lines.push(...this.compile(expr.right));
        lines.push(`    test rax, rax`);
        lines.push(`    jz ${falseLabel}`);

        lines.push(`    mov rax, 1  # Both true`);
        lines.push(`    jmp ${endLabel}`);
        lines.push(`${falseLabel}:`);
        lines.push(`    mov rax, 0  # At least one false`);
        lines.push(`${endLabel}:`);

      } else { // ||
        // Short-circuit OR
        const trueLabel = this.genLabel('or_true');
        const checkRightLabel = this.genLabel('or_check_right');
        const endLabel = this.genLabel('or_end');

        lines.push(...this.compile(expr.left));
        lines.push(`    test rax, rax`);
        lines.push(`    jz ${checkRightLabel}  # Left is false, check right`);
        lines.push(`    jmp ${trueLabel}  # Left is true, done`);

        lines.push(`${checkRightLabel}:`);
        lines.push(...this.compile(expr.right));
        lines.push(`    test rax, rax`);
        lines.push(`    jnz ${trueLabel}`);

        lines.push(`    mov rax, 0  # Both false`);
        lines.push(`    jmp ${endLabel}`);
        lines.push(`${trueLabel}:`);
        lines.push(`    mov rax, 1  # At least one true`);
        lines.push(`${endLabel}:`);
      }
    } else {
      throw new Error(`Unsupported binary operator: ${op}`);
    }

    return lines;
  }

  /**
   * Compile unary operation
   */
  compileUnary(expr) {
    const lines = [];
    const op = expr.op;

    lines.push(`    # Unary operation: ${op}`);
    lines.push(...this.compile(expr.operand));

    switch (op) {
      case '-':
        lines.push(`    neg rax`);
        break;
      case '!':
        lines.push(`    test rax, rax`);
        lines.push(`    setz al  # Set al to 1 if rax was 0`);
        lines.push(`    movzx rax, al  # Zero-extend to 64 bits`);
        break;
      case '+':
        // Unary plus is a no-op
        break;
      default:
        throw new Error(`Unsupported unary operator: ${op}`);
    }

    return lines;
  }

  /**
   * Compile function call
   */
  compileFunctionCall(expr) {
    const lines = [];
    const funcName = expr.name;

    lines.push(`    # Function call: ${funcName}`);

    // Compile arguments and push to stack (in reverse order for cdecl)
    // System V AMD64 calling convention: rdi, rsi, rdx, rcx, r8, r9
    // Arguments 7+ go on the stack in reverse order
    const args = expr.args || [];
    const argRegs = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
    const numRegArgs = Math.min(args.length, 6);
    const numStackArgs = Math.max(0, args.length - 6);

    // First, compile and push stack arguments (args 7+) in reverse order
    if (numStackArgs > 0) {
      for (let i = args.length - 1; i >= 6; i--) {
        lines.push(`    # Stack argument ${i}`);
        lines.push(...this.compile(args[i]));
        lines.push(`    push rax`);
      }
    }

    // Save any registers we'll use for register arguments
    if (numRegArgs > 0) {
      lines.push(`    push rdi`);
      lines.push(`    push rsi`);
      if (numRegArgs > 2) {
        lines.push(`    push rdx`);
      }
    }

    // Compile each register argument and move to appropriate register
    for (let i = 0; i < numRegArgs; i++) {
      lines.push(`    # Argument ${i}`);
      lines.push(...this.compile(args[i]));
      lines.push(`    mov ${argRegs[i]}, rax`);

      // If not the last arg, save it
      if (i < numRegArgs - 1) {
        lines.push(`    push ${argRegs[i]}`);
      }
    }

    // Restore arguments in correct registers (in reverse order)
    for (let i = numRegArgs - 2; i >= 0; i--) {
      lines.push(`    pop ${argRegs[i]}`);
    }

    // Call the function (check if it's a rule or builtin)
    if (this.symbolTable.isRule(this.agentId, funcName)) {
      lines.push(`    call rule_${this.agentId}_${funcName}`);
    } else {
      lines.push(`    call builtin_${funcName}`);
    }

    // Clean up stack arguments if any
    if (numStackArgs > 0) {
      lines.push(`    add rsp, ${numStackArgs * 8}  # Clean up ${numStackArgs} stack arguments`);
    }

    // Restore saved registers
    if (numRegArgs > 2) {
      lines.push(`    pop rdx`);
    }
    if (numRegArgs > 0) {
      lines.push(`    pop rsi`);
      lines.push(`    pop rdi`);
    }

    // Result is in rax

    return lines;
  }

  /**
   * Compile struct literal
   * Allocates struct on heap and initializes fields
   */
  compileStructLiteral(expr) {
    const lines = [];
    const structName = expr.structName;

    lines.push(`    # Struct literal: ${structName}`);

    // Get struct type info from symbol table
    const structInfo = this.symbolTable.types.get(structName);
    if (!structInfo) {
      throw new Error(`Unknown struct type: ${structName}`);
    }

    if (structInfo.kind !== 'struct') {
      throw new Error(`Type ${structName} is not a struct`);
    }

    const structSize = structInfo.size;

    // Allocate memory for the struct
    lines.push(`    # Allocate ${structSize} bytes for ${structName}`);
    lines.push(`    push rdi`);
    lines.push(`    mov rdi, ${structSize}`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    pop rdi`);
    lines.push(`    push rax              # Save struct pointer`);

    // Initialize each field
    for (const field of structInfo.fields) {
      const fieldName = field.name;
      const fieldOffset = field.offset;
      const fieldExpr = expr.fields[fieldName];

      if (fieldExpr) {
        lines.push(`    # Field ${fieldName} at offset ${fieldOffset}`);

        // Compile field value expression
        lines.push(...this.compile(fieldExpr));

        // Store value into struct
        // Struct pointer is on stack
        lines.push(`    mov rbx, [rsp]        # Load struct pointer`);

        // Use appropriate store instruction based on field type
        const fieldType = field.type;
        if (fieldType === 'u32' || fieldType === 'i32') {
          lines.push(`    mov [rbx + ${fieldOffset}], eax  # Store 32-bit field`);
        } else if (fieldType === 'u16' || fieldType === 'i16') {
          lines.push(`    mov [rbx + ${fieldOffset}], ax   # Store 16-bit field`);
        } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool') {
          lines.push(`    mov [rbx + ${fieldOffset}], al   # Store 8-bit field`);
        } else {
          // Default to 64-bit for pointers and i64/u64
          lines.push(`    mov [rbx + ${fieldOffset}], rax  # Store 64-bit field`);
        }
      }
    }

    // Return pointer to struct in rax
    lines.push(`    pop rax               # Return struct pointer`);

    return lines;
  }

  /**
   * Compile enum variant reference (EnumType::Variant)
   * Enum variants are represented as integer ordinals
   */
  compileEnumVariant(expr) {
    const lines = [];
    const enumType = expr.enumType;
    const variantName = expr.variant;

    lines.push(`    # Enum variant: ${enumType}::${variantName}`);

    // Look up enum type in symbol table
    const enumInfo = this.symbolTable.types.get(enumType);
    if (!enumInfo) {
      throw new Error(`Unknown enum type: ${enumType}`);
    }

    if (enumInfo.kind !== 'enum') {
      throw new Error(`Type ${enumType} is not an enum`);
    }

    // Look up variant info
    const variantInfo = enumInfo.variants.get(variantName);
    if (!variantInfo) {
      throw new Error(`Unknown variant ${variantName} in enum ${enumType}`);
    }

    // Load the ordinal value into rax
    lines.push(`    mov rax, ${variantInfo.ordinal}`);

    return lines;
  }

  /**
   * Compile array/vector access: array[index]
   * Uses vec_get(vector, index) builtin
   */
  compileArrayAccess(expr) {
    const lines = [];

    lines.push(`    # Array access: array[index]`);

    // Compile the array/vector expression
    lines.push(...this.compile(expr.object));
    lines.push(`    push rax              # Save array pointer`);

    // Compile the index expression
    lines.push(...this.compile(expr.index));

    // Set up arguments for vec_get(vector, index)
    lines.push(`    mov rsi, rax          # index in rsi`);
    lines.push(`    pop rdi               # vector in rdi`);

    // Call vec_get builtin
    lines.push(`    call builtin_vec_get`);

    // Result is in rax

    return lines;
  }

  /**
   * Compile enum variant constructor: EnumType::Variant(args)
   * For simple enums (no associated data), this just returns the ordinal.
   * For enums with associated data, this allocates a tagged union.
   */
  compileEnumVariantConstructor(expr) {
    const lines = [];
    const enumType = expr.enumType;
    const variantName = expr.variant;

    lines.push(`    # Enum variant constructor: ${enumType}::${variantName}(...)`);

    // Look up enum type in symbol table
    const enumInfo = this.symbolTable.types.get(enumType);
    if (!enumInfo) {
      throw new Error(`Unknown enum type: ${enumType}`);
    }

    if (enumInfo.kind !== 'enum') {
      throw new Error(`Type ${enumType} is not an enum`);
    }

    // Look up variant info
    const variantInfo = enumInfo.variants.get(variantName);
    if (!variantInfo) {
      throw new Error(`Unknown variant ${variantName} in enum ${enumType}`);
    }

    const ordinal = variantInfo.ordinal;
    const dataType = variantInfo.dataType;

    // If no data type, just return the ordinal (simple enum)
    if (!dataType) {
      lines.push(`    mov rax, ${ordinal}   # Return variant ordinal (no data)`);
      return lines;
    }

    // Enum with data - allocate tagged union
    const unionSize = enumInfo.size;

    lines.push(`    # Allocate tagged union: ${unionSize} bytes`);
    lines.push(`    push rdi`);
    lines.push(`    mov rdi, ${unionSize}`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    pop rdi`);
    lines.push(`    push rax              # Save union pointer`);
    lines.push(``);

    // Store the tag (ordinal)
    lines.push(`    # Store variant tag`);
    lines.push(`    mov rbx, [rsp]        # Get union pointer`);
    lines.push(`    mov qword ptr [rbx], ${ordinal}  # Store tag at offset 0`);
    lines.push(``);

    // Store the data (if argument provided)
    if (expr.args && expr.args.length > 0) {
      lines.push(`    # Store variant data`);

      // Compile the data argument
      lines.push(...this.compile(expr.args[0]));

      // Store data after tag (at offset 8)
      lines.push(`    mov rbx, [rsp]        # Get union pointer`);

      // Check data size to use appropriate store instruction
      const dataSize = variantInfo.dataSize;
      if (dataSize <= 8) {
        lines.push(`    mov qword ptr [rbx + 8], rax  # Store data at offset 8`);
      } else {
        // For larger data (structs), rax should be a pointer
        lines.push(`    mov qword ptr [rbx + 8], rax  # Store data pointer at offset 8`);
      }
    }

    // Return pointer to tagged union
    lines.push(`    pop rax               # Return union pointer`);

    return lines;
  }

  /**
   * Compile if-expression: if condition { thenValue } else { elseValue }
   * Similar to ternary operator in C: condition ? thenValue : elseValue
   */
  compileIfExpression(expr) {
    const lines = [];

    const elseLabel = this.genLabel('if_expr_else');
    const endLabel = this.genLabel('if_expr_end');

    lines.push(`    # if-expression`);

    // Evaluate condition
    lines.push(...this.compile(expr.condition));

    // Test and jump
    lines.push(`    test rax, rax`);
    lines.push(`    jz ${elseLabel}`);

    // Then value
    lines.push(`    # then value`);
    lines.push(...this.compile(expr.thenValue));
    lines.push(`    jmp ${endLabel}`);

    // Else value
    lines.push(`${elseLabel}:`);
    lines.push(`    # else value`);
    lines.push(...this.compile(expr.elseValue));

    lines.push(`${endLabel}:`);

    return lines;
  }

  /**
   * Compile type cast
   */
  compileCast(expr) {
    const lines = [];

    // Compile the expression being cast
    lines.push(...this.compile(expr.expression));

    // For now, most casts are no-ops in assembly
    // We might need to handle sign extension for certain cases
    lines.push(`    # Cast to ${expr.targetType}`);

    const sourceType = this.inferType(expr.expression);
    const targetType = expr.targetType;

    // Handle specific conversions
    if (sourceType === 'i32' && targetType === 'i64') {
      lines.push(`    movsxd rax, eax  # Sign-extend 32-bit to 64-bit`);
    } else if (sourceType === 'u32' && targetType === 'u64') {
      lines.push(`    mov eax, eax  # Zero-extend 32-bit to 64-bit`);
    }
    // Most other casts are no-ops or truncations

    return lines;
  }

  /**
   * Compile array literal expression
   * Creates a new vector and pushes all elements
   */
  compileArrayLiteral(expr) {
    const lines = [];

    // Call builtin_vec_new to create empty vector
    lines.push(`    # Array literal: [...]`);
    lines.push(`    call builtin_vec_new`);
    lines.push(`    # rax now contains empty vector pointer`);

    // If there are elements, push each one
    if (expr.elements && expr.elements.length > 0) {
      // Save vector pointer in r14 (callee-saved register)
      lines.push(`    mov r14, rax          # Save vector pointer in r14`);

      for (let i = 0; i < expr.elements.length; i++) {
        const element = expr.elements[i];

        lines.push(`    # Element ${i}`);

        // Compile element expression (result in rax)
        lines.push(...this.compile(element));

        // Set up arguments for builtin_vec_push(vec, element)
        lines.push(`    mov rdi, r14          # arg1: vector pointer`);
        lines.push(`    mov rsi, rax          # arg2: element value`);
        lines.push(`    call builtin_vec_push`);
      }

      // Restore vector pointer to rax as final result
      lines.push(`    mov rax, r14          # Return vector pointer`);
    }

    return lines;
  }

  compileTupleExpression(expr) {
    const lines = [];

    // Tuples are compiled as vectors (same as array literals)
    // Call builtin_vec_new to create empty vector
    lines.push(`    # Tuple expression: (...)`);
    lines.push(`    call builtin_vec_new`);
    lines.push(`    # rax now contains empty vector pointer`);

    // If there are elements, push each one
    if (expr.elements && expr.elements.length > 0) {
      // Save vector pointer in r14 (callee-saved register)
      lines.push(`    mov r14, rax          # Save vector pointer in r14`);

      for (let i = 0; i < expr.elements.length; i++) {
        const element = expr.elements[i];

        lines.push(`    # Tuple element ${i}`);

        // Compile element expression (result in rax)
        lines.push(...this.compile(element));

        // Set up arguments for builtin_vec_push(vec, element)
        lines.push(`    mov rdi, r14          # arg1: vector pointer`);
        lines.push(`    mov rsi, rax          # arg2: element value`);
        lines.push(`    call builtin_vec_push`);
      }

      // Restore vector pointer to rax as final result
      lines.push(`    mov rax, r14          # Return vector pointer`);
    }

    return lines;
  }

  /**
   * Infer the type of an expression (simplified)
   */
  inferType(expr) {
    if (expr.type === 'literal') {
      if (typeof expr.value === 'number') {
        return expr.value >= 0 ? 'i64' : 'i64';
      }
      return 'unknown';
    }
    // For now, default to i64
    return 'i64';
  }

  /**
   * Add a local variable to the scope
   */
  addLocalVar(name, size = 8, typeName = null) {
    this.stackOffset += size;
    this.tempVars.set(name, this.stackOffset);
    if (typeName) {
      this.tempVarTypes.set(name, typeName);
    }
    return this.stackOffset;
  }

  /**
   * Get stack offset for local variable
   */
  getLocalVarOffset(name) {
    return this.tempVars.get(name);
  }

  /**
   * Get type of local variable
   */
  getLocalVarType(name) {
    return this.tempVarTypes.get(name);
  }
}

module.exports = { ExpressionCompiler };

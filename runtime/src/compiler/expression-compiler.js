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

// Set to true to enable debug output
const DEBUG_EXPR = process.env.MYCELIAL_DEBUG === '1';

class ExpressionCompiler {
  constructor(symbolTable, agentId, sharedLabelCounter = null) {
    this.symbolTable = symbolTable;
    this.agentId = agentId;
    // Use shared label counter if provided, otherwise create local one
    this.labelCounter = sharedLabelCounter || { count: 0 };
    this.tempVars = new Map(); // local variable name -> stack offset
    this.tempVarTypes = new Map(); // local variable name -> type name
    this.stackOffset = 0; // Current stack offset for locals
    this.maxStackOffset = 0; // Maximum stack offset reached (for allocation)
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
    this.maxStackOffset = 0;
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
      DEBUG_EXPR && console.error('[DEBUG] Variable expression with null/undefined name:', JSON.stringify(expr));
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
      DEBUG_EXPR && console.error('[DEBUG] Stack trace for unknown variable error:');
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
            DEBUG_EXPR && console.error('[DEBUG] Available state fields:', Array.from(this.symbolTable.agents.get(this.agentId)?.state?.keys() || []));
            DEBUG_EXPR && console.error('[DEBUG] Full expression:', JSON.stringify(expr));
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
          } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool' || fieldType === 'boolean') {
            lines.push(`    movzx eax, byte ptr [r12 + ${fieldOffset}]  # Load 8-bit state field`);
          } else {
            // Check if this is an inline struct type (not a pointer type)
            const typeInfo = this.symbolTable.types.get(fieldType);
            if (typeInfo && typeInfo.kind === 'struct') {
              // Struct field - load the pointer (Gen0 stores all structs as pointers at runtime)
              lines.push(`    mov rax, [r12 + ${fieldOffset}]  # Load struct pointer state.${expr.field}`);
            } else {
              // Pointer type (string, vec, map, etc.) - load the pointer value
              lines.push(`    mov rax, [r12 + ${fieldOffset}]  # Load state field (pointer/64-bit)`);
            }
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
          } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool' || fieldType === 'boolean') {
            lines.push(`    movzx eax, byte ptr [r13 + ${fieldOffset}]  # Load 8-bit value`);
          } else {
            // Check if this is an inline struct type (not a pointer type)
            const typeInfo = this.symbolTable.types.get(fieldType);
            if (typeInfo && typeInfo.kind === 'struct') {
              // Struct field - load the pointer (Gen0 stores all structs as pointers at runtime)
              lines.push(`    mov rax, [r13 + ${fieldOffset}]  # Load struct pointer ${objName}.${expr.field}`);
            } else {
              // Pointer type - load the pointer value
              lines.push(`    mov rax, [r13 + ${fieldOffset}]  # Load pointer/64-bit value`);
            }
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
          } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool' || fieldType === 'boolean') {
            lines.push(`    movzx eax, byte ptr [rax + ${fieldOffset}]  # Load 8-bit field`);
          } else {
            // Check if this is an inline struct type (not a pointer type)
            const typeInfo = this.symbolTable.types.get(fieldType);
            if (typeInfo && typeInfo.kind === 'struct') {
              // Struct field - load the pointer (Gen0 stores all structs as pointers at runtime)
              lines.push(`    mov rax, [rax + ${fieldOffset}]  # Load struct pointer ${objName}.${expr.field}`);
            } else {
              // Pointer type - load the pointer value
              lines.push(`    mov rax, [rax + ${fieldOffset}]  # Load 64-bit field`);
            }
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
        } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool' || fieldType === 'boolean') {
          lines.push(`    movzx eax, byte ptr [rax + ${fieldOffset}]  # Load 8-bit field`);
        } else {
          // Check if this is an inline struct type (not a pointer type)
          const typeInfo = this.symbolTable.types.get(fieldType);
          if (typeInfo && typeInfo.kind === 'struct') {
            // Struct field - load the pointer (Gen0 stores all structs as pointers at runtime)
            lines.push(`    mov rax, [rax + ${fieldOffset}]  # Load struct pointer .${expr.field}`);
          } else {
            // Pointer type - load the pointer value
            lines.push(`    mov rax, [rax + ${fieldOffset}]  # Load 64-bit field`);
          }
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
      DEBUG_EXPR && console.error('[DEBUG] Binary expression contains null variable:');
      DEBUG_EXPR && console.error('[DEBUG] Full expression:', JSON.stringify(expr, null, 2));
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
      // Check if this is a string comparison (either operand is a string type)
      const leftIsString = this.isStringExpression(expr.left);
      const rightIsString = this.isStringExpression(expr.right);
      // Use string comparison for all comparison ops when either operand is a string
      const useStringCompare = (leftIsString || rightIsString);

      // Check if this is an enum comparison (either operand is an enum type)
      const leftIsEnum = this.isEnumExpression(expr.left);
      const rightIsEnum = this.isEnumExpression(expr.right);
      const useEnumCompare = (leftIsEnum || rightIsEnum) && !useStringCompare;

      // Debug: Log string comparison detection for variables
      if (expr.left.type === 'variable' || expr.right.type === 'variable') {
        console.error(`[DEBUG-CMP] Comparing: ${JSON.stringify(expr.left)} ${op} ${JSON.stringify(expr.right)}`);
        console.error(`[DEBUG-CMP] leftIsString=${leftIsString}, rightIsString=${rightIsString}, useStringCompare=${useStringCompare}`);
        console.error(`[DEBUG-CMP] leftIsEnum=${leftIsEnum}, rightIsEnum=${rightIsEnum}, useEnumCompare=${useEnumCompare}`);
        console.error(`[DEBUG-CMP] tempVarTypes:`, Array.from(this.tempVarTypes.entries()));
      }

      if (useStringCompare) {
        lines.push(`    # String comparison: ${op}`);
      } else if (useEnumCompare) {
        lines.push(`    # Enum comparison: ${op}`);
      } else {
        lines.push(`    # Comparison: ${op}`);
      }

      // Compile left side
      lines.push(...this.compile(expr.left));
      lines.push(`    push rax`);

      // Compile right side
      // Debug: Check if right side is a variable with null name
      if (expr.right.type === 'variable' && (expr.right.name === null || expr.right.name === undefined)) {
        DEBUG_EXPR && console.error('[DEBUG] Binary expression with null variable on right side:');
        DEBUG_EXPR && console.error('[DEBUG] Full binary expression:', JSON.stringify(expr));
        DEBUG_EXPR && console.error('[DEBUG] Operator:', op);
        DEBUG_EXPR && console.error('[DEBUG] Left:', JSON.stringify(expr.left));
        DEBUG_EXPR && console.error('[DEBUG] Right:', JSON.stringify(expr.right));
      }
      lines.push(...this.compile(expr.right));
      lines.push(`    mov rbx, rax`);
      lines.push(`    pop rax`);

      const trueLabel = this.genLabel('cmp_true');
      const endLabel = this.genLabel('cmp_end');

      if (useStringCompare) {
        // Use string comparison builtins
        // Need to ensure stack alignment before call
        lines.push(`    push r15              # Save r15`);
        lines.push(`    mov r15, rsp          # Save rsp`);
        lines.push(`    mov rdi, rax          # First string`);
        lines.push(`    mov rsi, rbx          # Second string`);
        lines.push(`    and rsp, -16          # Align stack`);
        lines.push(`    xor eax, eax          # No XMM args`);

        if (op === '==' || op === '!=') {
          // Use string_eq for equality comparisons
          lines.push(`    call builtin_string_eq`);
          lines.push(`    mov rsp, r15          # Restore rsp`);
          lines.push(`    pop r15               # Restore r15`);

          // builtin_string_eq returns 1 if equal, 0 if not equal
          if (op === '==') {
            lines.push(`    test rax, rax`);
            lines.push(`    jnz ${trueLabel}`);
          } else { // op === '!='
            lines.push(`    test rax, rax`);
            lines.push(`    jz ${trueLabel}`);
          }
        } else {
          // Use string_cmp for ordering comparisons (<, >, <=, >=)
          lines.push(`    call builtin_string_cmp`);
          lines.push(`    mov rsp, r15          # Restore rsp`);
          lines.push(`    pop r15               # Restore r15`);

          // builtin_string_cmp returns <0, 0, or >0 like strcmp
          // Compare result with 0 to determine true/false
          lines.push(`    cmp rax, 0`);
          switch (op) {
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
        }
      } else if (useEnumCompare) {
        // Enum comparison - compare tags (ordinals) at offset 0, not pointers
        // rax and rbx are pointers to tagged unions, dereference to get tags
        lines.push(`    mov rax, [rax]         # Load left enum tag`);
        lines.push(`    mov rbx, [rbx]         # Load right enum tag`);
        lines.push(`    cmp rax, rbx`);

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
      } else {
        // Integer/pointer comparison
        lines.push(`    cmp rax, rbx`);

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

    // System V AMD64 calling convention: rdi, rsi, rdx, rcx, r8, r9
    // Arguments 7+ go on the stack in reverse order (arg[N-1] pushed first)
    let args = expr.args || [];

    // vec_from uses NULL as a sentinel - add it as the last argument
    if (funcName === 'vec_from') {
      args = [...args, { type: 'literal', value: null }];
    }

    const argRegs = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
    const numRegArgs = Math.min(args.length, 6);
    const numStackArgs = Math.max(0, args.length - 6);

    // System V AMD64 ABI calling convention:
    // - First 6 args go in rdi, rsi, rdx, rcx, r8, r9
    // - Args 7+ go on stack (pushed in reverse order)
    // - Stack must be 16-byte aligned BEFORE call instruction
    // - Callee expects stack args at [rbp+16], [rbp+24], etc.

    // Step 1: Save r15 and remember current rsp
    lines.push(`    push r15  # Save callee-saved register`);
    lines.push(`    mov r15, rsp  # Remember rsp for restoration`);

    // Step 2: Force 16-byte alignment using and rsp, -16
    // This must happen BEFORE any stack arguments are pushed
    // so that stack args end up at correct offsets for callee
    lines.push(`    and rsp, -16  # Force 16-byte alignment`);

    // Step 3: Calculate total stack space needed and reserve it
    // Stack args need numStackArgs * 8 bytes
    // Also need 8 more bytes if numStackArgs is odd (to maintain 16-byte alignment after pushes)
    if (numStackArgs > 0) {
      const extraPadding = (numStackArgs % 2 === 1) ? 8 : 0;
      if (extraPadding > 0) {
        lines.push(`    sub rsp, 8  # Alignment padding for odd number of stack args`);
      }

      // Step 4: Compile and push stack arguments (args 6+) in reverse order
      for (let i = args.length - 1; i >= 6; i--) {
        lines.push(`    # Stack argument ${i}`);
        lines.push(...this.compile(args[i]));
        lines.push(`    push rax`);
      }
    }

    // Step 5: Compile register arguments (args 0-5)
    // We compile each one and save intermediate results on stack
    for (let i = 0; i < numRegArgs; i++) {
      lines.push(`    # Argument ${i}`);
      lines.push(...this.compile(args[i]));
      lines.push(`    push rax  # Save arg ${i}`);
    }

    // Step 6: Pop register arguments into their target registers (in reverse order)
    for (let i = numRegArgs - 1; i >= 0; i--) {
      lines.push(`    pop ${argRegs[i]}`);
    }

    // Step 7: Call the function
    // For variadic functions, al must contain the number of XMM registers used
    lines.push(`    xor eax, eax  # No XMM args for variadic functions`);
    if (this.symbolTable.isRule(this.agentId, funcName)) {
      lines.push(`    call rule_${this.agentId}_${funcName}`);
    } else {
      lines.push(`    call builtin_${funcName}`);
    }

    // Step 8: Restore rsp from r15 (undoes all pushes and alignment)
    lines.push(`    mov rsp, r15  # Restore rsp`);

    // Step 9: Restore r15
    lines.push(`    pop r15  # Restore callee-saved register`);

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
        } else if (fieldType === 'u8' || fieldType === 'i8' || fieldType === 'bool' || fieldType === 'boolean') {
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
   * All enum variants are represented as pointers to tagged unions
   * for consistent representation (enables match statements to always dereference)
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

    const ordinal = variantInfo.ordinal;

    // ALWAYS allocate a tagged union for consistent representation
    // This ensures match statements can always dereference to get the tag
    const unionSize = 16;  // 8 bytes for tag, 8 bytes for padding

    lines.push(`    # Allocate tagged union for ${enumType}::${variantName}`);
    lines.push(`    push rdi`);
    lines.push(`    mov rdi, ${unionSize}`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    pop rdi`);
    lines.push(`    mov qword ptr [rax], ${ordinal}  # Store tag at offset 0`);

    return lines;
  }

  /**
   * Compile array/vector/map access: array[index] or map[key]
   * Uses vec_get(vector, index) or map_get(map, key) builtin
   */
  compileArrayAccess(expr) {
    const lines = [];

    // Determine if this is a vector or map by checking the object's type
    const objectExpr = expr.object;
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

    lines.push(`    # ${isMap ? 'Map' : 'Array'} access: ${isMap ? 'map' : 'array'}[${isMap ? 'key' : 'index'}]`);

    // Compile the array/vector/map expression
    lines.push(...this.compile(expr.object));
    lines.push(`    push rax              # Save ${isMap ? 'map' : 'array'} pointer`);

    // Compile the index/key expression
    lines.push(...this.compile(expr.index));

    // Set up arguments for vec_get or map_get
    lines.push(`    mov rsi, rax          # ${isMap ? 'key' : 'index'} in rsi`);
    lines.push(`    pop rdi               # ${isMap ? 'map' : 'vector'} in rdi`);

    // Call appropriate builtin
    if (isMap) {
      lines.push(`    call builtin_map_get  # map_get(map, key) -> value`);
    } else {
      lines.push(`    call builtin_vec_get  # vec_get(vec, index) -> value`);
    }

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

    // ALWAYS allocate a tagged union for consistent representation
    // This ensures match statements can always dereference to get the tag
    const unionSize = enumInfo.size || 16;  // Minimum 16 bytes (8 tag + 8 data)

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
   * Check if an expression evaluates to a string type
   */
  isStringExpression(expr) {
    if (!expr) return false;

    // String literal
    if (expr.type === 'literal' && typeof expr.value === 'string') {
      return true;
    }

    // State field access - check if field type is 'string'
    if (expr.type === 'state-access') {
      const fieldType = this.symbolTable.getStateFieldType(this.agentId, expr.field);
      return fieldType === 'string';
    }

    // Field access - could be state.field, signal.field, or variable.field
    if (expr.type === 'field-access') {
      if (expr.object.type === 'variable') {
        const objName = expr.object.name;

        if (objName === 'state') {
          const fieldType = this.symbolTable.getStateFieldType(this.agentId, expr.field);
          return fieldType === 'string';
        }

        if (objName === this.currentParamName && this.currentFrequency) {
          const fieldType = this.symbolTable.getFrequencyFieldType(this.currentFrequency, expr.field);
          return fieldType === 'string';
        }

        // Check if objName is a local variable with a struct type that has a string field
        const varType = this.tempVarTypes.get(objName);
        if (varType) {
          const typeInfo = this.symbolTable.types.get(varType);
          if (typeInfo && typeInfo.kind === 'struct') {
            const field = typeInfo.fields.find(f => f.name === expr.field);
            if (field) {
              return field.type === 'string';
            }
          }
        }
      }
    }

    // Local variable - check if type is 'string'
    if (expr.type === 'variable') {
      const varType = this.tempVarTypes.get(expr.name);
      return varType === 'string';
    }

    // Call expression - check for known string-returning builtins
    if (expr.type === 'call') {
      const stringReturningFuncs = [
        'format', 'string_concat', 'substring', 'to_string',
        'read_file', 'read_line', 'input'
      ];
      const funcName = expr.function?.name || expr.callee?.name || '';
      return stringReturningFuncs.includes(funcName);
    }

    return false;
  }

  /**
   * Check if an expression evaluates to an enum type
   */
  isEnumExpression(expr) {
    if (!expr) return false;

    // Enum variant literal (e.g., TokenType::EOF)
    if (expr.type === 'enum-variant') {
      return true;
    }

    // Field access - check if field type is an enum
    if (expr.type === 'field-access') {
      if (expr.object.type === 'variable') {
        const objName = expr.object.name;

        // Check if objName is a local variable with a struct type that has an enum field
        const varType = this.tempVarTypes.get(objName);
        if (varType) {
          const typeInfo = this.symbolTable.types.get(varType);
          if (typeInfo && typeInfo.kind === 'struct') {
            const field = typeInfo.fields.find(f => f.name === expr.field);
            if (field && field.type) {
              // Check if the field type is an enum
              const fieldTypeInfo = this.symbolTable.types.get(field.type);
              if (fieldTypeInfo && fieldTypeInfo.kind === 'enum') {
                return true;
              }
            }
          }
        }
      }
    }

    // Local variable - check if type is an enum
    if (expr.type === 'variable') {
      const varType = this.tempVarTypes.get(expr.name);
      if (varType) {
        const typeInfo = this.symbolTable.types.get(varType);
        if (typeInfo && typeInfo.kind === 'enum') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Infer the type of an expression (simplified)
   */
  inferType(expr) {
    if (expr.type === 'literal') {
      if (typeof expr.value === 'number') {
        return expr.value >= 0 ? 'i64' : 'i64';
      }
      if (typeof expr.value === 'string') {
        return 'string';
      }
      return 'unknown';
    }
    // Check if it's a string expression
    if (this.isStringExpression(expr)) {
      return 'string';
    }
    // For now, default to i64
    return 'i64';
  }

  /**
   * Add a local variable to the scope
   */
  addLocalVar(name, size = 8, typeName = null) {
    this.stackOffset += size;
    // Track maximum stack offset for allocation (handles nested scopes)
    if (this.stackOffset > this.maxStackOffset) {
      this.maxStackOffset = this.stackOffset;
    }
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

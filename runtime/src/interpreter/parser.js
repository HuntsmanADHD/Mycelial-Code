/**
 * Mycelial Parser
 *
 * Parses Mycelial source code into an Abstract Syntax Tree (AST).
 * Handles: networks, frequencies, hyphae, spawns, sockets, handlers, expressions, statements
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

class MycelialParser {
  constructor() {
    this.source = '';
    this.position = 0;
    this.line = 1;
    this.column = 1;
  }

  /**
   * Parse complete Mycelial source code into network definition
   * @param {string} source - Mycelial source code
   * @returns {Object} Network AST
   */
  parseNetwork(source) {
    this.source = source;
    this.position = 0;
    this.line = 1;
    this.column = 1;

    console.error(`[PARSE-DEBUG] Starting parse of ${source.length} bytes`);
    this.skipWhitespaceAndComments();
    console.error(`[PARSE-DEBUG] Skipped initial whitespace, at position ${this.position}`);

    // Expect: network NetworkName { ... }
    this.expectKeyword('network');
    const networkName = this.parseIdentifier();
    this.expectChar('{');

    const network = {
      name: networkName,
      frequencies: {},
      types: {},
      hyphae: {},
      spawns: [],
      sockets: [],
      fruitingBodies: [],
      config: {}
    };

    // Parse network sections
    while (!this.checkChar('}')) {
      if (this.checkKeyword('frequencies')) {
        console.error(`[PARSE-DEBUG] Parsing frequencies at pos ${this.position}`);
        this.parseFrequencies(network);
        console.error(`[PARSE-DEBUG] Finished frequencies`);
      } else if (this.checkKeyword('types')) {
        console.error(`[PARSE-DEBUG] Parsing types at pos ${this.position}`);
        this.parseTypes(network);
        console.error(`[PARSE-DEBUG] Finished types`);
      } else if (this.checkKeyword('hyphae')) {
        console.error(`[PARSE-DEBUG] Parsing hyphae at pos ${this.position}`);
        this.parseHyphae(network);
        console.error(`[PARSE-DEBUG] Finished hyphae`);
      } else if (this.checkKeyword('topology')) {
        console.error(`[PARSE-DEBUG] Parsing topology at pos ${this.position}`);
        this.parseTopology(network);
        console.error(`[PARSE-DEBUG] Finished topology`);
      } else if (this.checkKeyword('config')) {
        console.error(`[PARSE-DEBUG] Skipping config at pos ${this.position}`);
        this.skipConfigBlock();
        console.error(`[PARSE-DEBUG] Finished config`);
      } else {
        console.error(`[PARSE-DEBUG] Unknown keyword at pos ${this.position}, breaking`);
        break;
      }
    }

    this.expectChar('}');
    return network;
  }

  /**
   * Parse types block with struct definitions
   */
  parseTypes(network) {
    this.expectKeyword('types');
    this.expectChar('{');

    while (!this.checkChar('}')) {
      if (this.checkKeyword('struct')) {
        const structDef = this.parseStruct();
        network.types[structDef.name] = structDef;
      } else if (this.checkKeyword('enum')) {
        const enumDef = this.parseEnum();
        network.types[enumDef.name] = enumDef;
      } else {
        // Skip unknown type definition
        this.consume();
      }
    }

    this.expectChar('}');
  }

  /**
   * Parse struct definition: struct Name { field: type, ... }
   */
  parseStruct() {
    this.expectKeyword('struct');
    const name = this.parseIdentifier();
    this.expectChar('{');

    const fields = [];
    while (!this.checkChar('}')) {
      const fieldName = this.parseIdentifier();
      this.expectChar(':');
      const fieldType = this.parseType();

      fields.push({
        name: fieldName,
        type: fieldType
      });

      // Optional comma
      if (this.checkChar(',')) {
        this.consumeChar(',');
      }
    }

    this.expectChar('}');

    return {
      type: 'struct',
      name,
      fields
    };
  }

  /**
   * Parse enum definition: enum Name { VARIANT1, VARIANT2, Variant(Type), ... }
   * Supports both simple variants and parameterized variants (with associated data)
   */
  parseEnum() {
    this.expectKeyword('enum');
    const name = this.parseIdentifier();
    this.expectChar('{');

    const variants = [];
    while (!this.checkChar('}')) {
      // Parse variant name (identifier)
      const variantName = this.parseIdentifier();

      let variantData = null;

      // Check for parameterized variant: Variant(Type) or Variant(Type, Type, ...)
      if (this.checkChar('(')) {
        this.consumeChar('(');

        const dataTypes = [];
        while (!this.checkChar(')')) {
          if (dataTypes.length > 0) {
            this.expectChar(',');
          }

          // Parse the type - could be simple or generic like vec<T>
          let typeName = this.parseIdentifier();

          // Check for generic type parameter: Type<Inner>
          this.skipWhitespaceAndComments();
          if (this.checkChar('<')) {
            this.consumeChar('<');
            // For simplicity, just consume until matching '>'
            let depth = 1;
            const startPos = this.position;
            while (depth > 0 && this.position < this.source.length) {
              if (this.checkChar('<')) {
                this.consumeChar('<');
                depth++;
              } else if (this.checkChar('>')) {
                this.consumeChar('>');
                depth--;
              } else {
                this.consume();
              }
            }
            const innerType = this.source.substring(startPos, this.position - 1).trim();
            typeName = `${typeName}<${innerType}>`;
          }

          dataTypes.push(typeName);

          this.skipWhitespaceAndComments();
        }

        this.expectChar(')');

        // For now, support single data type per variant (most common case)
        variantData = dataTypes.length > 0 ? dataTypes[0] : null;
      }

      variants.push({
        name: variantName,
        dataType: variantData
      });

      // Optional comma
      if (this.checkChar(',')) {
        this.consumeChar(',');
      }
    }

    this.expectChar('}');

    return {
      type: 'enum',
      name,
      variants
    };
  }

  /**
   * Skip config block (we don't need to parse runtime config for compilation)
   */
  skipConfigBlock() {
    this.expectKeyword('config');
    this.expectChar('{');

    // Skip until matching closing brace
    let depth = 1;
    while (depth > 0 && this.position < this.source.length) {
      this.skipWhitespaceAndComments();

      if (this.checkChar('{')) {
        this.consumeChar('{');
        depth++;
      } else if (this.checkChar('}')) {
        this.consumeChar('}');
        depth--;
      } else {
        this.consume();
      }
    }
  }

  /**
   * Parse frequencies block
   */
  parseFrequencies(network) {
    this.expectKeyword('frequencies');
    this.expectChar('{');

    while (!this.checkChar('}')) {
      if (this.checkChar('}')) break;

      const freqName = this.parseIdentifier();
      this.expectChar('{');

      const fields = [];
      while (!this.checkChar('}')) {
        if (this.checkChar('}')) break;

        const fieldName = this.parseIdentifier();
        this.expectChar(':');
        const fieldType = this.parseType();

        fields.push({ name: fieldName, type: fieldType });

        // Optional comma
        if (this.checkChar(',')) {
          this.consumeChar(',');
        }
      }

      this.expectChar('}');
      network.frequencies[freqName] = { fields };
    }

    this.expectChar('}');
  }

  /**
   * Parse hyphae block
   */
  parseHyphae(network) {
    this.expectKeyword('hyphae');
    this.expectChar('{');

    while (!this.checkChar('}')) {
      if (this.checkChar('}')) break;

      const hyphal = this.parseHyphal();
      network.hyphae[hyphal.name] = hyphal;
    }

    this.expectChar('}');
  }

  /**
   * Parse single hyphal definition
   */
  parseHyphal() {
    this.expectKeyword('hyphal');
    const name = this.parseIdentifier();
    this.expectChar('{');

    const hyphal = {
      name,
      state: [],
      handlers: [],
      rules: []
    };

    while (!this.checkChar('}')) {
      if (this.checkChar('}')) break;

      if (this.checkKeyword('frequency')) {
        // Skip frequency declaration (not used in native compilation)
        this.expectKeyword('frequency');
        this.parseIdentifier(); // frequency name
      } else if (this.checkKeyword('state')) {
        this.parseState(hyphal);
      } else if (this.checkKeyword('on')) {
        const handler = this.parseHandler();
        hyphal.handlers.push(handler);
      } else if (this.checkKeyword('rule')) {
        const rule = this.parseRule();
        hyphal.rules.push(rule);
      } else {
        // Unknown keyword - skip to avoid infinite loop
        this.error(`Unexpected keyword in hyphal definition: ${this.peek()}`);
      }
    }

    this.expectChar('}');
    return hyphal;
  }

  /**
   * Parse state block
   */
  parseState(hyphal) {
    this.expectKeyword('state');
    this.expectChar('{');

    while (!this.checkChar('}')) {
      if (this.checkChar('}')) break;

      const fieldName = this.parseIdentifier();
      this.expectChar(':');
      const fieldType = this.parseType();

      let defaultValue = null;
      if (this.checkChar('=')) {
        this.consumeChar('=');
        defaultValue = this.parseExpression();
      }

      hyphal.state.push({
        name: fieldName,
        type: fieldType,
        default: defaultValue
      });

      // Optional comma
      if (this.checkChar(',')) {
        this.consumeChar(',');
      }
    }

    this.expectChar('}');
  }

  /**
   * Parse signal handler: on signal(frequency, binding) { body } or on rest { body }
   */
  parseHandler() {
    this.expectKeyword('on');

    let handlerType = 'signal';
    let frequency = null;
    let binding = null;
    let guard = null;
    let cycleNumber = null;

    if (this.checkKeyword('rest')) {
      this.expectKeyword('rest');
      handlerType = 'rest';
    } else if (this.checkKeyword('cycle')) {
      // Timed handler: on cycle N { }
      this.expectKeyword('cycle');
      cycleNumber = this.parseNumber();
      handlerType = 'cycle';
    } else {
      this.expectKeyword('signal');
      this.expectChar('(');
      frequency = this.parseIdentifier();

      // Check if there's a binding parameter
      if (this.checkChar(',')) {
        this.consumeChar(',');
        binding = this.parseIdentifier();
      }

      this.expectChar(')');

      // Optional guard: when condition
      if (this.checkKeyword('when')) {
        this.expectKeyword('when');
        guard = this.parseExpression();
      }
    }

    this.expectChar('{');
    const body = this.parseStatements();
    this.expectChar('}');

    return {
      type: handlerType,
      frequency,
      binding,
      cycleNumber,
      guard,
      body
    };
  }

  /**
   * Parse rule definition: rule name(param: type, ...) -> returnType { body }
   */
  parseRule() {
    this.expectKeyword('rule');
    const name = this.parseIdentifier();
    this.expectChar('(');

    const params = [];
    while (!this.checkChar(')')) {
      if (this.checkChar(')')) break;

      const paramName = this.parseIdentifier();
      let paramType = null;

      if (this.checkChar(':')) {
        this.consumeChar(':');
        paramType = this.parseType();
      }

      params.push({ name: paramName, type: paramType });

      if (this.checkChar(',')) {
        this.consumeChar(',');
      }
    }

    this.expectChar(')');

    // Optional return type: -> type
    let returnType = null;
    if (this.checkOperator('->')) {
      this.consumeOperator('->');
      returnType = this.parseType();
    }

    this.expectChar('{');
    const body = this.parseStatements();
    this.expectChar('}');

    return {
      name,
      params,
      returnType,
      body
    };
  }

  /**
   * Parse topology block
   */
  parseTopology(network) {
    this.expectKeyword('topology');
    this.expectChar('{');

    while (!this.checkChar('}')) {
      if (this.checkChar('}')) break;

      if (this.checkKeyword('fruiting_body')) {
        this.expectKeyword('fruiting_body');
        const name = this.parseIdentifier();
        network.fruitingBodies.push(name);
      } else if (this.checkKeyword('spawn')) {
        this.expectKeyword('spawn');
        const hyphalType = this.parseIdentifier();
        this.expectKeyword('as');
        const instanceId = this.parseIdentifier();
        network.spawns.push({ hyphalType, instanceId });
      } else if (this.checkKeyword('socket')) {
        this.expectKeyword('socket');
        const from = this.parseIdentifier();
        this.expectKeyword('->');

        // Support broadcast wildcard: socket X -> *
        let to;
        if (this.checkChar('*')) {
          this.consumeChar('*');
          to = '*';  // Broadcast to all agents
        } else {
          to = this.parseIdentifier();
        }

        // Parse (frequency: name) or just frequency name
        let frequency = null;
        if (this.checkChar('(')) {
          this.consumeChar('(');
          this.expectKeyword('frequency');
          this.expectChar(':');
          frequency = this.parseIdentifier();
          this.expectChar(')');
        }

        network.sockets.push({
          from: { agent: from, frequency },
          to: { agent: to, frequency }
        });
      }
    }

    this.expectChar('}');
  }

  /**
   * Parse list of statements
   */
  parseStatements() {
    const statements = [];

    while (!this.checkChar('}') && this.position < this.source.length) {
      if (this.checkChar('}')) break;

      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);

        // Consume optional semicolon after statement
        this.skipWhitespaceAndComments();
        if (this.checkChar(';')) {
          this.consumeChar(';');
        }
      }
    }

    return statements;
  }

  /**
   * Parse single statement
   */
  parseStatement() {
    this.skipWhitespaceAndComments();

    // Debug logging
    const debugPos = this.position;
    const debugLine = this.line;
    const debugPreview = this.source.substring(this.position, this.position + 30);
    if (debugLine >= 598 && debugLine <= 606) {
      console.error(`[PARSE-DEBUG] parseStatement at line ${debugLine}, pos ${debugPos}: "${debugPreview}"`);
    }

    // let variable: type = expression
    if (this.checkKeyword('let')) {
      this.expectKeyword('let');
      const name = this.parseIdentifier();

      // Optional type annotation
      let typeAnnotation = null;
      if (this.checkChar(':')) {
        this.consumeChar(':');
        typeAnnotation = this.parseTypeRef();
      }

      this.expectChar('=');
      const value = this.parseExpression();
      return { type: 'let', name, typeAnnotation, value };
    }

    // emit frequency { field: value, ... }
    if (this.checkKeyword('emit')) {
      this.expectKeyword('emit');
      const frequency = this.parseIdentifier();
      this.expectChar('{');

      const payload = {};
      while (!this.checkChar('}')) {
        if (this.checkChar('}')) break;

        const fieldName = this.parseIdentifier();
        this.expectChar(':');
        const value = this.parseExpression();
        payload[fieldName] = value;

        if (this.checkChar(',')) {
          this.consumeChar(',');
        }
      }

      this.expectChar('}');
      return { type: 'emit', frequency, payload };
    }

    // if condition { ... } else if { ... } else { ... }
    if (this.checkKeyword('if')) {
      this.expectKeyword('if');
      const condLine = this.line;
      if (condLine >= 598 && condLine <= 606) {
        console.error(`[PARSE-DEBUG] About to parse if condition at line ${this.line}`);
      }
      const condition = this.parseExpression();
      if (condLine >= 598 && condLine <= 606) {
        console.error(`[PARSE-DEBUG] Finished if condition: ${JSON.stringify(condition)}, now at line ${this.line}`);
      }
      this.expectChar('{');
      const body = this.parseStatements();
      this.expectChar('}');

      let elseBranch = null;
      if (this.checkKeyword('else')) {
        this.expectKeyword('else');

        // Check for else if (parse as nested if statement)
        if (this.checkKeyword('if')) {
          const nestedIf = this.parseStatement();
          elseBranch = [nestedIf];
        } else {
          // Regular else block
          this.expectChar('{');
          elseBranch = this.parseStatements();
          this.expectChar('}');
        }
      }

      return { type: 'if', condition, body, else: elseBranch };
    }

    // for item in collection { ... } or for key, value in map { ... }
    // Also supports: for item: Type in collection { ... }
    if (this.checkKeyword('for')) {
      this.expectKeyword('for');
      const item = this.parseIdentifier();

      // Check for optional type annotation: for item: Type in ...
      let itemType = null;
      if (this.checkChar(':')) {
        this.consumeChar(':');
        itemType = this.parseTypeRef();
      }

      // Check for key-value iteration: for key, value in map
      let valueVar = null;
      let valueType = null;
      if (this.checkChar(',')) {
        this.consumeChar(',');
        valueVar = this.parseIdentifier();

        // Check for optional type annotation on value: for key, value: Type in ...
        if (this.checkChar(':')) {
          this.consumeChar(':');
          valueType = this.parseTypeRef();
        }
      }

      this.expectKeyword('in');
      const collection = this.parseExpression();
      this.expectChar('{');
      const body = this.parseStatements();
      this.expectChar('}');

      if (valueVar) {
        // Key-value iteration
        return { type: 'for-kv', key: item, value: valueVar, collection, body, keyType: itemType, valueType };
      } else {
        // Simple iteration
        return { type: 'for', item, collection, body, itemType };
      }
    }

    // while condition { ... }
    if (this.checkKeyword('while')) {
      this.expectKeyword('while');
      const condition = this.parseExpression();
      this.expectChar('{');
      const body = this.parseStatements();
      this.expectChar('}');
      return { type: 'while', condition, body };
    }

    // report name: value  OR  report name { field: value, ... } (struct literal)
    if (this.checkKeyword('report')) {
      this.expectKeyword('report');
      const name = this.parseIdentifier();

      // Check if this is a struct literal (report status { ... })
      // or a simple value (report count: 42)
      const savedPos = this.position;
      const savedLine = this.line;
      const savedCol = this.column;

      // Peek ahead (skip whitespace but not comments/newlines to match struct literal logic)
      let tempPos = this.position;
      while (tempPos < this.source.length && (this.source[tempPos] === ' ' || this.source[tempPos] === '\t')) {
        tempPos++;
      }

      if (tempPos < this.source.length && this.source[tempPos] === '{') {
        // This looks like a struct literal: report status { ... }
        // We need to manually construct the struct literal since we already consumed 'status'
        this.skipWhitespaceAndComments();
        this.consumeChar('{');

        const fields = {};
        while (!this.checkChar('}')) {
          if (this.checkChar('}')) break;

          const fieldName = this.parseIdentifier();
          this.expectChar(':');
          const fieldValue = this.parseExpression();
          fields[fieldName] = fieldValue;

          if (this.checkChar(',')) {
            this.consumeChar(',');
          }
        }

        this.expectChar('}');
        const value = { type: 'struct-literal', structName: name, fields };
        return { type: 'report', name, value };
      } else {
        // Traditional syntax: report name: value
        this.expectChar(':');
        const value = this.parseExpression();
        return { type: 'report', name, value };
      }
    }

    // return [expression]
    if (this.checkKeyword('return')) {
      this.expectKeyword('return');

      // Check if there's an expression to return, or if it's just "return"
      // If we see }, we're at the end of a block, so return has no value
      let value = null;
      if (!this.checkChar('}')) {
        value = this.parseExpression();
      }

      return { type: 'return', value };
    }

    // break (exit loop)
    if (this.checkKeyword('break')) {
      this.expectKeyword('break');
      return { type: 'break' };
    }

    // continue (next loop iteration)
    if (this.checkKeyword('continue')) {
      this.expectKeyword('continue');
      return { type: 'continue' };
    }

    // match expression { pattern => { body }, ... }
    if (this.checkKeyword('match')) {
      if (process.env.DEBUG && ((this.line >= 1509 && this.line <= 1512) || (this.line >= 947 && this.line <= 952))) {
        console.error(`[PARSE-DEBUG] Parsing match statement at line ${this.line}`);
      }

      this.expectKeyword('match');

      if (process.env.DEBUG && ((this.line >= 1509 && this.line <= 1512) || (this.line >= 947 && this.line <= 952))) {
        console.error(`[PARSE-DEBUG] About to parse match value at line ${this.line}, pos=${this.position}, preview='${this.source.substring(this.position, this.position + 80)}'`);
      }

      const value = this.parseExpression();

      if (process.env.DEBUG && ((this.line >= 1509 && this.line <= 1512) || (this.line >= 947 && this.line <= 952))) {
        console.error(`[PARSE-DEBUG] Match value parsed: ${JSON.stringify(value).substring(0, 100)}, now at line ${this.line}, expecting '{`);
      }

      this.expectChar('{');

      if (process.env.DEBUG && ((this.line >= 1509 && this.line <= 1512) || (this.line >= 947 && this.line <= 952))) {
        console.error(`[PARSE-DEBUG] Match '{' found, starting to parse arms at line ${this.line}`);
      }

      const arms = [];
      while (!this.checkChar('}')) {
        if (this.checkChar('}')) break;

        if (process.env.DEBUG && ((this.line >= 1509 && this.line <= 1512) || (this.line >= 947 && this.line <= 952))) {
          console.error(`[PARSE-DEBUG] Parsing match arm at line ${this.line}, pos=${this.position}, preview='${this.source.substring(this.position, this.position + 50)}'`);
        }

        // Parse pattern(s) - can be multiple separated by |
        // Patterns can be identifiers, string literals, enum variants with bindings, etc.
        const patterns = [];

        if (process.env.DEBUG && ((this.line >= 1509 && this.line <= 1512) || (this.line >= 947 && this.line <= 952))) {
          console.error(`[PARSE-DEBUG] About to call parsePattern() at line ${this.line}`);
        }

        patterns.push(this.parsePattern());

        if (process.env.DEBUG && ((this.line >= 1509 && this.line <= 1512) || (this.line >= 947 && this.line <= 952))) {
          console.error(`[PARSE-DEBUG] parsePattern() returned, pattern=${JSON.stringify(patterns[0]).substring(0, 100)}`);
        }

        while (this.checkChar('|')) {
          this.consumeChar('|');
          patterns.push(this.parsePattern());
        }

        // Parse =>
        this.expectChar('=');
        this.expectChar('>');

        // Parse arm body - can be either a block or a single expression
        let body;
        if (this.checkChar('{')) {
          // Block body: { statements }
          this.consumeChar('{');
          body = this.parseStatements();
          this.expectChar('}');
        } else {
          // Single expression body
          const expr = this.parseExpression();
          body = [{ type: 'expression-statement', expression: expr }];
        }

        arms.push({ patterns, body });

        // Optional comma between arms
        if (this.checkChar(',')) {
          this.consumeChar(',');
        }
      }

      this.expectChar('}');
      return { type: 'match', value, arms };
    }

    // Assignment: variable = value or state.field = value
    const startPos = this.position;
    const target = this.parseAssignmentTarget();

    if (this.checkChar('=')) {
      this.consumeChar('=');
      const value = this.parseExpression();
      return { type: 'assignment', target, value };
    }

    // Not an assignment, might be function call
    this.position = startPos;
    const expr = this.parseExpression();
    if (expr.type === 'function-call') {
      return { type: 'expression-statement', expression: expr };
    }

    return null;
  }

  /**
   * Parse assignment target (variable, state.field, or map[key])
   */
  parseAssignmentTarget() {
    let target = { type: 'variable', name: this.parseIdentifier() };

    // Handle field access and array access
    while (true) {
      this.skipWhitespaceAndComments();

      // Field access: target.field
      if (this.checkChar('.') && this.source[this.position + 1] !== '.') {
        this.consumeChar('.');
        const field = this.parseIdentifier();

        // Convert to state-access ONLY if the variable is actually "state"
        if (target.type === 'variable' && target.name === 'state') {
          target = { type: 'state-access', object: target.name, field };
        } else {
          target = { type: 'field-access', object: target, field };
        }
      }
      // Array access: target[index]
      else if (this.checkChar('[')) {
        this.consumeChar('[');
        const index = this.parseExpression();
        this.expectChar(']');
        target = { type: 'array-access', object: target, index };
      }
      else {
        break;
      }
    }

    return target;
  }

  /**
   * Parse expression with operator precedence
   */
  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();

    while (this.checkOperator('||')) {
      this.consumeOperator('||');
      const right = this.parseLogicalAnd();
      left = { type: 'binary', op: '||', left, right };
    }

    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();

    while (this.checkOperator('&&')) {
      this.consumeOperator('&&');
      const right = this.parseEquality();
      left = { type: 'binary', op: '&&', left, right };
    }

    return left;
  }

  parseEquality() {
    let left = this.parseRange();

    while (this.checkOperator('==') || this.checkOperator('!=')) {
      const op = this.consumeOperator(['==', '!=']);
      const right = this.parseRange();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  parseRange() {
    let left = this.parseBitwiseOr();

    if (this.checkOperator('..')) {
      this.consumeOperator('..');
      const right = this.parseBitwiseOr();
      return { type: 'range', start: left, end: right };
    }

    return left;
  }

  parseBitwiseOr() {
    let left = this.parseBitwiseXor();

    while (this.checkOperator('|') && !this.checkOperator('||')) {
      this.consumeOperator('|');
      const right = this.parseBitwiseXor();
      left = { type: 'binary', op: '|', left, right };
    }

    return left;
  }

  parseBitwiseXor() {
    let left = this.parseBitwiseAnd();

    while (this.checkOperator('^')) {
      this.consumeOperator('^');
      const right = this.parseBitwiseAnd();
      left = { type: 'binary', op: '^', left, right };
    }

    return left;
  }

  parseBitwiseAnd() {
    let left = this.parseShift();

    while (this.checkOperator('&') && !this.checkOperator('&&')) {
      this.consumeOperator('&');
      const right = this.parseShift();
      left = { type: 'binary', op: '&', left, right };
    }

    return left;
  }

  parseShift() {
    let left = this.parseComparison();

    while (this.checkOperator('<<') || this.checkOperator('>>')) {
      const op = this.consumeOperator(['<<', '>>']);
      const right = this.parseComparison();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();

    // Check for comparison operators, but exclude shift operators (<<, >>)
    while ((this.checkOperator('<=') || this.checkOperator('>=') ||
           (this.checkOperator('<') && !this.checkOperator('<<')) ||
           (this.checkOperator('>') && !this.checkOperator('>>')))) {
      const op = this.consumeOperator(['<=', '>=', '<', '>']);
      const right = this.parseAdditive();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();

    while (this.checkOperator('+') || this.checkOperator('-')) {
      const op = this.consumeOperator(['+', '-']);
      const right = this.parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();

    while (this.checkOperator('*') || this.checkOperator('/') || this.checkOperator('%')) {
      const op = this.consumeOperator(['*', '/', '%']);
      const right = this.parseUnary();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  parseUnary() {
    if (this.checkOperator('!') || this.checkOperator('-')) {
      const op = this.consumeOperator(['!', '-']);
      const operand = this.parseUnary();
      return { type: 'unary', op, operand };
    }

    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();

    while (true) {
      // Don't skip whitespace before checking for postfix operators
      // We need to be careful about when { starts a struct literal vs a block
      const beforePos = this.position;
      this.skipWhitespaceAndComments();

      if (process.env.DEBUG && this.line === 1511) {
        console.error(`[PARSE-DEBUG] At line 1511, pos=${this.position}, char='${this.peek()}', next='${this.source[this.position + 1]}', expr=${JSON.stringify(expr)}`);
      }

      // Enum variant access: Type::Variant
      if (this.checkChar(':') && this.source[this.position + 1] === ':') {
        if (process.env.DEBUG) {
          console.error(`[PARSE-DEBUG] Parsing :: at line ${this.line}, expr=${JSON.stringify(expr)}`);
        }
        this.consumeChar(':');
        this.consumeChar(':');
        const variant = this.parseIdentifier();
        // Convert variable to enum type name
        if (expr.type === 'variable') {
          expr = { type: 'enum-variant', enumType: expr.name, variant };
        } else {
          this.error(`Expected identifier before ::, got ${expr.type}`);
        }
      }
      // Field access: expr.field
      // But NOT range operator: expr..end
      else if (this.checkChar('.') && this.source[this.position + 1] !== '.') {
        this.consumeChar('.');
        const field = this.parseIdentifier();
        expr = { type: 'field-access', object: expr, field };
      }
      // Function call: expr(args)
      else if (this.checkChar('(')) {
        this.consumeChar('(');
        const args = [];

        while (!this.checkChar(')')) {
          if (this.checkChar(')')) break;

          args.push(this.parseExpression());

          if (this.checkChar(',')) {
            this.consumeChar(',');
          }
        }

        this.expectChar(')');

        // Convert identifier to function call
        if (expr.type === 'variable') {
          expr = { type: 'function-call', name: expr.name, args };
        } else if (expr.type === 'enum-variant') {
          // Enum variant constructor: EnumType::Variant(args)
          expr = {
            type: 'enum-variant-constructor',
            enumType: expr.enumType,
            variant: expr.variant,
            args
          };
        } else {
          expr = { type: 'method-call', object: expr, args };
        }
      }
      // Array access: expr[index]
      else if (this.checkChar('[')) {
        this.consumeChar('[');
        const index = this.parseExpression();
        this.expectChar(']');
        expr = { type: 'array-access', object: expr, index };
      }
      // Type cast: expr as Type
      else if (this.checkKeyword('as')) {
        this.expectKeyword('as');
        const targetType = this.parseTypeRef();
        expr = { type: 'type-cast', expression: expr, targetType };
      }
      else {
        break;
      }
    }

    return expr;
  }

  parsePrimary() {
    this.skipWhitespaceAndComments();

    // If expression: if condition { value } else { value }
    if (this.checkKeyword('if')) {
      this.expectKeyword('if');
      const condition = this.parseExpression();
      this.expectChar('{');

      // Parse single expression as the "then" value
      const thenValue = this.parseExpression();
      this.expectChar('}');

      this.expectKeyword('else');
      this.expectChar('{');

      // Parse single expression as the "else" value
      const elseValue = this.parseExpression();
      this.expectChar('}');

      return { type: 'if-expression', condition, thenValue, elseValue };
    }

    // Match expression: match value { pattern => expr, ... }
    if (this.checkKeyword('match')) {
      this.expectKeyword('match');
      const value = this.parseExpression();
      this.expectChar('{');

      const arms = [];
      while (!this.checkChar('}')) {
        if (this.checkChar('}')) break;

        // Parse pattern(s) - can be multiple separated by |
        const patterns = [];
        patterns.push(this.parsePattern());

        while (this.checkChar('|')) {
          this.consumeChar('|');
          patterns.push(this.parsePattern());
        }

        // Parse =>
        this.expectChar('=');
        this.expectChar('>');

        // Parse arm expression (must be single expression, not statement block)
        const expr = this.parseExpression();
        arms.push({ patterns, body: [{ type: 'expression-statement', expression: expr }] });

        // Optional comma after arm
        this.skipWhitespaceAndComments();
        if (this.checkChar(',')) {
          this.consumeChar(',');
        }
      }

      this.expectChar('}');
      return { type: 'match', value, arms };
    }

    // Number literal
    if (this.isDigit(this.peek())) {
      return this.parseNumber();
    }

    // String literal
    if (this.peek() === '"') {
      return this.parseString();
    }

    // Boolean literals
    if (this.checkKeyword('true')) {
      this.expectKeyword('true');
      return { type: 'literal', value: true };
    }

    if (this.checkKeyword('false')) {
      this.expectKeyword('false');
      return { type: 'literal', value: false };
    }

    // Null literal
    if (this.checkKeyword('null')) {
      this.expectKeyword('null');
      return { type: 'literal', value: null };
    }

    // Character literal: 'x'
    if (this.peek() === "'") {
      this.consume(); // opening '
      let ch = '';

      if (this.peek() === '\\') {
        // Escape sequence
        this.consume(); // backslash
        const next = this.consume();
        switch (next) {
          case 'n': ch = '\n'; break;
          case 't': ch = '\t'; break;
          case 'r': ch = '\r'; break;
          case '\\': ch = '\\'; break;
          case "'": ch = "'"; break;
          case '0': ch = '\0'; break;
          default: ch = next;
        }
      } else {
        ch = this.consume();
      }

      this.expectChar("'"); // closing '
      return { type: 'literal', value: ch };
    }

    // Anonymous function: fn(params) { body } or fn(params) -> expr
    if (this.checkKeyword('fn')) {
      this.expectKeyword('fn');
      this.expectChar('(');

      const params = [];
      while (!this.checkChar(')')) {
        if (params.length > 0) {
          this.expectChar(',');
        }

        const paramName = this.parseIdentifier();
        let paramType = null;

        if (this.checkChar(':')) {
          this.consumeChar(':');
          paramType = this.parseTypeRef();
        }

        params.push({ name: paramName, type: paramType });

        this.skipWhitespaceAndComments();
      }

      this.expectChar(')');

      // Optional return type
      let returnType = null;
      if (this.checkOperator('->')) {
        this.consumeOperator('->');
        returnType = this.parseTypeRef();
      }

      // Function body - either block or expression
      let body;
      if (this.checkChar('{')) {
        this.consumeChar('{');
        body = this.parseStatements();
        this.expectChar('}');
      } else {
        // Single expression body (arrow function style)
        const expr = this.parseExpression();
        body = [{ type: 'return', value: expr }];
      }

      return {
        type: 'function-literal',
        params,
        returnType,
        body
      };
    }

    // Array literal: [1, 2, 3]
    if (this.checkChar('[')) {
      this.consumeChar('[');
      const elements = [];

      while (!this.checkChar(']')) {
        if (this.checkChar(']')) break;

        elements.push(this.parseExpression());

        if (this.checkChar(',')) {
          this.consumeChar(',');
        }
      }

      this.expectChar(']');
      return { type: 'array-literal', elements };
    }

    // Map literal: {} (for now, only empty maps)
    if (this.checkChar('{')) {
      this.consumeChar('{');
      this.skipWhitespaceAndComments();

      // For now, only support empty map literals
      if (this.checkChar('}')) {
        this.consumeChar('}');
        return { type: 'map-literal', entries: [] };
      }

      // TODO: Support map literals with entries: {key: value, ...}
      throw new Error(`Map literals with entries not yet supported at line ${this.line}`);
    }

    // Parenthesized expression or tuple literal
    if (this.checkChar('(')) {
      this.consumeChar('(');

      // Parse first expression
      const firstExpr = this.parseExpression();
      this.skipWhitespaceAndComments();

      // Check if this is a tuple (comma-separated) or single grouped expression
      if (this.checkChar(',')) {
        // It's a tuple literal: (expr1, expr2, ...)
        const elements = [firstExpr];

        while (this.checkChar(',')) {
          this.consumeChar(',');
          this.skipWhitespaceAndComments();

          // Allow trailing comma
          if (this.checkChar(')')) {
            break;
          }

          elements.push(this.parseExpression());
          this.skipWhitespaceAndComments();
        }

        this.expectChar(')');
        return { type: 'tuple-expression', elements };
      } else {
        // Single grouped expression: (expr)
        this.expectChar(')');
        return firstExpr;
      }
    }

    // Identifier, function call, or struct literal
    const name = this.parseIdentifier();

    // Check for struct literal: TypeName { field: value, ... }
    // Only parse as struct literal if name starts with uppercase (type convention)
    // and is immediately followed by { without newline
    // BUT: Don't parse as struct literal if this could be a statement block
    // (i.e., after comparison operators like !=, ==, <, >, etc.)
    const savedPos = this.position;
    const savedLine = this.line;
    const savedColumn = this.column;

    // Check if { is on the same line (no newline between identifier and {)
    let hasNewline = false;
    let hasPrecedingOperator = false;

    // Look backward to see if there's a comparison/logical operator before this identifier
    // This prevents EOF in "tok.type != EOF {" from being parsed as struct literal
    // savedPos is right after parsing the identifier, so we look back before the identifier
    if (savedPos >= name.length + 2) {
      // Look at content before the identifier (savedPos - name.length gives us start of identifier)
      const beforeIdent = savedPos - name.length;
      let lookback = this.source.substring(Math.max(0, beforeIdent - 20), beforeIdent);
      lookback = lookback.trimEnd();

      if (savedLine >= 598 && savedLine <= 606) {
        console.error(`[PARSE-DEBUG] Checking for operator before '${name}', lookback: "${lookback}"`);
      }

      if (lookback.endsWith('!=') || lookback.endsWith('==') ||
          lookback.endsWith('&&') || lookback.endsWith('||') ||
          lookback.endsWith('<=') || lookback.endsWith('>=') ||
          lookback.endsWith('<') || lookback.endsWith('>') ||
          lookback.endsWith('+') || lookback.endsWith('-') ||
          lookback.endsWith('*') || lookback.endsWith('/') ||
          lookback.endsWith('%') ||
          lookback.endsWith('match') || lookback.endsWith('if') ||
          lookback.endsWith('while')) {
        hasPrecedingOperator = true;
        if (savedLine >= 598 && savedLine <= 606) {
          console.error(`[PARSE-DEBUG] Found preceding operator, won't parse '${name}' as struct`);
        }
      }
    }

    while (this.position < this.source.length && (this.peek() === ' ' || this.peek() === '\t')) {
      this.consume();
    }

    if (this.peek() === '\n' || this.peek() === '\r' || this.peek() === '#') {
      hasNewline = true;
    }

    // Restore position to re-check with skipWhitespaceAndComments
    this.position = savedPos;
    this.line = savedLine;
    this.column = savedColumn;

    // Treat as struct literal if:
    // 1. { is on same line (no newline between identifier and {)
    // 2. No preceding operator (to avoid "!= EOF {" being parsed as struct)
    // 3. Either: (a) Name starts with uppercase (type convention) OR
    //           (b) Name is lowercase AND next content after { looks like field: value
    //
    // This allows both "Status { ... }" and "status { ... }" for report statements
    if (!hasNewline && !hasPrecedingOperator && this.checkChar('{')) {
      // Save position before consuming {
      const beforeBrace = this.position;
      const beforeBraceLine = this.line;
      const beforeBraceCol = this.column;

      // Consume { and peek ahead
      this.skipWhitespaceAndComments();
      this.consumeChar('{');
      this.skipWhitespaceAndComments();

      // Check if we see identifier followed by ':' or '}' (empty struct)
      let looksLikeStruct = false;

      if (this.checkChar('}')) {
        // Empty braces: identifier {}
        looksLikeStruct = true;
      } else if (this.isAlpha(this.peek()) || this.peek() === '_') {
        const testPos = this.position;
        const testLine = this.line;
        const testCol = this.column;
        try {
          const testField = this.parseIdentifier();
          this.skipWhitespaceAndComments();
          if (this.peek() === ':') {
            looksLikeStruct = true;
          }
        } catch (e) {
          // Not a valid identifier, not a struct
        }
        // Restore position to just after {
        this.position = testPos;
        this.line = testLine;
        this.column = testCol;
      }

      // If it looks like a struct OR name is uppercase, parse as struct
      if (looksLikeStruct || name[0] === name[0].toUpperCase()) {
        const fields = {};

        while (!this.checkChar('}')) {
          if (this.checkChar('}')) break;

          const fieldName = this.parseIdentifier();
          this.expectChar(':');
          const value = this.parseExpression();
          fields[fieldName] = value;

          if (this.checkChar(',')) {
            this.consumeChar(',');
          }
        }

        this.expectChar('}');
        return { type: 'struct-literal', structName: name, fields };
      } else {
        // Not a struct literal, restore position to before {
        this.position = beforeBrace;
        this.line = beforeBraceLine;
        this.column = beforeBraceCol;
      }
    }

    return { type: 'variable', name };
  }

  /**
   * Parse type annotation
   */
  parseType() {
    this.skipWhitespaceAndComments();

    const baseType = this.parseIdentifier();

    // Handle vec<T>, map<K, V>, or other generic types
    if (this.checkChar('<')) {
      this.consumeChar('<');
      const firstType = this.parseType();

      // Check for map<K, V> with two type parameters
      if (this.checkChar(',')) {
        this.consumeChar(',');
        const secondType = this.parseType();
        this.expectChar('>');
        return `${baseType}<${firstType}, ${secondType}>`;
      }

      this.expectChar('>');
      return `${baseType}<${firstType}>`;
    }

    return baseType;
  }

  /**
   * Parse number literal
   */
  parseNumber() {
    this.skipWhitespaceAndComments();

    let num = '';
    let hasDot = false;
    let isHex = false;

    // Check for hexadecimal prefix 0x or 0X
    if (this.peek() === '0' && (this.source[this.position + 1] === 'x' || this.source[this.position + 1] === 'X')) {
      num += this.consume(); // '0'
      num += this.consume(); // 'x' or 'X'
      isHex = true;

      // Parse hex digits
      while (this.isHexDigit(this.peek())) {
        num += this.consume();
      }

      const value = parseInt(num, 16);
      return { type: 'literal', value };
    }

    // Parse decimal number
    while (this.isDigit(this.peek()) || (this.peek() === '.' && !hasDot && this.isDigit(this.source[this.position + 1]))) {
      if (this.peek() === '.') {
        hasDot = true;
      }
      num += this.consume();
    }

    const value = num.includes('.') ? parseFloat(num) : parseInt(num);

    // Check for type suffix: u8, i32, f64, etc.
    let typeSuffix = null;
    const ch = this.peek();
    if (ch === 'u' || ch === 'i' || ch === 'f') {
      // Try to parse type suffix
      const savedPos = this.position;
      let suffix = this.consume(); // 'u', 'i', or 'f'

      // Parse digits for bit width
      while (this.isDigit(this.peek())) {
        suffix += this.consume();
      }

      // Validate suffix (u8, u16, u32, u64, i8, i16, i32, i64, f32, f64)
      if (suffix.match(/^(u|i)(8|16|32|64)$/) || suffix.match(/^f(32|64)$/)) {
        typeSuffix = suffix;
      } else {
        // Not a valid type suffix, restore position
        this.position = savedPos;
      }
    }

    return { type: 'literal', value, typeSuffix };
  }

  /**
   * Check if character is a hexadecimal digit
   */
  isHexDigit(ch) {
    return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  }

  /**
   * Parse string literal
   */
  parseString() {
    this.expectChar('"');
    let str = '';

    while (this.peek() !== '"' && this.position < this.source.length) {
      if (this.peek() === '\\') {
        this.consume(); // consume backslash
        const next = this.consume();
        // Handle escape sequences
        switch (next) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case 'r': str += '\r'; break;
          case '\\': str += '\\'; break;
          case '"': str += '"'; break;
          default: str += next;
        }
      } else {
        str += this.consume();
      }
    }

    this.expectChar('"');
    return { type: 'literal', value: str };
  }

  /**
   * Parse identifier
   */
  parseIdentifier() {
    this.skipWhitespaceAndComments();

    if (!this.isAlpha(this.peek()) && this.peek() !== '_') {
      throw this.error(`Expected identifier, got '${this.peek()}'`);
    }

    let name = '';
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
      name += this.consume();
    }

    return name;
  }

  /**
   * Parse type reference
   * Examples: u32, string, vec<TokenType>, map<string, u32>
   */
  parseTypeRef() {
    this.skipWhitespaceAndComments();

    const baseType = this.parseIdentifier();

    // Check for generic types like vec<T> or map<K,V>
    if (this.checkChar('<')) {
      this.consumeChar('<');

      if (baseType === 'vec' || baseType === 'queue') {
        // vec<T> or queue<T>
        const elementType = this.parseTypeRef();
        this.expectChar('>');
        return `${baseType}<${elementType}>`;
      } else if (baseType === 'map') {
        // map<K,V>
        const keyType = this.parseTypeRef();
        this.expectChar(',');
        const valueType = this.parseTypeRef();
        this.expectChar('>');
        return `${baseType}<${keyType},${valueType}>`;
      }
    }

    return baseType;
  }

  /**
   * Parse match pattern
   * Supports:
   * - Simple literals: "string", 123, true
   * - Identifiers: NETWORK, EOF
   * - Enum variants with bindings: Expression::Identifier(id)
   */
  parsePattern() {
    this.skipWhitespaceAndComments();

    if (process.env.DEBUG && this.line === 1511) {
      console.error(`[PARSE-DEBUG] parsePattern called at line ${this.line}, pos=${this.position}, preview='${this.source.substring(this.position, this.position + 40)}'`);
    }

    // Check for tuple pattern: (pattern1, pattern2, ...)
    if (this.checkChar('(')) {
      if (process.env.DEBUG && (this.line >= 949 && this.line <= 952)) {
        console.error(`[PARSE-DEBUG] parsePattern detected tuple at line ${this.line}`);
      }

      this.consumeChar('(');

      const patterns = [];
      while (!this.checkChar(')')) {
        if (patterns.length > 0) {
          this.expectChar(',');
        }

        if (process.env.DEBUG && (this.line >= 949 && this.line <= 952)) {
          console.error(`[PARSE-DEBUG] Parsing tuple element ${patterns.length} at line ${this.line}, preview='${this.source.substring(this.position, this.position + 40)}'`);
        }

        patterns.push(this.parsePattern());
        this.skipWhitespaceAndComments();
      }

      this.expectChar(')');

      if (process.env.DEBUG && (this.line >= 949 && this.line <= 952)) {
        console.error(`[PARSE-DEBUG] Tuple pattern complete with ${patterns.length} elements`);
      }

      return {
        type: 'tuple-pattern',
        patterns: patterns
      };
    }

    // Parse simple patterns: literals, identifiers, enum variants
    // Do NOT use parsePrimary() because it treats ( as grouped expressions
    // which conflicts with tuple pattern parsing

    let expr;

    // String literal
    if (this.peek() === '"') {
      expr = this.parseString();
      return expr;
    }

    // Character literal
    if (this.peek() === "'") {
      this.consume(); // opening '
      let ch = '';

      if (this.peek() === '\\') {
        // Escape sequence
        this.consume(); // backslash
        const next = this.consume();
        switch (next) {
          case 'n': ch = '\n'; break;
          case 't': ch = '\t'; break;
          case 'r': ch = '\r'; break;
          case '\\': ch = '\\'; break;
          case "'": ch = "'"; break;
          case '0': ch = '\0'; break;
          default: ch = next;
        }
      } else {
        ch = this.consume();
      }

      this.expectChar("'"); // closing '
      return { type: 'literal', value: ch };
    }

    // Number literal
    if (this.isDigit(this.peek())) {
      expr = this.parseNumber();
      return expr;
    }

    // Boolean literals
    if (this.checkKeyword('true')) {
      this.expectKeyword('true');
      return { type: 'literal', value: true };
    }

    if (this.checkKeyword('false')) {
      this.expectKeyword('false');
      return { type: 'literal', value: false };
    }

    // Null literal
    if (this.checkKeyword('null')) {
      this.expectKeyword('null');
      return { type: 'literal', value: null };
    }

    // Identifier or enum variant
    const identifier = this.parseIdentifier();
    expr = { type: 'identifier', name: identifier };

    if (process.env.DEBUG && (this.line >= 949 && this.line <= 952)) {
      console.error(`[PARSE-DEBUG] parsePattern got identifier: ${identifier} at line ${this.line}`);
    }

    // Check for :: operator (enum variant)
    this.skipWhitespaceAndComments();
    if (this.checkOperator('::')) {
      this.consumeOperator('::');

      const variant = this.parseIdentifier();

      expr = {
        type: 'enum-variant',
        enumType: identifier,
        variant: variant
      };

      if (process.env.DEBUG && (this.line >= 949 && this.line <= 952)) {
        console.error(`[PARSE-DEBUG] Created enum-variant: ${identifier}::${variant} at line ${this.line}`);
      }

      // Check if this is an enum variant with bindings: EnumVariant(binding1, binding2)
      this.skipWhitespaceAndComments();
      if (this.checkChar('(')) {
        if (process.env.DEBUG && (this.line >= 949 && this.line <= 952)) {
          console.error(`[PARSE-DEBUG] Detected enum pattern bindings at line ${this.line}, pos=${this.position}`);
        }

        this.consumeChar('(');

        const bindings = [];
        while (!this.checkChar(')')) {
          if (bindings.length > 0) {
            this.expectChar(',');
          }

          const binding = this.parseIdentifier();
          bindings.push(binding);

          this.skipWhitespaceAndComments();
        }

        this.expectChar(')');

        if (process.env.DEBUG && (this.line >= 949 && this.line <= 952)) {
          console.error(`[PARSE-DEBUG] Enum pattern complete with ${bindings.length} bindings`);
        }

        return {
          type: 'enum-pattern',
          enumType: identifier,
          variant: variant,
          bindings: bindings
        };
      }
    }

    // Return the pattern (identifier, enum variant, or literal)
    return expr;
  }

  // ========== Utility Methods ==========

  skipWhitespaceAndComments() {
    while (this.position < this.source.length) {
      const ch = this.peek();

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.consume();
        continue;
      }

      // Comments: # to end of line
      if (ch === '#') {
        while (this.peek() !== '\n' && this.position < this.source.length) {
          this.consume();
        }
        continue;
      }

      break;
    }
  }

  peek() {
    if (this.position >= this.source.length) {
      return '\0';
    }
    return this.source[this.position];
  }

  consume() {
    if (this.position >= this.source.length) {
      return '\0';
    }

    const ch = this.source[this.position++];

    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }

    return ch;
  }

  checkChar(expected) {
    this.skipWhitespaceAndComments();
    return this.peek() === expected;
  }

  expectChar(expected) {
    this.skipWhitespaceAndComments();

    if (this.peek() !== expected) {
      throw this.error(`Expected '${expected}', got '${this.peek()}'`);
    }

    return this.consume();
  }

  consumeChar(expected) {
    return this.expectChar(expected);
  }

  checkKeyword(keyword) {
    this.skipWhitespaceAndComments();

    const start = this.position;
    for (let i = 0; i < keyword.length; i++) {
      if (this.source[start + i] !== keyword[i]) {
        return false;
      }
    }

    // Make sure it's not part of a larger identifier
    // Identifiers can contain letters, digits, and underscores
    const nextChar = this.source[start + keyword.length];
    if (nextChar && (this.isAlphaNumeric(nextChar) || nextChar === '_')) {
      return false;
    }

    return true;
  }

  expectKeyword(keyword) {
    if (!this.checkKeyword(keyword)) {
      throw this.error(`Expected keyword '${keyword}'`);
    }

    for (let i = 0; i < keyword.length; i++) {
      this.consume();
    }
  }

  checkOperator(op) {
    this.skipWhitespaceAndComments();

    for (let i = 0; i < op.length; i++) {
      if (this.source[this.position + i] !== op[i]) {
        return false;
      }
    }

    return true;
  }

  consumeOperator(ops) {
    this.skipWhitespaceAndComments();

    if (Array.isArray(ops)) {
      for (const op of ops) {
        if (this.checkOperator(op)) {
          for (let i = 0; i < op.length; i++) {
            this.consume();
          }
          return op;
        }
      }
      throw this.error(`Expected one of: ${ops.join(', ')}`);
    } else {
      if (!this.checkOperator(ops)) {
        throw this.error(`Expected operator '${ops}'`);
      }
      for (let i = 0; i < ops.length; i++) {
        this.consume();
      }
      return ops;
    }
  }

  isAlpha(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  isAlphaNumeric(ch) {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  error(message) {
    return new Error(`Parse error at line ${this.line}, column ${this.column}: ${message}`);
  }
}

module.exports = { MycelialParser };

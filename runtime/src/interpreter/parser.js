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

    this.skipWhitespaceAndComments();

    // Expect: network NetworkName { ... }
    this.expectKeyword('network');
    const networkName = this.parseIdentifier();
    this.expectChar('{');

    const network = {
      name: networkName,
      frequencies: {},
      hyphae: {},
      spawns: [],
      sockets: [],
      fruitingBodies: [],
      config: {}
    };

    // Parse network sections
    while (!this.checkChar('}')) {
      this.skipWhitespaceAndComments();

      if (this.checkKeyword('frequencies')) {
        this.parseFrequencies(network);
      } else if (this.checkKeyword('types')) {
        this.skipTypesBlock();
      } else if (this.checkKeyword('hyphae')) {
        this.parseHyphae(network);
      } else if (this.checkKeyword('topology')) {
        this.parseTopology(network);
      } else if (this.checkKeyword('config')) {
        this.skipConfigBlock();
      } else {
        break;
      }
    }

    this.expectChar('}');
    return network;
  }

  /**
   * Skip types block (we don't need to parse type definitions for runtime)
   */
  skipTypesBlock() {
    this.expectKeyword('types');
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
      this.skipWhitespaceAndComments();
      if (this.checkChar('}')) break;

      const freqName = this.parseIdentifier();
      this.expectChar('{');

      const fields = [];
      while (!this.checkChar('}')) {
        this.skipWhitespaceAndComments();
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
      this.skipWhitespaceAndComments();
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
      this.skipWhitespaceAndComments();
      if (this.checkChar('}')) break;

      if (this.checkKeyword('state')) {
        this.parseState(hyphal);
      } else if (this.checkKeyword('on')) {
        const handler = this.parseHandler();
        hyphal.handlers.push(handler);
      } else if (this.checkKeyword('rule')) {
        const rule = this.parseRule();
        hyphal.rules.push(rule);
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
      this.skipWhitespaceAndComments();
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
      this.skipWhitespaceAndComments();
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
      this.skipWhitespaceAndComments();
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
      this.skipWhitespaceAndComments();
      if (this.checkChar('}')) break;

      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
    }

    return statements;
  }

  /**
   * Parse single statement
   */
  parseStatement() {
    this.skipWhitespaceAndComments();

    // let variable = expression
    if (this.checkKeyword('let')) {
      this.expectKeyword('let');
      const name = this.parseIdentifier();
      this.expectChar('=');
      const value = this.parseExpression();
      return { type: 'let', name, value };
    }

    // emit frequency { field: value, ... }
    if (this.checkKeyword('emit')) {
      this.expectKeyword('emit');
      const frequency = this.parseIdentifier();
      this.expectChar('{');

      const payload = {};
      while (!this.checkChar('}')) {
        this.skipWhitespaceAndComments();
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
      const condition = this.parseExpression();
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

    // for item in collection { ... }
    if (this.checkKeyword('for')) {
      this.expectKeyword('for');
      const item = this.parseIdentifier();
      this.expectKeyword('in');
      const collection = this.parseExpression();
      this.expectChar('{');
      const body = this.parseStatements();
      this.expectChar('}');
      return { type: 'for', item, collection, body };
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
          this.skipWhitespaceAndComments();
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

        // Convert to state-access if this is the first field and object is a simple identifier
        if (target.type === 'variable') {
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
    let left = this.parseComparison();

    if (this.checkOperator('..')) {
      this.consumeOperator('..');
      const right = this.parseComparison();
      return { type: 'range', start: left, end: right };
    }

    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();

    // Check longer operators first (<=, >=) before shorter ones (<, >)
    while (this.checkOperator('<=') || this.checkOperator('>=') ||
           this.checkOperator('<') || this.checkOperator('>')) {
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

      // Field access: expr.field
      // But NOT range operator: expr..end
      if (this.checkChar('.') && this.source[this.position + 1] !== '.') {
        this.consumeChar('.');
        const field = this.parseIdentifier();
        expr = { type: 'field-access', object: expr, field };
      }
      // Function call: expr(args)
      else if (this.checkChar('(')) {
        this.consumeChar('(');
        const args = [];

        while (!this.checkChar(')')) {
          this.skipWhitespaceAndComments();
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

    // Array literal: [1, 2, 3]
    if (this.checkChar('[')) {
      this.consumeChar('[');
      const elements = [];

      while (!this.checkChar(']')) {
        this.skipWhitespaceAndComments();
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

    // Parenthesized expression
    if (this.checkChar('(')) {
      this.consumeChar('(');
      const expr = this.parseExpression();
      this.expectChar(')');
      return expr;
    }

    // Identifier, function call, or struct literal
    const name = this.parseIdentifier();

    // Check for struct literal: TypeName { field: value, ... }
    // Only parse as struct literal if name starts with uppercase (type convention)
    // and is immediately followed by { without newline
    const savedPos = this.position;
    const savedLine = this.line;
    const savedColumn = this.column;

    // Check if { is on the same line (no newline between identifier and {)
    let hasNewline = false;
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
    // 2. Either: (a) Name starts with uppercase (type convention) OR
    //           (b) Name is lowercase AND next content after { looks like field: value
    //
    // This allows both "Status { ... }" and "status { ... }" for report statements
    if (!hasNewline && this.checkChar('{')) {
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
          this.skipWhitespaceAndComments();
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

    while (this.isDigit(this.peek()) || (this.peek() === '.' && !hasDot && this.isDigit(this.source[this.position + 1]))) {
      if (this.peek() === '.') {
        hasDot = true;
      }
      num += this.consume();
    }

    const value = num.includes('.') ? parseFloat(num) : parseInt(num);
    return { type: 'literal', value };
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

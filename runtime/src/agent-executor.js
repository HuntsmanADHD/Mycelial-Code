/**
 * Mycelial Agent Executor
 *
 * Executes individual agent state machines (hyphae).
 * Manages agent state, processes incoming signals, executes rules, and emits outgoing signals.
 *
 * @author Claude Opus 4.5
 * @date 2026-01-01
 */

const { OrchestrationParser } = require('./orchestration-parser');

/**
 * AgentInstance - Represents a running instance of a hyphal agent
 */
class AgentInstance {
  /**
   * Create a new agent instance
   * @param {string} hyphalType - The type of hyphal (agent class)
   * @param {string} instanceId - Unique instance identifier
   * @param {Object} hyphalDefinition - The hyphal definition from parser
   */
  constructor(hyphalType, instanceId, hyphalDefinition) {
    this.hyphalType = hyphalType;
    this.instanceId = instanceId;
    this.definition = hyphalDefinition;
    this.state = {};
    this.outgoingSignals = [];
    this.initialized = false;
  }

  /**
   * Initialize the agent with default state values
   * @param {Object} typeDefinitions - Type definitions (enums, structs) from network
   */
  initialize(typeDefinitions = {}) {
    if (this.initialized) {
      throw new Error(`Agent ${this.instanceId} is already initialized`);
    }

    // Initialize state with type-based defaults
    for (const [fieldName, fieldType] of Object.entries(this.definition.state)) {
      this.state[fieldName] = OrchestrationParser.getDefaultValue(fieldType);
    }

    this.initialized = true;

    // Execute "on rest" rules
    this.executeRestRules();
  }

  /**
   * Execute "on rest" initialization rules
   */
  executeRestRules() {
    const restRules = this.definition.rules.filter(rule => rule.type === 'on_rest');

    for (const rule of restRules) {
      try {
        this.executeRuleBody(rule.body, {});
      } catch (error) {
        throw new Error(`Error executing on_rest rule in ${this.instanceId}: ${error.message}`);
      }
    }
  }

  /**
   * Process an incoming signal
   * @param {Object} signal - The signal to process
   * @returns {Array} List of emitted signals
   */
  processSignal(signal) {
    if (!this.initialized) {
      throw new Error(`Agent ${this.instanceId} is not initialized`);
    }

    if (!signal || !signal.frequency) {
      throw new Error('Invalid signal: missing frequency');
    }

    // Clear outgoing signal queue
    this.outgoingSignals = [];

    // Find matching rules
    const matchingRules = this.definition.rules.filter(rule => {
      if (rule.type !== 'on_signal') return false;
      if (rule.trigger !== signal.frequency) return false;

      // Check condition if present
      if (rule.condition) {
        return this.evaluateCondition(rule.condition, signal.payload || {});
      }

      return true;
    });

    // Execute matching rules
    for (const rule of matchingRules) {
      try {
        const context = {
          [rule.paramName]: signal.payload || {}
        };
        this.executeRuleBody(rule.body, context);
      } catch (error) {
        console.error(`Error executing rule in ${this.instanceId}:`, error);
        throw error;
      }
    }

    // Return emitted signals and clear queue
    const emitted = [...this.outgoingSignals];
    this.outgoingSignals = [];
    return emitted;
  }

  /**
   * Execute a cycle (periodic execution)
   * @returns {Array} List of emitted signals
   */
  executeCycle() {
    if (!this.initialized) {
      throw new Error(`Agent ${this.instanceId} is not initialized`);
    }

    this.outgoingSignals = [];

    const cycleRules = this.definition.rules.filter(rule => rule.type === 'on_cycle');

    for (const rule of cycleRules) {
      try {
        this.executeRuleBody(rule.body, {});
      } catch (error) {
        console.error(`Error executing cycle rule in ${this.instanceId}:`, error);
        throw error;
      }
    }

    const emitted = [...this.outgoingSignals];
    this.outgoingSignals = [];
    return emitted;
  }

  /**
   * Emit a signal
   * @param {string} frequency - Signal frequency (type)
   * @param {Object} payload - Signal payload
   */
  emit(frequency, payload) {
    this.outgoingSignals.push({
      frequency,
      payload,
      source: this.instanceId
    });
  }

  /**
   * Get current state snapshot
   * @returns {Object} Copy of current state
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Set state (for testing/debugging)
   * @param {Object} newState - New state values
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
  }

  /**
   * Evaluate a condition expression
   * @param {string} condition - Condition expression
   * @param {Object} context - Variable context
   * @returns {boolean} Evaluation result
   */
  evaluateCondition(condition, context) {
    // Simple expression evaluation (basic support)
    try {
      const evalContext = { ...context, state: this.state };
      // This is a simplified implementation
      // In production, use a proper expression evaluator
      return eval(condition);
    } catch (error) {
      console.error(`Condition evaluation failed: ${condition}`, error);
      return false;
    }
  }

  /**
   * Execute a rule body
   * @param {string} ruleBody - The rule body code
   * @param {Object} context - Variable context
   */
  executeRuleBody(ruleBody, context) {
    // Parse and execute statements in the rule body
    const statements = this.parseStatements(ruleBody);

    for (const stmt of statements) {
      this.executeStatement(stmt, context);
    }
  }

  /**
   * Parse statements from rule body
   * @param {string} body - Rule body text
   * @returns {Array} List of statement objects
   */
  parseStatements(body) {
    const statements = [];
    const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Check let first (before assignment check)
      if (line.startsWith('let ')) {
        statements.push({ type: 'let', line });
        i++;
      } else if (line.startsWith('emit ')) {
        // Handle multi-line emit statements
        let emitLine = line;
        let braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

        while (braceCount > 0 && i + 1 < lines.length) {
          i++;
          emitLine += ' ' + lines[i];
          braceCount += (lines[i].match(/\{/g) || []).length;
          braceCount -= (lines[i].match(/\}/g) || []).length;
        }

        statements.push({ type: 'emit', line: emitLine });
        i++;
      } else if (line.startsWith('if ')) {
        statements.push({ type: 'if', line });
        i++;
      } else if (line.startsWith('while ')) {
        statements.push({ type: 'while', line });
        i++;
      } else if (line.startsWith('for ')) {
        statements.push({ type: 'for', line });
        i++;
      } else if (line.includes('=') && !line.includes('==') && !line.includes('!=') && !line.includes('<=') && !line.includes('>=')) {
        statements.push({ type: 'assignment', line });
        i++;
      } else if (line.match(/^\w+\(/)) {
        statements.push({ type: 'function_call', line });
        i++;
      } else {
        i++;
      }
    }

    return statements;
  }

  /**
   * Execute a single statement
   * @param {Object} stmt - Statement object
   * @param {Object} context - Variable context
   */
  executeStatement(stmt, context) {
    switch (stmt.type) {
      case 'assignment':
        this.executeAssignment(stmt.line, context);
        break;

      case 'emit':
        this.executeEmit(stmt.line, context);
        break;

      case 'let':
        this.executeLetStatement(stmt.line, context);
        break;

      case 'function_call':
        this.executeFunctionCall(stmt.line, context);
        break;

      case 'if':
      case 'while':
      case 'for':
        // These require block parsing - simplified for now
        break;

      default:
        console.warn(`Unknown statement type: ${stmt.type}`);
    }
  }

  /**
   * Execute assignment statement
   * @param {string} line - Assignment line
   * @param {Object} context - Variable context
   */
  executeAssignment(line, context) {
    const match = line.match(/(\w+(?:\.\w+)*)\s*=\s*(.+)/);
    if (!match) {
      console.warn(`Failed to parse assignment: ${line}`);
      return;
    }

    const target = match[1];
    const expression = match[2].trim();

    const value = this.evaluateExpression(expression, context);

    // Handle state assignments
    if (target.startsWith('state.')) {
      const field = target.substring(6);
      this.state[field] = value;
    } else {
      // Local variable assignment
      context[target] = value;
    }
  }

  /**
   * Execute let statement
   * @param {string} line - Let statement
   * @param {Object} context - Variable context
   */
  executeLetStatement(line, context) {
    const match = line.match(/let\s+(\w+)\s*=\s*(.+)/);
    if (!match) return;

    const varName = match[1];
    const expression = match[2].trim();

    const value = this.evaluateExpression(expression, context);
    context[varName] = value;
  }

  /**
   * Execute emit statement
   * @param {string} line - Emit statement
   * @param {Object} context - Variable context
   */
  executeEmit(line, context) {
    // Parse: emit frequency_name { field1: value1, field2: value2 }
    const match = line.match(/emit\s+(\w+)\s*\{([^}]*)\}/);
    if (!match) return;

    const frequency = match[1];
    const fieldsBlock = match[2];

    const payload = {};

    // Parse field assignments
    const fieldRegex = /(\w+)\s*:\s*([^,]+)/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(fieldsBlock)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldExpr = fieldMatch[2].trim();
      payload[fieldName] = this.evaluateExpression(fieldExpr, context);
    }

    this.emit(frequency, payload);
  }

  /**
   * Execute function call
   * @param {string} line - Function call line
   * @param {Object} context - Variable context
   * @returns {*} Return value
   */
  executeFunctionCall(line, context) {
    const match = line.match(/(\w+)\(([^)]*)\)/);
    if (!match) return null;

    const funcName = match[1];
    const argsStr = match[2];

    // Parse arguments
    const args = argsStr
      .split(',')
      .map(arg => this.evaluateExpression(arg.trim(), context))
      .filter(arg => arg !== undefined);

    return this.callBuiltinFunction(funcName, args, context);
  }

  /**
   * Evaluate an expression
   * @param {string} expr - Expression to evaluate
   * @param {Object} context - Variable context
   * @returns {*} Evaluated value
   */
  evaluateExpression(expr, context) {
    expr = expr.trim();

    // Remove trailing comma if present
    if (expr.endsWith(',')) {
      expr = expr.slice(0, -1).trim();
    }

    // String literals
    if (expr.startsWith('"') && expr.endsWith('"')) {
      return expr.slice(1, -1);
    }

    if (expr.startsWith("'") && expr.endsWith("'")) {
      return expr.slice(1, -1);
    }

    // Number literals
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return parseFloat(expr);
    }

    // Boolean literals
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    // Function calls
    if (expr.includes('(') && expr.includes(')')) {
      return this.executeFunctionCall(expr, context);
    }

    // Binary operations - handle simple arithmetic
    if (expr.match(/[\+\-\*\/]/) && !expr.startsWith('"') && !expr.startsWith("'")) {
      return this.evaluateArithmetic(expr, context);
    }

    // Variable references
    if (expr.startsWith('state.')) {
      const field = expr.substring(6);
      return this.state[field];
    }

    if (context[expr] !== undefined) {
      return context[expr];
    }

    // Field access (e.g., req.field_name)
    if (expr.includes('.')) {
      const parts = expr.split('.');
      let value = context[parts[0]] || this.state;

      for (let i = 1; i < parts.length; i++) {
        if (value && typeof value === 'object') {
          value = value[parts[i]];
        } else {
          return undefined;
        }
      }

      return value;
    }

    return undefined;
  }

  /**
   * Evaluate arithmetic expression
   * @param {string} expr - Arithmetic expression
   * @param {Object} context - Variable context
   * @returns {number} Result
   */
  evaluateArithmetic(expr, context) {
    // Replace state.field and context variables with their values
    let evalExpr = expr;

    // Replace state.field references
    const stateMatches = expr.match(/state\.\w+/g);
    if (stateMatches) {
      for (const match of stateMatches) {
        const field = match.substring(6);
        const value = this.state[field] || 0;
        evalExpr = evalExpr.replace(match, String(value));
      }
    }

    // Replace context variables
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      if (typeof value === 'number') {
        evalExpr = evalExpr.replace(regex, String(value));
      }
    }

    try {
      // Safe evaluation of arithmetic
      return eval(evalExpr);
    } catch (error) {
      console.error(`Arithmetic evaluation failed: ${expr}`, error);
      return undefined;
    }
  }

  /**
   * Call a built-in function
   * @param {string} funcName - Function name
   * @param {Array} args - Arguments
   * @param {Object} context - Variable context
   * @returns {*} Return value
   */
  callBuiltinFunction(funcName, args, context) {
    switch (funcName) {
      // String operations
      case 'string_concat':
        return (args[0] || '') + (args[1] || '');

      case 'string_len':
        return (args[0] || '').length;

      case 'string_char_at':
        return (args[0] || '')[args[1]] || '';

      case 'format':
        // Simple format implementation
        return this.formatString(args[0], args.slice(1));

      // Vector operations
      case 'vec_new':
        return [];

      case 'vec_push':
        if (Array.isArray(args[0])) {
          args[0].push(args[1]);
        }
        return args[0];

      case 'vec_len':
        return Array.isArray(args[0]) ? args[0].length : 0;

      case 'vec_get':
        return Array.isArray(args[0]) ? args[0][args[1]] : undefined;

      // Map operations
      case 'map_new':
        return new Map();

      case 'map_insert':
        if (args[0] instanceof Map) {
          args[0].set(args[1], args[2]);
        }
        return args[0];

      case 'map_get':
        return args[0] instanceof Map ? args[0].get(args[1]) : undefined;

      case 'map_contains':
        return args[0] instanceof Map ? args[0].has(args[1]) : false;

      case 'map_get_or_default':
        if (args[0] instanceof Map) {
          return args[0].has(args[1]) ? args[0].get(args[1]) : args[2];
        }
        return args[2];

      // Queue operations
      case 'queue_new':
        return [];

      case 'queue_push':
        if (Array.isArray(args[0])) {
          args[0].push(args[1]);
        }
        return args[0];

      case 'queue_pop':
        return Array.isArray(args[0]) ? args[0].shift() : undefined;

      // Utility functions (stubs for Phase 3)
      case 'time_now':
        return Date.now();

      case 'read_file':
        // Stub - will be implemented in Phase 3
        console.warn('read_file not yet implemented');
        return '';

      case 'json_encode':
        return JSON.stringify(args[0]);

      case 'json_decode':
        try {
          return JSON.parse(args[0]);
        } catch {
          return null;
        }

      case 'hex_decode':
        // Stub - will be implemented in Phase 3
        return new Uint8Array(0);

      default:
        console.warn(`Unknown function: ${funcName}`);
        return undefined;
    }
  }

  /**
   * Format a string with arguments
   * @param {string} template - Format template
   * @param {Array} args - Arguments
   * @returns {string} Formatted string
   */
  formatString(template, args) {
    if (!template) return '';

    let result = template;
    let argIndex = 0;

    // Replace {} placeholders
    result = result.replace(/\{\}/g, () => {
      return argIndex < args.length ? String(args[argIndex++]) : '{}';
    });

    // Replace {:X} hex format
    result = result.replace(/\{:X\}/g, () => {
      const value = argIndex < args.length ? args[argIndex++] : 0;
      return typeof value === 'number' ? value.toString(16).toUpperCase() : String(value);
    });

    return result;
  }
}

module.exports = { AgentInstance };

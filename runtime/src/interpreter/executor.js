/**
 * Mycelial Executor
 *
 * Executes Mycelial programs by:
 * - Creating agent instances from network definitions
 * - Managing agent state and signal queues
 * - Evaluating expressions and executing statements
 * - Routing signals between agents
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

const { SignalRouter } = require('./signal-router.js');
const fs = require('fs');

class MycelialExecutor {
  constructor(network, parser) {
    this.network = network;          // Parsed network definition
    this.parser = parser;             // Parser for additional parsing needs
    this.agents = {};                 // Active agent instances { id: agent }
    this.frequencies = {};            // Frequency definitions { name: def }
    this.signalQueues = {};           // Signal queues { agentId: [signals] }
    this.signalRouter = null;         // Signal router
    this.outputs = [];                // Collected outputs (reports, emissions)
    this.reports = {};                // Reports by agent
  }

  /**
   * Initialize the executor: create agents, set up routing
   */
  initialize() {
    // 1. Register frequencies
    for (const [name, def] of Object.entries(this.network.frequencies)) {
      this.frequencies[name] = def;
    }

    // 2. Create agent instances from spawns
    for (const spawn of this.network.spawns) {
      this.createAgent(spawn.instanceId, spawn.hyphalType);
    }

    // 3. Set up signal router
    this.signalRouter = new SignalRouter(this.network.sockets);

    // 4. Create signal queues for all agents
    for (const agentId of Object.keys(this.agents)) {
      this.signalQueues[agentId] = [];
      this.reports[agentId] = {};
    }

    // 5. Add fruiting body placeholders
    for (const fbName of this.network.fruitingBodies) {
      this.signalQueues[fbName] = [];
    }
  }

  /**
   * Create an agent instance
   */
  createAgent(instanceId, hyphalType) {
    const hyphalDef = this.network.hyphae[hyphalType];
    if (!hyphalDef) {
      throw new Error(`Unknown hyphal type: ${hyphalType}`);
    }

    const agent = {
      id: instanceId,
      type: hyphalType,
      state: {},
      handlers: hyphalDef.handlers,
      rules: hyphalDef.rules || []
    };

    // Initialize state with defaults
    for (const field of hyphalDef.state) {
      if (field.default !== null) {
        // Evaluate default value
        agent.state[field.name] = this.evaluateExpression(agent, field.default, {});
      } else {
        agent.state[field.name] = this.defaultValue(field.type);
      }
    }

    this.agents[instanceId] = agent;
  }

  /**
   * Get default value for a type
   */
  defaultValue(type) {
    if (type.startsWith('vec<')) {
      return [];
    }

    if (type.startsWith('map<')) {
      return new Map();
    }

    const defaults = {
      'u8': 0,
      'u16': 0,
      'u32': 0,
      'u64': 0n,
      'i8': 0,
      'i16': 0,
      'i32': 0,
      'i64': 0n,
      'boolean': false,
      'bool': false,
      'string': '',
      'f32': 0.0,
      'f64': 0.0
    };

    return defaults[type] !== undefined ? defaults[type] : null;
  }

  /**
   * Emit a signal from an agent
   */
  emitSignal(sourceAgentId, frequency, payload) {
    const signal = {
      frequency: frequency,
      sourceAgentId: sourceAgentId,
      payload: payload,
      timestamp: Date.now()
    };

    // Route to destinations
    const destinations = this.signalRouter.getDestinations(sourceAgentId, frequency);

    // Enqueue in each destination's queue
    for (const destId of destinations) {
      if (this.signalQueues[destId]) {
        this.signalQueues[destId].push(signal);
      }
    }

    // Track output emissions
    this.outputs.push({
      type: 'emit',
      from: sourceAgentId,
      frequency: frequency,
      payload: payload
    });
  }

  /**
   * Handle a signal for an agent
   */
  handleSignal(agentId, signal) {
    const agent = this.agents[agentId];
    if (!agent) {
      return; // Might be a fruiting body
    }

    // Find matching handler
    const handler = agent.handlers.find(
      h => h.type === 'signal' && h.frequency === signal.frequency
    );

    if (!handler) {
      return; // No handler for this frequency
    }

    // Check guard condition if present
    if (handler.guard) {
      const binding = { [handler.binding]: signal.payload };
      const guardResult = this.evaluateExpression(agent, handler.guard, binding);
      if (!guardResult) {
        return; // Guard failed
      }
    }

    // Execute handler body with signal binding
    const context = { [handler.binding]: signal.payload };
    this.executeStatements(agent, handler.body, context);
  }

  /**
   * Execute rest handlers for all agents
   */
  executeRestHandlers() {
    for (const agent of Object.values(this.agents)) {
      const restHandlers = agent.handlers.filter(h => h.type === 'rest');
      for (const handler of restHandlers) {
        this.executeStatements(agent, handler.body, {});
      }
    }
  }

  /**
   * Execute a list of statements
   */
  executeStatements(agent, statements, context) {
    for (const stmt of statements) {
      const result = this.executeStatement(agent, stmt, context);
      if (result && result.type === 'return') {
        return result.value;
      }
    }
  }

  /**
   * Execute a single statement
   */
  executeStatement(agent, stmt, context) {
    switch (stmt.type) {
      case 'let': {
        // let x = value
        const value = this.evaluateExpression(agent, stmt.value, context);
        context[stmt.name] = value;
        break;
      }

      case 'assignment': {
        // x = value or state.field = value
        const value = this.evaluateExpression(agent, stmt.value, context);

        if (stmt.target.type === 'state-access') {
          agent.state[stmt.target.field] = value;
        } else if (stmt.target.type === 'variable') {
          if (context.hasOwnProperty(stmt.target.name)) {
            context[stmt.target.name] = value;
          } else if (agent.state.hasOwnProperty(stmt.target.name)) {
            agent.state[stmt.target.name] = value;
          } else {
            context[stmt.target.name] = value;
          }
        }
        break;
      }

      case 'emit': {
        // emit frequency { field: value, ... }
        const payload = {};
        for (const [key, valExpr] of Object.entries(stmt.payload)) {
          payload[key] = this.evaluateExpression(agent, valExpr, context);
        }
        this.emitSignal(agent.id, stmt.frequency, payload);
        break;
      }

      case 'if': {
        // if condition { ... } else { ... }
        const condition = this.evaluateExpression(agent, stmt.condition, context);
        if (condition) {
          const result = this.executeStatements(agent, stmt.body, context);
          if (result !== undefined) {
            return { type: 'return', value: result };
          }
        } else if (stmt.else) {
          const result = this.executeStatements(agent, stmt.else, context);
          if (result !== undefined) {
            return { type: 'return', value: result };
          }
        }
        break;
      }

      case 'for': {
        // for item in collection { ... }
        const collection = this.evaluateExpression(agent, stmt.collection, context);
        if (Array.isArray(collection)) {
          for (const item of collection) {
            const loopContext = { ...context, [stmt.item]: item };
            const result = this.executeStatements(agent, stmt.body, loopContext);
            if (result !== undefined) {
              return { type: 'return', value: result };
            }
          }
        }
        break;
      }

      case 'for-kv': {
        // for key, value in map { ... }
        const collection = this.evaluateExpression(agent, stmt.collection, context);
        if (collection instanceof Map) {
          for (const [key, value] of collection.entries()) {
            const loopContext = { ...context, [stmt.key]: key, [stmt.value]: value };
            const result = this.executeStatements(agent, stmt.body, loopContext);
            if (result !== undefined) {
              return { type: 'return', value: result };
            }
          }
        } else if (typeof collection === 'object' && collection !== null) {
          // Also support plain objects
          for (const [key, value] of Object.entries(collection)) {
            const loopContext = { ...context, [stmt.key]: key, [stmt.value]: value };
            const result = this.executeStatements(agent, stmt.body, loopContext);
            if (result !== undefined) {
              return { type: 'return', value: result };
            }
          }
        }
        break;
      }

      case 'while': {
        // while condition { ... }
        while (this.evaluateExpression(agent, stmt.condition, context)) {
          const result = this.executeStatements(agent, stmt.body, context);
          if (result !== undefined) {
            return { type: 'return', value: result };
          }
        }
        break;
      }

      case 'match': {
        // match value { pattern => { body }, ... }
        const value = this.evaluateExpression(agent, stmt.value, context);

        for (const arm of stmt.arms) {
          // Check if any pattern matches
          let matched = false;
          let patternContext = { ...context };

          for (const pattern of arm.patterns) {
            // Handle tuple pattern: (pattern1, pattern2, ...)
            if (pattern.type === 'tuple-pattern') {
              // Check if value is an array with matching length
              if (Array.isArray(value) && value.length === pattern.patterns.length) {
                matched = true;

                // Try to match each sub-pattern
                for (let i = 0; i < pattern.patterns.length; i++) {
                  const subPattern = pattern.patterns[i];
                  const subValue = value[i];

                  // Handle enum pattern in tuple
                  if (subPattern.type === 'enum-pattern') {
                    if (!subValue || typeof subValue !== 'object' ||
                        subValue.variant !== subPattern.variant ||
                        subValue.enumType !== subPattern.enumType) {
                      matched = false;
                      break;
                    }

                    // Bind variables from enum pattern
                    if (subPattern.bindings && subPattern.bindings.length > 0) {
                      patternContext[subPattern.bindings[0]] = subValue.payload || subValue.data || subValue;
                    }
                  } else {
                    // Simple sub-pattern - just compare
                    const subPatternValue = this.evaluateExpression(agent, subPattern, patternContext);
                    if (subValue !== subPatternValue) {
                      matched = false;
                      break;
                    }
                  }
                }

                if (matched) break;
              }
            }
            // Handle enum pattern with bindings: EnumVariant(binding1, binding2)
            else if (pattern.type === 'enum-pattern') {
              // Check if value matches the enum variant
              if (value && typeof value === 'object' &&
                  value.variant === pattern.variant &&
                  value.enumType === pattern.enumType) {
                matched = true;

                // Bind the payload to variables
                if (pattern.bindings && pattern.bindings.length > 0) {
                  // For now, assume single binding gets the whole payload
                  patternContext[pattern.bindings[0]] = value.payload || value.data || value;
                }

                break;
              }
            } else {
              // Simple pattern - evaluate and compare
              const patternValue = this.evaluateExpression(agent, pattern, patternContext);

              if (value === patternValue || String(value) === String(patternValue)) {
                matched = true;
                break;
              }
            }
          }

          if (matched) {
            const result = this.executeStatements(agent, arm.body, patternContext);
            if (result !== undefined) {
              return { type: 'return', value: result };
            }
            break; // Only execute first matching arm
          }
        }
        break;
      }

      case 'report': {
        // report name: value
        const value = this.evaluateExpression(agent, stmt.value, context);
        this.reports[agent.id][stmt.name] = value;
        this.outputs.push({
          type: 'report',
          from: agent.id,
          name: stmt.name,
          value: value
        });
        break;
      }

      case 'return': {
        // return expression
        const value = this.evaluateExpression(agent, stmt.value, context);
        return { type: 'return', value };
      }

      case 'expression-statement': {
        // Standalone expression (usually function call)
        this.evaluateExpression(agent, stmt.expression, context);
        break;
      }

      default:
        throw new Error(`Unknown statement type: ${stmt.type}`);
    }
  }

  /**
   * Evaluate an expression
   */
  evaluateExpression(agent, expr, context) {
    switch (expr.type) {
      case 'literal':
        return expr.value;

      case 'variable': {
        // Special case: 'state' refers to agent state object
        if (expr.name === 'state' && agent && agent.state) {
          return agent.state;
        }
        // Check context first, then agent state
        if (context.hasOwnProperty(expr.name)) {
          return context[expr.name];
        }
        if (agent && agent.state && agent.state.hasOwnProperty(expr.name)) {
          return agent.state[expr.name];
        }
        throw new Error(`Undefined variable: ${expr.name}`);
      }

      case 'binary': {
        const left = this.evaluateExpression(agent, expr.left, context);
        const right = this.evaluateExpression(agent, expr.right, context);
        return this.applyBinaryOp(expr.op, left, right);
      }

      case 'unary': {
        const operand = this.evaluateExpression(agent, expr.operand, context);
        return this.applyUnaryOp(expr.op, operand);
      }

      case 'field-access': {
        const obj = this.evaluateExpression(agent, expr.object, context);
        if (obj === null || obj === undefined) {
          throw new Error(`Cannot access field '${expr.field}' on null/undefined`);
        }
        return obj[expr.field];
      }

      case 'array-access': {
        const arr = this.evaluateExpression(agent, expr.object, context);
        const index = this.evaluateExpression(agent, expr.index, context);
        return arr[index];
      }

      case 'function-call': {
        return this.callFunction(expr.name, expr.args, agent, context);
      }

      case 'array-literal': {
        return expr.elements.map(el => this.evaluateExpression(agent, el, context));
      }

      case 'map-literal': {
        // For now, only support empty map literals
        // Return a JavaScript Map object
        return new Map();
      }

      case 'struct-literal': {
        // Evaluate all field values and return as plain object
        const obj = {};
        for (const [key, valExpr] of Object.entries(expr.fields)) {
          obj[key] = this.evaluateExpression(agent, valExpr, context);
        }
        return obj;
      }

      case 'function-literal': {
        // Return a closure that captures the current context
        const capturedAgent = agent;
        const capturedContext = { ...context };
        const functionExpr = expr;

        return (...args) => {
          // Create new context with parameters bound to arguments
          const fnContext = { ...capturedContext };
          for (let i = 0; i < functionExpr.params.length; i++) {
            fnContext[functionExpr.params[i].name] = args[i];
          }

          // Execute function body
          const result = this.executeStatements(capturedAgent, functionExpr.body, fnContext);

          // If body contains return statement, extract the value
          if (result && result.type === 'return') {
            return result.value;
          }

          return result;
        };
      }

      case 'tuple-expression': {
        // Evaluate all tuple elements and return as array
        return expr.elements.map(elem => this.evaluateExpression(agent, elem, context));
      }

      case 'type-cast': {
        // Evaluate the expression and perform type conversion
        const value = this.evaluateExpression(agent, expr.expression, context);
        const targetType = expr.targetType;

        // For primitive types, perform conversions
        if (targetType === 'u8' || targetType === 'i8' ||
            targetType === 'u16' || targetType === 'i16' ||
            targetType === 'u32' || targetType === 'i32' ||
            targetType === 'u64' || targetType === 'i64') {
          return Number(value) | 0; // Convert to integer
        } else if (targetType === 'f32' || targetType === 'f64') {
          return Number(value); // Convert to float
        } else if (targetType === 'bool' || targetType === 'boolean') {
          return Boolean(value);
        } else if (targetType === 'string') {
          return String(value);
        }

        // For other types, just return the value as-is (JavaScript is dynamically typed)
        return value;
      }

      default:
        throw new Error(`Unknown expression type: ${expr.type}`);
    }
  }

  /**
   * Apply binary operator
   */
  applyBinaryOp(op, left, right) {
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case '%': return left % right;
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      case '&&': return left && right;
      case '||': return left || right;
      case '|': return left | right;
      case '&': return left & right;
      case '^': return left ^ right;
      case '<<': return left << right;
      case '>>': return left >> right;
      default:
        throw new Error(`Unknown binary operator: ${op}`);
    }
  }

  /**
   * Apply unary operator
   */
  applyUnaryOp(op, operand) {
    switch (op) {
      case '-': return -operand;
      case '!': return !operand;
      default:
        throw new Error(`Unknown unary operator: ${op}`);
    }
  }

  /**
   * Call a built-in function or rule
   */
  callFunction(name, argExprs, agent, context) {
    // Check if it's a rule first
    if (agent && agent.rules) {
      const rule = agent.rules.find(r => r.name === name);
      if (rule) {
        return this.callRule(agent, rule, argExprs, context);
      }
    }

    const args = argExprs.map(arg => this.evaluateExpression(agent, arg, context));

    switch (name) {
      // Vector functions
      case 'vec_new': {
        return [];
      }

      case 'vec_push': {
        const vec = args[0];
        const value = args[1];
        vec.push(value);
        return undefined;
      }

      case 'vec_pop': {
        const vec = args[0];
        return vec.pop();
      }

      case 'vec_get': {
        const vec = args[0];
        const index = args[1];
        return vec[index];
      }

      case 'vec_set': {
        const vec = args[0];
        const index = args[1];
        const value = args[2];
        vec[index] = value;
        return undefined;
      }

      case 'vec_len': {
        const vec = args[0];
        return vec.length;
      }

      case 'vec_clear': {
        const vec = args[0];
        vec.length = 0;
        return undefined;
      }

      // String functions
      case 'string_len':
      case 'len': {
        const val = args[0];
        if (typeof val === 'string') {
          return val.length;
        }
        if (Array.isArray(val)) {
          return val.length;
        }
        if (val instanceof Map) {
          return val.size;
        }
        return 0;
      }

      case 'string_concat': {
        return args.join('');
      }

      case 'string_slice': {
        const str = args[0];
        const start = args[1];
        const end = args[2];
        return str.slice(start, end);
      }

      case 'string_index_of': {
        const str = args[0];
        const substr = args[1];
        return str.indexOf(substr);
      }

      case 'string_char_at': {
        const str = args[0];
        const index = args[1];
        return str.charAt(index);
      }

      case 'format': {
        const template = args[0];
        let result = template;
        // Support both {} and {0}, {1}, etc.
        for (let i = 1; i < args.length; i++) {
          // Try indexed placeholders first
          result = result.replace(`{${i-1}}`, String(args[i]));
          // Then try non-indexed
          result = result.replace('{}', String(args[i]));
        }
        return result;
      }

      // Map functions
      case 'map_new': {
        return new Map();
      }

      case 'map_insert': {
        const map = args[0];
        const key = args[1];
        const value = args[2];
        if (map instanceof Map) {
          map.set(key, value);
        }
        return undefined;
      }

      case 'map_get': {
        const map = args[0];
        const key = args[1];
        if (map instanceof Map) {
          return map.get(key);
        }
        return undefined;
      }

      case 'map_has': {
        const map = args[0];
        const key = args[1];
        if (map instanceof Map) {
          return map.has(key);
        }
        return false;
      }

      case 'map_remove': {
        const map = args[0];
        const key = args[1];
        if (map instanceof Map) {
          map.delete(key);
        }
        return undefined;
      }

      case 'map_keys': {
        const map = args[0];
        if (map instanceof Map) {
          return Array.from(map.keys());
        }
        return [];
      }

      case 'map_values': {
        const map = args[0];
        if (map instanceof Map) {
          return Array.from(map.values());
        }
        return [];
      }

      // Time functions
      case 'time_now': {
        return Date.now();
      }

      // File I/O functions
      case 'read_file': {
        const path = args[0];
        try {
          return fs.readFileSync(path, 'utf8');
        } catch (error) {
          throw new Error(`Failed to read file ${path}: ${error.message}`);
        }
      }

      case 'write_file': {
        const path = args[0];
        const contents = args[1];
        try {
          fs.writeFileSync(path, contents, 'utf8');
          return undefined;
        } catch (error) {
          throw new Error(`Failed to write file ${path}: ${error.message}`);
        }
      }

      case 'file_exists': {
        const path = args[0];
        try {
          return fs.existsSync(path);
        } catch (error) {
          return false;
        }
      }

      // Math functions
      case 'abs': {
        return Math.abs(args[0]);
      }

      case 'min': {
        return Math.min(...args);
      }

      case 'max': {
        return Math.max(...args);
      }

      case 'pow': {
        return Math.pow(args[0], args[1]);
      }

      // Type conversions
      case 'to_string': {
        return String(args[0]);
      }

      case 'to_int': {
        return parseInt(args[0]);
      }

      case 'to_float': {
        return parseFloat(args[0]);
      }

      // Debug/utility
      case 'print': {
        console.log(...args);
        return undefined;
      }

      case 'debug': {
        console.log('[DEBUG]', ...args);
        return undefined;
      }

      // Placeholder for complex functions that need implementation
      case 'compute': {
        // Simple computation for testing
        const input = args[0];
        if (typeof input === 'string') {
          return input.length;
        }
        return 0;
      }

      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  /**
   * Call a rule (internal function)
   */
  callRule(agent, rule, argExprs, context) {
    // Evaluate arguments
    const args = argExprs.map(arg => this.evaluateExpression(agent, arg, context));

    // Create a new context with parameters bound to arguments
    const ruleContext = { ...context };
    for (let i = 0; i < rule.params.length; i++) {
      ruleContext[rule.params[i].name] = args[i] || null;
    }

    // Execute the rule body
    const result = this.executeStatements(agent, rule.body, ruleContext);

    // Return the result (or undefined if no return statement)
    return result !== undefined ? result : undefined;
  }

  /**
   * Get output results
   */
  getOutput() {
    return {
      outputs: this.outputs,
      reports: this.reports,
      agents: Object.keys(this.agents).map(id => ({
        id,
        type: this.agents[id].type,
        state: this.agents[id].state
      }))
    };
  }

  /**
   * Get signals queued for a specific fruiting body
   */
  getFruitingBodyOutput(name) {
    if (!this.signalQueues[name]) {
      return [];
    }
    return this.signalQueues[name];
  }
}

module.exports = { MycelialExecutor };

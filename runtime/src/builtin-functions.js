/**
 * Mycelial Builtin Functions - Phase 3
 *
 * Comprehensive library of 55+ builtin functions for agent execution environment.
 * Organized into 7 categories with full error handling and edge case support.
 *
 * @author Claude Opus 4.5
 * @date 2026-01-01
 */

class BuiltinFunctions {

  // ============================================================================
  // STRING OPERATIONS (12 functions)
  // ============================================================================

  /**
   * Get length of string
   * @param {*} s - String input (coerced if not string)
   * @returns {number} Length of string
   */
  static string_len(s) {
    const str = s === null || s === undefined ? '' : String(s);
    return str.length;
  }

  /**
   * Concatenate two strings
   * @param {*} s1 - First string (coerced)
   * @param {*} s2 - Second string (coerced)
   * @returns {string} Concatenated string
   */
  static string_concat(s1, s2) {
    const str1 = s1 === null || s1 === undefined ? '' : String(s1);
    const str2 = s2 === null || s2 === undefined ? '' : String(s2);
    return str1 + str2;
  }

  /**
   * Extract substring from string
   * @param {string} s - Source string
   * @param {number} start - Start index (inclusive)
   * @param {number} end - End index (exclusive)
   * @returns {string} Substring
   */
  static string_slice(s, start, end) {
    const str = s === null || s === undefined ? '' : String(s);
    const startIdx = Math.max(0, Math.floor(start));
    const endIdx = end === undefined ? str.length : Math.floor(end);
    return str.slice(startIdx, endIdx);
  }

  /**
   * Check if two strings are equal
   * @param {*} s1 - First string
   * @param {*} s2 - Second string
   * @returns {boolean} True if equal
   */
  static string_equals(s1, s2) {
    const str1 = s1 === null || s1 === undefined ? '' : String(s1);
    const str2 = s2 === null || s2 === undefined ? '' : String(s2);
    return str1 === str2;
  }

  /**
   * Check if string contains substring
   * @param {string} s - Source string
   * @param {string} substring - Substring to search for
   * @returns {boolean} True if contains
   */
  static string_contains(s, substring) {
    const str = s === null || s === undefined ? '' : String(s);
    const sub = substring === null || substring === undefined ? '' : String(substring);
    return str.includes(sub);
  }

  /**
   * Split string by delimiter
   * @param {string} s - Source string
   * @param {string} delimiter - Delimiter
   * @returns {Array<string>} Array of substrings
   */
  static string_split(s, delimiter) {
    const str = s === null || s === undefined ? '' : String(s);
    const delim = delimiter === null || delimiter === undefined ? '' : String(delimiter);

    if (delim === '') {
      // Split into individual characters
      return str.split('');
    }
    return str.split(delim);
  }

  /**
   * Convert string to uppercase
   * @param {string} s - Source string
   * @returns {string} Uppercase string
   */
  static string_upper(s) {
    const str = s === null || s === undefined ? '' : String(s);
    return str.toUpperCase();
  }

  /**
   * Convert string to lowercase
   * @param {string} s - Source string
   * @returns {string} Lowercase string
   */
  static string_lower(s) {
    const str = s === null || s === undefined ? '' : String(s);
    return str.toLowerCase();
  }

  /**
   * Trim whitespace from string
   * @param {string} s - Source string
   * @returns {string} Trimmed string
   */
  static string_trim(s) {
    const str = s === null || s === undefined ? '' : String(s);
    return str.trim();
  }

  /**
   * Replace all occurrences of pattern in string
   * @param {string} s - Source string
   * @param {string} pattern - Pattern to replace
   * @param {string} replacement - Replacement string
   * @returns {string} String with replacements
   */
  static string_replace(s, pattern, replacement) {
    const str = s === null || s === undefined ? '' : String(s);
    const patt = pattern === null || pattern === undefined ? '' : String(pattern);
    const repl = replacement === null || replacement === undefined ? '' : String(replacement);
    return str.split(patt).join(repl);
  }

  /**
   * Get character at index
   * @param {string} s - Source string
   * @param {number} index - Character index
   * @returns {string} Character at index or empty string
   */
  static char_at(s, index) {
    const str = s === null || s === undefined ? '' : String(s);
    const idx = Math.floor(index);
    if (idx < 0 || idx >= str.length) {
      return '';
    }
    return str.charAt(idx);
  }

  /**
   * Create string from character code
   * @param {number} code - Character code
   * @returns {string} Single character string
   */
  static string_from_code(code) {
    const charCode = Math.floor(code);
    if (charCode < 0 || charCode > 0x10FFFF) {
      throw new Error(`string_from_code: Invalid character code ${charCode}`);
    }
    return String.fromCodePoint(charCode);
  }

  /**
   * Get character code at index
   * @param {string} s - Source string
   * @param {number} index - Character index
   * @returns {number} Character code or 0 if out of bounds
   */
  static string_code_at(s, index) {
    const str = s === null || s === undefined ? '' : String(s);
    const idx = Math.floor(index);
    if (idx < 0 || idx >= str.length) {
      return 0;
    }
    return str.charCodeAt(idx);
  }

  // ============================================================================
  // VECTOR/ARRAY OPERATIONS (11 functions)
  // ============================================================================

  /**
   * Create new empty vector
   * @returns {Array} Empty array
   */
  static vec_new() {
    return [];
  }

  /**
   * Push item to vector
   * @param {Array} vec - Vector
   * @param {*} item - Item to push
   * @returns {Array} The vector (modified)
   */
  static vec_push(vec, item) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_push: First argument must be an array');
    }
    vec.push(item);
    return vec;
  }

  /**
   * Pop item from vector
   * @param {Array} vec - Vector
   * @returns {*} Popped item or undefined
   */
  static vec_pop(vec) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_pop: Argument must be an array');
    }
    return vec.pop();
  }

  /**
   * Get length of vector
   * @param {Array} vec - Vector
   * @returns {number} Length
   */
  static vec_len(vec) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_len: Argument must be an array');
    }
    return vec.length;
  }

  /**
   * Get item at index
   * @param {Array} vec - Vector
   * @param {number} index - Index
   * @returns {*} Item at index or undefined
   */
  static vec_get(vec, index) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_get: First argument must be an array');
    }
    const idx = Math.floor(index);
    if (idx < 0 || idx >= vec.length) {
      return undefined;
    }
    return vec[idx];
  }

  /**
   * Set item at index
   * @param {Array} vec - Vector
   * @param {number} index - Index
   * @param {*} value - Value to set
   * @returns {Array} The vector
   */
  static vec_set(vec, index, value) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_set: First argument must be an array');
    }
    const idx = Math.floor(index);
    if (idx < 0) {
      throw new Error(`vec_set: Index ${idx} is negative`);
    }
    vec[idx] = value;
    return vec;
  }

  /**
   * Extract slice of vector
   * @param {Array} vec - Vector
   * @param {number} start - Start index (inclusive)
   * @param {number} end - End index (exclusive)
   * @returns {Array} New vector with slice
   */
  static vec_slice(vec, start, end) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_slice: First argument must be an array');
    }
    const startIdx = Math.max(0, Math.floor(start));
    const endIdx = end === undefined ? vec.length : Math.floor(end);
    return vec.slice(startIdx, endIdx);
  }

  /**
   * Concatenate two vectors
   * @param {Array} vec1 - First vector
   * @param {Array} vec2 - Second vector
   * @returns {Array} New concatenated vector
   */
  static vec_concat(vec1, vec2) {
    if (!Array.isArray(vec1)) {
      throw new Error('vec_concat: First argument must be an array');
    }
    if (!Array.isArray(vec2)) {
      throw new Error('vec_concat: Second argument must be an array');
    }
    return vec1.concat(vec2);
  }

  /**
   * Check if vector contains value (shallow equality)
   * @param {Array} vec - Vector
   * @param {*} value - Value to search for
   * @returns {boolean} True if contains
   */
  static vec_contains(vec, value) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_contains: First argument must be an array');
    }
    return vec.includes(value);
  }

  /**
   * Reverse vector in place
   * @param {Array} vec - Vector
   * @returns {Array} The reversed vector
   */
  static vec_reverse(vec) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_reverse: Argument must be an array');
    }
    vec.reverse();
    return vec;
  }

  /**
   * Find index of value in vector
   * @param {Array} vec - Vector
   * @param {*} value - Value to find
   * @returns {number} Index or -1 if not found
   */
  static vec_find(vec, value) {
    if (!Array.isArray(vec)) {
      throw new Error('vec_find: First argument must be an array');
    }
    return vec.indexOf(value);
  }

  // ============================================================================
  // MAP/DICT OPERATIONS (9 functions)
  // ============================================================================

  /**
   * Create new empty map
   * @returns {Map} Empty map
   */
  static map_new() {
    return new Map();
  }

  /**
   * Set key-value pair in map
   * @param {Map} map - Map
   * @param {*} key - Key
   * @param {*} value - Value
   * @returns {Map} The map
   */
  static map_set(map, key, value) {
    if (!(map instanceof Map)) {
      throw new Error('map_set: First argument must be a Map');
    }
    map.set(key, value);
    return map;
  }

  /**
   * Get value from map
   * @param {Map} map - Map
   * @param {*} key - Key
   * @returns {*} Value or undefined
   */
  static map_get(map, key) {
    if (!(map instanceof Map)) {
      throw new Error('map_get: First argument must be a Map');
    }
    return map.get(key);
  }

  /**
   * Delete key from map
   * @param {Map} map - Map
   * @param {*} key - Key to delete
   * @returns {boolean} True if deleted
   */
  static map_delete(map, key) {
    if (!(map instanceof Map)) {
      throw new Error('map_delete: First argument must be a Map');
    }
    return map.delete(key);
  }

  /**
   * Check if map has key
   * @param {Map} map - Map
   * @param {*} key - Key
   * @returns {boolean} True if key exists
   */
  static map_has(map, key) {
    if (!(map instanceof Map)) {
      throw new Error('map_has: First argument must be a Map');
    }
    return map.has(key);
  }

  /**
   * Get all keys from map
   * @param {Map} map - Map
   * @returns {Array} Array of keys
   */
  static map_keys(map) {
    if (!(map instanceof Map)) {
      throw new Error('map_keys: Argument must be a Map');
    }
    return Array.from(map.keys());
  }

  /**
   * Get all values from map
   * @param {Map} map - Map
   * @returns {Array} Array of values
   */
  static map_values(map) {
    if (!(map instanceof Map)) {
      throw new Error('map_values: Argument must be a Map');
    }
    return Array.from(map.values());
  }

  /**
   * Get map size
   * @param {Map} map - Map
   * @returns {number} Number of entries
   */
  static map_len(map) {
    if (!(map instanceof Map)) {
      throw new Error('map_len: Argument must be a Map');
    }
    return map.size;
  }

  /**
   * Merge two maps (second overwrites first)
   * @param {Map} map1 - First map
   * @param {Map} map2 - Second map
   * @returns {Map} New merged map
   */
  static map_merge(map1, map2) {
    if (!(map1 instanceof Map)) {
      throw new Error('map_merge: First argument must be a Map');
    }
    if (!(map2 instanceof Map)) {
      throw new Error('map_merge: Second argument must be a Map');
    }
    const result = new Map(map1);
    for (const [key, value] of map2) {
      result.set(key, value);
    }
    return result;
  }

  /**
   * Clear all entries from map
   * @param {Map} map - Map
   * @returns {Map} The cleared map
   */
  static map_clear(map) {
    if (!(map instanceof Map)) {
      throw new Error('map_clear: Argument must be a Map');
    }
    map.clear();
    return map;
  }

  // ============================================================================
  // NUMERIC OPERATIONS (12 functions)
  // ============================================================================

  /**
   * Add two numbers
   * @param {*} a - First number (coerced)
   * @param {*} b - Second number (coerced)
   * @returns {number} Sum
   */
  static num_add(a, b) {
    const n1 = a === null || a === undefined ? 0 : Number(a);
    const n2 = b === null || b === undefined ? 0 : Number(b);
    return n1 + n2;
  }

  /**
   * Subtract two numbers
   * @param {*} a - First number (coerced)
   * @param {*} b - Second number (coerced)
   * @returns {number} Difference
   */
  static num_sub(a, b) {
    const n1 = a === null || a === undefined ? 0 : Number(a);
    const n2 = b === null || b === undefined ? 0 : Number(b);
    return n1 - n2;
  }

  /**
   * Multiply two numbers
   * @param {*} a - First number (coerced)
   * @param {*} b - Second number (coerced)
   * @returns {number} Product
   */
  static num_mul(a, b) {
    const n1 = a === null || a === undefined ? 0 : Number(a);
    const n2 = b === null || b === undefined ? 0 : Number(b);
    return n1 * n2;
  }

  /**
   * Divide two numbers
   * @param {*} a - Dividend (coerced)
   * @param {*} b - Divisor (coerced)
   * @returns {number} Quotient
   */
  static num_div(a, b) {
    const n1 = a === null || a === undefined ? 0 : Number(a);
    const n2 = b === null || b === undefined ? 0 : Number(b);
    if (n2 === 0) {
      throw new Error('num_div: Division by zero');
    }
    return n1 / n2;
  }

  /**
   * Modulo operation
   * @param {*} a - Dividend (coerced)
   * @param {*} b - Divisor (coerced)
   * @returns {number} Remainder
   */
  static num_mod(a, b) {
    const n1 = a === null || a === undefined ? 0 : Number(a);
    const n2 = b === null || b === undefined ? 0 : Number(b);
    if (n2 === 0) {
      throw new Error('num_mod: Modulo by zero');
    }
    return n1 % n2;
  }

  /**
   * Raise number to power
   * @param {*} base - Base (coerced)
   * @param {*} exponent - Exponent (coerced)
   * @returns {number} Result
   */
  static num_pow(base, exponent) {
    const b = base === null || base === undefined ? 0 : Number(base);
    const e = exponent === null || exponent === undefined ? 0 : Number(exponent);
    return Math.pow(b, e);
  }

  /**
   * Absolute value
   * @param {*} n - Number (coerced)
   * @returns {number} Absolute value
   */
  static num_abs(n) {
    const num = n === null || n === undefined ? 0 : Number(n);
    return Math.abs(num);
  }

  /**
   * Maximum of two numbers
   * @param {*} a - First number (coerced)
   * @param {*} b - Second number (coerced)
   * @returns {number} Maximum
   */
  static num_max(a, b) {
    const n1 = a === null || a === undefined ? 0 : Number(a);
    const n2 = b === null || b === undefined ? 0 : Number(b);
    return Math.max(n1, n2);
  }

  /**
   * Minimum of two numbers
   * @param {*} a - First number (coerced)
   * @param {*} b - Second number (coerced)
   * @returns {number} Minimum
   */
  static num_min(a, b) {
    const n1 = a === null || a === undefined ? 0 : Number(a);
    const n2 = b === null || b === undefined ? 0 : Number(b);
    return Math.min(n1, n2);
  }

  /**
   * Floor of number
   * @param {*} n - Number (coerced)
   * @returns {number} Floor value
   */
  static num_floor(n) {
    const num = n === null || n === undefined ? 0 : Number(n);
    return Math.floor(num);
  }

  /**
   * Ceiling of number
   * @param {*} n - Number (coerced)
   * @returns {number} Ceiling value
   */
  static num_ceil(n) {
    const num = n === null || n === undefined ? 0 : Number(n);
    return Math.ceil(num);
  }

  /**
   * Round number to nearest integer
   * @param {*} n - Number (coerced)
   * @returns {number} Rounded value
   */
  static num_round(n) {
    const num = n === null || n === undefined ? 0 : Number(n);
    return Math.round(num);
  }

  /**
   * Check if two numbers are equal
   * @param {*} a - First number (coerced)
   * @param {*} b - Second number (coerced)
   * @returns {boolean} True if equal
   */
  static num_equals(a, b) {
    const n1 = a === null || a === undefined ? 0 : Number(a);
    const n2 = b === null || b === undefined ? 0 : Number(b);
    return n1 === n2;
  }

  // ============================================================================
  // LOGIC OPERATIONS (9 functions + 2 helpers)
  // ============================================================================

  /**
   * Helper: Check if value is truthy
   * @param {*} v - Value
   * @returns {boolean} True if truthy
   */
  static isTruthy(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof Map) return v.size > 0;
    return true;
  }

  /**
   * Helper: Deep equality check for structures
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} True if deeply equal
   */
  static _deepEquals(a, b) {
    // Strict equality check
    if (a === b) return true;

    // Type check
    if (typeof a !== typeof b) return false;

    // Null/undefined
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;

    // Arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!BuiltinFunctions._deepEquals(a[i], b[i])) return false;
      }
      return true;
    }

    // Maps
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        if (!b.has(key)) return false;
        if (!BuiltinFunctions._deepEquals(value, b.get(key))) return false;
      }
      return true;
    }

    // Objects
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!BuiltinFunctions._deepEquals(a[key], b[key])) return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Logical AND
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} a AND b
   */
  static logic_and(a, b) {
    return BuiltinFunctions.isTruthy(a) && BuiltinFunctions.isTruthy(b);
  }

  /**
   * Logical OR
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} a OR b
   */
  static logic_or(a, b) {
    return BuiltinFunctions.isTruthy(a) || BuiltinFunctions.isTruthy(b);
  }

  /**
   * Logical NOT
   * @param {*} v - Value
   * @returns {boolean} NOT v
   */
  static logic_not(v) {
    return !BuiltinFunctions.isTruthy(v);
  }

  /**
   * Deep equality check
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} True if deeply equal
   */
  static logic_equals(a, b) {
    return BuiltinFunctions._deepEquals(a, b);
  }

  /**
   * Deep inequality check
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} True if not deeply equal
   */
  static logic_not_equals(a, b) {
    return !BuiltinFunctions._deepEquals(a, b);
  }

  /**
   * Less than comparison (numeric)
   * @param {*} a - First value (coerced to number)
   * @param {*} b - Second value (coerced to number)
   * @returns {boolean} a < b
   */
  static logic_less_than(a, b) {
    const n1 = Number(a);
    const n2 = Number(b);
    return n1 < n2;
  }

  /**
   * Greater than comparison (numeric)
   * @param {*} a - First value (coerced to number)
   * @param {*} b - Second value (coerced to number)
   * @returns {boolean} a > b
   */
  static logic_greater_than(a, b) {
    const n1 = Number(a);
    const n2 = Number(b);
    return n1 > n2;
  }

  /**
   * Less than or equal comparison (numeric)
   * @param {*} a - First value (coerced to number)
   * @param {*} b - Second value (coerced to number)
   * @returns {boolean} a <= b
   */
  static logic_less_equal(a, b) {
    const n1 = Number(a);
    const n2 = Number(b);
    return n1 <= n2;
  }

  /**
   * Greater than or equal comparison (numeric)
   * @param {*} a - First value (coerced to number)
   * @param {*} b - Second value (coerced to number)
   * @returns {boolean} a >= b
   */
  static logic_greater_equal(a, b) {
    const n1 = Number(a);
    const n2 = Number(b);
    return n1 >= n2;
  }

  // ============================================================================
  // TYPE CHECKING (10 functions)
  // ============================================================================

  /**
   * Get type of value
   * @param {*} value - Value to check
   * @returns {string} Type name
   */
  static typeof(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return 'integer';
      return 'number';
    }
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'vector';
    if (value instanceof Map) return 'map';
    if (value instanceof Uint8Array) return 'binary';
    return 'object';
  }

  /**
   * Check if value is string
   * @param {*} value - Value to check
   * @returns {boolean} True if string
   */
  static is_string(value) {
    return typeof value === 'string';
  }

  /**
   * Check if value is number
   * @param {*} value - Value to check
   * @returns {boolean} True if number
   */
  static is_number(value) {
    return typeof value === 'number' && !isNaN(value);
  }

  /**
   * Check if value is vector/array
   * @param {*} value - Value to check
   * @returns {boolean} True if array
   */
  static is_vector(value) {
    return Array.isArray(value);
  }

  /**
   * Check if value is map
   * @param {*} value - Value to check
   * @returns {boolean} True if Map
   */
  static is_map(value) {
    return value instanceof Map;
  }

  /**
   * Check if value is boolean
   * @param {*} value - Value to check
   * @returns {boolean} True if boolean
   */
  static is_bool(value) {
    return typeof value === 'boolean';
  }

  /**
   * Check if value is null
   * @param {*} value - Value to check
   * @returns {boolean} True if null
   */
  static is_null(value) {
    return value === null || value === undefined;
  }

  /**
   * Check if value is numeric (number or numeric string)
   * @param {*} value - Value to check
   * @returns {boolean} True if can be converted to number
   */
  static is_numeric(value) {
    if (typeof value === 'number') return !isNaN(value);
    if (typeof value === 'string') {
      const num = Number(value);
      return !isNaN(num);
    }
    return false;
  }

  /**
   * Check if value is integer
   * @param {*} value - Value to check
   * @returns {boolean} True if integer
   */
  static is_integer(value) {
    return typeof value === 'number' && Number.isInteger(value);
  }

  /**
   * Convert value to string representation
   * @param {*} value - Value to convert
   * @returns {string} String representation
   */
  static value_to_string(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `[${value.map(v => BuiltinFunctions.value_to_string(v)).join(', ')}]`;
    if (value instanceof Map) {
      const entries = Array.from(value.entries())
        .map(([k, v]) => `${BuiltinFunctions.value_to_string(k)}: ${BuiltinFunctions.value_to_string(v)}`)
        .join(', ');
      return `{${entries}}`;
    }
    return String(value);
  }

  // ============================================================================
  // BINARY OPERATIONS (10 functions)
  // ============================================================================

  /**
   * Bitwise AND
   * @param {number} a - First integer
   * @param {number} b - Second integer
   * @returns {number} a & b
   */
  static bin_and(a, b) {
    const n1 = Math.floor(Number(a)) | 0;
    const n2 = Math.floor(Number(b)) | 0;
    return n1 & n2;
  }

  /**
   * Bitwise OR
   * @param {number} a - First integer
   * @param {number} b - Second integer
   * @returns {number} a | b
   */
  static bin_or(a, b) {
    const n1 = Math.floor(Number(a)) | 0;
    const n2 = Math.floor(Number(b)) | 0;
    return n1 | n2;
  }

  /**
   * Bitwise XOR
   * @param {number} a - First integer
   * @param {number} b - Second integer
   * @returns {number} a ^ b
   */
  static bin_xor(a, b) {
    const n1 = Math.floor(Number(a)) | 0;
    const n2 = Math.floor(Number(b)) | 0;
    return n1 ^ n2;
  }

  /**
   * Bitwise NOT
   * @param {number} n - Integer
   * @returns {number} ~n
   */
  static bin_not(n) {
    const num = Math.floor(Number(n)) | 0;
    return ~num;
  }

  /**
   * Left shift
   * @param {number} n - Integer to shift
   * @param {number} bits - Number of bits to shift
   * @returns {number} n << bits
   */
  static bin_lshift(n, bits) {
    const num = Math.floor(Number(n)) | 0;
    const shift = Math.floor(Number(bits)) | 0;
    return num << shift;
  }

  /**
   * Right shift (arithmetic)
   * @param {number} n - Integer to shift
   * @param {number} bits - Number of bits to shift
   * @returns {number} n >> bits
   */
  static bin_rshift(n, bits) {
    const num = Math.floor(Number(n)) | 0;
    const shift = Math.floor(Number(bits)) | 0;
    return num >> shift;
  }

  /**
   * Convert integer to hex string
   * @param {number} n - Integer
   * @returns {string} Hex string (with sign for negative)
   */
  static bin_to_hex(n) {
    const num = Math.floor(Number(n));
    if (num < 0) {
      // Two's complement for negative numbers
      return '-' + Math.abs(num).toString(16).toUpperCase();
    }
    return num.toString(16).toUpperCase();
  }

  /**
   * Parse hex string to integer
   * @param {string} hex - Hex string
   * @returns {number} Integer value
   */
  static bin_from_hex(hex) {
    const str = String(hex).trim();
    if (str.length === 0) {
      throw new Error('bin_from_hex: Empty hex string');
    }

    // Handle negative sign
    if (str.startsWith('-')) {
      return -parseInt(str.substring(1), 16);
    }

    const result = parseInt(str, 16);
    if (isNaN(result)) {
      throw new Error(`bin_from_hex: Invalid hex string "${hex}"`);
    }
    return result;
  }

  /**
   * Convert integer to binary string
   * @param {number} n - Integer
   * @returns {string} Binary string (with sign for negative)
   */
  static bin_to_binary(n) {
    const num = Math.floor(Number(n));
    if (num < 0) {
      // Two's complement representation
      return '-' + Math.abs(num).toString(2);
    }
    return num.toString(2);
  }

  /**
   * Parse binary string to integer
   * @param {string} binary - Binary string
   * @returns {number} Integer value
   */
  static bin_from_binary(binary) {
    const str = String(binary).trim();
    if (str.length === 0) {
      throw new Error('bin_from_binary: Empty binary string');
    }

    // Handle negative sign
    if (str.startsWith('-')) {
      return -parseInt(str.substring(1), 2);
    }

    const result = parseInt(str, 2);
    if (isNaN(result)) {
      throw new Error(`bin_from_binary: Invalid binary string "${binary}"`);
    }
    return result;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get all functions as object for registration
   * @returns {Object} Object with all function names mapped to functions
   */
  static getAllFunctions() {
    return {
      // String operations
      string_len: BuiltinFunctions.string_len,
      string_concat: BuiltinFunctions.string_concat,
      string_slice: BuiltinFunctions.string_slice,
      string_equals: BuiltinFunctions.string_equals,
      string_contains: BuiltinFunctions.string_contains,
      string_split: BuiltinFunctions.string_split,
      string_upper: BuiltinFunctions.string_upper,
      string_lower: BuiltinFunctions.string_lower,
      string_trim: BuiltinFunctions.string_trim,
      string_replace: BuiltinFunctions.string_replace,
      char_at: BuiltinFunctions.char_at,
      string_from_code: BuiltinFunctions.string_from_code,
      string_code_at: BuiltinFunctions.string_code_at,

      // Vector operations
      vec_new: BuiltinFunctions.vec_new,
      vec_push: BuiltinFunctions.vec_push,
      vec_pop: BuiltinFunctions.vec_pop,
      vec_len: BuiltinFunctions.vec_len,
      vec_get: BuiltinFunctions.vec_get,
      vec_set: BuiltinFunctions.vec_set,
      vec_slice: BuiltinFunctions.vec_slice,
      vec_concat: BuiltinFunctions.vec_concat,
      vec_contains: BuiltinFunctions.vec_contains,
      vec_reverse: BuiltinFunctions.vec_reverse,
      vec_find: BuiltinFunctions.vec_find,

      // Map operations
      map_new: BuiltinFunctions.map_new,
      map_set: BuiltinFunctions.map_set,
      map_get: BuiltinFunctions.map_get,
      map_delete: BuiltinFunctions.map_delete,
      map_has: BuiltinFunctions.map_has,
      map_keys: BuiltinFunctions.map_keys,
      map_values: BuiltinFunctions.map_values,
      map_len: BuiltinFunctions.map_len,
      map_merge: BuiltinFunctions.map_merge,
      map_clear: BuiltinFunctions.map_clear,

      // Numeric operations
      num_add: BuiltinFunctions.num_add,
      num_sub: BuiltinFunctions.num_sub,
      num_mul: BuiltinFunctions.num_mul,
      num_div: BuiltinFunctions.num_div,
      num_mod: BuiltinFunctions.num_mod,
      num_pow: BuiltinFunctions.num_pow,
      num_abs: BuiltinFunctions.num_abs,
      num_max: BuiltinFunctions.num_max,
      num_min: BuiltinFunctions.num_min,
      num_floor: BuiltinFunctions.num_floor,
      num_ceil: BuiltinFunctions.num_ceil,
      num_round: BuiltinFunctions.num_round,
      num_equals: BuiltinFunctions.num_equals,

      // Logic operations
      logic_and: BuiltinFunctions.logic_and,
      logic_or: BuiltinFunctions.logic_or,
      logic_not: BuiltinFunctions.logic_not,
      logic_equals: BuiltinFunctions.logic_equals,
      logic_not_equals: BuiltinFunctions.logic_not_equals,
      logic_less_than: BuiltinFunctions.logic_less_than,
      logic_greater_than: BuiltinFunctions.logic_greater_than,
      logic_less_equal: BuiltinFunctions.logic_less_equal,
      logic_greater_equal: BuiltinFunctions.logic_greater_equal,

      // Type checking
      typeof: BuiltinFunctions.typeof,
      is_string: BuiltinFunctions.is_string,
      is_number: BuiltinFunctions.is_number,
      is_vector: BuiltinFunctions.is_vector,
      is_map: BuiltinFunctions.is_map,
      is_bool: BuiltinFunctions.is_bool,
      is_null: BuiltinFunctions.is_null,
      is_numeric: BuiltinFunctions.is_numeric,
      is_integer: BuiltinFunctions.is_integer,
      value_to_string: BuiltinFunctions.value_to_string,

      // Binary operations
      bin_and: BuiltinFunctions.bin_and,
      bin_or: BuiltinFunctions.bin_or,
      bin_xor: BuiltinFunctions.bin_xor,
      bin_not: BuiltinFunctions.bin_not,
      bin_lshift: BuiltinFunctions.bin_lshift,
      bin_rshift: BuiltinFunctions.bin_rshift,
      bin_to_hex: BuiltinFunctions.bin_to_hex,
      bin_from_hex: BuiltinFunctions.bin_from_hex,
      bin_to_binary: BuiltinFunctions.bin_to_binary,
      bin_from_binary: BuiltinFunctions.bin_from_binary,
    };
  }

  /**
   * Register all functions with an execution context
   * @param {Object} context - Execution context to register functions in
   */
  static registerWithContext(context) {
    const functions = BuiltinFunctions.getAllFunctions();
    for (const [name, func] of Object.entries(functions)) {
      context[name] = func;
    }
  }

  /**
   * Validate that a function exists
   * @param {string} funcName - Function name to validate
   * @param {number} expectedArity - Expected number of arguments (optional)
   * @returns {boolean} True if function exists
   */
  static validateFunction(funcName, expectedArity) {
    const func = BuiltinFunctions.getAllFunctions()[funcName];
    if (!func) {
      return false;
    }

    if (expectedArity !== undefined) {
      // Check arity (length property)
      if (func.length !== expectedArity) {
        console.warn(`Function ${funcName} expects ${func.length} args, but ${expectedArity} were expected`);
      }
    }

    return true;
  }

  /**
   * Get documentation for all functions
   * @returns {Object} Documentation object with categories
   */
  static getDocumentation() {
    return {
      categories: {
        string: [
          'string_len', 'string_concat', 'string_slice', 'string_equals',
          'string_contains', 'string_split', 'string_upper', 'string_lower',
          'string_trim', 'string_replace', 'char_at', 'string_from_code', 'string_code_at'
        ],
        vector: [
          'vec_new', 'vec_push', 'vec_pop', 'vec_len', 'vec_get', 'vec_set',
          'vec_slice', 'vec_concat', 'vec_contains', 'vec_reverse', 'vec_find'
        ],
        map: [
          'map_new', 'map_set', 'map_get', 'map_delete', 'map_has',
          'map_keys', 'map_values', 'map_len', 'map_merge', 'map_clear'
        ],
        numeric: [
          'num_add', 'num_sub', 'num_mul', 'num_div', 'num_mod', 'num_pow',
          'num_abs', 'num_max', 'num_min', 'num_floor', 'num_ceil', 'num_round', 'num_equals'
        ],
        logic: [
          'logic_and', 'logic_or', 'logic_not', 'logic_equals', 'logic_not_equals',
          'logic_less_than', 'logic_greater_than', 'logic_less_equal', 'logic_greater_equal'
        ],
        type: [
          'typeof', 'is_string', 'is_number', 'is_vector', 'is_map', 'is_bool',
          'is_null', 'is_numeric', 'is_integer', 'value_to_string'
        ],
        binary: [
          'bin_and', 'bin_or', 'bin_xor', 'bin_not', 'bin_lshift', 'bin_rshift',
          'bin_to_hex', 'bin_from_hex', 'bin_to_binary', 'bin_from_binary'
        ]
      },
      totalFunctions: 73
    };
  }
}

module.exports = BuiltinFunctions;

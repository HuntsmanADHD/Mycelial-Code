/**
 * Comprehensive Test Suite for Phase 3 Builtin Functions
 * Tests all 55+ builtin functions across 7 categories
 *
 * Usage: node test-builtin-functions.js
 * Exit code: 0 on success, 1 on failure
 */

const BuiltinFunctions = require('./builtin-functions.js');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

class TestBuiltinFunctions {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this.builtins = BuiltinFunctions.getAllFunctions();
  }

  assertEquals(actual, expected, testName) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);

    if (actualStr === expectedStr) {
      console.log(`  ${colors.green}PASS${colors.reset}: ${testName}`);
      this.passed++;
      return true;
    } else {
      console.log(`  ${colors.red}FAIL${colors.reset}: ${testName}`);
      console.log(`    Expected: ${expectedStr}`);
      console.log(`    Actual:   ${actualStr}`);
      this.failed++;
      this.errors.push(testName);
      return false;
    }
  }

  assertThrows(func, testName) {
    try {
      func();
      console.log(`  ${colors.red}FAIL${colors.reset}: ${testName} (should have thrown)`);
      this.failed++;
      this.errors.push(testName);
      return false;
    } catch (e) {
      console.log(`  ${colors.green}PASS${colors.reset}: ${testName}`);
      this.passed++;
      return true;
    }
  }

  printHeader(title) {
    console.log('\n' + '='.repeat(60));
    console.log(colors.bold + title + colors.reset);
    console.log('='.repeat(60));
  }

  // ============================================================
  // STRING OPERATIONS TESTS
  // ============================================================
  testStringOperations() {
    this.printHeader('STRING OPERATIONS');

    // string_len tests
    this.assertEquals(this.builtins.string_len('hello'), 5, 'string_len basic');
    this.assertEquals(this.builtins.string_len(''), 0, 'string_len empty');
    this.assertEquals(this.builtins.string_len(null), 0, 'string_len null handling');

    // string_concat tests
    this.assertEquals(this.builtins.string_concat('hello', ' world'), 'hello world', 'string_concat normal');
    this.assertEquals(this.builtins.string_concat('', 'test'), 'test', 'string_concat empty first');
    this.assertEquals(this.builtins.string_concat('test', ''), 'test', 'string_concat empty second');

    // string_slice tests
    this.assertEquals(this.builtins.string_slice('hello world', 0, 5), 'hello', 'string_slice with end');
    this.assertEquals(this.builtins.string_slice('hello world', 6), 'world', 'string_slice without end');
    this.assertEquals(this.builtins.string_slice('test', 1, 3), 'es', 'string_slice middle');

    // string_contains tests
    this.assertEquals(this.builtins.string_contains('hello world', 'world'), true, 'string_contains found');
    this.assertEquals(this.builtins.string_contains('hello world', 'xyz'), false, 'string_contains not found');
    this.assertEquals(this.builtins.string_contains('test', ''), true, 'string_contains empty substring');

    // string_split tests
    this.assertEquals(this.builtins.string_split('a,b,c', ','), ['a', 'b', 'c'], 'string_split multiple');
    this.assertEquals(this.builtins.string_split('hello', ','), ['hello'], 'string_split no delimiter');
    this.assertEquals(this.builtins.string_split('a,,b', ','), ['a', '', 'b'], 'string_split empty parts');

    // string_upper/lower tests
    this.assertEquals(this.builtins.string_upper('hello'), 'HELLO', 'string_upper basic');
    this.assertEquals(this.builtins.string_lower('WORLD'), 'world', 'string_lower basic');
    this.assertEquals(this.builtins.string_upper('Hello123'), 'HELLO123', 'string_upper mixed');

    // string_trim tests
    this.assertEquals(this.builtins.string_trim('  hello  '), 'hello', 'string_trim both sides');
    this.assertEquals(this.builtins.string_trim('\t\ntest\n'), 'test', 'string_trim whitespace');
    this.assertEquals(this.builtins.string_trim('no-spaces'), 'no-spaces', 'string_trim none');

    // string_replace tests
    this.assertEquals(this.builtins.string_replace('hello world', 'world', 'there'), 'hello there', 'string_replace single');
    this.assertEquals(this.builtins.string_replace('aaa', 'a', 'b'), 'bbb', 'string_replace multiple');
    this.assertEquals(this.builtins.string_replace('test', 'x', 'y'), 'test', 'string_replace no match');

    // char_at tests
    this.assertEquals(this.builtins.char_at('hello', 0), 'h', 'char_at first');
    this.assertEquals(this.builtins.char_at('hello', 4), 'o', 'char_at last');
    this.assertEquals(this.builtins.char_at('hello', 10), '', 'char_at out of bounds');

    // string_code_at tests
    this.assertEquals(this.builtins.string_code_at('A', 0), 65, 'string_code_at A');
    this.assertEquals(this.builtins.string_code_at('hello', 0), 104, 'string_code_at h');
    this.assertEquals(typeof this.builtins.string_code_at('hello', 10), 'number', 'string_code_at invalid returns number');

    // string_from_code tests
    this.assertEquals(this.builtins.string_from_code(65), 'A', 'string_from_code A');
    this.assertEquals(this.builtins.string_from_code(104), 'h', 'string_from_code h');
    this.assertEquals(this.builtins.string_from_code(48), '0', 'string_from_code digit');
  }

  // ============================================================
  // VECTOR OPERATIONS TESTS
  // ============================================================
  testVectorOperations() {
    this.printHeader('VECTOR OPERATIONS');

    // vec_new tests
    const arr1 = this.builtins.vec_new();
    this.assertEquals(Array.isArray(arr1) && arr1.length === 0, true, 'vec_new creates empty array');

    // vec_push tests
    const arr2 = [];
    this.builtins.vec_push(arr2, 1);
    this.builtins.vec_push(arr2, 2);
    this.assertEquals(arr2, [1, 2], 'vec_push adds elements');
    this.assertEquals(arr2.length, 2, 'vec_push increments length');

    // vec_pop tests
    const arr3 = [1, 2, 3];
    const popped = this.builtins.vec_pop(arr3);
    this.assertEquals(popped, 3, 'vec_pop returns last element');
    this.assertEquals(arr3, [1, 2], 'vec_pop removes element');

    // vec_len tests
    this.assertEquals(this.builtins.vec_len([1, 2, 3]), 3, 'vec_len returns length');
    this.assertEquals(this.builtins.vec_len([]), 0, 'vec_len empty array');

    // vec_get tests
    this.assertEquals(this.builtins.vec_get([10, 20, 30], 1), 20, 'vec_get valid index');
    this.assertEquals(this.builtins.vec_get([10, 20], 5), undefined, 'vec_get out of bounds');
    this.assertEquals(this.builtins.vec_get([], 0), undefined, 'vec_get empty array');

    // vec_set tests
    const arr4 = [1, 2, 3];
    this.builtins.vec_set(arr4, 1, 99);
    this.assertEquals(arr4[1], 99, 'vec_set modifies element');
    this.assertEquals(arr4, [1, 99, 3], 'vec_set in place');

    // vec_slice tests
    this.assertEquals(this.builtins.vec_slice([1, 2, 3, 4, 5], 1, 4), [2, 3, 4], 'vec_slice with end');
    this.assertEquals(this.builtins.vec_slice([1, 2, 3], 1), [2, 3], 'vec_slice without end');

    // vec_concat tests
    this.assertEquals(this.builtins.vec_concat([1, 2], [3, 4]), [1, 2, 3, 4], 'vec_concat two arrays');
    this.assertEquals(this.builtins.vec_concat([], [1, 2]), [1, 2], 'vec_concat empty first');

    // vec_contains tests
    this.assertEquals(this.builtins.vec_contains([1, 2, 3], 2), true, 'vec_contains found');
    this.assertEquals(this.builtins.vec_contains([1, 2, 3], 5), false, 'vec_contains not found');

    // vec_find tests
    this.assertEquals(this.builtins.vec_find([10, 20, 30], 20), 1, 'vec_find returns index');
    this.assertEquals(this.builtins.vec_find([10, 20, 30], 99), -1, 'vec_find not found');

    // vec_reverse tests
    const arr5 = [1, 2, 3];
    this.builtins.vec_reverse(arr5);
    this.assertEquals(arr5, [3, 2, 1], 'vec_reverse in place');
  }

  // ============================================================
  // MAP OPERATIONS TESTS
  // ============================================================
  testMapOperations() {
    this.printHeader('MAP OPERATIONS');

    // map_new tests
    const map1 = this.builtins.map_new();
    this.assertEquals(map1 instanceof Map, true, 'map_new creates Map');
    this.assertEquals(map1.size, 0, 'map_new creates empty Map');

    // map_set/map_get tests
    const map2 = new Map();
    this.builtins.map_set(map2, 'key1', 'value1');
    this.assertEquals(this.builtins.map_get(map2, 'key1'), 'value1', 'map_set/get basic');
    this.builtins.map_set(map2, 'key2', 42);
    this.assertEquals(this.builtins.map_get(map2, 'key2'), 42, 'map_set/get number value');

    // map_has tests
    this.assertEquals(this.builtins.map_has(map2, 'key1'), true, 'map_has existing key');
    this.assertEquals(this.builtins.map_has(map2, 'nonexistent'), false, 'map_has missing key');

    // map_delete tests
    const map3 = new Map([['a', 1], ['b', 2]]);
    this.builtins.map_delete(map3, 'a');
    this.assertEquals(this.builtins.map_has(map3, 'a'), false, 'map_delete removes key');
    this.assertEquals(map3.size, 1, 'map_delete decrements size');

    // map_keys tests
    const map4 = new Map([['x', 1], ['y', 2], ['z', 3]]);
    const keys = this.builtins.map_keys(map4);
    this.assertEquals(keys.sort(), ['x', 'y', 'z'], 'map_keys returns all keys');

    // map_values tests
    const values = this.builtins.map_values(map4);
    this.assertEquals(values.sort(), [1, 2, 3], 'map_values returns all values');

    // map_len tests
    this.assertEquals(this.builtins.map_len(map4), 3, 'map_len returns size');
    this.assertEquals(this.builtins.map_len(new Map()), 0, 'map_len empty map');

    // map_merge tests
    const mapA = new Map([['a', 1], ['b', 2]]);
    const mapB = new Map([['c', 3], ['d', 4]]);
    const merged = this.builtins.map_merge(mapA, mapB);
    this.assertEquals(merged.size, 4, 'map_merge combines maps');
    this.assertEquals(this.builtins.map_get(merged, 'a'), 1, 'map_merge preserves first map');

    // map_clear tests
    const map5 = new Map([['a', 1], ['b', 2]]);
    this.builtins.map_clear(map5);
    this.assertEquals(map5.size, 0, 'map_clear empties map');
  }

  // ============================================================
  // NUMERIC OPERATIONS TESTS
  // ============================================================
  testNumericOperations() {
    this.printHeader('NUMERIC OPERATIONS');

    // Basic arithmetic
    this.assertEquals(this.builtins.num_add(5, 3), 8, 'num_add basic');
    this.assertEquals(this.builtins.num_sub(10, 4), 6, 'num_sub basic');
    this.assertEquals(this.builtins.num_mul(6, 7), 42, 'num_mul basic');
    this.assertEquals(this.builtins.num_div(20, 4), 5, 'num_div basic');

    // Division by zero
    this.assertThrows(() => this.builtins.num_div(10, 0), 'num_div by zero throws');

    // Modulo
    this.assertEquals(this.builtins.num_mod(10, 3), 1, 'num_mod basic');
    this.assertEquals(this.builtins.num_mod(20, 5), 0, 'num_mod even division');

    // Power
    this.assertEquals(this.builtins.num_pow(2, 3), 8, 'num_pow basic');
    this.assertEquals(this.builtins.num_pow(5, 2), 25, 'num_pow square');

    // Absolute value
    this.assertEquals(this.builtins.num_abs(-5), 5, 'num_abs negative');
    this.assertEquals(this.builtins.num_abs(5), 5, 'num_abs positive');
    this.assertEquals(this.builtins.num_abs(0), 0, 'num_abs zero');

    // Max/Min
    this.assertEquals(this.builtins.num_max(5, 10), 10, 'num_max basic');
    this.assertEquals(this.builtins.num_max(-5, -10), -5, 'num_max negatives');
    this.assertEquals(this.builtins.num_min(5, 10), 5, 'num_min basic');
    this.assertEquals(this.builtins.num_min(-5, -10), -10, 'num_min negatives');

    // Rounding
    this.assertEquals(this.builtins.num_floor(3.7), 3, 'num_floor basic');
    this.assertEquals(this.builtins.num_ceil(3.2), 4, 'num_ceil basic');
    this.assertEquals(this.builtins.num_round(3.5), 4, 'num_round up');
    this.assertEquals(this.builtins.num_round(3.4), 3, 'num_round down');

    // Numeric equality
    this.assertEquals(this.builtins.num_equals(5, 5), true, 'num_equals same');
    this.assertEquals(this.builtins.num_equals(5, 6), false, 'num_equals different');
  }

  // ============================================================
  // LOGIC OPERATIONS TESTS
  // ============================================================
  testLogicOperations() {
    this.printHeader('LOGIC OPERATIONS');

    // Boolean operations
    this.assertEquals(this.builtins.logic_and(true, true), true, 'logic_and both true');
    this.assertEquals(this.builtins.logic_and(true, false), false, 'logic_and one false');
    this.assertEquals(this.builtins.logic_or(false, true), true, 'logic_or one true');
    this.assertEquals(this.builtins.logic_or(false, false), false, 'logic_or both false');
    this.assertEquals(this.builtins.logic_not(true), false, 'logic_not true');
    this.assertEquals(this.builtins.logic_not(false), true, 'logic_not false');

    // Equality
    this.assertEquals(this.builtins.logic_equals(5, 5), true, 'logic_equals numbers same');
    this.assertEquals(this.builtins.logic_equals('test', 'test'), true, 'logic_equals strings same');
    this.assertEquals(this.builtins.logic_not_equals(5, 6), true, 'logic_not_equals different');
    this.assertEquals(this.builtins.logic_not_equals(5, 5), false, 'logic_not_equals same');

    // Comparisons
    this.assertEquals(this.builtins.logic_less_than(5, 10), true, 'logic_less_than true');
    this.assertEquals(this.builtins.logic_less_than(10, 5), false, 'logic_less_than false');
    this.assertEquals(this.builtins.logic_greater_than(10, 5), true, 'logic_greater_than true');
    this.assertEquals(this.builtins.logic_greater_than(5, 10), false, 'logic_greater_than false');
    this.assertEquals(this.builtins.logic_less_equal(5, 5), true, 'logic_less_equal equal');
    this.assertEquals(this.builtins.logic_greater_equal(10, 10), true, 'logic_greater_equal equal');

    // Deep equality for arrays
    this.assertEquals(this.builtins.logic_equals([1, 2, 3], [1, 2, 3]), true, 'logic_equals arrays same');
    this.assertEquals(this.builtins.logic_equals([1, 2], [1, 3]), false, 'logic_equals arrays different');

    // Deep equality for maps
    const m1 = new Map([['a', 1]]);
    const m2 = new Map([['a', 1]]);
    const m3 = new Map([['a', 2]]);
    this.assertEquals(this.builtins.logic_equals(m1, m2), true, 'logic_equals maps same');
    this.assertEquals(this.builtins.logic_equals(m1, m3), false, 'logic_equals maps different');
  }

  // ============================================================
  // TYPE OPERATIONS TESTS
  // ============================================================
  testTypeOperations() {
    this.printHeader('TYPE OPERATIONS');

    // typeof tests
    this.assertEquals(this.builtins.typeof('hello'), 'string', 'typeof string');
    this.assertEquals(this.builtins.typeof(42), 'number', 'typeof number');
    this.assertEquals(this.builtins.typeof([1, 2]), 'array', 'typeof array');
    this.assertEquals(this.builtins.typeof(new Map()), 'map', 'typeof map');
    this.assertEquals(this.builtins.typeof(true), 'boolean', 'typeof boolean');
    this.assertEquals(this.builtins.typeof(null), 'null', 'typeof null');
    this.assertEquals(this.builtins.typeof(undefined), 'undefined', 'typeof undefined');

    // Type checking
    this.assertEquals(this.builtins.is_string('test'), true, 'is_string true');
    this.assertEquals(this.builtins.is_string(123), false, 'is_string false');
    this.assertEquals(this.builtins.is_number(42), true, 'is_number true');
    this.assertEquals(this.builtins.is_number('42'), false, 'is_number false');
    this.assertEquals(this.builtins.is_vector([1, 2]), true, 'is_vector true');
    this.assertEquals(this.builtins.is_vector('not array'), false, 'is_vector false');
    this.assertEquals(this.builtins.is_map(new Map()), true, 'is_map true');
    this.assertEquals(this.builtins.is_map({}), false, 'is_map false');
    this.assertEquals(this.builtins.is_bool(true), true, 'is_bool true');
    this.assertEquals(this.builtins.is_bool(1), false, 'is_bool false');
    this.assertEquals(this.builtins.is_null(null), true, 'is_null true');
    this.assertEquals(this.builtins.is_null(undefined), false, 'is_null undefined is not null');

    // is_numeric tests
    this.assertEquals(this.builtins.is_numeric(42), true, 'is_numeric number');
    this.assertEquals(this.builtins.is_numeric('42'), true, 'is_numeric numeric string');
    this.assertEquals(this.builtins.is_numeric('abc'), false, 'is_numeric non-numeric string');

    // is_integer tests
    this.assertEquals(this.builtins.is_integer(42), true, 'is_integer whole number');
    this.assertEquals(this.builtins.is_integer(42.0), true, 'is_integer whole float');
    this.assertEquals(this.builtins.is_integer(42.5), false, 'is_integer decimal');

    // value_to_string tests
    this.assertEquals(this.builtins.value_to_string(42), '42', 'value_to_string number');
    this.assertEquals(this.builtins.value_to_string(true), 'true', 'value_to_string boolean');
    this.assertEquals(typeof this.builtins.value_to_string([1, 2]), 'string', 'value_to_string array returns string');
  }

  // ============================================================
  // BINARY OPERATIONS TESTS
  // ============================================================
  testBinaryOperations() {
    this.printHeader('BINARY OPERATIONS');

    // Bitwise operations
    this.assertEquals(this.builtins.bin_and(12, 10), 8, 'bin_and basic');
    this.assertEquals(this.builtins.bin_or(12, 10), 14, 'bin_or basic');
    this.assertEquals(this.builtins.bin_xor(12, 10), 6, 'bin_xor basic');
    this.assertEquals(this.builtins.bin_not(5), -6, 'bin_not basic');

    // Bit shifting
    this.assertEquals(this.builtins.bin_lshift(1, 3), 8, 'bin_lshift basic');
    this.assertEquals(this.builtins.bin_rshift(8, 2), 2, 'bin_rshift basic');

    // Hex conversion
    this.assertEquals(this.builtins.bin_to_hex(255), 'ff', 'bin_to_hex basic');
    this.assertEquals(this.builtins.bin_to_hex(16), '10', 'bin_to_hex 16');
    this.assertEquals(this.builtins.bin_to_hex(255, 4), '00ff', 'bin_to_hex with width');

    // Hex parsing
    this.assertEquals(this.builtins.bin_from_hex('ff'), 255, 'bin_from_hex lowercase');
    this.assertEquals(this.builtins.bin_from_hex('FF'), 255, 'bin_from_hex uppercase');
    this.assertEquals(this.builtins.bin_from_hex('10'), 16, 'bin_from_hex 10');
    this.assertThrows(() => this.builtins.bin_from_hex('xyz'), 'bin_from_hex invalid');

    // Binary conversion
    this.assertEquals(this.builtins.bin_to_binary(5), '101', 'bin_to_binary basic');
    this.assertEquals(this.builtins.bin_to_binary(8), '1000', 'bin_to_binary power of 2');
    this.assertEquals(this.builtins.bin_to_binary(5, 8), '00000101', 'bin_to_binary with width');

    // Binary parsing
    this.assertEquals(this.builtins.bin_from_binary('101'), 5, 'bin_from_binary basic');
    this.assertEquals(this.builtins.bin_from_binary('1000'), 8, 'bin_from_binary power of 2');
    this.assertThrows(() => this.builtins.bin_from_binary('102'), 'bin_from_binary invalid');
  }

  // ============================================================
  // UTILITY FUNCTION TESTS
  // ============================================================
  testUtilities() {
    this.printHeader('UTILITY FUNCTIONS');

    // getAllFunctions test
    const allFuncs = BuiltinFunctions.getAllFunctions();
    this.assertEquals(typeof allFuncs, 'object', 'getAllFunctions returns object');
    this.assertEquals(allFuncs !== null, true, 'getAllFunctions not null');

    // Check for key functions
    this.assertEquals(typeof allFuncs.string_len, 'function', 'string_len is function');
    this.assertEquals(typeof allFuncs.vec_new, 'function', 'vec_new is function');
    this.assertEquals(typeof allFuncs.map_new, 'function', 'map_new is function');
    this.assertEquals(typeof allFuncs.num_add, 'function', 'num_add is function');
    this.assertEquals(typeof allFuncs.logic_and, 'function', 'logic_and is function');
    this.assertEquals(typeof allFuncs.typeof, 'function', 'typeof is function');
    this.assertEquals(typeof allFuncs.bin_and, 'function', 'bin_and is function');

    // Check that we have a reasonable number of functions
    const funcCount = Object.keys(allFuncs).length;
    this.assertEquals(funcCount >= 55, true, `getAllFunctions has 55+ functions (found ${funcCount})`);
  }

  // ============================================================
  // RUN ALL TESTS
  // ============================================================
  runAll() {
    console.log(colors.bold + '\n╔════════════════════════════════════════════════════════════╗' + colors.reset);
    console.log(colors.bold + '║  Phase 3 Builtin Functions - Comprehensive Test Suite     ║' + colors.reset);
    console.log(colors.bold + '╚════════════════════════════════════════════════════════════╝' + colors.reset);

    this.testStringOperations();
    this.testVectorOperations();
    this.testMapOperations();
    this.testNumericOperations();
    this.testLogicOperations();
    this.testTypeOperations();
    this.testBinaryOperations();
    this.testUtilities();

    // Print summary
    this.printHeader('TEST SUMMARY');
    console.log(`${colors.green}PASSED: ${this.passed}${colors.reset}`);
    console.log(`${colors.red}FAILED: ${this.failed}${colors.reset}`);

    if (this.failed > 0) {
      console.log(`\n${colors.yellow}Failed tests:${colors.reset}`);
      this.errors.forEach(err => console.log(`  - ${err}`));
    }

    console.log('='.repeat(60));

    return this.failed === 0;
  }
}

// Run tests
const tester = new TestBuiltinFunctions();
const success = tester.runAll();
process.exit(success ? 0 : 1);

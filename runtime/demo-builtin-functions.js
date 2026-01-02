/**
 * Demonstration of all 73 Phase 3 Builtin Functions
 *
 * Usage: node demo-builtin-functions.js
 */

const BuiltinFunctions = require('./src/builtin-functions.js');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Mycelial Builtin Functions - Phase 3 Demonstration       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// ============================================================================
// STRING OPERATIONS (13 functions)
// ============================================================================
console.log('📝 STRING OPERATIONS (13 functions)\n');

const greeting = 'hello world';
console.log(`Original: "${greeting}"`);
console.log(`  string_len: ${BuiltinFunctions.string_len(greeting)}`);
console.log(`  string_upper: "${BuiltinFunctions.string_upper(greeting)}"`);
console.log(`  string_slice(0, 5): "${BuiltinFunctions.string_slice(greeting, 0, 5)}"`);
console.log(`  string_contains("world"): ${BuiltinFunctions.string_contains(greeting, 'world')}`);
console.log(`  string_split(" "): [${BuiltinFunctions.string_split(greeting, ' ').map(s => '"' + s + '"').join(', ')}]`);
console.log(`  string_replace("world", "there"): "${BuiltinFunctions.string_replace(greeting, 'world', 'there')}"`);
console.log(`  char_at(0): "${BuiltinFunctions.char_at(greeting, 0)}"`);
console.log(`  string_code_at(0): ${BuiltinFunctions.string_code_at(greeting, 0)} (ASCII)`);
console.log(`  string_from_code(65): "${BuiltinFunctions.string_from_code(65)}"`);

// ============================================================================
// VECTOR OPERATIONS (11 functions)
// ============================================================================
console.log('\n📊 VECTOR OPERATIONS (11 functions)\n');

const vec = BuiltinFunctions.vec_new();
BuiltinFunctions.vec_push(vec, 'apple');
BuiltinFunctions.vec_push(vec, 'banana');
BuiltinFunctions.vec_push(vec, 'cherry');

console.log(`Created vector: [${vec.map(s => '"' + s + '"').join(', ')}]`);
console.log(`  vec_len: ${BuiltinFunctions.vec_len(vec)}`);
console.log(`  vec_get(1): "${BuiltinFunctions.vec_get(vec, 1)}"`);
console.log(`  vec_contains("banana"): ${BuiltinFunctions.vec_contains(vec, 'banana')}`);
console.log(`  vec_find("cherry"): ${BuiltinFunctions.vec_find(vec, 'cherry')}`);
console.log(`  vec_slice(0, 2): [${BuiltinFunctions.vec_slice(vec, 0, 2).map(s => '"' + s + '"').join(', ')}]`);

const vec2 = ['date', 'elderberry'];
const combined = BuiltinFunctions.vec_concat(vec, vec2);
console.log(`  vec_concat with [${vec2.map(s => '"' + s + '"').join(', ')}]: [${combined.map(s => '"' + s + '"').join(', ')}]`);

// ============================================================================
// MAP OPERATIONS (10 functions)
// ============================================================================
console.log('\n🗺️  MAP OPERATIONS (10 functions)\n');

const map = BuiltinFunctions.map_new();
BuiltinFunctions.map_set(map, 'name', 'Alice');
BuiltinFunctions.map_set(map, 'age', 30);
BuiltinFunctions.map_set(map, 'city', 'NYC');

console.log(`Created map with 3 entries`);
console.log(`  map_len: ${BuiltinFunctions.map_len(map)}`);
console.log(`  map_get("name"): "${BuiltinFunctions.map_get(map, 'name')}"`);
console.log(`  map_has("age"): ${BuiltinFunctions.map_has(map, 'age')}`);
console.log(`  map_keys: [${BuiltinFunctions.map_keys(map).map(k => '"' + k + '"').join(', ')}]`);
console.log(`  map_values: [${BuiltinFunctions.map_values(map).join(', ')}]`);

// ============================================================================
// NUMERIC OPERATIONS (13 functions)
// ============================================================================
console.log('\n🔢 NUMERIC OPERATIONS (13 functions)\n');

const a = 10, b = 3;
console.log(`Numbers: a=${a}, b=${b}`);
console.log(`  num_add(a, b): ${BuiltinFunctions.num_add(a, b)}`);
console.log(`  num_sub(a, b): ${BuiltinFunctions.num_sub(a, b)}`);
console.log(`  num_mul(a, b): ${BuiltinFunctions.num_mul(a, b)}`);
console.log(`  num_div(a, b): ${BuiltinFunctions.num_div(a, b).toFixed(2)}`);
console.log(`  num_mod(a, b): ${BuiltinFunctions.num_mod(a, b)}`);
console.log(`  num_pow(2, 8): ${BuiltinFunctions.num_pow(2, 8)}`);
console.log(`  num_abs(-42): ${BuiltinFunctions.num_abs(-42)}`);
console.log(`  num_max(a, b): ${BuiltinFunctions.num_max(a, b)}`);
console.log(`  num_min(a, b): ${BuiltinFunctions.num_min(a, b)}`);
console.log(`  num_floor(3.7): ${BuiltinFunctions.num_floor(3.7)}`);
console.log(`  num_ceil(3.2): ${BuiltinFunctions.num_ceil(3.2)}`);
console.log(`  num_round(3.5): ${BuiltinFunctions.num_round(3.5)}`);

// ============================================================================
// LOGIC OPERATIONS (9 functions)
// ============================================================================
console.log('\n🔍 LOGIC OPERATIONS (9 functions)\n');

console.log(`Boolean operations:`);
console.log(`  logic_and(true, false): ${BuiltinFunctions.logic_and(true, false)}`);
console.log(`  logic_or(true, false): ${BuiltinFunctions.logic_or(true, false)}`);
console.log(`  logic_not(false): ${BuiltinFunctions.logic_not(false)}`);

console.log(`Comparisons:`);
console.log(`  logic_equals(5, 5): ${BuiltinFunctions.logic_equals(5, 5)}`);
console.log(`  logic_less_than(5, 10): ${BuiltinFunctions.logic_less_than(5, 10)}`);
console.log(`  logic_greater_than(10, 5): ${BuiltinFunctions.logic_greater_than(10, 5)}`);

console.log(`Deep equality:`);
const arr1 = [1, 2, 3];
const arr2 = [1, 2, 3];
console.log(`  logic_equals([1,2,3], [1,2,3]): ${BuiltinFunctions.logic_equals(arr1, arr2)}`);

// ============================================================================
// TYPE OPERATIONS (10 functions)
// ============================================================================
console.log('\n🏷️  TYPE OPERATIONS (10 functions)\n');

console.log(`Type checking:`);
console.log(`  typeof(42): "${BuiltinFunctions.typeof(42)}"`);
console.log(`  typeof([1,2,3]): "${BuiltinFunctions.typeof([1,2,3])}"`);
console.log(`  typeof(new Map()): "${BuiltinFunctions.typeof(new Map())}"`);
console.log(`  is_string("hello"): ${BuiltinFunctions.is_string("hello")}`);
console.log(`  is_number(42): ${BuiltinFunctions.is_number(42)}`);
console.log(`  is_integer(42.0): ${BuiltinFunctions.is_integer(42.0)}`);
console.log(`  is_integer(42.5): ${BuiltinFunctions.is_integer(42.5)}`);
console.log(`  is_numeric("123"): ${BuiltinFunctions.is_numeric("123")}`);

// ============================================================================
// BINARY OPERATIONS (10 functions)
// ============================================================================
console.log('\n🔧 BINARY OPERATIONS (10 functions)\n');

const x = 12, y = 10;
console.log(`Bitwise operations (x=${x}, y=${y}):`);
console.log(`  bin_and(x, y): ${BuiltinFunctions.bin_and(x, y)}`);
console.log(`  bin_or(x, y): ${BuiltinFunctions.bin_or(x, y)}`);
console.log(`  bin_xor(x, y): ${BuiltinFunctions.bin_xor(x, y)}`);
console.log(`  bin_not(5): ${BuiltinFunctions.bin_not(5)}`);
console.log(`  bin_lshift(1, 3): ${BuiltinFunctions.bin_lshift(1, 3)}`);
console.log(`  bin_rshift(8, 2): ${BuiltinFunctions.bin_rshift(8, 2)}`);

console.log(`Conversions:`);
console.log(`  bin_to_hex(255): "${BuiltinFunctions.bin_to_hex(255)}"`);
console.log(`  bin_from_hex("FF"): ${BuiltinFunctions.bin_from_hex("FF")}`);
console.log(`  bin_to_binary(8): "${BuiltinFunctions.bin_to_binary(8)}"`);
console.log(`  bin_from_binary("1000"): ${BuiltinFunctions.bin_from_binary("1000")}`);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '═'.repeat(60));
const docs = BuiltinFunctions.getDocumentation();
console.log(`📊 SUMMARY: ${docs.totalFunctions} total builtin functions`);
console.log('═'.repeat(60));

Object.entries(docs.categories).forEach(([category, functions]) => {
  console.log(`   ${category.padEnd(10)} - ${functions.length} functions`);
});

console.log('\n✅ All functions ready for use in Mycelial agent networks!\n');

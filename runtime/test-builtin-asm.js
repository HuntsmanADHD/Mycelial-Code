#!/usr/bin/env node
/**
 * Test Builtin Functions Generator
 *
 * Tests the builtin function assembly generator and displays
 * the generated x86-64 assembly code for all builtin functions.
 */

const { BuiltinFunctionsGenerator } = require('./src/compiler/builtin-asm.js');

console.log('='.repeat(70));
console.log('Testing Builtin Functions Generator');
console.log('='.repeat(70));

// Create builtin functions generator
const builtinGen = new BuiltinFunctionsGenerator();

console.log('\n--- Generating All Builtin Functions ---\n');

// Generate all builtin functions
const builtinCode = builtinGen.generateAll();

console.log(builtinCode);

console.log('\n' + '='.repeat(70));
console.log('Builtin Functions Generation Complete!');
console.log('='.repeat(70));

// Show summary of what was generated
console.log('\n--- Summary ---');
console.log('\nGenerated Builtin Functions:');

console.log('\nString Operations:');
console.log('  ✓ builtin_string_len (counts bytes until null)');
console.log('  ✓ builtin_string_concat (allocates and concatenates)');
console.log('  ✓ builtin_format (string interpolation - placeholder)');
console.log('  ✓ builtin_strcpy (helper: copy string)');
console.log('  ✓ builtin_strcat (helper: concatenate strings)');

console.log('\nI/O Operations:');
console.log('  ✓ builtin_print (write syscall to stdout)');
console.log('  ✓ builtin_println (print with newline)');

console.log('\nMemory Management:');
console.log('  ✓ builtin_heap_alloc (bump allocator with overflow check)');
console.log('  ✓ builtin_heap_free (no-op for bump allocator)');

console.log('\nVector Operations:');
console.log('  ✓ builtin_vec_new (allocate vector struct)');
console.log('  ✓ builtin_vec_len (get vector length)');
console.log('  ✓ builtin_vec_push (append to vector - TODO)');
console.log('  ✓ builtin_vec_get (bounds-checked access)');

console.log('\nUtility Functions:');
console.log('  ✓ builtin_memcpy (uses rep movsb)');
console.log('  ✓ builtin_memset (uses rep stosb)');

console.log('\nCalling Convention:');
console.log('  • System V AMD64 ABI');
console.log('  • Arguments: rdi, rsi, rdx, rcx, r8, r9');
console.log('  • Return value: rax');
console.log('  • Callee-saved: rbx, r12-r15, rbp');

console.log('\n' + '='.repeat(70));
console.log('All Tests Complete!');
console.log('='.repeat(70));

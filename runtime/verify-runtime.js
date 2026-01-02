// Verify Runtime implementation
const {Runtime} = require('./src/runtime.js');

console.log('Runtime class loaded successfully');

const methods = Object.getOwnPropertyNames(Runtime.prototype).filter(m => m !== 'constructor');
console.log('Total methods:', methods.length);
console.log('Methods:', methods.join(', '));

// Test instantiation
try {
  const runtime = new Runtime({
    sourcePath: './test.mycelial',
    outputPath: './test.elf'
  });
  console.log('\nRuntime instance created successfully');
  console.log('Properties:', Object.keys(runtime).join(', '));
} catch (error) {
  console.error('Error creating runtime:', error.message);
}

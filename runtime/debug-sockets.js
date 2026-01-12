#!/usr/bin/env node
const { MycelialParser } = require('./src/interpreter/parser.js');
const fs = require('fs');

const src = fs.readFileSync('../tests/pipeline.mycelial', 'utf8');
const parser = new MycelialParser();
const network = parser.parseNetwork(src);

console.log('=== Sockets ===');
console.log(`Total sockets: ${network.sockets.length}`);
console.log('');

for (const [i, socket] of network.sockets.entries()) {
  console.log(`Socket ${i}:`);
  console.log(JSON.stringify(socket, null, 2));
  console.log('');
}

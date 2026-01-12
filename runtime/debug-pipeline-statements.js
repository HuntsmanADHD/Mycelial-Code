#!/usr/bin/env node
const { MycelialParser } = require('./src/interpreter/parser.js');
const fs = require('fs');

const src = fs.readFileSync('../tests/pipeline.mycelial', 'utf8');
const parser = new MycelialParser();

try {
  const network = parser.parseNetwork(src);
  console.log('✅ Parsed successfully!');

  // Check all handlers
  for (const [hyphaName, hyphaType] of Object.entries(network.hyphae)) {
    console.log(`\n=== Hyphal: ${hyphaName} ===`);

    for (const [idx, handler] of hyphaType.handlers.entries()) {
      console.log(`\nHandler ${idx}:`);
      console.log(`  Type: ${handler.type}`);
      console.log(`  Frequency: ${handler.frequency || 'REST'}`);

      if (Array.isArray(handler.body)) {
        console.log(`  Body statements (${handler.body.length}):`);
        handler.body.forEach((stmt, i) => {
          console.log(`    ${i}: type=${stmt.type || 'UNDEFINED'}`);
          if (!stmt.type) {
            console.log(`       FULL STATEMENT:`, JSON.stringify(stmt, null, 6));
          }
        });
      } else if (handler.body) {
        console.log(`  Body: single statement, type=${handler.body.type || 'UNDEFINED'}`);
        if (!handler.body.type) {
          console.log(`    FULL STATEMENT:`, JSON.stringify(handler.body, null, 4));
        }
      }
    }
  }

} catch(e) {
  console.log('❌ Error:', e.message);
  console.log(e.stack);
}

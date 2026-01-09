/**
 * Test advanced syntax parsing
 *
 * Tests the parser's ability to handle:
 * - types { } blocks
 * - on rest handlers
 * - rule definitions
 * - map<K, V> types
 */

const { MycelialParser } = require('./src/interpreter/parser.js');
const fs = require('fs');
const path = require('path');

console.log('=== Testing Advanced Syntax Parsing ===\n');

// Test 1: Parse types block
console.log('Test 1: Parsing types block...');
const typesTest = `
network test {
  types {
    struct Token {
      type: string
      value: string
    }
    enum TokenType {
      IDENTIFIER, NUMBER, STRING
    }
  }

  frequencies {
    msg { text: string }
  }

  hyphae {
    hyphal worker {
      state { count: u32 }
      on rest {
        state.count = 0
      }
    }
  }

  topology {
    spawn worker as w1
  }
}
`;

try {
  const parser = new MycelialParser();
  const network = parser.parseNetwork(typesTest);
  console.log('✓ Successfully parsed types block');
  console.log(`  Network: ${network.name}`);
  console.log(`  Hyphae: ${Object.keys(network.hyphae).join(', ')}`);
} catch (e) {
  console.error('✗ Failed to parse types block:', e.message);
  process.exit(1);
}

// Test 2: Parse on rest handler
console.log('\nTest 2: Parsing on rest handler...');
const restTest = `
network test {
  frequencies {
    msg { text: string }
  }

  hyphae {
    hyphal worker {
      state {
        keywords: map<string, string>
        count: u32
      }

      on rest {
        state.count = 0
        state.keywords = map_new()
        map_insert(state.keywords, "hello", "HELLO")
      }

      on signal(msg, m) {
        state.count = state.count + 1
      }
    }
  }

  topology {
    spawn worker as w1
  }
}
`;

try {
  const parser = new MycelialParser();
  const network = parser.parseNetwork(restTest);
  const worker = network.hyphae.worker;

  console.log('✓ Successfully parsed on rest handler');
  console.log(`  Handlers: ${worker.handlers.length}`);

  const restHandler = worker.handlers.find(h => h.type === 'rest');
  if (restHandler) {
    console.log('✓ Found rest handler with', restHandler.body.length, 'statements');
  } else {
    console.error('✗ Rest handler not found!');
    process.exit(1);
  }
} catch (e) {
  console.error('✗ Failed to parse on rest handler:', e.message);
  process.exit(1);
}

// Test 3: Parse rule definitions
console.log('\nTest 3: Parsing rule definitions...');
const ruleTest = `
network test {
  frequencies {
    msg { text: string }
  }

  hyphae {
    hyphal worker {
      state {
        source: string
        position: u32
      }

      on rest {
        state.position = 0
      }

      rule peek(offset: u32) -> string {
        let pos = state.position + offset
        if pos < string_len(state.source) {
          return "char"
        }
        return ""
      }

      rule advance() -> string {
        let ch = peek(0)
        state.position = state.position + 1
        return ch
      }

      on signal(msg, m) {
        let ch = peek(0)
        advance()
      }
    }
  }

  topology {
    spawn worker as w1
  }
}
`;

try {
  const parser = new MycelialParser();
  const network = parser.parseNetwork(ruleTest);
  const worker = network.hyphae.worker;

  console.log('✓ Successfully parsed rule definitions');
  console.log(`  Rules: ${worker.rules ? worker.rules.length : 0}`);

  if (worker.rules && worker.rules.length === 2) {
    console.log('✓ Found 2 rules:', worker.rules.map(r => r.name).join(', '));

    const peekRule = worker.rules.find(r => r.name === 'peek');
    if (peekRule) {
      console.log(`  - peek has ${peekRule.params.length} parameter(s)`);
      console.log(`  - peek return type: ${peekRule.returnType}`);
    }
  } else {
    console.error('✗ Expected 2 rules, found', worker.rules ? worker.rules.length : 0);
    process.exit(1);
  }
} catch (e) {
  console.error('✗ Failed to parse rule definitions:', e.message);
  console.error(e.stack);
  process.exit(1);
}

// Test 4: Parse actual lexer.mycelial file
console.log('\nTest 4: Parsing actual lexer.mycelial file...');
const lexerPath = '/home/lewey/Desktop/mycelial-compiler/compiler/lexer.mycelial';

if (fs.existsSync(lexerPath)) {
  try {
    const source = fs.readFileSync(lexerPath, 'utf8');
    const parser = new MycelialParser();
    const network = parser.parseNetwork(source);

    console.log('✓ Successfully parsed lexer.mycelial!');
    console.log(`  Network: ${network.name}`);
    console.log(`  Frequencies: ${Object.keys(network.frequencies).length}`);
    console.log(`  Hyphae: ${Object.keys(network.hyphae).join(', ')}`);

    const lexer = network.hyphae.lexer;
    if (lexer) {
      console.log(`  Lexer state fields: ${lexer.state.length}`);
      console.log(`  Lexer handlers: ${lexer.handlers.length}`);
      console.log(`  Lexer rules: ${lexer.rules ? lexer.rules.length : 0}`);

      // Check for specific things
      const restHandler = lexer.handlers.find(h => h.type === 'rest');
      if (restHandler) {
        console.log('✓ Found rest handler');
      }

      if (lexer.rules && lexer.rules.length > 0) {
        console.log(`✓ Found ${lexer.rules.length} rules:`, lexer.rules.slice(0, 5).map(r => r.name).join(', '), '...');
      }

      const keywordsField = lexer.state.find(f => f.name === 'keywords');
      if (keywordsField) {
        console.log(`✓ Found keywords field with type: ${keywordsField.type}`);
      }
    }
  } catch (e) {
    console.error('✗ Failed to parse lexer.mycelial:', e.message);
    console.error('  at line', e.message.match(/line (\d+)/)?.[1] || 'unknown');
    process.exit(1);
  }
} else {
  console.warn('⚠ lexer.mycelial not found, skipping full file test');
}

console.log('\n=== All Advanced Syntax Tests Passed! ===');

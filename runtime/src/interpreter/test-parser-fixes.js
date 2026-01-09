/**
 * Test suite for parser fixes
 *
 * Tests the specific issues that were fixed:
 * 1. report with struct literal: report status { message: "..." }
 * 2. return without value
 * 3. if expressions: let x = if condition { val1 } else { val2 }
 * 4. Function calls with parentheses in assignments
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

const { MycelialParser } = require('./parser.js');

function test(name, code, expectedSuccess = true) {
  const parser = new MycelialParser();
  try {
    const ast = parser.parseNetwork(code);
    if (expectedSuccess) {
      console.log(`✓ ${name}`);
      return true;
    } else {
      console.log(`✗ ${name} - Expected to fail but succeeded`);
      return false;
    }
  } catch (err) {
    if (!expectedSuccess) {
      console.log(`✓ ${name} - Failed as expected`);
      return true;
    } else {
      console.log(`✗ ${name} - ${err.message}`);
      return false;
    }
  }
}

console.log('╔════════════════════════════════════════════╗');
console.log('║   Parser Fixes Test Suite                  ║');
console.log('╚════════════════════════════════════════════╝\n');

let passed = 0;
let total = 0;

// Test 1: report with struct literal
total++;
if (test('Report with struct literal (lowercase)', `
network Test {
  frequencies { dummy { x: u32 } }
  hyphae {
    hyphal test {
      on signal(dummy, d) {
        report status { message: "hello", code: 42 }
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 2: report with uppercase struct literal (original behavior)
total++;
if (test('Report with struct literal (uppercase)', `
network Test {
  frequencies { dummy { x: u32 } }
  hyphae {
    hyphal test {
      on signal(dummy, d) {
        report Status { message: "hello" }
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 3: report with traditional colon syntax
total++;
if (test('Report with colon syntax', `
network Test {
  frequencies { dummy { x: u32 } }
  hyphae {
    hyphal test {
      state { count: u32 = 0 }
      on signal(dummy, d) {
        report count: 42
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 4: return without value
total++;
if (test('Return without value', `
network Test {
  frequencies { dummy { x: u32 } }
  hyphae {
    hyphal test {
      on signal(dummy, d) {
        if d.x == 0 {
          return
        }
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 5: return with value
total++;
if (test('Return with value', `
network Test {
  frequencies { dummy { x: u32 } }
  hyphae {
    hyphal test {
      rule compute(x: u32) -> u32 {
        return x + 1
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 6: if expression
total++;
if (test('If expression in let', `
network Test {
  frequencies { dummy { x: u32 } }
  hyphae {
    hyphal test {
      on signal(dummy, d) {
        let result = if d.x > 10 { d.x } else { 10 }
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 7: if expression in assignment
total++;
if (test('If expression in assignment', `
network Test {
  frequencies { dummy { x: u32 } }
  hyphae {
    hyphal test {
      state { value: u32 = 0 }
      on signal(dummy, d) {
        state.value = if d.x > 0 { d.x } else { 0 }
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 8: function calls in expressions (the original issue)
total++;
if (test('Function call in assignment', `
network Test {
  frequencies { req { source_file: string } }
  hyphae {
    hyphal test {
      state { source_code: string }
      on signal(req, r) {
        state.source_code = read_file(r.source_file)
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 9: multiple function calls
total++;
if (test('Multiple function calls', `
network Test {
  frequencies { req { data: string } }
  hyphae {
    hyphal test {
      state { len: u32 = 0 }
      on signal(req, r) {
        state.len = string_len(r.data)
        let time = time_now()
      }
    }
  }
  topology { spawn test as t }
}
`)) passed++;

// Test 10: Complex expression from compiler.mycelial
total++;
if (test('Complex real-world example', `
network Test {
  frequencies {
    compile_request { source_file: string, output_file: string }
    status { message: string }
  }
  hyphae {
    hyphal orchestrator {
      state {
        source_file: string
        output_file: string
        source_code: string
        start_time: u64
        error_count: u32
      }

      on signal(compile_request, req) {
        state.source_file = req.source_file
        state.output_file = req.output_file
        state.start_time = time_now()
        state.error_count = 0

        report status { message: format("Compiling: {}", req.source_file) }

        state.source_code = read_file(req.source_file)

        if string_len(state.source_code) == 0 {
          state.error_count = 1
          return
        }

        report status { message: "  -> Lexing..." }
      }
    }
  }
  topology { spawn orchestrator as orch }
}
`)) passed++;

// Results
console.log('\n╔════════════════════════════════════════════╗');
console.log(`║   Tests Passed:  ${passed.toString().padStart(2)} / ${total.toString().padStart(2)}                     ║`);
if (passed === total) {
  console.log('║   Status: ALL TESTS PASSED ✓               ║');
} else {
  console.log(`║   Status: ${total - passed} FAILED                           ║`);
}
console.log('╚════════════════════════════════════════════╝\n');

process.exit(passed === total ? 0 : 1);

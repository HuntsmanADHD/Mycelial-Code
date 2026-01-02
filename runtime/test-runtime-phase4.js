/**
 * Test Runtime Phase 4 - Integration Test
 *
 * Tests the complete Runtime class with all phases integrated.
 */

const { Runtime } = require('./src/runtime.js');
const fs = require('fs');
const path = require('path');

// Test network definition
const testNetwork = `
network SimpleCompiler {
  frequencies {
    compile_request {
      source_path: string
      output_path: string
      timestamp: u64
    }

    lex_tokens {
      tokens: vec<string>
    }

    parse_tree {
      ast: string
    }

    compiled_binary {
      elf_data: binary
    }
  }

  types {
    enum TokenType {
      KEYWORD,
      IDENTIFIER,
      NUMBER
    }
  }

  hyphae {
    hyphal Lexer {
      state {
        position: u32
      }

      on signal(compile_request, req) {
        emit lex_tokens { tokens: ["token1", "token2"] }
      }
    }

    hyphal Parser {
      state {
        depth: u32
      }

      on signal(lex_tokens, tokens) {
        emit parse_tree { ast: "program" }
      }
    }

    hyphal CodeGen {
      state {
        output_binary: binary
        compiled_elf: binary
      }

      on signal(parse_tree, tree) {
        state.compiled_elf = "ELF_PLACEHOLDER"
        emit compiled_binary { elf_data: state.compiled_elf }
      }
    }
  }

  topology {
    spawn Lexer as lexer
    spawn Parser as parser
    spawn CodeGen as codegen

    socket lexer -> parser (frequency: lex_tokens)
    socket parser -> codegen (frequency: parse_tree)
  }
}
`;

async function runTests() {
  console.log('='.repeat(70));
  console.log('  RUNTIME PHASE 4 INTEGRATION TEST');
  console.log('='.repeat(70));

  const testDir = path.join(__dirname, 'test-output');
  const sourcePath = path.join(testDir, 'test.mycelial');
  const outputPath = path.join(testDir, 'test.elf');

  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Write test source file
  fs.writeFileSync(sourcePath, testNetwork);

  try {
    console.log('\n[TEST 1] Initialize Runtime');
    console.log('-'.repeat(70));

    const runtime = new Runtime({
      sourcePath: sourcePath,
      outputPath: outputPath,
      verbose: true,
      maxCycles: 100
    });

    await runtime.initialize();
    console.log('✓ Runtime initialized successfully');

    console.log('\n[TEST 2] Run Compilation');
    console.log('-'.repeat(70));

    const result = await runtime.compile();

    console.log('\n[TEST 3] Verify Results');
    console.log('-'.repeat(70));

    if (result.success) {
      console.log('✓ Compilation successful');
    } else {
      console.log('✗ Compilation failed:', result.error);
    }

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`✓ Output file exists: ${outputPath} (${stats.size} bytes)`);
    } else {
      console.log('✗ Output file not created');
    }

    console.log('\n[TEST 4] Verify Statistics');
    console.log('-'.repeat(70));

    console.log('Statistics:', JSON.stringify(result.stats, null, 2));

    if (result.stats.cycles > 0) {
      console.log('✓ Tidal cycles executed:', result.stats.cycles);
    } else {
      console.log('✗ No tidal cycles executed');
    }

    console.log('\n[TEST 5] Verify Execution Context');
    console.log('-'.repeat(70));

    if (runtime.executionContext) {
      console.log('✓ Execution context created');
      console.log('  - Builtins:', Object.keys(runtime.executionContext.builtins).length);
      console.log('  - Buffers:', Object.keys(runtime.executionContext.buffers).length);
      console.log('  - Metadata:', runtime.executionContext.metadata.networkName);
    } else {
      console.log('✗ Execution context not created');
    }

    console.log('\n[TEST 6] Test Error Handling');
    console.log('-'.repeat(70));

    try {
      const badRuntime = new Runtime({
        sourcePath: '/nonexistent/file.mycelial',
        outputPath: '/tmp/output.elf',
        verbose: false
      });

      await badRuntime.compile();
      console.log('✗ Should have thrown error for missing file');
    } catch (error) {
      console.log('✓ Correctly handled missing file error:', error.message);
    }

    console.log('\n' + '='.repeat(70));
    console.log('  ALL TESTS COMPLETED');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

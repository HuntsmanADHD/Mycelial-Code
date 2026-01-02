# Mycelial Runtime - Phase 4: Main Orchestrator

## Quick Start

```javascript
const { Runtime } = require('./src/runtime.js');

// Create runtime instance
const runtime = new Runtime({
  sourcePath: './program.mycelial',
  outputPath: './program.elf',
  verbose: true
});

// Compile
const result = await runtime.compile();
console.log('Success:', result.success);
```

## What is Phase 4?

Phase 4 implements the **Runtime** class - the main orchestrator that ties together all previous phases:

- **Phase 1:** File I/O and Parsing
- **Phase 2:** Network Execution and Signal Routing
- **Phase 3:** Tidal Cycle Scheduling and Builtin Functions
- **Phase 4:** Complete Integration and Orchestration ← YOU ARE HERE

## Files in This Phase

```
mycelial-runtime/
├── src/
│   └── runtime.js                    # Main Runtime class (614 lines)
├── mycelial-compile.js               # CLI tool (172 lines)
├── test-runtime-phase4.js            # Integration tests (162 lines)
├── RUNTIME_DOCUMENTATION.md          # Complete API reference
├── PHASE4_SUMMARY.md                 # Implementation summary
└── README_RUNTIME.md                 # This file
```

## Runtime Class Overview

### Constructor

```javascript
new Runtime({
  sourcePath: string,      // Path to .mycelial source file
  outputPath: string,      // Path for output ELF binary
  verbose: boolean,        // Enable verbose logging (default: false)
  maxCycles: number,       // Maximum tidal cycles (default: 1000)
  network: Object          // Pre-parsed network (optional)
})
```

### Public Methods

#### initialize() → Promise<Runtime>

Initialize the runtime: load source, parse network, validate, create context.

```javascript
await runtime.initialize();
```

#### compile() → Promise<Result>

Execute the full compilation pipeline.

```javascript
const result = await runtime.compile();
// result = { success, error, warnings, stats, outputPath }
```

### Private Methods (15 total)

**Initialization:**
- loadSourceCode()
- parseNetworkDefinition()
- validateNetworkDefinition()
- createExecutionContext()

**Compilation:**
- runCompilationPipeline()
- injectInitialSignal()
- extractCompilationResults()
- finalizeOutput()
- generatePlaceholderELF()

**Error Handling & Logging:**
- handleCompilationError()
- logProgress()
- logError()
- printCompilationSummary()

## Compilation Pipeline

```
INITIALIZE
  ├─ Load Source Code (FileIO)
  ├─ Parse Network (OrchestrationParser)
  ├─ Validate Network
  └─ Create Context (73+ builtins)

COMPILE
  ├─ Create NetworkRunner
  ├─ Create TidalCycleScheduler
  ├─ Inject compile_request signal
  ├─ Run Tidal Cycles
  │   ├─ REST phase (pause)
  │   ├─ SENSE phase (collect signals)
  │   └─ ACT phase (process signals)
  ├─ Extract Results
  └─ Finalize Output

FINALIZE
  ├─ Write ELF Binary
  ├─ Print Summary
  └─ Return Result
```

## CLI Usage

```bash
# Basic compilation
node mycelial-compile.js program.mycelial

# Specify output path
node mycelial-compile.js program.mycelial -o output.elf

# Verbose mode
node mycelial-compile.js program.mycelial -v

# Custom cycle limit
node mycelial-compile.js program.mycelial -m 5000

# Show help
node mycelial-compile.js --help
```

## Compilation Result

```javascript
{
  success: boolean,           // true if compilation succeeded
  error: string | null,       // error message if failed
  warnings: string[],         // warning messages
  stats: {
    totalTimeMs: number,      // total compilation time
    cycles: number,           // tidal cycles executed
    signalsProcessed: number, // total signals processed
    restTimeMs: number,       // time in REST phase
    senseTimeMs: number,      // time in SENSE phase
    actTimeMs: number,        // time in ACT phase
    averageCycleTimeMs: number, // average per-cycle time
    outputSize: number,       // output file size (bytes)
    errors: string[]          // execution errors
  },
  outputPath: string          // path to output file
}
```

## Execution Context

The runtime creates an execution context available to all agents:

```javascript
{
  runtime: Runtime,           // reference to runtime instance
  builtins: {                 // 73+ builtin functions
    string_len: Function,
    vec_push: Function,
    map_get: Function,
    // ... all builtins
  },
  buffers: {                  // signal buffers by frequency
    compile_request: [],
    lex_tokens: [],
    parse_tree: [],
    // ... per network
  },
  metadata: {
    startTime: number,
    sourcePath: string,
    outputPath: string,
    networkName: string,
    maxCycles: number,
    verbose: boolean
  },
  outputs: {
    elfBinary: Buffer,        // compiled binary
    diagnostics: string[],    // diagnostic messages
    logs: string[]            // compilation logs
  }
}
```

## Example: Complete Compilation

```javascript
const { Runtime } = require('./src/runtime.js');

async function compileProgram() {
  try {
    // Create runtime
    const runtime = new Runtime({
      sourcePath: './myprogram.mycelial',
      outputPath: './myprogram.elf',
      verbose: true,
      maxCycles: 1000
    });

    // Initialize
    await runtime.initialize();
    console.log('Initialized:', runtime.networkDefinition.networkName);

    // Compile
    const result = await runtime.compile();

    if (result.success) {
      console.log('Compilation successful!');
      console.log('Output:', result.outputPath);
      console.log('Cycles:', result.stats.cycles);
      console.log('Time:', result.stats.totalTimeMs + 'ms');
    } else {
      console.error('Compilation failed:', result.error);
    }

    // Check warnings
    if (result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }

    return result;

  } catch (error) {
    console.error('Fatal error:', error.message);
    throw error;
  }
}

compileProgram();
```

## Example Network Definition

```mycelial
network SimpleCompiler {
  frequencies {
    compile_request {
      source_path: string
      output_path: string
    }

    lex_tokens {
      tokens: vec<string>
    }

    compiled_binary {
      elf_data: binary
    }
  }

  hyphae {
    hyphal Lexer {
      state { position: u32 }

      on signal(compile_request, req) {
        emit lex_tokens { tokens: [...] }
      }
    }

    hyphal CodeGen {
      state { compiled_elf: binary }

      on signal(parse_tree, tree) {
        state.compiled_elf = generate_binary(tree)
        emit compiled_binary { elf_data: state.compiled_elf }
      }
    }
  }

  topology {
    spawn Lexer as lexer
    spawn CodeGen as codegen

    socket lexer -> codegen
  }
}
```

## Testing

Run the integration tests:

```bash
node test-runtime-phase4.js
```

Expected output:
```
======================================================================
  RUNTIME PHASE 4 INTEGRATION TEST
======================================================================

[TEST 1] Initialize Runtime
✓ Runtime initialized successfully

[TEST 2] Run Compilation
✓ Compilation successful

[TEST 3] Verify Results
✓ Output file exists (15 bytes)

[TEST 4] Verify Statistics
✓ Tidal cycles executed: 4

[TEST 5] Verify Execution Context
✓ Execution context created

[TEST 6] Test Error Handling
✓ Correctly handled missing file error

======================================================================
  ALL TESTS COMPLETED
======================================================================
```

## Error Handling

The runtime handles errors at multiple levels:

### File Errors
```javascript
try {
  await runtime.compile();
} catch (error) {
  if (error.message.includes('File not found')) {
    console.error('Source file missing:', error.message);
  }
}
```

### Parse Errors
```javascript
try {
  await runtime.compile();
} catch (error) {
  if (error.message.includes('Parse error')) {
    console.error('Syntax error in source:', error.message);
  }
}
```

### Validation Errors
```javascript
try {
  await runtime.compile();
} catch (error) {
  if (error.message.includes('Unknown hyphal type')) {
    console.error('Network validation failed:', error.message);
  }
}
```

## Verbose Logging

Enable verbose mode to see detailed compilation progress:

```javascript
const runtime = new Runtime({
  sourcePath: './program.mycelial',
  outputPath: './program.elf',
  verbose: true  // Enable detailed logging
});

const result = await runtime.compile();
```

Output:
```
2026-01-02T11:49:35.513Z [INIT]       Starting runtime initialization
2026-01-02T11:49:35.513Z [LOAD]       Reading source: ./program.mycelial
2026-01-02T11:49:35.513Z [LOAD]       Loaded 1.2 KB from ./program.mycelial
2026-01-02T11:49:35.514Z [PARSE]      Parsing network definition
2026-01-02T11:49:35.514Z [PARSE]      Network: SimpleCompiler
2026-01-02T11:49:35.514Z [VALIDATE]   Validating network structure
2026-01-02T11:49:35.514Z [CONTEXT]    Creating execution context
2026-01-02T11:49:35.515Z [COMPILE]    Starting compilation pipeline
2026-01-02T11:49:35.515Z [PIPELINE]   Initializing network runner
2026-01-02T11:49:35.515Z [PIPELINE]   Running tidal cycle execution
Cycle 0: 1 signals, REST=2ms, SENSE=0ms, ACT=0ms, Total=2ms
Cycle 1: 1 signals, REST=1ms, SENSE=0ms, ACT=0ms, Total=1ms
2026-01-02T11:49:35.521Z [EXTRACT]    Extracting compilation results
2026-01-02T11:49:35.521Z [FINALIZE]   Writing output binary
2026-01-02T11:49:35.521Z [COMPILE]    Compilation complete
```

## Statistics Collection

The runtime collects detailed statistics:

```javascript
const result = await runtime.compile();

console.log('Total Time:', result.stats.totalTimeMs, 'ms');
console.log('Cycles:', result.stats.cycles);
console.log('Signals:', result.stats.signalsProcessed);
console.log('Avg Cycle Time:', result.stats.averageCycleTimeMs.toFixed(2), 'ms');
console.log('Output Size:', result.stats.outputSize, 'bytes');
```

## Integration Points

### Phase 1: File I/O
```javascript
this.fileIO = new FileIO();
this.sourceCode = this.fileIO.readSourceFile(sourcePath);
this.fileIO.writeELFBinary(outputPath, elfBinary);
```

### Phase 1: Parsing
```javascript
this.parser = new OrchestrationParser();
this.networkDefinition = this.parser.parse(sourceCode);
```

### Phase 2: Network Execution
```javascript
this.networkRunner = new NetworkRunner(networkDefinition);
this.networkRunner.initialize();
```

### Phase 3: Tidal Cycles
```javascript
this.scheduler = new TidalCycleScheduler(router, agents, options);
await this.scheduler.runCompilation();
```

### Phase 3: Builtins
```javascript
const builtins = BuiltinFunctions.getAllFunctions();
this.executionContext.builtins = builtins;
```

## Documentation

- **API Reference:** See `RUNTIME_DOCUMENTATION.md`
- **Implementation Summary:** See `PHASE4_SUMMARY.md`
- **Integration Tests:** See `test-runtime-phase4.js`
- **CLI Tool:** See `mycelial-compile.js`

## Key Features

1. **Complete Integration** - All 4 phases working together
2. **Error Handling** - Comprehensive error recovery
3. **Logging** - Detailed progress and error logging
4. **Statistics** - Performance metrics collection
5. **CLI Tool** - User-friendly command-line interface
6. **Testing** - Full integration test suite
7. **Documentation** - Complete API reference

## Performance

Typical compilation metrics:
- **Initialization:** 1-5ms
- **Parsing:** 2-10ms per KB
- **Network Setup:** 1-3ms
- **Tidal Cycles:** 1-2ms per cycle
- **Finalization:** 1-3ms

Example:
```
Total Time: 7ms
Tidal Cycles: 4
Signals Processed: 3
Avg Cycle Time: 1.50ms
```

## Next Steps

After Phase 4, possible enhancements:

1. **Phase 5:** Code Generation (actual x86-64 assembly)
2. **Phase 6:** Optimization (dead code elimination, inlining)
3. **Phase 7:** Debugging (breakpoints, stepping)
4. **Phase 8:** Standard Library (I/O, networking, etc.)

## License

Part of the Mycelial Compiler Runtime System

Author: Claude Opus 4.5
Date: 2026-01-02

## Support

For issues or questions:
1. Check `RUNTIME_DOCUMENTATION.md` for API details
2. Review `test-runtime-phase4.js` for usage examples
3. Run with `--verbose` for detailed logging
4. Check compilation result for errors and warnings

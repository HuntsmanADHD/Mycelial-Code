# Mycelial Runtime - Phase 4 Documentation

## Overview

The **Runtime** class is the main orchestrator for the Mycelial compilation system. It coordinates all compilation phases from source loading to binary generation, integrating File I/O, parsing, network execution, and ELF generation.

## Architecture

```
Runtime (Phase 4)
├── FileIO (Phase 1)
├── OrchestrationParser (Phase 1)
├── NetworkRunner (Phase 2)
├── TidalCycleScheduler (Phase 3)
└── BuiltinFunctions (Phase 3)
```

## Class: Runtime

### Constructor

```javascript
new Runtime(options)
```

**Parameters:**
- `options.sourcePath` (string): Path to .mycelial source file
- `options.outputPath` (string): Path for output ELF binary
- `options.verbose` (boolean): Enable verbose logging (default: false)
- `options.maxCycles` (number): Maximum tidal cycles (default: 1000)
- `options.network` (Object): Pre-parsed network definition (optional)

**Example:**
```javascript
const runtime = new Runtime({
  sourcePath: './program.mycelial',
  outputPath: './program.elf',
  verbose: true,
  maxCycles: 500
});
```

---

## Public Methods

### initialize()

Initialize the runtime: load source, parse network, validate, create context.

**Returns:** `Promise<Runtime>` - This runtime instance (for chaining)

**Throws:** Error if initialization fails

**Steps:**
1. Load source code from disk
2. Parse network definition
3. Validate network structure
4. Create execution context with builtins

**Example:**
```javascript
await runtime.initialize();
```

---

### compile()

Execute the full compilation pipeline.

**Returns:** `Promise<Object>` - Compilation result

**Result Structure:**
```javascript
{
  success: boolean,
  error: string | null,
  warnings: string[],
  stats: {
    totalTimeMs: number,
    cycles: number,
    signalsProcessed: number,
    restTimeMs: number,
    senseTimeMs: number,
    actTimeMs: number,
    averageCycleTimeMs: number,
    outputSize: number,
    errors: string[]
  },
  outputPath: string
}
```

**Example:**
```javascript
const result = await runtime.compile();
if (result.success) {
  console.log('Compilation successful:', result.outputPath);
}
```

---

## Private Methods

### Initialization Phase

#### loadSourceCode()
Load source code from disk using FileIO.

**Logs:** File size and path
**Throws:** Error if file not found or unreadable

---

#### parseNetworkDefinition()
Parse network definition using OrchestrationParser.

**Logs:** Network name, frequencies, hyphae, topology stats
**Throws:** Error if parsing fails

---

#### validateNetworkDefinition()
Validate network structure for correctness.

**Validation Checks:**
- All spawned agents have hyphal definitions
- All socket connections reference valid agents
- No dangling references

**Throws:** Error if validation fails

---

#### createExecutionContext()
Create execution context with builtins and buffers.

**Context Structure:**
```javascript
{
  runtime: Runtime,           // Reference to this runtime
  builtins: Object,           // All 73+ builtin functions
  buffers: Object,            // Signal buffers by frequency
  metadata: {
    startTime: number,
    sourcePath: string,
    outputPath: string,
    networkName: string,
    maxCycles: number,
    verbose: boolean
  },
  outputs: {
    elfBinary: Buffer,
    diagnostics: string[],
    logs: string[]
  }
}
```

---

### Compilation Phase

#### runCompilationPipeline()
Execute the compilation pipeline with tidal cycles.

**Steps:**
1. Create NetworkRunner
2. Create TidalCycleScheduler
3. Compute execution order
4. Inject initial signal
5. Run scheduler until quiescence
6. Collect statistics

**Logs:** Cycle count, signals processed, execution time

---

#### injectInitialSignal(signalQueue)
Inject initial `compile_request` signal to trigger compilation.

**Signal Structure:**
```javascript
{
  frequency: 'compile_request',
  payload: {
    source_path: string,
    output_path: string,
    timestamp: number
  },
  source: 'runtime'
}
```

**Target:** First agent in topology spawns

---

#### extractCompilationResults()
Extract ELF binary from agent outputs.

**Search Strategy:**
1. Check for `state.output_binary`
2. Check for `state.compiled_elf`
3. Generate placeholder if none found

**Logs:** Which agent provided the binary

---

#### finalizeOutput()
Write ELF binary to disk.

**Steps:**
1. Get binary from execution context
2. Convert to Buffer if needed
3. Write using FileIO
4. Set executable permissions (Unix/Linux)
5. Log file size

**Throws:** Error if write fails

---

#### generatePlaceholderELF()
Generate minimal ELF header for testing.

**Returns:** `Buffer` - 64-byte minimal ELF header for x86-64 Linux

**Format:**
- Magic: `0x7f 0x45 0x4c 0x46` (ELF)
- Class: 64-bit
- Data: Little-endian
- Machine: x86-64

---

### Error Handling & Logging

#### handleCompilationError(error, stage)
Central error handler with context.

**Parameters:**
- `error` (Error): The error that occurred
- `stage` (string): Compilation stage (e.g., 'initialization', 'compilation')

**Actions:**
- Log error with context
- Update compilation result
- Mark compilation as failed

---

#### logProgress(stage, message, data)
Log progress message (only if verbose).

**Format:**
```
2026-01-02T11:49:35.513Z [STAGE]      Message
{
  "data": "formatted as JSON"
}
```

**Parameters:**
- `stage` (string): Stage tag (e.g., 'INIT', 'PARSE')
- `message` (string): Progress message
- `data` (Object): Additional data (optional)

---

#### logError(error, stage, context)
Log error with full context.

**Format:**
```
2026-01-02T11:49:35.513Z [STAGE]      ERROR: Error message
Stack trace: ...
Context: { ... }
```

**Parameters:**
- `error` (Error): The error
- `stage` (string): Stage where error occurred
- `context` (Object): Additional context

---

#### printCompilationSummary(result)
Print formatted compilation summary.

**Output:**
```
======================================================================
  MYCELIAL COMPILATION SUMMARY
======================================================================

Status: SUCCESS
Output: /path/to/output.elf
Size: 1.2 KB

Warnings (1):
  1. No ELF binary generated by agents

Statistics:
  Total Time: 125ms
  Tidal Cycles: 15
  Signals Processed: 42
  Avg Cycle Time: 8.33ms

======================================================================
```

---

## Execution Flow

### Complete Compilation Pipeline

```
1. INITIALIZE
   ├── Load Source Code (FileIO)
   ├── Parse Network (OrchestrationParser)
   ├── Validate Network (internal)
   └── Create Context (BuiltinFunctions)

2. COMPILE
   ├── Create NetworkRunner
   ├── Create TidalCycleScheduler
   ├── Inject compile_request signal
   ├── Run Tidal Cycles (REST → SENSE → ACT)
   │   ├── Cycle 0: Process compile_request
   │   ├── Cycle 1: Process lexer output
   │   ├── Cycle 2: Process parser output
   │   └── Cycle N: Network quiescence
   ├── Extract Results (from agent states)
   └── Finalize Output (write ELF)

3. FINALIZE
   ├── Write Binary (FileIO)
   ├── Print Summary
   └── Return Result
```

---

## Error Handling Strategy

### Recoverable Errors
- Invalid signal routing → Log warning, continue
- Missing output binary → Generate placeholder, add warning
- Execution errors in cycles → Collect in stats, continue

### Fatal Errors
- Source file not found → Abort at initialization
- Parse errors → Abort at parsing
- Validation errors → Abort at validation
- Write errors → Abort at finalization

---

## Statistics Tracking

The runtime tracks detailed statistics throughout compilation:

```javascript
stats: {
  totalTimeMs: 125,           // Total compilation time
  cycles: 15,                 // Number of tidal cycles
  signalsProcessed: 42,       // Total signals processed
  restTimeMs: 15,             // Time in REST phase
  senseTimeMs: 8,             // Time in SENSE phase
  actTimeMs: 102,             // Time in ACT phase
  averageCycleTimeMs: 8.33,   // Average per-cycle time
  outputSize: 1234,           // Output file size (bytes)
  errors: []                  // Execution errors
}
```

---

## Usage Examples

### Basic Compilation

```javascript
const { Runtime } = require('./src/runtime.js');

const runtime = new Runtime({
  sourcePath: './program.mycelial',
  outputPath: './program.elf',
  verbose: false
});

const result = await runtime.compile();
if (result.success) {
  console.log('Success!', result.stats);
} else {
  console.error('Failed:', result.error);
}
```

### Verbose Mode with Custom Settings

```javascript
const runtime = new Runtime({
  sourcePath: './complex-program.mycelial',
  outputPath: './output.elf',
  verbose: true,
  maxCycles: 5000
});

await runtime.initialize();
console.log('Context:', runtime.executionContext.metadata);

const result = await runtime.compile();
```

### Error Handling

```javascript
try {
  const runtime = new Runtime({
    sourcePath: './program.mycelial',
    outputPath: './output.elf'
  });

  const result = await runtime.compile();

  if (result.warnings.length > 0) {
    console.warn('Warnings:', result.warnings);
  }
} catch (error) {
  console.error('Compilation failed:', error.message);
}
```

---

## Integration with Other Phases

### Phase 1: File I/O
```javascript
this.fileIO.readSourceFile(sourcePath)
this.fileIO.writeELFBinary(outputPath, buffer)
```

### Phase 2: Network Execution
```javascript
this.networkRunner = new NetworkRunner(networkDefinition)
this.networkRunner.initialize()
```

### Phase 3: Tidal Cycles
```javascript
this.scheduler = new TidalCycleScheduler(router, agents, options)
this.scheduler.computeExecutionOrder()
await this.scheduler.runCompilation()
```

### Phase 3: Builtins
```javascript
const builtins = BuiltinFunctions.getAllFunctions()
context.builtins = builtins
```

---

## Implementation Metrics

- **Total Lines:** 614
- **Methods:** 18 (2 public, 16 private)
- **Dependencies:** 5 modules
- **Error Handlers:** 3 dedicated methods
- **Logging Methods:** 3 (progress, error, summary)

---

## Testing

See `test-runtime-phase4.js` for comprehensive integration tests covering:
- Initialization
- Compilation pipeline
- Result extraction
- Error handling
- Statistics collection
- File I/O operations

---

## Future Enhancements

1. **Parallel Compilation:** Support multiple source files
2. **Incremental Compilation:** Cache parsed networks
3. **Debug Mode:** Step-through tidal cycle execution
4. **Profiling:** Detailed performance analysis per agent
5. **Optimization:** Dead code elimination, signal batching
6. **Streaming:** Process large files incrementally

---

## License

Part of the Mycelial Compiler Runtime System
Author: Claude Opus 4.5
Date: 2026-01-02

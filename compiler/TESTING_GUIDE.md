# M1 Compiler Testing Guide

## Quick Start

The Mycelial compiler consists of 5 agent implementations that work together in a pipeline. Testing requires running them through the Mycelial interpreter.

### Prerequisites

```bash
# The simulator (interpreter) is located at:
/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/

# It has a CLI test harness:
/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/test-cli.js

# Your compiler code is at:
/home/lewey/Desktop/mycelial-compiler/compiler/
```

---

## Phase 1: Unit Test Individual Agents

Each agent has been tested with unit tests embedded in the code. Run these from the simulator:

### Option A: Run via the simulator's test-cli.js

```bash
cd /home/lewey/Desktop/MyLanguage/05-TOOLS/simulator

# Run parser tests
node test-cli.js /home/lewey/Desktop/mycelial-compiler/tests/parser_test.mycelial

# Run code gen tests
node test-cli.js /home/lewey/Desktop/mycelial-compiler/tests/codegen_test.mycelial
node test-cli.js /home/lewey/Desktop/mycelial-compiler/tests/codegen_unit_tests.mycelial

# Run assembler tests
node test-cli.js /home/lewey/Desktop/mycelial-compiler/tests/assembler_test.mycelial
```

### What Each Test Verifies

**Parser Tests** (`parser_test.mycelial`):
- ✅ Parses hello_world.mycelial correctly
- ✅ Generates correct AST with 50+ node types
- ✅ Handles expression precedence (1 + 2 * 3 = 7, not 9)
- ✅ Parses conditional statements

**CodeGen Tests** (`codegen_test.mycelial` + `codegen_unit_tests.mycelial`):
- ✅ All 27 LIR opcodes translate to x86-64
- ✅ Instruction encodings are correct
- ✅ Register allocation works
- ✅ Prologue/epilogue generation

**Assembler Tests** (`assembler_test.mycelial`):
- ✅ 60+ instruction encodings verified
- ✅ All addressing modes work
- ✅ REX prefix generation correct
- ✅ Two-pass assembly produces correct sizes

---

## Phase 2: Integration Test - Full Pipeline

This is the next step. You need to:

### Step 1: Create Orchestration Layer

Create `/home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial` that:
1. Imports all 5 agents
2. Wires up signal flow between them
3. Implements main input/output logic

**Structure**:
```mycelial
network mycelial_compiler {
  // Define all agent frequencies and hyphae

  // Wire: Source → Lexer → Parser → TypeChecker → IR Gen → CodeGen → Assembler → Linker

  // Main orchestration hyphae
  hyphal orchestrator {
    on signal(run, program) {
      // Feed source to lexer
      // Connect all agent signals
      // Output final binary
    }
  }
}
```

### Step 2: Test with hello_world

```bash
cd /home/lewey/Desktop/MyLanguage/05-TOOLS/simulator

node test-cli.js /home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial \
  --input /home/lewey/Desktop/mycelial-compiler/tests/hello_world.mycelial \
  --output /tmp/hello
```

### Step 3: Verify Output

```bash
# Check if output is valid ELF
file /tmp/hello

# Try to run it (if on x86-64 Linux)
chmod +x /tmp/hello
/tmp/hello
# Should print: "Hello, World!"
```

---

## Phase 3: Test All Examples

Once hello_world works, test the other 5 example programs:

```bash
# Test each example through the compiler
for example in pipeline counter_agent map_reduce distributed_search consensus; do
  node test-cli.js /home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial \
    --input /home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/examples/$example.mycelial \
    --output /tmp/$example

  # Verify output
  file /tmp/$example
done
```

---

## Troubleshooting

### Error: "Cannot find module"

Make sure you're running from `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/`:

```bash
cd /home/lewey/Desktop/MyLanguage/05-TOOLS/simulator
node test-cli.js /path/to/test.mycelial
```

### Error: "Agent not found" or signal routing issues

This means the orchestration layer (Step 2 above) needs to be created - the individual agents exist but they're not wired together yet.

**Solution**: Create `mycelial-compiler.mycelial` that imports and wires all 5 agents.

### Error: "ELF header invalid"

The linker output doesn't have proper ELF format. Check:
- ✅ Linker agent correctly writes ELF magic (0x7F 'ELF')
- ✅ ELF header is 64 bytes
- ✅ Section layout is correct
- ✅ Program headers generated

---

## Current Status

### What's Complete ✅
- Parser agent (1,972 lines) - standalone, tested
- Code generator agent (1,230 lines) - standalone, tested
- Assembler agent (1,815 lines) - standalone, tested
- IR generator agent (1,651 lines) - standalone, tested
- Linker agent (1,047 lines) - standalone, ready

### What's Needed for M1 Completion ⏳
- [ ] Create `mycelial-compiler.mycelial` orchestration layer
- [ ] Wire all 5 agents together with signals
- [ ] Test with hello_world.mycelial
- [ ] Verify output is valid ELF executable
- [ ] Test other example programs

---

## Expected Output

When everything works, you should be able to:

```bash
$ cd /home/lewey/Desktop/MyLanguage/05-TOOLS/simulator
$ node test-cli.js /home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial \
    --input /home/lewey/Desktop/mycelial-compiler/tests/hello_world.mycelial \
    --output /tmp/hello

[Output from compiler agents...]

$ file /tmp/hello
/tmp/hello: ELF 64-bit LSB executable, x86-64, version 1 (SYSV)...

$ /tmp/hello
Hello, World!
```

---

## Next Steps

1. **Create orchestration layer** - Wire all 5 agents together
2. **Test with hello_world** - Basic validation
3. **Test with other examples** - Full language coverage
4. **Verify ELF output** - Use `readelf` and `objdump` to inspect
5. **Bootstrap preparation** - Ready for Gen0 → Gen1 → Gen2

---

## Reference

- Simulator: `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/`
- Compiler agents: `/home/lewey/Desktop/mycelial-compiler/compiler/`
- Test programs: `/home/lewey/Desktop/mycelial-compiler/tests/`
- Examples: `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/examples/`

---

*Testing guide prepared for M1 integration verification*

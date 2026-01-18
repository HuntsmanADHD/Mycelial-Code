# 🚀 Gen1 Self-Hosting Plan

**Path to self-hosting in 3 steps. Built different.**

---

## The Vision

```
Gen0 (JavaScript) → compiles → Bootstrap Compiler → Gen1 (native binary)
Gen1 (native)     → compiles → Bootstrap Compiler → Gen2 (native binary)
Gen2 == Gen1 (byte-identical) = SELF-HOSTING ACHIEVED ✅
```

---

## Current State: Gen0 Complete ✅

**What we have:**
- Gen0 JavaScript compiler (runtime/src/compiler/)
- Bootstrap compiler source (self-hosted-compiler/mycelial-compiler.mycelial) - 8,700+ lines
- Gen0 successfully compiles bootstrap → object file (.o) in 79ms
- All language features working (for-kv, ranges, tuples, match, patterns)

**The gap:**
- Gen0 produces object files, not executables
- Object files need builtin function implementations to link
- We just built those builtins! (10 functions, ~200 lines of C)

---

## Step 1: Build Minimal Builtins ⏳

**Goal:** Compile the 10 core builtin functions

**Files:**
- `runtime/c/minimal-builtins.c` - The 10 builtins (vec, string, I/O)
- `runtime/c/minimal-builtins.h` - Header file
- `runtime/c/Makefile.minimal` - Build script

**Command:**
```bash
cd runtime/c
make -f Makefile.minimal
```

**Expected output:**
```
✅ Built minimal-builtins.o
   Ready to link with bootstrap compiler!
```

**What it does:**
Compiles 10 C functions into a relocatable object file:
1. `builtin_vec_new()` - Create vector
2. `builtin_vec_push()` - Append
3. `builtin_vec_len()` - Get length
4. `builtin_vec_get()` - Array access
5. `builtin_vec_set()` - Array assignment
6. `builtin_string_len()` - String length
7. `builtin_char_at()` - Get character
8. `builtin_format()` - Format strings
9. `builtin_write_file()` - Write binary
10. `builtin_chmod()` - Make executable

**Why only 10?**
Because that's ALL the linker needs. We're not C. We're not Rust. We cut the fat.

---

## Step 2: Link Gen1 Compiler ⏳

**Goal:** Link bootstrap compiler object with builtins → Gen1 executable

**Prerequisite:**
- Gen0 must have compiled bootstrap compiler to `.o` file
- Check for: `artifacts/mycelial-compiler.o` (or similar)

**Command:**
```bash
./link-bootstrap.sh
```

**What it does:**
1. Checks for bootstrap compiler object file (Gen0 output)
2. Checks for minimal-builtins.o (builds if missing)
3. Links them together using gcc:
   ```bash
   gcc -no-pie -o gen1-compiler \
       artifacts/mycelial-compiler.o \
       runtime/c/minimal-builtins.o \
       -lc
   ```
4. Creates `gen1-compiler` executable

**Expected output:**
```
🔗 Linking bootstrap compiler with minimal runtime...

   Input:
     - artifacts/mycelial-compiler.o (Gen0 output)
     - runtime/c/minimal-builtins.o (10 core builtins)

✅ Linked successfully!

   Output: gen1-compiler

📊 Gen1 Compiler Stats:
   Size: ~500KB
   Type: Native x86-64 ELF executable

✅ Valid ELF64 executable

🎉 GEN1 READY!
```

**What you have now:**
- `gen1-compiler` - A native x86-64 binary
- Written entirely IN Mycelial
- Compiled BY Mycelial (Gen0)
- Can compile Mycelial programs to native code
- **This is a self-hosting compiler!**

---

## Step 3: Test Gen1 Compiler ⏳

**Goal:** Verify Gen1 works correctly

**Test 1: Simple program**
```bash
./gen1-compiler tests/hello_world.mycelial
./tests/hello_world.elf
echo $?  # Should be 0
```

**Expected:**
- Gen1 compiles hello_world.mycelial
- Output binary runs successfully
- Exit code 0

**Test 2: Compile itself! (Gen2)**
```bash
./gen1-compiler self-hosted-compiler/mycelial-compiler.mycelial -o gen2-compiler
```

**Expected:**
- Gen1 compiles the bootstrap compiler source
- Produces gen2-compiler binary
- Should take ~79ms (same as Gen0)

**Test 3: Fixed point verification**
```bash
# Compare Gen1 and Gen2 binaries
cmp gen1-compiler gen2-compiler
```

**If they're identical:**
```
🎉 SELF-HOSTING FIXED POINT ACHIEVED!

Gen1 == Gen2 (byte-for-byte identical)

The compiler compiles itself to produce an identical binary.
We have achieved self-hosting.
No more JavaScript needed.
Pure Mycelial toolchain.

Built different. 🔥
```

**If they're different:**
```
Gen1 and Gen2 differ - this is expected on first try.
Differences could be due to:
- Timestamps in binaries
- Non-deterministic code generation
- Missing optimizations

Next step: Investigate differences and iterate until fixed point.
```

---

## Success Criteria

### Minimum Viable Gen1 ✅
- [ ] Minimal builtins compile successfully
- [ ] Gen1 links without errors
- [ ] Gen1 is a valid ELF64 executable
- [ ] Gen1 can compile hello_world.mycelial
- [ ] Output binary executes correctly

### Self-Hosting Achieved 🎯
- [ ] Gen1 compiles bootstrap compiler source
- [ ] Gen2 binary is produced
- [ ] Gen2 can compile programs
- [ ] Gen1 == Gen2 (fixed point)
- [ ] No more JavaScript needed

### Production Ready 🚀
- [ ] Gen1 compiles all test programs
- [ ] Output matches Gen0 output
- [ ] Performance is acceptable (<100ms for small programs)
- [ ] Error messages are helpful
- [ ] Documentation is complete

---

## Troubleshooting

### "Bootstrap compiler object not found"
**Problem:** Gen0 hasn't compiled the bootstrap compiler yet
**Solution:** Run Gen0 to compile `self-hosted-compiler/mycelial-compiler.mycelial`

### "Undefined symbol" during linking
**Problem:** Bootstrap compiler references a builtin we haven't implemented
**Solution:** Add the missing builtin to `minimal-builtins.c`

### Gen1 crashes immediately
**Problem:** Could be:
- Incorrect function signatures
- ABI mismatch
- Missing initialization

**Debug:**
```bash
gdb ./gen1-compiler
(gdb) run tests/hello_world.mycelial
(gdb) bt  # backtrace
```

### Gen1 produces different output than Gen0
**Problem:** Code generation differences
**Solution:**
- Compare assembly output
- Check for non-determinism (timestamps, addresses)
- Verify type handling matches

---

## The Bigger Picture

**This is the critical moment.**

Once Gen1 works, we have:
- Proven Mycelial can handle systems programming (compilers!)
- Proven the agent model scales to complex programs
- Achieved self-hosting (compiler compiles itself)
- Cut all dependencies on JavaScript
- Built a pure Mycelial toolchain

**From here we can:**
- Add more language features (M2)
- Optimize code generation (M5)
- Add ARM64 support (M4)
- Build standard library (M6)
- Create development tools (debugger, LSP)

**But first: Get Gen1 running.**

**Let's do this. Built different. 🔥**

---

## Timeline Estimate

- **Step 1 (Build builtins):** 2 minutes
- **Step 2 (Link Gen1):** 1 minute
- **Step 3 (Test Gen1):** 10-30 minutes (debugging if needed)

**Total: ~30 minutes to Gen1**

**Then: Iterations to fixed point (hours to days)**

We're SO CLOSE. Let's finish this.

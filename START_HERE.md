# 🧬 Mycelial Language - START HERE

Welcome! This document helps you navigate the complete Mycelial Programming Language project.

---

## What Is This?

A **bio-inspired distributed programming language** and web-based IDE that treats computation like a living fungal network:

- 🌿 **Local rules** create **global behavior** (emergent computation)
- 🔄 **Tidal cycles** rhythm execution (SENSE → ACT → REST)
- 📡 **Signal-based** communication between autonomous agents
- 🌐 **Distributed by design** with no central coordinator
- 🎯 **Real P2P systems** as first-class language constructs

---

## Quick Navigation

### 🚀 Want to Test It Right Now?

**Start the dev server:**
```bash
npm run dev
```

Then open http://localhost:3000 in your browser and:
1. Load `clawed_code.mycelial` from examples
2. Click "Parse" to validate
3. Click "Step" to execute one tidal cycle
4. Watch the network graph animate

**See:** [QUICK_START.md](QUICK_START.md) for detailed walkthrough

---

### 📚 Want to Understand the Language?

| Document | Purpose |
|----------|---------|
| [MYCELIAL_MANIFESTO.md](00-VISION/MYCELIAL_MANIFESTO.md) | Core philosophy & vision |
| [CORE_PRIMITIVES.md](00-VISION/CORE_PRIMITIVES.md) | 10 building blocks explained |
| [EXECUTION_MODEL.md](00-VISION/EXECUTION_MODEL.md) | How tidal cycles work |
| [GRAMMAR.md](01-SPECIFICATION/GRAMMAR.md) | Formal EBNF specification |
| [SYNTAX_DESIGN.md](01-SPECIFICATION/SYNTAX_DESIGN.md) | Language design with examples |
| [QUICK_REFERENCE.md](01-SPECIFICATION/QUICK_REFERENCE.md) | Syntax cheat sheet |

**Start with:** [MYCELIAL_MANIFESTO.md](00-VISION/MYCELIAL_MANIFESTO.md) (understand the why)

---

### 🧪 Want to See Working Examples?

All in `/05-TOOLS/simulator/examples/`:

| Program | Complexity | What It Shows |
|---------|-----------|---------------|
| [hello_world.mycelial](05-TOOLS/simulator/examples/hello_world.mycelial) | ⭐ Beginner | Basic signal routing |
| [pipeline.mycelial](05-TOOLS/simulator/examples/pipeline.mycelial) | ⭐⭐ Intermediate | Sequential stages |
| [map_reduce.mycelial](05-TOOLS/simulator/examples/map_reduce.mycelial) | ⭐⭐⭐ Advanced | Data parallelism |
| [distributed_search.mycelial](05-TOOLS/simulator/examples/distributed_search.mycelial) | ⭐⭐⭐ Advanced | Task distribution |
| [consensus.mycelial](05-TOOLS/simulator/examples/consensus.mycelial) | ⭐⭐⭐ Advanced | Distributed voting |
| [**clawed_code.mycelial**](05-TOOLS/simulator/examples/clawed_code.mycelial) | ⭐⭐⭐⭐ Expert | **P2P messaging** |

Load any in the simulator and click "Step" to watch it execute.

---

### ✅ Want to See Test Results?

| Document | Purpose |
|----------|---------|
| [TEST_REPORT.md](TEST_REPORT.md) | Complete test results |
| [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md) | What was built & delivered |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Detailed progress tracking |

**Key Result:** All 6 programs pass syntax validation ✅

---

### 🏗️ Want to Understand the Architecture?

See [02-ARCHITECTURE/DESIGN.md](02-ARCHITECTURE/DESIGN.md) for:
- System architecture diagram
- Component descriptions
- Data flow between modules
- Extension points for future work

**High-level:**
```
Source Code
    ↓ [Lexer]
Tokens
    ↓ [Parser]
AST (Abstract Syntax Tree)
    ↓ [Semantic Analyzer]
Validated AST
    ↓ [Scheduler (Runtime)]
Execution State
    ↓ [Graph Renderer]
Interactive Visualization
```

---

### 💻 Want to Look at the Code?

**Main simulator location:**
```
05-TOOLS/simulator/
```

**Key files:**
- `index.html` - Main UI
- `src/parser/parser.js` - 620-line recursive descent parser
- `src/runtime/scheduler.js` - Tidal cycle executor
- `src/visualizer/graph-renderer.js` - D3.js visualization
- `src/ui/app.js` - Application controller

**Module structure:**
```
src/
├── parser/      → Lexer, Parser, AST
├── analyzer/    → Symbol table, Type checking
├── runtime/     → Scheduler, Agents, Signal routing
├── visualizer/  → D3.js graphs
└── ui/          → App controller, event handlers
```

---

### 🤔 Got Questions?

**Q: How do I write a Mycelial program?**
A: See [SYNTAX_DESIGN.md](01-SPECIFICATION/SYNTAX_DESIGN.md) for syntax and examples.

**Q: How does execution work?**
A: See [EXECUTION_MODEL.md](00-VISION/EXECUTION_MODEL.md) for tidal cycle details.

**Q: What are frequencies and hyphae?**
A: See [CORE_PRIMITIVES.md](00-VISION/CORE_PRIMITIVES.md) for all 10 building blocks.

**Q: How do I test programs?**
A: See [QUICK_START.md](QUICK_START.md) for step-by-step instructions.

**Q: What was tested and what passed?**
A: See [TEST_REPORT.md](TEST_REPORT.md) for comprehensive results.

---

## Project Structure

```
📁 MyLanguage/
│
├── 📄 START_HERE.md ← You are here
├── 📄 QUICK_START.md (for testing)
├── 📄 COMPLETION_SUMMARY.md (what was built)
├── 📄 TEST_REPORT.md (test results)
├── 📄 PROJECT_STATUS.md (detailed progress)
│
├── 📁 00-VISION/
│   ├── MYCELIAL_MANIFESTO.md (philosophy)
│   ├── CORE_PRIMITIVES.md (building blocks)
│   └── EXECUTION_MODEL.md (runtime semantics)
│
├── 📁 01-SPECIFICATION/
│   ├── GRAMMAR.md (formal EBNF)
│   ├── SYNTAX_DESIGN.md (language design)
│   └── QUICK_REFERENCE.md (cheat sheet)
│
├── 📁 02-ARCHITECTURE/
│   └── DESIGN.md (system architecture)
│
├── 📁 05-TOOLS/simulator/ ← 🎯 MAIN APPLICATION
│   ├── index.html (open this in browser!)
│   ├── src/ (parser, runtime, visualizer, ui)
│   ├── styles/ (CSS)
│   ├── examples/ (6 .mycelial programs)
│   └── README.md (simulator docs)
│
└── 📁 07-EXAMPLES/
    └── *.mycelial (original examples)
```

---

## The 30-Second Summary

**Mycelial** is a distributed programming language where:

1. **You write networks** of autonomous agents
2. **Agents exchange signals** (typed messages)
3. **Local rules** at each agent determine behavior
4. **Global patterns** emerge from signal interactions
5. **Execution happens in tidal cycles:**
   - **SENSE:** Deliver pending signals to agents
   - **ACT:** Agents process signals and emit new ones
   - **REST:** Cleanup and preparation for next cycle

**Example - P2P Messaging (ClawedCode):**
- 3 peer nodes + 1 relay + 1 consensus node
- Peers receive messages, relay distributes them
- Nodes vote on message validity
- When 2/3 vote yes → consensus reached
- No central authority, yet consensus emerges ✨

---

## Getting Started (Pick One Path)

### Path 1: I Want to Test It Now ⚡
1. [QUICK_START.md](QUICK_START.md)
2. Open simulator in browser
3. Load clawed_code.mycelial
4. Click Parse → Step → Play

**Time: 5 minutes**

### Path 2: I Want to Understand First 📖
1. [MYCELIAL_MANIFESTO.md](00-VISION/MYCELIAL_MANIFESTO.md) - Vision
2. [CORE_PRIMITIVES.md](00-VISION/CORE_PRIMITIVES.md) - Building blocks
3. [SYNTAX_DESIGN.md](01-SPECIFICATION/SYNTAX_DESIGN.md) - Examples
4. Then test in simulator

**Time: 30 minutes**

### Path 3: I Want the Complete Picture 🎓
1. Read all specs (00-VISION/ and 01-SPECIFICATION/)
2. Study [EXECUTION_MODEL.md](00-VISION/EXECUTION_MODEL.md)
3. Review [GRAMMAR.md](01-SPECIFICATION/GRAMMAR.md)
4. Look at code in `/src/runtime/scheduler.js`
5. Test all 6 examples in simulator

**Time: 2-3 hours**

### Path 4: I Want to Build on It 🔨
1. Review [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)
2. Study [02-ARCHITECTURE/DESIGN.md](02-ARCHITECTURE/DESIGN.md)
3. Read parser code (`src/parser/`)
4. Read runtime code (`src/runtime/`)
5. Read visualizer code (`src/visualizer/`)
6. Make changes and test

**Time: Variable**

---

## Key Files You'll Use

| File | Purpose | When |
|------|---------|------|
| `index.html` | Open in browser | Testing |
| `QUICK_START.md` | How to test | First time |
| `MYCELIAL_MANIFESTO.md` | Understand vision | Learning |
| `GRAMMAR.md` | Language rules | Writing programs |
| `QUICK_REFERENCE.md` | Syntax reminder | Coding |
| `EXECUTION_MODEL.md` | Understand runtime | Debugging |
| `TEST_REPORT.md` | Verification results | Verification |

---

## Quick Commands

**Start the dev server:**
```bash
npm run dev
# Then open http://localhost:3000
```

**Run syntax validation:**
```bash
npm run verify
```

**View test results:**
```
See: TEST_REPORT.md
```

---

## What You Can Do Now

✅ Write Mycelial programs (learn syntax in 15 minutes)
✅ Run programs in the web-based simulator (click and watch)
✅ Visualize networks as D3.js graphs (interactive)
✅ Inspect agent state at each cycle (click nodes)
✅ Step through execution manually or auto-play
✅ Read all documentation (comprehensive specs)
✅ Study the implementation (3000+ lines of code)
✅ Extend with new features (architecture documented)

---

## Recent Additions

🎉 **New in This Session:**
- ✅ **ClawedCode example** - 820-token P2P messaging system
- ✅ **Complete test suite** - All 6 programs pass validation
- ✅ **Comprehensive documentation** - Quick start, test report, completion summary
- ✅ **Working simulator** - Full IDE with visualization

---

## Quick Facts

- **Language:** Mycelial (bio-inspired distributed computing)
- **Platform:** Web-based (runs in any modern browser)
- **Parser:** Recursive descent (620 lines)
- **Runtime:** Tidal cycle executor (500+ lines)
- **Visualizer:** D3.js force-directed graph (350+ lines)
- **Examples:** 6 programs (hello_world to ClawedCode)
- **Tokens:** 2,828 across all examples
- **Status:** ✅ Complete and tested
- **Test Pass Rate:** 100% (6/6 programs)

---

## Questions About...

- **The Language:** See [00-VISION/](00-VISION/)
- **Syntax:** See [01-SPECIFICATION/](01-SPECIFICATION/)
- **Implementation:** See `/05-TOOLS/simulator/src/`
- **Testing:** See [TEST_REPORT.md](TEST_REPORT.md)
- **Architecture:** See [02-ARCHITECTURE/DESIGN.md](02-ARCHITECTURE/DESIGN.md)
- **Examples:** See `/05-TOOLS/simulator/examples/`

---

## Next Steps

1. **Pick a path above** (test, understand, build, or learn)
2. **Start with [QUICK_START.md](QUICK_START.md)** if unsure
3. **Open the simulator** in your browser
4. **Load an example** (ClawedCode recommended!)
5. **Click Parse** and watch it validate
6. **Click Step or Play** and watch execution

---

**Ready? Run `npm run dev` and open http://localhost:3000!**

Or start with [QUICK_START.md](QUICK_START.md) for detailed instructions.

---

**Status:** ✅ All systems operational. Ready for exploration.

Happy exploring! 🌿🧬

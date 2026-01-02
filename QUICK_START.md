# Quick Start: Testing the Mycelial Simulator with ClawedCode

## What You Have

✅ **Complete web-based simulator** with:
- Full lexer/parser for .mycelial syntax
- Semantic analyzer (symbol table, type checking, topology validation)
- Runtime executor (tidal cycle: SENSE → ACT → REST)
- D3.js-based network visualization
- Interactive state inspection
- 6 example programs (including new **ClawedCode**)

✅ **All programs pass syntax validation** (820 tokens in ClawedCode alone)

## Step 1: Start the Dev Server

Run the following command in your terminal:
```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Step 2: Load an Example

The simulator will load with a code editor on the left and an empty graph on the right.

**Option A: Load from examples dropdown**
- Click the dropdown at the top (if available)
- Select "clawed_code.mycelial"

**Option B: Load the file manually**
- Click "📂 Load File" button
- Navigate to the `examples/` directory
- Select `clawed_code.mycelial`

The code will appear in the editor on the left.

## Step 3: Parse and Validate

1. Click the "✓ Parse" button
2. Wait for validation to complete
3. You should see:
   - No error messages
   - "Parsed successfully" confirmation
   - Network graph renders on the right showing all nodes and connections

## Step 4: Explore the Network

**What you'll see for ClawedCode:**
- **5 hyphal nodes:**
  - Peer_A, Peer_B, Peer_C (circles, green when active)
  - Relay_1 (circle, relays messages)
  - Consensus_1 (circle, collects votes)
- **3 fruiting bodies:**
  - input_messages (square, message source)
  - output_messages (square, result destination)
  - network_status (square, status reporting)
- **Connecting sockets** (lines with arrows showing direction and frequency type)

Click on any node to see its state in the bottom panel.

## Step 5: Execute Cycles

### Single Step
1. Click "⏭ Step" button
2. Simulator executes one tidal cycle (SENSE → ACT → REST)
3. Cycle counter increments
4. Graph updates with new state

**What happens in cycle 1:**
- Input receives message from external source
- Peers A, B, C all receive the message
- Each peer caches it and emits delivery acknowledgment
- State variables increment

### Auto-Play
1. Click "▶ Play" button (changes to "⏸ Pause")
2. Simulator auto-steps through cycles automatically
3. Adjust speed with slider at top (1=slow, 10=fast)
4. Click "⏸ Pause" to stop
5. Click "↺ Reset" to return to cycle 0

## Step 6: Inspect Agent State

1. Click on any hyphal node (Peer_A, Relay_1, etc.)
2. Bottom panel shows:
   - **State variables** (e.g., node_id: "Peer_A", message_cache: [...])
   - **Inbox** (signals waiting to be processed)
   - **Outbox** (signals this agent emitted this cycle)
   - **Active rules** (which rules matched this cycle)

## Step 7: Try Other Examples

After exploring ClawedCode, try these in order of complexity:

1. **hello_world.mycelial** - Simplest (78 tokens)
   - One agent receives greeting, emits response
   - Great for understanding basic concepts

2. **pipeline.mycelial** - Sequential (330 tokens)
   - Three stages: validator → processor → formatter
   - Watch data flow through stages

3. **map_reduce.mycelial** - Parallel (430 tokens)
   - Mapper distributes data to 3 reducers
   - Aggregator combines results
   - See data parallelism in action

4. **distributed_search.mycelial** - Coordination (643 tokens)
   - Coordinator sends search tasks to workers
   - Workers report results back
   - Demonstrates fan-out/fan-in patterns

5. **consensus.mycelial** - Voting (527 tokens)
   - 3 voters propose, tallier counts, observer watches
   - See how emergent consensus works
   - No central authority, yet agreement emerges

## Features of the Simulator

### Code Editor (Left Side)
- Syntax-aware editor with CodeMirror
- Load .mycelial files
- Drag-drop file support
- View code while watching execution

### Network Visualization (Right Side)
- Force-directed D3.js graph
- Nodes colored by health:
  - 🟢 Green = Active (processing signals)
  - ⚪ Gray = Idle (no signals)
  - 🟠 Orange = Degraded (errors, recovering)
  - 🔴 Red = Failed (unrecoverable)
- Click nodes to inspect state
- Edges labeled with frequency type

### Controls (Top)
- **Parse** - Validate syntax and semantics
- **Step** - Execute one tidal cycle
- **Play/Pause** - Auto-execute cycles
- **Reset** - Return to cycle 0
- **Speed slider** - Control playback speed
- **Cycle counter** - Shows current cycle number

### State Inspector (Bottom)
- Shows selected agent's state
- Displays all state variables with values
- Shows inbox (pending signals)
- Shows outbox (emitted signals)
- Lists active rules

### Error Panel (Below controls)
- Clear error messages
- Source locations (file:line:column)
- Validation errors with suggestions

## Understanding the Tidal Cycle

Each "Step" executes three phases:

### Phase 1: SENSE
- Simulator delivers all pending signals to agent inboxes
- Signals accumulated from previous cycle's outbox
- Routed through socket network

### Phase 2: ACT
- Each agent processes its inbox signals
- Matches signals against rules (pattern matching)
- Executes matching rule (emit new signals, update state)
- First matching rule wins (priority order)

### Phase 3: REST
- All agent outboxes flush to socket network
- Ready for next cycle's SENSE phase
- Cleanup and reporting

## Keyboard Shortcuts (if implemented)

- **Space** = Play/Pause (when focused)
- **Right Arrow** = Step forward one cycle
- **Left Arrow** = Reset (if timeline scrubbing implemented)

## Troubleshooting

### "Parse error" appears
- Check that file is valid .mycelial
- Run `node verify-syntax.js` in terminal to validate syntax
- All examples in /examples/ directory are pre-validated

### Graph doesn't render
- Parser must succeed first (click Parse button)
- Check browser console (F12) for JavaScript errors
- Try with hello_world.mycelial first (simplest example)

### State inspection shows empty/undefined
- Agent may not have been selected yet
- Click on a hyphal node (circle) to inspect
- Fruiting bodies (squares) are I/O only, not inspectable

### Cycles not progressing
- Click "⏭ Step" to manually advance one cycle
- Or click "▶ Play" to auto-advance
- Check that simulator is not paused

## What ClawedCode Demonstrates

The ClawedCode example is a **P2P messaging network simulator** showing:

### 1. **Distributed Message Routing**
```
input_messages → Peer_A
                 Peer_B  → Relay_1 → Consensus_1 → output_messages
                 Peer_C
```

### 2. **Consensus Formation**
- Peers receive message and vote
- Tallier counts votes (threshold = 2/3)
- When threshold reached, consensus decision emitted

### 3. **Resilience**
- No single point of failure
- If one peer fails, others continue
- Relay provides alternative routing paths

### 4. **Realistic Semantics**
- Message caching (prevent duplicates)
- Delivery acknowledgments
- Trust scores between peers
- Throughput metrics
- Active connection tracking

### 5. **Emergent Behavior**
- No centralized coordinator tells peers what to do
- Local rules at each peer
- Global behavior emerges from signal patterns
- This is the essence of mycelial computing!

## Next Steps

1. Open the simulator in your browser
2. Load each example program
3. Parse and visualize the network
4. Step through cycles and watch signals flow
5. Inspect agent state at each cycle
6. Try auto-play and adjust the speed slider
7. Explore how local rules create global behavior

## Files Location

```
Mycelial-Code/
├── 00-VISION/              # Philosophy and vision
├── 01-SPECIFICATION/       # Grammar and syntax specification
├── 05-TOOLS/simulator/     # Main simulator
│   ├── index.html          # Simulator UI
│   ├── examples/           # All 6 programs
│   └── src/                # Parser, analyzer, runtime, visualizer
└── 07-EXAMPLES/            # Original example programs (read-only)
```

## Important: Browser Compatibility

The simulator requires:
- Modern browser (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript support
- No plugins required
- Works online AND offline (opens with file:// URLs)

---

**Ready to explore?**

Run `npm run dev` and open http://localhost:3000 to start testing with ClawedCode!

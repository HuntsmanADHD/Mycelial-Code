# Mycelial Signal Runtime (C Implementation)

## Overview

This directory contains the C runtime library for compiled Mycelial programs. It provides the low-level infrastructure for signal creation, queuing, and routing between agents.

## Files

| File | Lines | Description |
|------|-------|-------------|
| `signal.h` | ~320 | Header with all struct definitions and function declarations |
| `dispatch.h` | ~200 | Dispatch table types and handler function signatures |
| `memory.c` | ~180 | Heap allocation using Linux mmap syscalls |
| `signal.c` | ~280 | Signal allocation and ring buffer queue operations |
| `routing.c` | ~320 | Routing table and agent registry |
| `dispatch.c` | ~280 | Signal dispatch to handler functions |
| `agents.h` | ~250 | Enhanced agent registry and topology types |
| `agents.c` | ~400 | Agent registry and network initialization |

## Building

```bash
# Compile to object files
gcc -c -O2 -Wall -Wextra memory.c -o memory.o
gcc -c -O2 -Wall -Wextra signal.c -o signal.o
gcc -c -O2 -Wall -Wextra routing.c -o routing.o
gcc -c -O2 -Wall -Wextra dispatch.c -o dispatch.o
gcc -c -O2 -Wall -Wextra agents.c -o agents.o

# Create static library
ar rcs libmycelial_runtime.a memory.o signal.o routing.o dispatch.o agents.o

# Or compile all at once
gcc -c -O2 -Wall -Wextra *.c
```

## Usage

### Initialization

```c
#include "signal.h"

int main() {
    // Initialize heap (16MB default)
    if (!heap_init(0)) {
        return 1;
    }

    // Create agent registry
    AgentRegistry* agents = agent_registry_create(MAX_AGENTS);

    // Create routing table
    RoutingTable* routes = routing_table_create(MAX_ROUTES);

    // ... create agents, add routes, run scheduler ...

    return 0;
}
```

### Creating and Routing Signals

```c
// Create a signal with payload
typedef struct { int value; char name[32]; } MyPayload;
MyPayload data = { .value = 42, .name = "hello" };

Signal* sig = signal_create(
    FREQ_MY_SIGNAL,     // frequency_id
    AGENT_SENDER,       // source_agent_id
    &data,              // payload
    sizeof(data)        // payload_size
);

// Route to all destinations
int delivered = routing_broadcast(routes, sig, agents);

// Or use convenience function
int delivered = emit_signal(routes, agents,
                            FREQ_MY_SIGNAL, AGENT_SENDER,
                            &data, sizeof(data));
```

### Queue Operations

```c
// Create queue
SignalQueue* queue = signal_queue_create(1024);

// Enqueue (increments ref_count)
int result = signal_queue_enqueue(queue, sig);
if (result == SIGNAL_ERR_QUEUE_FULL) {
    // Handle overflow
}

// Dequeue (does NOT decrement ref_count)
Signal* received = signal_queue_dequeue(queue);
if (received != NULL) {
    // Process signal...
    void* payload = signal_get_payload(received);

    // Free when done (decrements ref_count)
    signal_free(received);
}
```

### Signal Dispatch (Handler Tables)

```c
#include "dispatch.h"

// Define a handler function
int handle_increment(void* agent_state, Signal* signal) {
    MyState* state = (MyState*)agent_state;
    int* value = signal_get_payload(signal);
    state->count += *value;
    return 0;  // Success
}

// Guard function (for where clauses)
int guard_positive(void* agent_state, Signal* signal) {
    int* value = signal_get_payload(signal);
    return (*value > 0) ? 1 : 0;  // Pass if > 0
}

// Create dispatch table for agent
DispatchTable* table = dispatch_table_create(16, AGENT_ID);
dispatch_set_state(table, &my_agent_state);

// Register handlers
dispatch_register(table, FREQ_INCREMENT, handle_increment, NULL);
dispatch_register(table, FREQ_GUARDED, handle_guarded, guard_positive);

// Dispatch a signal
Signal* sig = signal_create(FREQ_INCREMENT, 1, &value, sizeof(value));
int result = dispatch_invoke(table, sig);
signal_free(sig);

// Process all signals in queue
int processed = dispatch_process_queue(table, queue);
```

### Network Topology Initialization

```c
#include "agents.h"

// Define network topology (compile-time generated)
AgentInfo agents[] = {
    { .agent_id = 1, .name = "source", .state_size = 8, .queue_capacity = 64 },
    { .agent_id = 2, .name = "sink", .state_size = 8, .queue_capacity = 64 }
};

SocketDef sockets[] = {
    { .source_agent_id = 1, .frequency_id = 1, .dest_agent_id = 2 }
};

NetworkTopology topology = {
    .agents = agents,
    .agent_count = 2,
    .sockets = sockets,
    .socket_count = 1,
    .network_name = "my_network"
};

// Initialize entire network
AgentRegistry2* registry = topology_init(&topology);

// Access agents
AgentInfo* source = registry_get_agent(registry, 1);
AgentInfo* sink = registry_get_agent_by_name(registry, "sink");

// Signals route automatically via routing table
Signal* sig = signal_create(1, 1, &data, sizeof(data));
routing_broadcast(registry->routing, sig, old_registry);

// Cleanup
topology_shutdown(registry);
```

## Performance Characteristics

### Cycle Counts (at 3 GHz)

| Operation | Cycles | Time |
|-----------|--------|------|
| `signal_alloc` | 40-60 | ~15ns |
| `signal_create` (with 64B payload) | 100-150 | ~40ns |
| `signal_free` | 30-50 | ~15ns |
| `signal_queue_enqueue` | 15-25 | ~7ns |
| `signal_queue_dequeue` | 12-20 | ~5ns |
| `routing_lookup` | 20-30 | ~8ns |
| `routing_broadcast` (per dest) | 50-100 | ~25ns |
| `dispatch_lookup` | 10-20 | ~5ns |
| `dispatch_invoke` | 30-50 | ~15ns |
| `dispatch_process_queue` (per signal) | 50-80 | ~20ns |

### Memory Usage

| Component | Size |
|-----------|------|
| Signal header | 32 bytes |
| SignalQueue struct | 64 bytes |
| Queue buffer (1024 signals) | 8 KB |
| RoutingEntry | 32 bytes |
| DispatchTable struct | 40 bytes |
| DispatchEntry | 24 bytes |
| Default heap | 16 MB |

### Throughput Estimates

- Signal creation: ~20M signals/second
- Queue operations: ~100M ops/second
- End-to-end (create + route): ~5-10M signals/second

## Design Decisions

### 1. Queue Overflow Behavior
**Decision:** Return error code, don't block.

The caller decides how to handle overflow:
- Drop the signal
- Wait and retry
- Log and continue

```c
if (signal_queue_enqueue(queue, sig) == SIGNAL_ERR_QUEUE_FULL) {
    // Overflow! Handle it.
    queue->dropped_count++;  // Already done internally
}
```

### 2. Heap Strategy
**Decision:** Pre-allocated pool with bump allocation + free list.

- Fast allocation (~40 cycles)
- No fragmentation for same-size allocations
- Freed blocks reused via LIFO free list

### 3. Error Handling
**Decision:** Return error codes (defensive).

All functions that can fail return error codes:
- `SIGNAL_OK` (0) - Success
- `SIGNAL_ERR_QUEUE_FULL` (1) - Queue is full
- `SIGNAL_ERR_NULL_POINTER` (3) - NULL argument
- `SIGNAL_ERR_ALLOC_FAILED` (4) - Heap allocation failed

### 4. Signal Sharing
**Decision:** Reference counting for zero-copy.

Signals can be shared across multiple queues (broadcast):
- `signal_ref()` increments count
- `signal_free()` decrements, frees when zero
- Payload is only freed when last reference is released

### 5. Payload Storage
**Decision:** Copy payload into signal-owned allocation.

- Caller's data is copied, not referenced
- Signal owns its payload (freed automatically)
- Avoids lifetime issues

## Integration with Compiler

The compiler generates code that calls these functions:

```asm
; Emit signal from agent code
mov rdi, frequency_id
mov rsi, source_agent_id
mov rdx, payload_ptr
mov rcx, payload_size
call signal_create

mov rdi, routing_table_ptr
mov rsi, rax              ; signal from above
mov rdx, agent_registry_ptr
call routing_broadcast
```

## API Reference

### Memory Functions (`memory.c`)

```c
int heap_init(size_t initial_size);
void* heap_allocate(size_t bytes);
int heap_free(void* ptr, size_t bytes);
size_t heap_get_used(void);
size_t heap_get_peak(void);
size_t heap_get_total(void);
```

### Signal Functions (`signal.c`)

```c
Signal* signal_alloc(void);
void signal_free(Signal* sig);
void signal_ref(Signal* sig);
Signal* signal_create(uint32_t frequency_id, uint32_t source_agent_id,
                      const void* payload, uint32_t payload_size);

SignalQueue* signal_queue_create(uint32_t capacity);
void signal_queue_destroy(SignalQueue* queue);
int signal_queue_enqueue(SignalQueue* queue, Signal* signal);
Signal* signal_queue_dequeue(SignalQueue* queue);
Signal* signal_queue_peek(SignalQueue* queue);

uint32_t signal_queue_count(SignalQueue* queue);
int signal_queue_is_full(SignalQueue* queue);
int signal_queue_is_empty(SignalQueue* queue);
```

### Routing Functions (`routing.c`)

```c
RoutingTable* routing_table_create(uint32_t capacity);
void routing_table_destroy(RoutingTable* table);
int routing_add_entry(RoutingTable* table, uint32_t source_agent_id,
                      uint32_t frequency_id, uint32_t dest_count,
                      const uint32_t* dest_agent_ids);
uint32_t* routing_lookup(RoutingTable* table, uint32_t source_agent_id,
                         uint32_t frequency_id, uint32_t* out_count);
int routing_broadcast(RoutingTable* table, Signal* signal,
                      AgentRegistry* agents);

AgentRegistry* agent_registry_create(uint32_t capacity);
int agent_registry_add(AgentRegistry* registry, Agent* agent);
Agent* agent_registry_get(AgentRegistry* registry, uint32_t agent_id);
```

### Dispatch Functions (`dispatch.c`)

```c
// Handler function signature
typedef int (*signal_handler_fn)(void* agent_state, Signal* signal);
typedef int (*guard_fn)(void* agent_state, Signal* signal);

// Table management
DispatchTable* dispatch_table_create(uint32_t capacity, uint32_t agent_id);
void dispatch_table_destroy(DispatchTable* table);
void dispatch_set_state(DispatchTable* table, void* state);
void dispatch_set_default(DispatchTable* table, signal_handler_fn handler);

// Handler registration
int dispatch_register(DispatchTable* table, uint32_t frequency_id,
                      signal_handler_fn handler, guard_fn guard);
int dispatch_unregister(DispatchTable* table, uint32_t frequency_id);

// Lookup and invoke
signal_handler_fn dispatch_lookup(DispatchTable* table, uint32_t frequency_id);
int dispatch_invoke(DispatchTable* table, Signal* signal);
int dispatch_invoke_with_state(DispatchTable* table, void* state, Signal* signal);

// Queue processing
int dispatch_process_queue(DispatchTable* table, SignalQueue* queue);
int dispatch_process_batch(DispatchTable* table, SignalQueue* queue, uint32_t max);
```

### Topology Functions (`agents.c`)

```c
// Registry management
AgentRegistry2* registry_create(uint32_t capacity);
void registry_destroy(AgentRegistry2* registry);

// Agent registration
int registry_register(AgentRegistry2* registry, uint32_t agent_id,
                      const char* name, void* state, size_t state_size,
                      SignalQueue* queue, DispatchTable* dispatch);

// Agent lookup
AgentInfo* registry_get_agent(AgentRegistry2* registry, uint32_t agent_id);
AgentInfo* registry_get_agent_by_name(AgentRegistry2* registry, const char* name);
SignalQueue* registry_get_queue(AgentRegistry2* registry, uint32_t agent_id);
DispatchTable* registry_get_dispatch(AgentRegistry2* registry, uint32_t agent_id);

// Network initialization
AgentRegistry2* topology_init(NetworkTopology* topology);
int topology_init_agent(AgentRegistry2* registry, AgentInfo* info);
int topology_build_routes(AgentRegistry2* registry, SocketDef* sockets, uint32_t count);
void topology_resolve_routes(AgentRegistry2* registry);
void topology_shutdown(AgentRegistry2* registry);

// Agent state helpers
void* agent_state_alloc(size_t state_size);
void agent_state_free(void* state, size_t state_size);
```

## Testing

```c
// Simple test
#include "signal.h"
#include <stdio.h>

int main() {
    heap_init(0);

    // Create queue
    SignalQueue* q = signal_queue_create(16);

    // Create and enqueue signals
    for (int i = 0; i < 10; i++) {
        int payload = i * 100;
        Signal* s = signal_create(1, 1, &payload, sizeof(payload));
        signal_queue_enqueue(q, s);
        signal_free(s);  // Decrement our ref
    }

    printf("Queue count: %u\n", signal_queue_count(q));

    // Dequeue and process
    Signal* s;
    while ((s = signal_queue_dequeue(q)) != NULL) {
        int* val = signal_get_payload(s);
        printf("Got signal with value: %d\n", *val);
        signal_free(s);  // Done with signal
    }

    signal_queue_destroy(q);
    return 0;
}
```

## License

Part of the Mycelial compiler project.

/*
 * Mycelial Signal Runtime - Memory Management
 * M2 Phase 1 Implementation
 *
 * Provides heap allocation using Linux mmap syscalls.
 * Based on M2_SIGNAL_RUNTIME_SPEC.md
 */

#include "signal.h"
#include <sys/mman.h>
#include <string.h>

/* =============================================================================
 * GLOBAL HEAP STATE
 * ============================================================================= */

static HeapState g_heap = {0};
static int g_heap_initialized = 0;

/* =============================================================================
 * LINUX SYSCALL WRAPPERS
 *
 * We use mmap/munmap directly for memory allocation.
 * This avoids libc malloc and gives us full control.
 * ============================================================================= */

/*
 * Allocate memory using mmap syscall
 *
 * @param size: Number of bytes to allocate
 * @return: Pointer to allocated memory, or NULL on failure
 */
static void* sys_mmap(size_t size) {
    void* ptr = mmap(
        NULL,                           /* Let kernel choose address */
        size,
        PROT_READ | PROT_WRITE,         /* Read/write access */
        MAP_PRIVATE | MAP_ANONYMOUS,    /* Private, not backed by file */
        -1,                             /* No file descriptor */
        0                               /* No offset */
    );

    if (ptr == MAP_FAILED) {
        return NULL;
    }

    return ptr;
}

/*
 * Free memory using munmap syscall
 *
 * @param ptr: Pointer to memory to free
 * @param size: Size of the allocation
 * @return: 0 on success, -1 on failure
 */
static int sys_munmap(void* ptr, size_t size) {
    return munmap(ptr, size);
}

/* =============================================================================
 * HEAP INITIALIZATION
 * ============================================================================= */

/*
 * Initialize the heap allocator
 *
 * Design decisions:
 * - Pre-allocate a large contiguous region (default 16MB)
 * - Use bump allocation for speed
 * - Maintain free list for reuse of freed blocks
 *
 * @param initial_size: Size of heap to allocate (0 = use default)
 * @return: 1 on success, 0 on failure
 */
int heap_init(size_t initial_size) {
    if (g_heap_initialized) {
        return 1;  /* Already initialized */
    }

    if (initial_size == 0) {
        initial_size = DEFAULT_HEAP_SIZE;
    }

    /* Align to page size (4KB) */
    size_t page_size = 4096;
    initial_size = (initial_size + page_size - 1) & ~(page_size - 1);

    /* Allocate heap region */
    void* base = sys_mmap(initial_size);
    if (base == NULL) {
        return 0;  /* Allocation failed */
    }

    /* Initialize heap state */
    g_heap.base = base;
    g_heap.current = base;
    g_heap.end = (char*)base + initial_size;
    g_heap.total_size = initial_size;
    g_heap.used = 0;
    g_heap.peak_used = 0;
    g_heap.free_list = NULL;

    g_heap_initialized = 1;
    return 1;
}

/* =============================================================================
 * HEAP ALLOCATION
 *
 * Strategy: Bump allocator with free list
 * - Fast allocation (just increment pointer)
 * - Freed blocks go to free list for reuse
 * - Best-fit search on free list
 * ============================================================================= */

/*
 * Allocate memory from heap
 *
 * @param bytes: Number of bytes to allocate
 * @return: Pointer to allocated memory (zeroed), or NULL on failure
 */
void* heap_allocate(size_t bytes) {
    if (!g_heap_initialized) {
        /* Auto-initialize with default size */
        if (!heap_init(0)) {
            return NULL;
        }
    }

    if (bytes == 0) {
        return NULL;
    }

    /* Align to 8 bytes for proper alignment */
    bytes = (bytes + 7) & ~((size_t)7);

    /* Ensure minimum size for FreeBlock header (16 bytes on x86_64) */
    if (bytes < sizeof(FreeBlock)) {
        bytes = sizeof(FreeBlock);
    }

    /* First, check free list for suitable block */
    FreeBlock** prev = (FreeBlock**)&g_heap.free_list;
    FreeBlock* block = g_heap.free_list;

    while (block != NULL) {
        if (block->size >= bytes) {
            /* Found suitable block - remove from free list */
            *prev = block->next;

            /* Zero the memory */
            memset(block, 0, bytes);

            /* Update stats */
            g_heap.used += bytes;
            if (g_heap.used > g_heap.peak_used) {
                g_heap.peak_used = g_heap.used;
            }

            return block;
        }
        prev = &block->next;
        block = block->next;
    }

    /* No suitable free block - bump allocate */
    void* ptr = g_heap.current;
    void* new_current = (char*)g_heap.current + bytes;

    /* Check if we have space */
    if (new_current > g_heap.end) {
        /* Out of memory - could expand heap here, but for now fail */
        return NULL;
    }

    /* Advance allocation pointer */
    g_heap.current = new_current;

    /* Update stats */
    g_heap.used += bytes;
    if (g_heap.used > g_heap.peak_used) {
        g_heap.peak_used = g_heap.used;
    }

    /* Memory is already zeroed from mmap */
    return ptr;
}

/*
 * Free previously allocated memory
 *
 * Design: Add to free list head (LIFO)
 * - Fast O(1) free operation
 * - Good cache locality for recently freed blocks
 *
 * @param ptr: Pointer to memory to free
 * @param bytes: Size of the allocation
 * @return: 0 on success
 */
int heap_free(void* ptr, size_t bytes) {
    if (ptr == NULL || bytes == 0) {
        return 0;
    }

    /* Align size */
    bytes = (bytes + 7) & ~((size_t)7);

    /* Ensure minimum size for FreeBlock header */
    if (bytes < sizeof(FreeBlock)) {
        bytes = sizeof(FreeBlock);
    }

    /* Create free block header in the freed memory */
    FreeBlock* block = (FreeBlock*)ptr;
    block->size = bytes;
    block->next = g_heap.free_list;

    /* Add to front of free list */
    g_heap.free_list = block;

    /* Update stats */
    g_heap.used -= bytes;

    return 0;
}

/* =============================================================================
 * HEAP STATISTICS
 * ============================================================================= */

size_t heap_get_used(void) {
    return g_heap.used;
}

size_t heap_get_peak(void) {
    return g_heap.peak_used;
}

size_t heap_get_total(void) {
    return g_heap.total_size;
}

/* =============================================================================
 * CONVENIENCE ALLOCATION FUNCTIONS
 * ============================================================================= */

/*
 * Create a pre-allocated signal queue
 *
 * @param capacity: Queue capacity (must be power of 2)
 * @return: Pointer to queue, or NULL on failure
 */
SignalQueue* create_signal_queue(uint32_t capacity) {
    /* Ensure capacity is power of 2 */
    if (!is_power_of_two(capacity)) {
        capacity = next_power_of_two(capacity);
    }

    /* Allocate queue struct */
    SignalQueue* queue = heap_allocate(sizeof(SignalQueue));
    if (queue == NULL) {
        return NULL;
    }

    /* Allocate buffer for signal pointers */
    size_t buffer_size = capacity * sizeof(Signal*);
    queue->buffer = heap_allocate(buffer_size);
    if (queue->buffer == NULL) {
        heap_free(queue, sizeof(SignalQueue));
        return NULL;
    }

    /* Initialize queue fields */
    queue->capacity = capacity;
    queue->mask = capacity - 1;
    queue->head = 0;
    queue->tail = 0;
    queue->count = 0;
    queue->total_enqueued = 0;
    queue->total_dequeued = 0;
    queue->dropped_count = 0;
    queue->owner_agent_id = 0;
    queue->flags = QUEUE_FLAG_ACTIVE;
    queue->reserved = 0;

    return queue;
}

/*
 * Create agent state struct
 *
 * @param state_size: Size of state struct in bytes
 * @return: Pointer to zeroed state memory, or NULL on failure
 */
void* create_agent_state(size_t state_size) {
    return heap_allocate(state_size);
}

/* =============================================================================
 * MEMORY UTILITIES
 * ============================================================================= */

/*
 * Simple memcpy implementation (for standalone use)
 */
void* mycelial_memcpy(void* dest, const void* src, size_t n) {
    char* d = dest;
    const char* s = src;
    while (n--) {
        *d++ = *s++;
    }
    return dest;
}

/*
 * Simple memset implementation (for standalone use)
 */
void* mycelial_memset(void* dest, int c, size_t n) {
    unsigned char* d = dest;
    while (n--) {
        *d++ = (unsigned char)c;
    }
    return dest;
}

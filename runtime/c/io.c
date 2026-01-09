/*
 * Mycelial Signal Runtime - File I/O Implementation
 * M3 Phase 1a Implementation
 *
 * Provides file I/O using Linux x86-64 syscalls directly.
 * Enables reading source files and writing compiled binaries.
 */

#include "io.h"
#include "signal.h"  /* For heap_allocate/heap_free */
#include <string.h>

/* =============================================================================
 * SYSCALL INTERFACE
 *
 * Direct syscall invocation using inline assembly.
 * x86-64 System V ABI:
 *   - syscall number in rax
 *   - arguments in rdi, rsi, rdx, r10, r8, r9
 *   - return value in rax
 * ============================================================================= */

static inline long syscall1(long num, long arg1) {
    long ret;
    __asm__ __volatile__ (
        "syscall"
        : "=a" (ret)
        : "a" (num), "D" (arg1)
        : "rcx", "r11", "memory"
    );
    return ret;
}

static inline long syscall2(long num, long arg1, long arg2) {
    long ret;
    __asm__ __volatile__ (
        "syscall"
        : "=a" (ret)
        : "a" (num), "D" (arg1), "S" (arg2)
        : "rcx", "r11", "memory"
    );
    return ret;
}

static inline long syscall3(long num, long arg1, long arg2, long arg3) {
    long ret;
    __asm__ __volatile__ (
        "syscall"
        : "=a" (ret)
        : "a" (num), "D" (arg1), "S" (arg2), "d" (arg3)
        : "rcx", "r11", "memory"
    );
    return ret;
}

/* =============================================================================
 * LOW-LEVEL SYSCALL WRAPPERS
 * ============================================================================= */

/*
 * Open file
 */
int io_open(const char* filename, int flags, int mode) {
    return (int)syscall3(SYS_open, (long)filename, (long)flags, (long)mode);
}

/*
 * Read from file descriptor
 */
long io_read(int fd, void* buf, size_t count) {
    return syscall3(SYS_read, (long)fd, (long)buf, (long)count);
}

/*
 * Write to file descriptor
 */
long io_write(int fd, const void* buf, size_t count) {
    return syscall3(SYS_write, (long)fd, (long)buf, (long)count);
}

/*
 * Close file descriptor
 */
int io_close(int fd) {
    return (int)syscall1(SYS_close, (long)fd);
}

/*
 * Seek within file
 */
long io_lseek(int fd, long offset, int whence) {
    return syscall3(SYS_lseek, (long)fd, offset, (long)whence);
}

/* =============================================================================
 * STRING LENGTH HELPER
 * ============================================================================= */

static size_t str_len(const char* str) {
    if (str == NULL) {
        return 0;
    }
    size_t len = 0;
    while (str[len] != '\0') {
        len++;
    }
    return len;
}

/* =============================================================================
 * HIGH-LEVEL FILE OPERATIONS
 * ============================================================================= */

/*
 * Read entire file into memory
 *
 * Algorithm:
 * 1. Open file for reading
 * 2. Seek to end to get file size
 * 3. Seek back to start
 * 4. Allocate buffer (size + 1 for null terminator)
 * 5. Read file contents
 * 6. Null-terminate buffer
 * 7. Close file
 * 8. Return FileBuffer struct
 */
FileBuffer* io_read_file(const char* filename) {
    if (filename == NULL) {
        return NULL;
    }

    /* 1. Open file for reading */
    int fd = io_open(filename, O_RDONLY, 0);
    if (fd < 0) {
        return NULL;  /* Open failed */
    }

    /* 2. Seek to end to get file size */
    long file_size = io_lseek(fd, 0, SEEK_END);
    if (file_size < 0) {
        io_close(fd);
        return NULL;  /* Seek failed */
    }

    /* 3. Seek back to start */
    long pos = io_lseek(fd, 0, SEEK_SET);
    if (pos < 0) {
        io_close(fd);
        return NULL;  /* Seek failed */
    }

    /* 4. Allocate FileBuffer struct */
    FileBuffer* buf = (FileBuffer*)heap_allocate(sizeof(FileBuffer));
    if (buf == NULL) {
        io_close(fd);
        return NULL;  /* Allocation failed */
    }

    /* 5. Allocate data buffer (size + 1 for null terminator) */
    size_t capacity = (size_t)file_size + 1;
    buf->data = (char*)heap_allocate(capacity);
    if (buf->data == NULL) {
        heap_free(buf, sizeof(FileBuffer));
        io_close(fd);
        return NULL;  /* Allocation failed */
    }

    /* 6. Read file contents */
    long bytes_read = io_read(fd, buf->data, (size_t)file_size);
    if (bytes_read < 0 || bytes_read != file_size) {
        heap_free(buf->data, capacity);
        heap_free(buf, sizeof(FileBuffer));
        io_close(fd);
        return NULL;  /* Read failed */
    }

    /* 7. Close file */
    io_close(fd);

    /* 8. Null-terminate and set up struct */
    buf->data[file_size] = '\0';
    buf->size = (size_t)file_size;
    buf->capacity = capacity;

    return buf;
}

/*
 * Write data to file (internal helper)
 */
static int io_write_file_with_mode(const char* filename, const char* data,
                                    size_t size, int mode) {
    if (filename == NULL || data == NULL) {
        return IO_ERR_NULL;
    }

    /* 1. Open file for writing (create/truncate) */
    int flags = O_WRONLY | O_CREAT | O_TRUNC;
    int fd = io_open(filename, flags, mode);
    if (fd < 0) {
        return IO_ERR_OPEN;
    }

    /* 2. Write data */
    long bytes_written = io_write(fd, data, size);
    if (bytes_written < 0 || (size_t)bytes_written != size) {
        io_close(fd);
        return IO_ERR_WRITE;
    }

    /* 3. Close file */
    int close_result = io_close(fd);
    if (close_result < 0) {
        return IO_ERR_CLOSE;
    }

    return IO_OK;
}

/*
 * Write data to file (default permissions 0644)
 */
int io_write_file(const char* filename, const char* data, size_t size) {
    return io_write_file_with_mode(filename, data, size, DEFAULT_MODE);
}

/*
 * Write executable binary to file (permissions 0755)
 */
int io_write_executable(const char* filename, const char* data, size_t size) {
    return io_write_file_with_mode(filename, data, size, EXEC_MODE);
}

/*
 * Append data to file
 */
int io_append_file(const char* filename, const char* data, size_t size) {
    if (filename == NULL || data == NULL) {
        return IO_ERR_NULL;
    }

    /* Open file for appending (create if doesn't exist) */
    int flags = O_WRONLY | O_CREAT | O_APPEND;
    int fd = io_open(filename, flags, DEFAULT_MODE);
    if (fd < 0) {
        return IO_ERR_OPEN;
    }

    /* Write data */
    long bytes_written = io_write(fd, data, size);
    if (bytes_written < 0 || (size_t)bytes_written != size) {
        io_close(fd);
        return IO_ERR_WRITE;
    }

    /* Close file */
    int close_result = io_close(fd);
    if (close_result < 0) {
        return IO_ERR_CLOSE;
    }

    return IO_OK;
}

/*
 * Free file buffer
 */
void io_free_buffer(FileBuffer* buf) {
    if (buf == NULL) {
        return;
    }

    if (buf->data != NULL) {
        heap_free(buf->data, buf->capacity);
    }

    heap_free(buf, sizeof(FileBuffer));
}

/*
 * Get file size without reading
 */
long io_file_size(const char* filename) {
    if (filename == NULL) {
        return IO_ERR_NULL;
    }

    /* Open file */
    int fd = io_open(filename, O_RDONLY, 0);
    if (fd < 0) {
        return IO_ERR_OPEN;
    }

    /* Seek to end to get size */
    long size = io_lseek(fd, 0, SEEK_END);

    /* Close file */
    io_close(fd);

    return size;
}

/*
 * Check if file exists
 */
int io_file_exists(const char* filename) {
    if (filename == NULL) {
        return 0;
    }

    /* Try to open file */
    int fd = io_open(filename, O_RDONLY, 0);
    if (fd < 0) {
        return 0;  /* Doesn't exist or not accessible */
    }

    /* Close and return success */
    io_close(fd);
    return 1;
}

/*
 * Check if file is readable
 */
int io_file_readable(const char* filename) {
    /* Same as exists for our purposes - can open for reading */
    return io_file_exists(filename);
}

/*
 * Check if path is a directory
 *
 * We try to open it for reading - directories will succeed but
 * attempting to read will fail in a specific way.
 * For simplicity, we just check if we can open it and it has size 0
 * when we try to read (directories show size differently).
 *
 * Note: A more robust check would use stat() syscall.
 */
int io_is_directory(const char* path) {
    if (path == NULL) {
        return 0;
    }

    /* Try to open - directories can be opened on Linux */
    int fd = io_open(path, O_RDONLY, 0);
    if (fd < 0) {
        return 0;
    }

    /* Try to read 1 byte - regular files can be read, directories return error */
    char byte;
    long result = io_read(fd, &byte, 1);
    io_close(fd);

    /* If read returns -21 (EISDIR), it's a directory */
    /* Also consider it a directory if file is empty but opened successfully */
    /* This is a simplified check - production would use stat() */
    return (result == -21);  /* -EISDIR = -21 */
}

/* =============================================================================
 * STANDARD I/O OPERATIONS
 * ============================================================================= */

/*
 * Write string to stdout
 */
int io_print(const char* str) {
    if (str == NULL) {
        return 0;
    }
    size_t len = str_len(str);
    long result = io_write(STDOUT_FD, str, len);
    return (result >= 0) ? (int)result : IO_ERR_WRITE;
}

/*
 * Write string to stderr
 */
int io_eprint(const char* str) {
    if (str == NULL) {
        return 0;
    }
    size_t len = str_len(str);
    long result = io_write(STDERR_FD, str, len);
    return (result >= 0) ? (int)result : IO_ERR_WRITE;
}

/*
 * Read line from stdin
 *
 * Reads up to max_len-1 characters, stopping at newline.
 * Null-terminates the result.
 */
int io_readline(char* buf, size_t max_len) {
    if (buf == NULL || max_len == 0) {
        return 0;
    }

    size_t pos = 0;
    char c;

    while (pos < max_len - 1) {
        long result = io_read(STDIN_FD, &c, 1);
        if (result <= 0) {
            break;  /* EOF or error */
        }

        if (c == '\n') {
            break;  /* End of line */
        }

        buf[pos++] = c;
    }

    buf[pos] = '\0';
    return (int)pos;
}

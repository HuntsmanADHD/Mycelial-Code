/*
 * Mycelial Signal Runtime - File I/O
 * M3 Phase 1a Implementation
 *
 * Provides file I/O syscall wrappers for the Mycelial compiler.
 * Enables reading source files and writing compiled binaries.
 *
 * Uses Linux x86-64 syscalls directly for minimal dependencies.
 */

#ifndef MYCELIAL_IO_H
#define MYCELIAL_IO_H

#include <stddef.h>
#include <stdint.h>

/* =============================================================================
 * SYSTEM CALL NUMBERS (x86-64 System V ABI)
 * ============================================================================= */

#define SYS_read    0
#define SYS_write   1
#define SYS_open    2
#define SYS_close   3
#define SYS_lseek   8
#define SYS_stat    4
#define SYS_fstat   5

/* =============================================================================
 * OPEN FLAGS
 * ============================================================================= */

#define O_RDONLY    0
#define O_WRONLY    1
#define O_RDWR      2
#define O_CREAT     64      /* 0100 */
#define O_TRUNC     512     /* 01000 */
#define O_APPEND    1024    /* 02000 */

/* =============================================================================
 * SEEK WHENCE VALUES
 * ============================================================================= */

#define SEEK_SET    0       /* From beginning of file */
#define SEEK_CUR    1       /* From current position */
#define SEEK_END    2       /* From end of file */

/* =============================================================================
 * FILE PERMISSIONS
 * ============================================================================= */

#define S_IRUSR     0400    /* Owner read */
#define S_IWUSR     0200    /* Owner write */
#define S_IXUSR     0100    /* Owner execute */
#define S_IRGRP     0040    /* Group read */
#define S_IWGRP     0020    /* Group write */
#define S_IXGRP     0010    /* Group execute */
#define S_IROTH     0004    /* Others read */
#define S_IWOTH     0002    /* Others write */
#define S_IXOTH     0001    /* Others execute */

/* Default file permissions: 0644 (rw-r--r--) */
#define DEFAULT_MODE (S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH)

/* Executable permissions: 0755 (rwxr-xr-x) */
#define EXEC_MODE (S_IRUSR | S_IWUSR | S_IXUSR | S_IRGRP | S_IXGRP | S_IROTH | S_IXOTH)

/* =============================================================================
 * ERROR CODES
 * ============================================================================= */

#define IO_OK               0
#define IO_ERR_OPEN         -1
#define IO_ERR_READ         -2
#define IO_ERR_WRITE        -3
#define IO_ERR_CLOSE        -4
#define IO_ERR_SEEK         -5
#define IO_ERR_ALLOC        -6
#define IO_ERR_NULL         -7

/* =============================================================================
 * FILE BUFFER STRUCTURE
 * ============================================================================= */

/*
 * Buffer for file contents
 *
 * Created by io_read_file(), freed by io_free_buffer().
 * Data is null-terminated for convenience with string operations.
 */
typedef struct FileBuffer {
    char*   data;           /* File contents (null-terminated) */
    size_t  size;           /* Size in bytes (not including null) */
    size_t  capacity;       /* Allocated capacity */
} FileBuffer;

/* =============================================================================
 * FILE I/O FUNCTIONS
 * ============================================================================= */

/*
 * Read entire file into memory
 *
 * Reads file contents into a newly allocated buffer.
 * Buffer is null-terminated for convenience.
 *
 * @param filename: Path to file
 * @return: FileBuffer with data + size, or NULL on error
 */
FileBuffer* io_read_file(const char* filename);

/*
 * Write data to file
 *
 * Creates or overwrites file with given data.
 * Uses default permissions (0644).
 *
 * @param filename: Path to file
 * @param data: Data to write
 * @param size: Size of data in bytes
 * @return: 0 on success, negative error code on failure
 */
int io_write_file(const char* filename, const char* data, size_t size);

/*
 * Write executable binary to file
 *
 * Same as io_write_file but with executable permissions (0755).
 *
 * @param filename: Path to file
 * @param data: Data to write
 * @param size: Size of data in bytes
 * @return: 0 on success, negative error code on failure
 */
int io_write_executable(const char* filename, const char* data, size_t size);

/*
 * Append data to file
 *
 * Appends data to existing file (creates if doesn't exist).
 *
 * @param filename: Path to file
 * @param data: Data to append
 * @param size: Size of data in bytes
 * @return: 0 on success, negative error code on failure
 */
int io_append_file(const char* filename, const char* data, size_t size);

/*
 * Free file buffer
 *
 * Frees both the data buffer and the FileBuffer struct.
 *
 * @param buf: FileBuffer to free
 */
void io_free_buffer(FileBuffer* buf);

/*
 * Get file size without reading
 *
 * @param filename: Path to file
 * @return: File size in bytes, or negative error code
 */
long io_file_size(const char* filename);

/*
 * Check if file exists
 *
 * @param filename: Path to file
 * @return: 1 if exists, 0 if not
 */
int io_file_exists(const char* filename);

/*
 * Check if file is readable
 *
 * @param filename: Path to file
 * @return: 1 if readable, 0 if not
 */
int io_file_readable(const char* filename);

/*
 * Check if path is a directory
 *
 * @param path: Path to check
 * @return: 1 if directory, 0 if not (or doesn't exist)
 */
int io_is_directory(const char* path);

/* =============================================================================
 * LOW-LEVEL SYSCALL WRAPPERS
 * ============================================================================= */

/*
 * Open file (low-level)
 *
 * @param filename: Path to file
 * @param flags: Open flags (O_RDONLY, O_WRONLY, etc.)
 * @param mode: Permissions for created files
 * @return: File descriptor on success, negative on error
 */
int io_open(const char* filename, int flags, int mode);

/*
 * Read from file descriptor (low-level)
 *
 * @param fd: File descriptor
 * @param buf: Buffer to read into
 * @param count: Maximum bytes to read
 * @return: Bytes read on success, negative on error
 */
long io_read(int fd, void* buf, size_t count);

/*
 * Write to file descriptor (low-level)
 *
 * @param fd: File descriptor
 * @param buf: Buffer to write from
 * @param count: Bytes to write
 * @return: Bytes written on success, negative on error
 */
long io_write(int fd, const void* buf, size_t count);

/*
 * Close file descriptor (low-level)
 *
 * @param fd: File descriptor
 * @return: 0 on success, negative on error
 */
int io_close(int fd);

/*
 * Seek within file (low-level)
 *
 * @param fd: File descriptor
 * @param offset: Offset in bytes
 * @param whence: SEEK_SET, SEEK_CUR, or SEEK_END
 * @return: New position on success, negative on error
 */
long io_lseek(int fd, long offset, int whence);

/* =============================================================================
 * STANDARD FILE DESCRIPTORS
 * ============================================================================= */

#define STDIN_FD    0
#define STDOUT_FD   1
#define STDERR_FD   2

/*
 * Write to stdout
 */
int io_print(const char* str);

/*
 * Write to stderr
 */
int io_eprint(const char* str);

/*
 * Read line from stdin
 *
 * @param buf: Buffer to read into
 * @param max_len: Maximum length to read
 * @return: Bytes read (excluding null terminator)
 */
int io_readline(char* buf, size_t max_len);

#endif /* MYCELIAL_IO_H */

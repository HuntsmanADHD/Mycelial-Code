# Hello World in ARM64 Assembly (AAPCS64 / Linux SVE ABI)
# Assemble: aarch64-linux-gnu-as hello-arm64.asm -o hello.o
# Link: aarch64-linux-gnu-ld hello.o -o hello
# Run: ./hello

    .section .rodata
    .align 3
hello_msg:
    .ascii "Hello, World!\n"
msg_len = . - hello_msg

    .section .text
    .align 2
    .global _start
    .type _start, @function

_start:
    # System call: write(1, msg_addr, msg_len)
    # x0 = 1 (stdout file descriptor) - argument 1
    # x1 = &hello_msg (pointer to message) - argument 2
    # x2 = msg_len (message length) - argument 3
    # x8 = 64 (write syscall number on ARM64 Linux)

    adrp    x1, hello_msg       # Load page address of hello_msg
    add     x1, x1, #:lo12:hello_msg  # Add low 12 bits

    mov     x0, #1              # fd = stdout
    mov     x2, #msg_len        # message length
    mov     x8, #64             # syscall: write
    svc     #0                  # invoke syscall

    # System call: exit(0)
    # x0 = 0 (exit code) - argument 1
    # x8 = 93 (exit syscall number on ARM64 Linux)

    mov     x0, #0              # exit code = 0
    mov     x8, #93             # syscall: exit_group
    svc     #0                  # invoke syscall

    # Should never reach here
    .align 2
    brk     #0

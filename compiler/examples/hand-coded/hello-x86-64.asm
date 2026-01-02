# Hello World in x86-64 Assembly (System V AMD64 ABI)
# Assemble: as hello-x86-64.asm -o hello.o
# Link: ld hello.o -o hello
# Run: ./hello

    .section .rodata
    .align 8
hello_msg:
    .ascii "Hello, World!\n"
msg_len = . - hello_msg

    .section .text
    .global _start
    .type _start, @function

_start:
    # System call: write(1, msg_addr, msg_len)
    # rax = 1 (write syscall number)
    # rdi = 1 (stdout file descriptor)
    # rsi = &hello_msg (pointer to message)
    # rdx = msg_len (message length)

    movq $1, %rax           # sys_write syscall number
    movq $1, %rdi           # fd = stdout
    movq $hello_msg, %rsi   # RSI = address of message
    movq $msg_len, %rdx     # RDX = message length
    syscall                 # invoke syscall

    # System call: exit(0)
    # rax = 60 (exit syscall number)
    # rdi = 0 (exit code)

    movq $60, %rax          # sys_exit syscall number
    movq $0, %rdi           # exit code = 0
    syscall                 # invoke syscall

    # Should never reach here
    hlt

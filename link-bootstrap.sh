#!/bin/bash
#
# Mycelial Bootstrap Linker
#
# Links the bootstrap compiler (Gen0 output) with minimal builtins → Gen1!
#
# This is the critical step: taking the Mycelial compiler written in Mycelial
# and creating a native executable that can compile itself.
#

set -e  # Exit on error

echo "🔗 Mycelial Bootstrap Linker"
echo ""

# Check if bootstrap compiler object exists
BOOTSTRAP_OBJ="artifacts/mycelial-compiler.o"
if [ ! -f "$BOOTSTRAP_OBJ" ]; then
    echo "❌ Bootstrap compiler object not found: $BOOTSTRAP_OBJ"
    echo "   Run Gen0 first to compile the bootstrap compiler"
    exit 1
fi

# Check if minimal builtins exist
BUILTINS_OBJ="runtime/c/minimal-builtins.o"
if [ ! -f "$BUILTINS_OBJ" ]; then
    echo "📦 Building minimal builtins..."
    cd runtime/c
    make -f Makefile.minimal
    cd ../..
    echo ""
fi

# Link!
echo "🔗 Linking bootstrap compiler with minimal runtime..."
echo ""
echo "   Input:"
echo "     - $BOOTSTRAP_OBJ (Gen0 output)"
echo "     - $BUILTINS_OBJ (10 core builtins)"
echo ""

GEN1_OUTPUT="gen1-compiler"

gcc \
    -no-pie \
    -o "$GEN1_OUTPUT" \
    "$BOOTSTRAP_OBJ" \
    "$BUILTINS_OBJ" \
    -lc

echo "✅ Linked successfully!"
echo ""
echo "   Output: $GEN1_OUTPUT"
echo ""

# Make executable
chmod +x "$GEN1_OUTPUT"

# Get file size
SIZE=$(du -h "$GEN1_OUTPUT" | cut -f1)

echo "📊 Gen1 Compiler Stats:"
echo "   Size: $SIZE"
echo "   Type: Native x86-64 ELF executable"
echo ""

# Verify it's a valid ELF
if file "$GEN1_OUTPUT" | grep -q "ELF 64-bit"; then
    echo "✅ Valid ELF64 executable"
else
    echo "❌ Warning: Not a valid ELF64 executable"
    file "$GEN1_OUTPUT"
    exit 1
fi

echo ""
echo "🎉 GEN1 READY!"
echo ""
echo "   You now have a native Mycelial compiler binary."
echo "   It's written IN Mycelial and compiled BY Mycelial (Gen0)."
echo ""
echo "   Next step: Run it to compile itself → Gen2 (self-hosting!)"
echo ""
echo "   Try it:"
echo "     ./$GEN1_OUTPUT tests/hello_world.mycelial"
echo ""
echo "   Built different. 🔥"

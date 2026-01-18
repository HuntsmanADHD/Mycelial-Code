#!/bin/bash
#
# Build Gen1 - Complete Bootstrap Pipeline
#
# This script:
# 1. Compiles bootstrap compiler (Mycelial) to object file using Gen0
# 2. Compiles complete builtins (C, 30+ functions) to object file
# 3. Links them together to create Gen1 executable
#
# Built different. 🔥
#

set -e  # Exit on error

echo "🚀 Building Gen1 - Mycelial Self-Hosting Compiler"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: Compile Bootstrap Compiler to Object File
# ═══════════════════════════════════════════════════════════════════════════

echo "📦 Step 1: Compiling bootstrap compiler (Mycelial → .o)"
echo ""

BOOTSTRAP_SOURCE="self-hosted-compiler/mycelial-compiler.mycelial"
BOOTSTRAP_OBJ="artifacts/bootstrap-compiler.o"

# Create artifacts directory if it doesn't exist
mkdir -p artifacts

# Compile using Gen0 with --object-only flag
echo "   Running Gen0 compiler..."
node runtime/mycelial-compile.js "$BOOTSTRAP_SOURCE" \
    --object-only \
    --output "$BOOTSTRAP_OBJ" \
    --verbose

echo ""
echo "   ✅ Bootstrap compiler compiled to object file"
echo "      Output: $BOOTSTRAP_OBJ"

# Verify object file
if [ ! -f "$BOOTSTRAP_OBJ" ]; then
    echo "   ❌ ERROR: Object file not created!"
    exit 1
fi

OBJ_SIZE=$(du -h "$BOOTSTRAP_OBJ" | cut -f1)
echo "      Size: $OBJ_SIZE"

# Check if it's a valid ELF object file
if file "$BOOTSTRAP_OBJ" | grep -q "ELF 64-bit.*relocatable"; then
    echo "      Type: ✅ Valid ELF64 relocatable object"
else
    echo "      Type: ⚠️  Warning - may not be valid relocatable object:"
    file "$BOOTSTRAP_OBJ"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: Compile Complete Builtins
# ═══════════════════════════════════════════════════════════════════════════

echo "📦 Step 2: Compiling complete builtins (C → .o)"
echo ""

BUILTINS_OBJ="runtime/c/complete-builtins.o"

if [ ! -f "$BUILTINS_OBJ" ]; then
    echo "   Building complete builtins (30+ functions)..."
    cd runtime/c
    make -f Makefile.complete
    cd ../..
else
    echo "   ✅ Complete builtins already compiled"
    echo "      Using: $BUILTINS_OBJ"
fi

echo ""

# Verify builtins object
if [ ! -f "$BUILTINS_OBJ" ]; then
    echo "   ❌ ERROR: Builtins object file not created!"
    exit 1
fi

BUILTINS_SIZE=$(du -h "$BUILTINS_OBJ" | cut -f1)
echo "   Size: $BUILTINS_SIZE"

# Check if it's a valid ELF object file
if file "$BUILTINS_OBJ" | grep -q "ELF 64-bit.*relocatable"; then
    echo "   Type: ✅ Valid ELF64 relocatable object"
else
    echo "   Type: ⚠️  Warning - may not be valid relocatable object:"
    file "$BUILTINS_OBJ"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: Link Gen1 Compiler
# ═══════════════════════════════════════════════════════════════════════════

echo "🔗 Step 3: Linking Gen1 compiler"
echo ""

GEN1_OUTPUT="gen1-compiler"

echo "   Linking:"
echo "     + $BOOTSTRAP_OBJ"
echo "     + $BUILTINS_OBJ"
echo "     → $GEN1_OUTPUT"
echo ""

# Link with gcc (uses ld internally)
# Use -nostartfiles to avoid conflict with bootstrap compiler's _start
gcc -no-pie -nostartfiles \
    -o "$GEN1_OUTPUT" \
    "$BOOTSTRAP_OBJ" \
    "$BUILTINS_OBJ" \
    -lc

echo "   ✅ Linking successful!"
echo ""

# Make executable
chmod +x "$GEN1_OUTPUT"

# Get stats
GEN1_SIZE=$(du -h "$GEN1_OUTPUT" | cut -f1)

echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📊 Gen1 Compiler Stats"
echo ""
echo "   Size:  $GEN1_SIZE"

# Verify it's a valid ELF executable
if file "$GEN1_OUTPUT" | grep -q "ELF 64-bit.*executable"; then
    echo "   Type:  ✅ Valid ELF64 executable"
    echo "   Arch:  x86-64"
else
    echo "   Type:  ❌ Not a valid ELF64 executable:"
    file "$GEN1_OUTPUT"
    echo ""
    echo "   Build failed. Check the object files."
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "🎉 GEN1 BUILD COMPLETE!"
echo ""
echo "   You now have a native Mycelial compiler!"
echo ""
echo "   Details:"
echo "     • Written IN Mycelial (8,700+ lines)"
echo "     • Compiled BY Mycelial (Gen0)"
echo "     • Linked with minimal runtime (10 builtins)"
echo "     • Produces native x86-64 binaries"
echo ""
echo "   Next steps:"
echo ""
echo "   1. Test it:"
echo "      ./gen1-compiler tests/hello_world.mycelial"
echo ""
echo "   2. Self-compile (Gen2):"
echo "      ./gen1-compiler self-hosted-compiler/mycelial-compiler.mycelial -o gen2-compiler"
echo ""
echo "   3. Verify fixed point:"
echo "      cmp gen1-compiler gen2-compiler"
echo ""
echo "   Built different. 🔥"
echo ""

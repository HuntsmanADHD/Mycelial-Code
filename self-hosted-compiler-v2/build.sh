#!/bin/bash
# Mycelial Compiler - Modular Build Script
# Concatenates separate agent files into a single compilable network
#
# Usage: ./build.sh > mycelial-compiler-built.mycelial
#
# This script demonstrates the modular architecture while producing
# a single file that Gen0 can compile.

set -e
cd "$(dirname "$0")"

cat << 'HEADER'
# ============================================================================
# Mycelial Native Compiler - Modular Build
# ============================================================================
# Auto-generated from separate agent files
#
# Structure:
#   - shared/frequencies.mycelial  : Signal definitions
#   - shared/types.mycelial        : Shared type definitions
#   - agents/lexer.mycelial        : Lexer agent
#   - agents/orchestrator.mycelial : Pipeline coordinator
#   - agents/main.mycelial         : Entry point
#   - agents/parser.mycelial       : Parser agent
#   - agents/ir_generator.mycelial : IR generator agent
#   - agents/x86_codegen.mycelial  : x86-64 code generator
#   - agents/assembler.mycelial    : Assembler agent
#   - agents/linker.mycelial       : ELF linker agent
#   - topology.mycelial            : Agent wiring
#
# Each agent is an independent hyphal that communicates via signals.
# This matches the Mycelial vision of decentralized, communicating agents.
# ============================================================================

network mycelial_compiler {

  # ==========================================================================
  # FREQUENCIES (Signal Definitions)
  # ==========================================================================

HEADER

cat shared/frequencies.mycelial

cat << 'TYPES_HEADER'

  # ==========================================================================
  # TYPES (Shared Data Structures)
  # ==========================================================================

TYPES_HEADER

cat shared/types.mycelial

cat << 'HYPHAE_HEADER'

  # ==========================================================================
  # HYPHAE (Agent Definitions)
  # ==========================================================================

  hyphae {

    # ------------------------------------------------------------------------
    # LEXER AGENT
    # Transforms source code into token stream
    # Input: lex_request | Output: token, lex_complete
    # ------------------------------------------------------------------------

HYPHAE_HEADER

cat agents/lexer.mycelial

cat << 'ORCHESTRATOR_HEADER'

    # ------------------------------------------------------------------------
    # ORCHESTRATOR AGENT
    # Coordinates the compilation pipeline, buffers intermediate data
    # Input: compile_request | Output: compilation_complete/error
    # ------------------------------------------------------------------------

ORCHESTRATOR_HEADER

cat agents/orchestrator.mycelial

cat << 'MAIN_HEADER'

    # ------------------------------------------------------------------------
    # MAIN AGENT
    # Entry point - handles startup and reports results
    # Input: startup | Output: compile_request, status messages
    # ------------------------------------------------------------------------

MAIN_HEADER

cat agents/main.mycelial

cat << 'PARSER_HEADER'

    # ------------------------------------------------------------------------
    # PARSER AGENT
    # Transforms token stream into AST
    # Input: token, lex_complete | Output: ast_complete, parse_error
    # ------------------------------------------------------------------------

PARSER_HEADER

cat agents/parser.mycelial

cat << 'IR_HEADER'

    # ------------------------------------------------------------------------
    # IR GENERATOR AGENT
    # Transforms AST into intermediate representation
    # Input: ast_complete | Output: ir_complete, lir_function, lir_struct
    # ------------------------------------------------------------------------

IR_HEADER

cat agents/ir_generator.mycelial

cat << 'CODEGEN_HEADER'

    # ------------------------------------------------------------------------
    # X86 CODE GENERATOR AGENT
    # Transforms IR into x86-64 assembly
    # Input: ir_complete, lir_* | Output: asm_instruction, asm_data
    # ------------------------------------------------------------------------

CODEGEN_HEADER

cat agents/x86_codegen.mycelial

cat << 'ASSEMBLER_HEADER'

    # ------------------------------------------------------------------------
    # ASSEMBLER AGENT
    # Transforms assembly into machine code
    # Input: asm_* | Output: machine_code, symbol_def, relocation
    # ------------------------------------------------------------------------

ASSEMBLER_HEADER

cat agents/assembler.mycelial

cat << 'LINKER_HEADER'

    # ------------------------------------------------------------------------
    # LINKER AGENT
    # Creates ELF executable from machine code
    # Input: machine_code, symbols, relocations | Output: link_complete
    # ------------------------------------------------------------------------

LINKER_HEADER

cat agents/linker.mycelial

cat << 'HYPHAE_FOOTER'

  }  # end hyphae

  # ==========================================================================
  # TOPOLOGY (Agent Wiring)
  # ==========================================================================

HYPHAE_FOOTER

cat topology.mycelial

cat << 'FOOTER'

}  # end network

# ============================================================================
# END OF MODULAR BUILD
# ============================================================================
FOOTER

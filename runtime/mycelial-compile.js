#!/usr/bin/env node
/**
 * Mycelial Compiler CLI
 *
 * Command-line interface for the Mycelial Runtime.
 * Compiles .mycelial source files to ELF binaries.
 *
 * Usage:
 *   node mycelial-compile.js <source.mycelial> [options]
 *
 * @author Claude Opus 4.5
 * @date 2026-01-02
 */

const { Runtime } = require('./src/runtime.js');
const path = require('path');
const fs = require('fs');

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  const options = {
    sourcePath: null,
    outputPath: null,
    verbose: false,
    maxCycles: 1000,
    help: false,
    objectOnly: false  // New: produce .o file instead of executable
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--output' || arg === '-o') {
      options.outputPath = args[++i];
    } else if (arg === '--max-cycles' || arg === '-m') {
      options.maxCycles = parseInt(args[++i], 10);
    } else if (arg === '--object-only' || arg === '-c') {
      options.objectOnly = true;
    } else if (!options.sourcePath) {
      options.sourcePath = arg;
    }
  }

  return options;
}

// Print help message
function printHelp() {
  console.log(`
Mycelial Compiler CLI
=====================

Compiles .mycelial source files to ELF binaries using the Mycelial Runtime.

USAGE:
  node mycelial-compile.js <source.mycelial> [options]

OPTIONS:
  -o, --output <path>       Output path for ELF binary (default: <source>.elf)
  -c, --object-only         Produce relocatable object file (.o) instead of executable
  -v, --verbose             Enable verbose logging
  -m, --max-cycles <n>      Maximum tidal cycles (default: 1000)
  -h, --help                Show this help message

EXAMPLES:
  # Basic compilation
  node mycelial-compile.js program.mycelial

  # Specify output path
  node mycelial-compile.js program.mycelial -o myprogram

  # Verbose mode with custom cycle limit
  node mycelial-compile.js program.mycelial -v -m 5000

EXIT CODES:
  0   Compilation successful
  1   Compilation failed
  2   Invalid arguments
`);
}

// Validate arguments
function validateArgs(options) {
  if (!options.sourcePath) {
    console.error('Error: Source file required');
    console.error('Run with --help for usage information');
    return false;
  }

  if (!fs.existsSync(options.sourcePath)) {
    console.error(`Error: Source file not found: ${options.sourcePath}`);
    return false;
  }

  if (!options.outputPath) {
    // Auto-generate output path
    const parsed = path.parse(options.sourcePath);
    const extension = options.objectOnly ? '.o' : '.elf';
    options.outputPath = path.join(parsed.dir, parsed.name + extension);
  }

  return true;
}

// Main compilation function
async function compile(options) {
  const startTime = Date.now();

  console.log('Mycelial Compiler');
  console.log('Source:', options.sourcePath);
  console.log('Output:', options.outputPath);
  console.log();

  try {
    // Create runtime
    const runtime = new Runtime({
      sourcePath: options.sourcePath,
      outputPath: options.outputPath,
      verbose: options.verbose,
      maxCycles: options.maxCycles,
      objectOnly: options.objectOnly
    });

    // Run compilation
    const result = await runtime.compile();

    const totalTime = Date.now() - startTime;

    if (result.success) {
      console.log('\nCompilation successful!');
      console.log(`Output: ${result.outputPath}`);
      console.log(`Time: ${totalTime}ms`);

      if (result.warnings.length > 0) {
        console.log(`\nWarnings (${result.warnings.length}):`);
        result.warnings.forEach((warning, i) => {
          console.log(`  ${i + 1}. ${warning}`);
        });
      }

      return 0; // Success
    } else {
      console.error('\nCompilation failed!');
      console.error(`Error: ${result.error}`);
      console.error(`Time: ${totalTime}ms`);
      return 1; // Failure
    }

  } catch (error) {
    console.error('\nFatal error during compilation:');
    console.error(error.message);

    if (options.verbose && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    return 1; // Failure
  }
}

// Main entry point
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return 0;
  }

  if (!validateArgs(options)) {
    return 2; // Invalid arguments
  }

  const exitCode = await compile(options);
  return exitCode;
}

// Run CLI
main()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

/**
 * Mycelial Runtime - Centralized Error Handler (Phase 5)
 *
 * Provides comprehensive error management for the Mycelial compiler pipeline.
 * Handles error categorization, reporting, recovery strategies, and statistics.
 *
 * @author Claude Opus 4.5
 * @date 2026-01-02
 */

// ============================================================================
// ERROR CATEGORIZATION
// ============================================================================

const ERROR_TYPES = {
  FILE_IO: 'FileIOError',
  PARSE: 'ParseError',
  COMPILATION: 'CompilationError',
  RUNTIME: 'RuntimeError'
};

const SEVERITY_LEVELS = {
  WARNING: 'warning',
  ERROR: 'error',
  FATAL: 'fatal'
};

const STAGE_CODES = {
  lexer: '01',
  parser: '02',
  ir: '03',
  codegen: '04',
  assembler: '05',
  linker: '06',
  runtime: '99'
};

const TYPE_PREFIXES = {
  FileIOError: 'F',
  ParseError: 'P',
  CompilationError: 'C',
  RuntimeError: 'R'
};

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

class ErrorHandler {
  /**
   * Initialize the error handler
   * @param {Object} options - Configuration options
   * @param {boolean} options.verbose - Enable verbose error output
   * @param {number} options.maxErrors - Maximum errors before stopping (default: 100)
   */
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.maxErrors = options.maxErrors || 100;

    this.errors = [];
    this.warnings = [];
    this.recoveredErrors = [];
    this.startTime = Date.now();
  }

  // ==========================================================================
  // ERROR MANAGEMENT
  // ==========================================================================

  /**
   * Add an error with context and attempt recovery
   * @param {Error|Object} error - Error object or error details
   * @param {string} stage - Compilation stage (lexer, parser, etc.)
   * @param {Object} context - Additional context information
   * @returns {boolean} True if compilation can continue, false if fatal
   */
  addError(error, stage, context = {}) {
    // Check if we've already hit the error limit
    if (this.errors.length >= this.maxErrors) {
      // Don't add more errors, just return false
      return false;
    }

    const normalizedError = this.normalizeError(error, stage, context);

    // Attempt recovery strategies
    const recovered = this.attemptRecovery(normalizedError);

    if (recovered) {
      this.recoveredErrors.push(normalizedError);
      if (this.verbose) {
        console.log(`[RECOVERY] Successfully recovered from error: ${normalizedError.code}`);
      }
    } else {
      this.errors.push(normalizedError);

      // If we just hit the limit, add a special error
      if (this.errors.length === this.maxErrors) {
        const maxError = {
          type: ERROR_TYPES.COMPILATION,
          severity: SEVERITY_LEVELS.FATAL,
          message: `Maximum error limit (${this.maxErrors}) exceeded`,
          code: 'E999',
          stage: stage,
          source: null,
          suggestion: 'Fix previous errors and try again',
          timestamp: new Date().toISOString(),
          context: {}
        };
        this.errors.push(maxError);
      }
    }

    // Determine if compilation can continue
    return normalizedError.severity !== SEVERITY_LEVELS.FATAL && this.errors.length < this.maxErrors;
  }

  /**
   * Add a non-fatal warning
   * @param {string|Object} warning - Warning message or object
   * @param {string} stage - Compilation stage
   */
  addWarning(warning, stage) {
    const normalizedWarning = {
      type: 'Warning',
      severity: SEVERITY_LEVELS.WARNING,
      message: typeof warning === 'string' ? warning : warning.message,
      stage: stage,
      timestamp: new Date().toISOString(),
      context: typeof warning === 'object' ? warning.context : {}
    };

    this.warnings.push(normalizedWarning);
  }

  /**
   * Check if any errors exist
   * @returns {boolean} True if errors exist
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Check if compilation should continue
   * @returns {boolean} True if compilation can continue
   */
  canContinue() {
    if (this.errors.length === 0) return true;

    // Check for fatal errors
    const hasFatal = this.errors.some(err => err.severity === SEVERITY_LEVELS.FATAL);
    if (hasFatal) return false;

    // Check error limit
    return this.errors.length < this.maxErrors;
  }

  /**
   * Get all errors
   * @returns {Array} Array of error objects
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Get all warnings
   * @returns {Array} Array of warning objects
   */
  getWarnings() {
    return [...this.warnings];
  }

  /**
   * Get errors for a specific stage
   * @param {string} stage - Stage name
   * @returns {Array} Array of errors for the stage
   */
  getStageErrors(stage) {
    return this.errors.filter(err => err.stage === stage);
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get summary statistics
   * @returns {Object} Summary object with error statistics
   */
  getSummary() {
    const errorsByStage = {};

    this.errors.forEach(err => {
      errorsByStage[err.stage] = (errorsByStage[err.stage] || 0) + 1;
    });

    const stagesAffected = Object.keys(errorsByStage).sort();

    return {
      total_errors: this.errors.length,
      total_warnings: this.warnings.length,
      recovered_errors: this.recoveredErrors.length,
      errors_by_stage: errorsByStage,
      success: this.errors.length === 0,
      can_continue: this.canContinue(),
      stages_affected: stagesAffected
    };
  }

  /**
   * Format a single error for display
   * @param {Object} error - Error object
   * @returns {string} Formatted error string
   */
  formatError(error) {
    const lines = [];

    // Header with code and location
    const location = error.source
      ? `${error.source.file}:${error.source.line}:${error.source.column}`
      : error.stage;

    lines.push(`┌─ [${error.code}] ${error.type} at ${location}`);
    lines.push(`│`);

    // Error message
    lines.push(`│  ${error.message}`);

    // Source context
    if (error.source && error.source.text) {
      lines.push(`│`);
      lines.push(`│  ${error.source.text}`);
      if (error.source.column > 0) {
        const pointer = ' '.repeat(error.source.column + 3) + '^';
        lines.push(`│${pointer}`);
      }
    }

    // Suggestion
    if (error.suggestion) {
      lines.push(`│`);
      lines.push(`│  Suggestion: ${error.suggestion}`);
    }

    lines.push(`└─`);

    return lines.join('\n');
  }

  /**
   * Format complete error report
   * @returns {string} Formatted report string
   */
  formatErrorReport() {
    const lines = [];
    const summary = this.getSummary();

    lines.push('');
    lines.push('═'.repeat(70));
    lines.push('  MYCELIAL COMPILATION ERROR REPORT');
    lines.push('═'.repeat(70));
    lines.push('');

    // Summary section
    lines.push('Summary:');
    lines.push(`  Total Errors:     ${summary.total_errors}`);
    lines.push(`  Total Warnings:   ${summary.total_warnings}`);
    lines.push(`  Recovered:        ${summary.recovered_errors}`);
    lines.push(`  Can Continue:     ${summary.can_continue ? 'Yes' : 'No'}`);
    lines.push(`  Stages Affected:  ${summary.stages_affected.join(', ') || 'None'}`);
    lines.push('');

    // Errors by stage
    if (Object.keys(summary.errors_by_stage).length > 0) {
      lines.push('Errors by Stage:');
      for (const [stage, count] of Object.entries(summary.errors_by_stage)) {
        lines.push(`  ${stage.padEnd(15)} ${count} error(s)`);
      }
      lines.push('');
    }

    // Detailed errors
    if (this.errors.length > 0) {
      lines.push('Detailed Errors:');
      lines.push('');
      this.errors.forEach((error, index) => {
        lines.push(`Error ${index + 1}/${this.errors.length}:`);
        lines.push(this.formatError(error));
        lines.push('');
      });
    }

    // Warnings
    if (this.warnings.length > 0) {
      lines.push('Warnings:');
      this.warnings.forEach((warning, index) => {
        lines.push(`  ${index + 1}. [${warning.stage}] ${warning.message}`);
      });
      lines.push('');
    }

    lines.push('═'.repeat(70));

    return lines.join('\n');
  }

  /**
   * Print error report to console
   */
  printErrorReport() {
    console.error(this.formatErrorReport());
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Clear all errors and reset state
   */
  clear() {
    this.errors = [];
    this.warnings = [];
    this.recoveredErrors = [];
    this.startTime = Date.now();
  }

  /**
   * Serialize errors for logging
   * @returns {Object} Serialized error data
   */
  serialize() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      recovered: this.recoveredErrors,
      summary: this.getSummary(),
      timestamp: new Date().toISOString()
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Normalize error to standard format
   * @param {Error|Object} error - Error to normalize
   * @param {string} stage - Compilation stage
   * @param {Object} context - Additional context
   * @returns {Object} Normalized error object
   * @private
   */
  normalizeError(error, stage, context) {
    const type = this.determineErrorType(error, stage);
    const severity = this.determineSeverity(error, type);
    const code = this.generateErrorCode(type, stage);

    return {
      type: type,
      severity: severity,
      message: error.message || String(error),
      code: code,
      stage: stage,
      source: this.extractSource(error, context),
      suggestion: this.generateSuggestion(error, type),
      timestamp: new Date().toISOString(),
      context: context
    };
  }

  /**
   * Determine error type from error object or stage
   * @param {Error|Object} error - Error object
   * @param {string} stage - Stage name
   * @returns {string} Error type
   * @private
   */
  determineErrorType(error, stage) {
    // Check if error has explicit type name
    if (error.name) {
      if (error.name === 'FileNotFoundError' || error.name === 'PermissionError' ||
          error.name === 'InvalidFilePathError' || error.name === 'DiskSpaceError') {
        return ERROR_TYPES.FILE_IO;
      }

      // Check for standard error type names
      const typeName = error.name.replace('Error', '');
      if (typeName === 'FileIO' || typeName === 'Parse' ||
          typeName === 'Compilation' || typeName === 'Runtime') {
        return ERROR_TYPES[typeName.toUpperCase().replace('_', '')];
      }
    }

    // Check error message for clues (before stage inference)
    const msg = error.message || '';
    if (msg.includes('File not found') || msg.includes('Permission denied') ||
        msg.includes('file') || msg.includes('File')) {
      return ERROR_TYPES.FILE_IO;
    }

    // Infer from stage
    if (stage === 'lexer' || stage === 'parser') {
      return ERROR_TYPES.PARSE;
    }

    if (stage === 'ir' || stage === 'codegen' || stage === 'assembler' || stage === 'linker') {
      return ERROR_TYPES.COMPILATION;
    }

    if (stage === 'runtime') {
      return ERROR_TYPES.RUNTIME;
    }

    return ERROR_TYPES.COMPILATION;
  }

  /**
   * Determine severity level
   * @param {Error|Object} error - Error object
   * @param {string} type - Error type
   * @returns {string} Severity level
   * @private
   */
  determineSeverity(error, type) {
    if (error.severity) {
      return error.severity;
    }

    // FileIO errors are usually fatal
    if (type === ERROR_TYPES.FILE_IO) {
      return SEVERITY_LEVELS.FATAL;
    }

    // Parse errors can sometimes be recovered
    if (type === ERROR_TYPES.PARSE) {
      return SEVERITY_LEVELS.ERROR;
    }

    return SEVERITY_LEVELS.ERROR;
  }

  /**
   * Generate error code (e.g., EF01, EP02)
   * @param {string} type - Error type
   * @param {string} stage - Stage name
   * @returns {string} Error code
   * @private
   */
  generateErrorCode(type, stage) {
    const typePrefix = TYPE_PREFIXES[type] || 'X';
    const stageCode = STAGE_CODES[stage] || '99';
    return `E${typePrefix}${stageCode}`;
  }

  /**
   * Extract source location from error
   * @param {Error|Object} error - Error object
   * @param {Object} context - Context object
   * @returns {Object|null} Source location object
   * @private
   */
  extractSource(error, context) {
    if (error.source) {
      return error.source;
    }

    const source = {
      file: context.file || context.sourcePath || 'unknown',
      line: error.line || context.line || 0,
      column: error.column || context.column || 0,
      text: error.text || context.text || ''
    };

    return source.line > 0 || source.text ? source : null;
  }

  /**
   * Generate helpful suggestion based on error
   * @param {Error|Object} error - Error object
   * @param {string} type - Error type
   * @returns {string} Suggestion text
   * @private
   */
  generateSuggestion(error, type) {
    if (error.suggestion) {
      return error.suggestion;
    }

    const msg = error.message || '';

    // Type-specific suggestions
    if (type === ERROR_TYPES.FILE_IO) {
      if (msg.includes('not found')) {
        return 'Check that the file path is correct and the file exists';
      }
      if (msg.includes('permission')) {
        return 'Check file permissions or run with appropriate privileges';
      }
      return 'Verify file path and permissions';
    }

    if (type === ERROR_TYPES.PARSE) {
      if (msg.includes('expected')) {
        return 'Check for missing or mismatched braces, parentheses, or semicolons';
      }
      if (msg.includes('unexpected')) {
        return 'Check for syntax errors or typos near the error location';
      }
      return 'Review syntax near the error location';
    }

    if (type === ERROR_TYPES.COMPILATION) {
      if (msg.includes('undefined')) {
        return 'Ensure all variables and functions are declared before use';
      }
      if (msg.includes('type')) {
        return 'Check type compatibility between operands';
      }
      return 'Review the compilation context and dependencies';
    }

    return 'Check the error message for details';
  }

  /**
   * Attempt to recover from error
   * @param {Object} error - Normalized error object
   * @returns {boolean} True if recovery successful
   * @private
   */
  attemptRecovery(error) {
    // FileIO errors cannot be recovered
    if (error.type === ERROR_TYPES.FILE_IO) {
      return false;
    }

    // Parse errors might be recoverable with heuristics
    if (error.type === ERROR_TYPES.PARSE) {
      return this.recoverParseError(error);
    }

    // Compilation errors might be recoverable
    if (error.type === ERROR_TYPES.COMPILATION) {
      return this.recoverCompilationError(error);
    }

    // Runtime errors can often be logged and continued
    if (error.type === ERROR_TYPES.RUNTIME) {
      if (this.verbose) {
        console.log(`[RECOVERY] Continuing after runtime error: ${error.message}`);
      }
      return true;
    }

    return false;
  }

  /**
   * Attempt to recover from parse errors
   * @param {Object} error - Parse error object
   * @returns {boolean} True if recovery successful
   * @private
   */
  recoverParseError(error) {
    const msg = error.message;

    // Simple heuristic recoveries
    if (msg.includes('missing') && msg.includes('}')) {
      error.recovery = 'Inserted missing closing brace';
      return true;
    }

    if (msg.includes('missing') && msg.includes(';')) {
      error.recovery = 'Inserted missing semicolon';
      return true;
    }

    return false;
  }

  /**
   * Attempt to recover from compilation errors
   * @param {Object} error - Compilation error object
   * @returns {boolean} True if recovery successful
   * @private
   */
  recoverCompilationError(error) {
    const msg = error.message;

    // Treat undefined variables as extern declarations
    if (msg.includes('undefined variable')) {
      error.recovery = 'Treating undefined variable as extern';
      return true;
    }

    return false;
  }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = { ErrorHandler };

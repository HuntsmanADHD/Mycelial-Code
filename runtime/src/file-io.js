/**
 * Mycelial File I/O Module
 *
 * Handles reading source files and writing ELF binaries for the Mycelial Runtime.
 * Provides file system operations with comprehensive error handling.
 *
 * @author Claude Opus 4.5
 * @date 2026-01-01
 */

const fs = require('fs');
const path = require('path');

// Custom Error Classes
class FileNotFoundError extends Error {
  constructor(filePath) {
    super(`File not found: ${filePath}\nSuggestion: Check the file path and ensure the file exists.`);
    this.name = 'FileNotFoundError';
    this.path = filePath;
  }
}

class PermissionError extends Error {
  constructor(filePath, operation) {
    super(`Permission denied for ${operation}: ${filePath}\nSuggestion: Check file permissions or run with appropriate privileges.`);
    this.name = 'PermissionError';
    this.path = filePath;
    this.operation = operation;
  }
}

class InvalidFilePathError extends Error {
  constructor(filePath, reason) {
    super(`Invalid file path: ${filePath}\nReason: ${reason}`);
    this.name = 'InvalidFilePathError';
    this.path = filePath;
    this.reason = reason;
  }
}

class DiskSpaceError extends Error {
  constructor(filePath, bytesNeeded) {
    super(`Insufficient disk space for: ${filePath}\nBytes needed: ${bytesNeeded}\nSuggestion: Free up disk space and try again.`);
    this.name = 'DiskSpaceError';
    this.path = filePath;
    this.bytesNeeded = bytesNeeded;
  }
}

// FileIO Class
class FileIO {
  /**
   * Read a .mycelial source file from disk
   * @param {string} sourcePath - Path to the source file
   * @returns {string} File contents as UTF-8 string
   * @throws {FileNotFoundError|PermissionError|InvalidFilePathError}
   */
  readSourceFile(sourcePath) {
    this.validatePath(sourcePath);

    if (!this.fileExists(sourcePath)) {
      throw new FileNotFoundError(sourcePath);
    }

    try {
      return fs.readFileSync(sourcePath, 'utf-8');
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new PermissionError(sourcePath, 'read');
      }
      throw error;
    }
  }

  /**
   * Write binary ELF data to disk
   * @param {string} outputPath - Path for output file
   * @param {Buffer} elfBytes - Binary ELF data
   * @throws {PermissionError|DiskSpaceError|InvalidFilePathError}
   */
  writeELFBinary(outputPath, elfBytes) {
    this.validatePath(outputPath);

    const directory = this.getDirectory(outputPath);
    this.ensureDirectoryExists(directory);

    try {
      fs.writeFileSync(outputPath, elfBytes);
      this.makeExecutable(outputPath);
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new PermissionError(outputPath, 'write');
      }
      if (error.code === 'ENOSPC') {
        throw new DiskSpaceError(outputPath, elfBytes.length);
      }
      throw error;
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Path to check
   * @returns {boolean} True if file exists
   */
  fileExists(filePath) {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract filename from path
   * @param {string} filePath - Full file path
   * @returns {string} Filename with extension
   */
  getFileName(filePath) {
    return path.basename(filePath);
  }

  /**
   * Extract directory from path
   * @param {string} filePath - Full file path
   * @returns {string} Directory path
   */
  getDirectory(filePath) {
    return path.dirname(filePath);
  }

  /**
   * Get file size in bytes
   * @param {string} filePath - Path to file
   * @returns {number} File size in bytes
   * @throws {FileNotFoundError}
   */
  getFileSize(filePath) {
    if (!this.fileExists(filePath)) {
      throw new FileNotFoundError(filePath);
    }
    return fs.statSync(filePath).size;
  }

  /**
   * Create directory recursively if it doesn't exist
   * @param {string} dirPath - Directory path to create
   * @throws {PermissionError}
   */
  ensureDirectoryExists(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new PermissionError(dirPath, 'create directory');
      }
      throw error;
    }
  }

  /**
   * Set executable permissions on Unix/Linux systems
   * @param {string} filePath - Path to file
   * @throws {PermissionError}
   */
  makeExecutable(filePath) {
    if (process.platform === 'win32') {
      return; // Skip on Windows
    }

    try {
      fs.chmodSync(filePath, 0o755);
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new PermissionError(filePath, 'chmod');
      }
      throw error;
    }
  }

  /**
   * Validate path safety and format
   * @param {string} filePath - Path to validate
   * @throws {InvalidFilePathError}
   */
  validatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new InvalidFilePathError(filePath, 'Path is null, undefined, or not a string');
    }

    if (filePath.trim().length === 0) {
      throw new InvalidFilePathError(filePath, 'Path is empty');
    }

    const invalidChars = /[<>"|?*\x00-\x1F]/;
    if (invalidChars.test(filePath)) {
      throw new InvalidFilePathError(filePath, 'Path contains invalid characters');
    }
  }

  /**
   * Convert bytes to human-readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string (e.g., "1.5 KB", "2.3 MB")
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);

    return `${size.toFixed(1)} ${units[i]}`;
  }
}

module.exports = {
  FileIO,
  FileNotFoundError,
  PermissionError,
  InvalidFilePathError,
  DiskSpaceError
};

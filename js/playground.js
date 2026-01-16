/**
 * MYCELIAL PLAYGROUND - CORE MODULE
 * Main playground logic and compilation orchestration
 */

/**
 * Initialize playground
 */
function initPlayground() {
    // Initialize editor
    window.editorModule.init();

    // Initialize output panel
    window.outputModule.init();

    // Set up compile button
    const compileButton = document.getElementById('btn-compile');
    if (compileButton) {
        compileButton.addEventListener('click', compileCode);
    }

    // Set up reset button
    const resetButton = document.getElementById('btn-reset');
    if (resetButton) {
        resetButton.addEventListener('click', resetPlayground);
    }

    // Set up share button
    const shareButton = document.getElementById('btn-share');
    if (shareButton) {
        shareButton.addEventListener('click', shareCode);
    }

    // Set up help button
    const helpButton = document.getElementById('btn-help');
    if (helpButton) {
        helpButton.addEventListener('click', showHelp);
    }

    // Set up example selector
    const exampleSelector = document.getElementById('example-selector');
    if (exampleSelector) {
        exampleSelector.addEventListener('change', loadExample);
    }

    // Set up help modal close
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', hideHelp);
    }

    // Close modal on background click
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideHelp();
            }
        });
    }

    // Load examples
    loadExamplesList();

    // Check for shared code in URL
    loadSharedCode();

    console.log('Mycelial Playground initialized');
}

/**
 * Compile the current code
 */
function compileCode() {
    const code = window.editorModule.getCode();

    if (!code.trim()) {
        window.outputModule.addConsoleMessage('Error: No code to compile', 'error');
        return;
    }

    // Update status
    const statusEl = document.getElementById('editor-status');
    if (statusEl) {
        statusEl.textContent = 'Compiling...';
        statusEl.classList.add('compiling');
    }

    window.outputModule.clearAllOutputs();
    window.outputModule.addConsoleMessage('Starting compilation...', 'info');
    window.outputModule.updateCompileStatus('Compiling...');

    // Simulate compilation (in real implementation, this would call the WASM compiler)
    setTimeout(() => {
        try {
            // Phase 1: Lexical Analysis
            window.outputModule.addConsoleMessage('Phase 1: Lexical Analysis', 'info');
            const tokens = mockLexer(code);
            window.outputModule.displayTokens(tokens);
            window.outputModule.addConsoleMessage(`✓ Generated ${tokens.length} tokens`, 'success');

            // Phase 2: Parsing
            window.outputModule.addConsoleMessage('Phase 2: Parsing', 'info');
            const ast = mockParser(tokens);
            window.outputModule.displayAST(ast);
            window.outputModule.addConsoleMessage('✓ AST generated successfully', 'success');

            // Phase 3: Type Checking
            window.outputModule.addConsoleMessage('Phase 3: Type Checking', 'info');
            const typeCheckResult = mockTypeChecker(ast);
            if (typeCheckResult.success) {
                window.outputModule.addConsoleMessage('✓ Type checking passed', 'success');
            } else {
                window.outputModule.addConsoleMessage('⚠ Type checking warnings', 'warning');
            }

            // Phase 4: IR Generation
            window.outputModule.addConsoleMessage('Phase 4: IR Generation', 'info');
            const ir = mockIRGenerator(ast);
            window.outputModule.addConsoleMessage('✓ IR generated successfully', 'success');

            // Phase 5: Code Generation
            window.outputModule.addConsoleMessage('Phase 5: Code Generation', 'info');
            const assembly = mockCodeGen(ir);
            window.outputModule.displayAssembly(assembly);
            window.outputModule.addConsoleMessage('✓ Assembly generated successfully', 'success');

            // Phase 6: Binary Generation
            window.outputModule.addConsoleMessage('Phase 6: Binary Generation', 'info');
            const binary = mockBinaryGen(assembly);
            window.outputModule.displayBinary(binary);
            window.outputModule.addConsoleMessage('✓ Binary generated successfully', 'success');

            // Success
            window.outputModule.addConsoleMessage('', 'info');
            window.outputModule.addConsoleMessage('Compilation completed successfully! 🌿', 'success');
            window.outputModule.updateCompileStatus('Compiled successfully');

            if (statusEl) {
                statusEl.textContent = 'Ready';
                statusEl.classList.remove('compiling');
            }
        } catch (error) {
            window.outputModule.addConsoleMessage(`Error: ${error.message}`, 'error');
            window.outputModule.updateCompileStatus('Compilation failed');

            if (statusEl) {
                statusEl.textContent = 'Error';
                statusEl.classList.remove('compiling');
            }
        }
    }, 500);
}

/**
 * Reset playground to default state
 */
function resetPlayground() {
    if (confirm('Reset to default code? Your current code will be lost.')) {
        window.editorModule.reset();
        window.outputModule.clearAllOutputs();
        window.outputModule.addConsoleMessage('Playground reset', 'info');
        window.outputModule.updateCompileStatus('Not compiled');
    }
}

/**
 * Share code via URL
 */
function shareCode() {
    const code = window.editorModule.getCode();
    const compressed = LZString.compressToEncodedURIComponent(code);
    const shareUrl = `${window.location.origin}${window.location.pathname}?code=${compressed}`;

    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Share link copied to clipboard!');
    }).catch(() => {
        // Fallback: show in prompt
        prompt('Copy this link to share:', shareUrl);
    });
}

/**
 * Load shared code from URL
 */
function loadSharedCode() {
    const params = new URLSearchParams(window.location.search);
    const compressed = params.get('code');

    if (compressed) {
        try {
            const code = LZString.decompressFromEncodedURIComponent(compressed);
            if (code) {
                window.editorModule.setCode(code);
                window.outputModule.addConsoleMessage('Loaded shared code', 'info');
            }
        } catch (error) {
            console.error('Failed to load shared code:', error);
        }
    }
}

/**
 * Load examples list
 */
function loadExamplesList() {
    const selector = document.getElementById('example-selector');
    if (!selector) return;

    // In a real implementation, this would fetch from examples.json
    // For now, we'll populate it in examples.js
}

/**
 * Load a specific example
 */
function loadExample(event) {
    const exampleId = event.target.value;
    if (!exampleId) return;

    // This will be implemented in examples.js
    if (window.examplesModule && window.examplesModule.loadExample) {
        window.examplesModule.loadExample(exampleId);
    }

    // Reset selector
    event.target.value = '';
}

/**
 * Show help modal
 */
function showHelp() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Hide help modal
 */
function hideHelp() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ============================================================================
// MOCK COMPILER FUNCTIONS
// These simulate the compilation pipeline
// In production, these would call the WASM-compiled Mycelial compiler
// ============================================================================

/**
 * Mock lexer - generates tokens from source code
 */
function mockLexer(code) {
    const tokens = [];
    const keywords = ['network', 'frequencies', 'hyphae', 'hyphal', 'topology',
                     'fruiting_body', 'spawn', 'socket', 'on', 'signal', 'emit',
                     'if', 'else', 'while', 'for', 'let', 'state', 'as'];

    // Simple regex-based tokenization (mock)
    const lines = code.split('\n');
    lines.forEach((line, lineNum) => {
        // Skip comments
        if (line.trim().startsWith('#')) {
            tokens.push({
                type: 'COMMENT',
                value: line.trim(),
                line: lineNum + 1,
                col: 1
            });
            return;
        }

        // Tokenize words
        const words = line.match(/\w+|[{}()[\]:,;]|->|"[^"]*"/g) || [];
        words.forEach((word, col) => {
            let type = 'IDENTIFIER';

            if (keywords.includes(word)) {
                type = 'KEYWORD';
            } else if (word.match(/^\d+$/)) {
                type = 'NUMBER';
            } else if (word.match(/^".*"$/)) {
                type = 'STRING';
            } else if (['{', '}', '(', ')', '[', ']'].includes(word)) {
                type = 'DELIMITER';
            } else if ([':', ',', ';'].includes(word)) {
                type = 'SEPARATOR';
            } else if (word === '->') {
                type = 'OPERATOR';
            }

            tokens.push({
                type,
                value: word,
                line: lineNum + 1,
                col: col + 1
            });
        });
    });

    return tokens;
}

/**
 * Mock parser - generates AST from tokens
 */
function mockParser(tokens) {
    return {
        type: 'Program',
        networks: [
            {
                type: 'Network',
                name: 'Example',
                frequencies: [],
                hyphae: [],
                topology: {}
            }
        ]
    };
}

/**
 * Mock type checker
 */
function mockTypeChecker(ast) {
    return { success: true, errors: [], warnings: [] };
}

/**
 * Mock IR generator
 */
function mockIRGenerator(ast) {
    return {
        functions: [],
        structs: []
    };
}

/**
 * Mock code generator - generates assembly
 */
function mockCodeGen(ir) {
    return `; Mycelial Assembly Output
; Generated by Mycelial Compiler

section .text
global _start

_start:
    ; Initialize runtime
    call mycelial_init

    ; Execute network
    call network_execute

    ; Exit
    mov rax, 60
    xor rdi, rdi
    syscall

mycelial_init:
    ; Runtime initialization
    ret

network_execute:
    ; Network execution
    ret

section .data
    msg db "Hello, Mycelial!", 10
    msglen equ $ - msg
`;
}

/**
 * Mock binary generator - generates binary info
 */
function mockBinaryGen(assembly) {
    return `Binary Information
==================

Format: ELF64
Architecture: x86-64
Entry Point: 0x401000
Sections: 3

.text   (code)   : 0x401000 - 0x401FFF (4 KB)
.data   (data)   : 0x402000 - 0x402FFF (4 KB)
.bss    (uninit) : 0x403000 - 0x403FFF (4 KB)

Symbols:
  _start          : 0x401000
  mycelial_init   : 0x401020
  network_execute : 0x401040

File size: 12,288 bytes
`;
}

// Simple LZString implementation for URL compression
const LZString = {
    compressToEncodedURIComponent: function(input) {
        if (input == null) return '';
        return encodeURIComponent(btoa(input));
    },
    decompressFromEncodedURIComponent: function(input) {
        if (input == null) return '';
        try {
            return atob(decodeURIComponent(input));
        } catch (e) {
            return '';
        }
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayground);
} else {
    initPlayground();
}

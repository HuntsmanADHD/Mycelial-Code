/**
 * MYCELIAL PLAYGROUND - EDITOR MODULE
 * CodeMirror editor setup and configuration
 */

let editor = null;

/**
 * Initialize CodeMirror editor
 */
function initEditor() {
    const textarea = document.getElementById('code-editor');
    if (!textarea) {
        console.error('Editor textarea not found');
        return null;
    }

    // Initialize CodeMirror
    editor = CodeMirror.fromTextArea(textarea, {
        mode: 'text/x-csrc', // C-like mode for Mycelial
        theme: 'dracula',
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        indentWithTabs: false,
        lineWrapping: false,
        viewportMargin: Infinity,
        extraKeys: {
            'Ctrl-Enter': compileCode,
            'Cmd-Enter': compileCode,
            'Ctrl-S': saveToLocalStorage,
            'Cmd-S': saveToLocalStorage,
        }
    });

    // Set default code
    const defaultCode = `# Hello World in Mycelial
# The simplest possible program

network HelloWorld {
  frequencies {
    greeting {
      name: string
    }

    response {
      message: string
    }
  }

  hyphae {
    hyphal greeter {
      on signal(greeting, g) {
        emit response {
          message: format("Hello, {}!", g.name)
        }
      }
    }
  }

  topology {
    fruiting_body input
    fruiting_body output

    spawn greeter as G1

    socket input -> G1 (frequency: greeting)
    socket G1 -> output (frequency: response)
  }
}`;

    // Load from localStorage or use default
    const savedCode = localStorage.getItem('mycelial-playground-code');
    editor.setValue(savedCode || defaultCode);

    // Update cursor position display
    editor.on('cursorActivity', updateCursorPosition);

    // Auto-save on change
    editor.on('change', () => {
        saveToLocalStorage();
    });

    // Initial cursor position
    updateCursorPosition();

    return editor;
}

/**
 * Update cursor position display
 */
function updateCursorPosition() {
    if (!editor) return;

    const cursor = editor.getCursor();
    const positionEl = document.getElementById('cursor-position');
    if (positionEl) {
        positionEl.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
    }
}

/**
 * Save editor content to localStorage
 */
function saveToLocalStorage(e) {
    if (e) e.preventDefault();

    if (!editor) return;

    const code = editor.getValue();
    localStorage.setItem('mycelial-playground-code', code);

    // Show save indicator
    const statusEl = document.getElementById('editor-status');
    if (statusEl) {
        const originalText = statusEl.textContent;
        statusEl.textContent = 'Saved';
        setTimeout(() => {
            statusEl.textContent = originalText;
        }, 1000);
    }

    return false;
}

/**
 * Get current editor code
 */
function getEditorCode() {
    return editor ? editor.getValue() : '';
}

/**
 * Set editor code
 */
function setEditorCode(code) {
    if (editor) {
        editor.setValue(code);
    }
}

/**
 * Reset editor to default code
 */
function resetEditor() {
    const defaultCode = `# Start coding here
network Example {
  frequencies {
    # Define your signal types
  }

  hyphae {
    # Define your agents
  }

  topology {
    # Define your network topology
  }
}`;

    setEditorCode(defaultCode);
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.editorModule = {
        init: initEditor,
        getCode: getEditorCode,
        setCode: setEditorCode,
        reset: resetEditor,
        save: saveToLocalStorage
    };
}

/**
 * MYCELIAL PLAYGROUND - OUTPUT MODULE
 * Output panel management and tab switching
 */

let currentTab = 'tokens';

/**
 * Initialize output panel
 */
function initOutput() {
    // Set up tab switching
    const tabButtons = document.querySelectorAll('.output-tab');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Set up copy button
    const copyButton = document.getElementById('btn-copy-output');
    if (copyButton) {
        copyButton.addEventListener('click', copyCurrentOutput);
    }

    // Set up tab navigation buttons
    const prevButton = document.getElementById('btn-prev-tab');
    const nextButton = document.getElementById('btn-next-tab');

    if (prevButton) {
        prevButton.addEventListener('click', () => navigateTabs(-1));
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => navigateTabs(1));
    }
}

/**
 * Switch to a specific output tab
 */
function switchTab(tabName) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.output-tab');
    tabButtons.forEach(button => {
        if (button.getAttribute('data-tab') === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Update tab content
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        if (content.id === `tab-${tabName}`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    currentTab = tabName;
}

/**
 * Navigate tabs (previous/next)
 */
function navigateTabs(direction) {
    const tabs = ['tokens', 'ast', 'assembly', 'binary', 'console'];
    const currentIndex = tabs.indexOf(currentTab);
    let newIndex = currentIndex + direction;

    // Wrap around
    if (newIndex < 0) newIndex = tabs.length - 1;
    if (newIndex >= tabs.length) newIndex = 0;

    switchTab(tabs[newIndex]);
}

/**
 * Copy current output to clipboard
 */
function copyCurrentOutput() {
    let textToCopy = '';

    switch (currentTab) {
        case 'tokens':
            textToCopy = getTokensText();
            break;
        case 'ast':
            textToCopy = document.getElementById('ast-output')?.textContent || '';
            break;
        case 'assembly':
            textToCopy = document.getElementById('assembly-output')?.textContent || '';
            break;
        case 'binary':
            textToCopy = document.getElementById('binary-output')?.textContent || '';
            break;
        case 'console':
            textToCopy = getConsoleText();
            break;
    }

    if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showCopyFeedback();
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }
}

/**
 * Get tokens table as text
 */
function getTokensText() {
    const table = document.getElementById('tokens-table');
    if (!table) return '';

    const rows = table.querySelectorAll('tbody tr');
    let text = 'Type\tValue\tLine:Col\n';

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 3) {
            text += `${cells[0].textContent}\t${cells[1].textContent}\t${cells[2].textContent}\n`;
        }
    });

    return text;
}

/**
 * Get console output as text
 */
function getConsoleText() {
    const console = document.getElementById('console-output');
    if (!console) return '';

    const lines = console.querySelectorAll('.console-line');
    return Array.from(lines).map(line => line.textContent).join('\n');
}

/**
 * Show copy feedback
 */
function showCopyFeedback() {
    const copyButton = document.getElementById('btn-copy-output');
    if (copyButton) {
        const originalText = copyButton.textContent;
        copyButton.textContent = '✓';
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 1500);
    }
}

/**
 * Display tokens in the tokens tab
 */
function displayTokens(tokens) {
    const tbody = document.getElementById('tokens-body');
    if (!tbody) return;

    // Clear existing content
    tbody.innerHTML = '';

    if (!tokens || tokens.length === 0) {
        tbody.innerHTML = '<tr class="empty-state"><td colspan="3">No tokens generated</td></tr>';
        return;
    }

    // Add token rows
    tokens.forEach(token => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(token.type)}</td>
            <td>${escapeHtml(token.value)}</td>
            <td>${token.line}:${token.col}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Display AST in the AST tab
 */
function displayAST(ast) {
    const output = document.getElementById('ast-output');
    if (!output) return;

    if (!ast) {
        output.innerHTML = '<span class="empty-state">No AST generated</span>';
        return;
    }

    // Pretty-print the AST
    output.textContent = typeof ast === 'string' ? ast : JSON.stringify(ast, null, 2);
}

/**
 * Display assembly in the assembly tab
 */
function displayAssembly(assembly) {
    const output = document.getElementById('assembly-output');
    if (!output) return;

    if (!assembly) {
        output.innerHTML = '<span class="empty-state">No assembly generated</span>';
        return;
    }

    output.textContent = assembly;
}

/**
 * Display binary info in the binary tab
 */
function displayBinary(binary) {
    const output = document.getElementById('binary-output');
    if (!output) return;

    if (!binary) {
        output.innerHTML = '<span class="empty-state">No binary generated</span>';
        return;
    }

    output.textContent = binary;
}

/**
 * Add a console message
 */
function addConsoleMessage(message, type = 'info') {
    const consoleOutput = document.getElementById('console-output');
    if (!consoleOutput) return;

    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = message;
    consoleOutput.appendChild(line);

    // Auto-scroll to bottom
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

/**
 * Clear console
 */
function clearConsole() {
    const consoleOutput = document.getElementById('console-output');
    if (!consoleOutput) return;

    consoleOutput.innerHTML = '';
}

/**
 * Clear all outputs
 */
function clearAllOutputs() {
    // Clear tokens
    const tbody = document.getElementById('tokens-body');
    if (tbody) {
        tbody.innerHTML = '<tr class="empty-state"><td colspan="3">Click "Compile" to see tokens</td></tr>';
    }

    // Clear AST
    const astOutput = document.getElementById('ast-output');
    if (astOutput) {
        astOutput.innerHTML = '<span class="empty-state">Click "Compile" to see AST</span>';
    }

    // Clear assembly
    const asmOutput = document.getElementById('assembly-output');
    if (asmOutput) {
        asmOutput.innerHTML = '<span class="empty-state">Click "Compile" to see assembly</span>';
    }

    // Clear binary
    const binOutput = document.getElementById('binary-output');
    if (binOutput) {
        binOutput.innerHTML = '<span class="empty-state">Click "Compile" to see binary info</span>';
    }

    // Clear console
    clearConsole();
}

/**
 * Update compile status
 */
function updateCompileStatus(status) {
    const statusEl = document.getElementById('compile-status');
    if (statusEl) {
        statusEl.textContent = status;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.outputModule = {
        init: initOutput,
        switchTab,
        displayTokens,
        displayAST,
        displayAssembly,
        displayBinary,
        addConsoleMessage,
        clearConsole,
        clearAllOutputs,
        updateCompileStatus
    };
}

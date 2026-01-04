/**
 * MYCELIAL PLAYGROUND - EXAMPLES MODULE
 * Example programs loading and management
 */

let examplesData = null;

/**
 * Load examples from data/examples.json
 */
async function loadExamples() {
    try {
        const response = await fetch('../data/examples.json');
        const data = await response.json();
        examplesData = data.examples;

        // Populate example selector (playground page)
        populateExampleSelector();

        // Populate examples gallery (landing page)
        populateExamplesGallery();

        return examplesData;
    } catch (error) {
        console.error('Failed to load examples:', error);
        return [];
    }
}

/**
 * Populate example selector dropdown (playground)
 */
function populateExampleSelector() {
    const selector = document.getElementById('example-selector');
    if (!selector || !examplesData) return;

    // Clear existing options (keep the first "Load Example..." option)
    while (selector.options.length > 1) {
        selector.remove(1);
    }

    // Add examples
    examplesData.forEach(example => {
        const option = document.createElement('option');
        option.value = example.id;
        option.textContent = `${example.title} (${example.difficulty})`;
        selector.appendChild(option);
    });
}

/**
 * Populate examples gallery (landing page)
 */
function populateExamplesGallery() {
    const gallery = document.getElementById('examples-grid');
    if (!gallery || !examplesData) return;

    gallery.innerHTML = '';

    examplesData.forEach((example, index) => {
        const card = createExampleCard(example, index);
        gallery.appendChild(card);
    });
}

/**
 * Create an example card for the gallery
 */
function createExampleCard(example, index) {
    const card = document.createElement('div');
    card.className = 'example-card';

    const difficultyClass = example.difficulty || 'beginner';
    const difficultyEmoji = {
        'beginner': '🌱',
        'intermediate': '🌿',
        'advanced': '🌳'
    }[difficultyClass] || '🌱';

    card.innerHTML = `
        <div class="example-header">
            <h3>${escapeHtml(example.title)}</h3>
            <span class="difficulty-badge ${difficultyClass}">
                ${difficultyEmoji} ${capitalize(example.difficulty)}
            </span>
        </div>
        <p class="example-description">${escapeHtml(example.description)}</p>
        <div class="example-actions">
            <button class="btn btn-secondary btn-small" onclick="tryExample('${example.id}')">
                Try It →
            </button>
            <button class="btn btn-secondary btn-small" onclick="viewExampleCode('${example.id}')">
                View Code
            </button>
        </div>
    `;

    return card;
}

/**
 * Load a specific example into the editor
 */
function loadExample(exampleId) {
    if (!examplesData) {
        console.error('Examples not loaded yet');
        return;
    }

    const example = examplesData.find(ex => ex.id === exampleId);
    if (!example) {
        console.error('Example not found:', exampleId);
        return;
    }

    // Set the code in the editor
    if (window.editorModule) {
        window.editorModule.setCode(example.code);
    }

    // Clear outputs
    if (window.outputModule) {
        window.outputModule.clearAllOutputs();
        window.outputModule.addConsoleMessage(`Loaded example: ${example.title}`, 'info');
        window.outputModule.updateCompileStatus('Not compiled');
    }

    // Update editor status
    const statusEl = document.getElementById('editor-status');
    if (statusEl) {
        statusEl.textContent = 'Ready';
    }
}

/**
 * Try an example (navigate to playground with example loaded)
 */
function tryExample(exampleId) {
    if (!examplesData) return;

    const example = examplesData.find(ex => ex.id === exampleId);
    if (!example) return;

    // Compress code for URL
    const compressed = LZString.compressToEncodedURIComponent(example.code);
    const playgroundUrl = `playground.html?code=${compressed}`;

    // Navigate to playground
    window.location.href = playgroundUrl;
}

/**
 * View example code in a modal
 */
function viewExampleCode(exampleId) {
    if (!examplesData) return;

    const example = examplesData.find(ex => ex.id === exampleId);
    if (!example) return;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${escapeHtml(example.title)}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>${escapeHtml(example.description)}</p>
                <div class="code-example">
                    <div class="code-header">
                        <span class="code-title">${example.id}.mycelial</span>
                        <button class="btn-copy" onclick="copyExampleCode('${example.id}')">Copy</button>
                    </div>
                    <pre><code class="mycelial">${escapeHtml(example.code)}</code></pre>
                </div>
                <div style="margin-top: 1rem; text-align: center;">
                    <button class="btn btn-primary" onclick="tryExample('${example.id}')">
                        Try in Playground →
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Close button
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
}

/**
 * Copy example code to clipboard
 */
function copyExampleCode(exampleId) {
    if (!examplesData) return;

    const example = examplesData.find(ex => ex.id === exampleId);
    if (!example) return;

    navigator.clipboard.writeText(example.code).then(() => {
        alert('Code copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Utility: Capitalize first letter
 */
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// Simple LZString for URL compression (same as in playground.js)
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

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.examplesModule = {
        load: loadExamples,
        loadExample: loadExample,
        tryExample: tryExample,
        viewExampleCode: viewExampleCode,
        copyExampleCode: copyExampleCode
    };
}

// Load examples when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadExamples);
} else {
    loadExamples();
}

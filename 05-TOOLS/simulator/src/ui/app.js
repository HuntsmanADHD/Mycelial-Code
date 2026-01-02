/**
 * Main Application Controller
 * Coordinates parser, analyzer, runtime, and visualizer
 */

class MycelialApp {
  constructor() {
    this.parser = null;
    this.analyzer = null;
    this.scheduler = null;
    this.renderer = null;

    this.currentAST = null;
    this.currentSource = '';

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupCodeEditor();
    this.setupEventListeners();
    this.loadExamples();
  }

  /**
   * Set up CodeMirror editor
   */
  setupCodeEditor() {
    this.editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      indentWithTabs: false,
      theme: 'default',
      mode: 'null', // Custom Mycelial mode would go here
    });

    // Update size
    this.editor.setSize('100%', '100%');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // File operations
    document.getElementById('btn-load-file').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files[0]);
    });

    // Parse button
    document.getElementById('btn-parse').addEventListener('click', () => {
      this.parseAndValidate();
    });

    // Execution controls
    document.getElementById('btn-step').addEventListener('click', () => {
      this.step();
    });

    document.getElementById('btn-play').addEventListener('click', () => {
      this.play();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.pause();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      this.reset();
    });

    // Speed control
    document.getElementById('speed-slider').addEventListener('input', (e) => {
      this.setSpeed(parseInt(e.target.value));
    });

    // Close error panel
    document.getElementById('btn-close-errors').addEventListener('click', () => {
      document.getElementById('error-panel').style.display = 'none';
    });

    // Drag and drop
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      document.getElementById('main').style.opacity = '0.5';
    });

    document.addEventListener('dragleave', () => {
      document.getElementById('main').style.opacity = '1';
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      document.getElementById('main').style.opacity = '1';
      if (e.dataTransfer.files[0]) {
        this.handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  /**
   * Load example programs
   */
  loadExamples() {
    const examplesSelect = document.getElementById('examples');
    examplesSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadExampleFile(e.target.value);
      }
    });
  }

  /**
   * Load example file
   */
  loadExampleFile(filename) {
    const path = `examples/${filename}`;
    fetch(path)
      .then(response => response.text())
      .then(text => {
        this.editor.setValue(text);
        this.currentSource = text;
        this.enableParseButton();
      })
      .catch(err => {
        this.displayError(`Failed to load example: ${err.message}`);
      });
  }

  /**
   * Handle file selection
   */
  handleFileSelect(file) {
    if (!file.name.endsWith('.mycelial')) {
      this.displayError('Please select a .mycelial file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.editor.setValue(e.target.result);
      this.currentSource = e.target.result;
      this.enableParseButton();
    };
    reader.readAsText(file);
  }

  /**
   * Parse and validate the program
   */
  parseAndValidate() {
    this.clearErrors();
    this.currentSource = this.editor.getValue();

    try {
      // Lexical analysis
      const lexer = new Lexer(this.currentSource, 'program.mycelial');
      const tokens = lexer.tokenize();

      // Parsing
      const parser = new Parser(tokens);
      this.currentAST = parser.parse();

      if (parser.errors.length > 0) {
        parser.errors.forEach(err => this.displayError(err.message, err));
        document.getElementById('btn-parse').textContent = '✗ Parse Failed';
        document.getElementById('btn-parse').classList.add('error');
        return false;
      }

      // Semantic analysis
      const analyzer = new SemanticAnalyzer();
      const validationErrors = analyzer.analyze(this.currentAST);

      if (validationErrors.length > 0) {
        validationErrors.forEach(err => {
          this.displayError(err.message, err);
        });
        document.getElementById('btn-parse').textContent = '⚠ Validation Failed';
        document.getElementById('btn-parse').classList.add('warning');
        return false;
      }

      // Success!
      document.getElementById('btn-parse').textContent = '✓ Parsed';
      document.getElementById('btn-parse').classList.remove('error', 'warning');
      document.getElementById('btn-parse').classList.add('success');

      // Enable runtime controls
      this.enableRuntimeControls();

      // Initialize runtime and visualization
      this.initializeRuntime();

      return true;
    } catch (e) {
      console.error('Parse error:', e);
      this.displayError(e.message || String(e) || 'Unknown parse error');
      document.getElementById('btn-parse').textContent = '✗ Parse Failed';
      document.getElementById('btn-parse').classList.add('error');
      return false;
    }
  }

  /**
   * Initialize runtime
   */
  initializeRuntime() {
    if (!this.currentAST) return;

    try {
      this.scheduler = new Scheduler(this.currentAST);
      this.renderer = new GraphRenderer('#graph-container');
      this.renderer.render(this.currentAST.topology);

      // Remove placeholder
      const placeholder = document.querySelector('.placeholder');
      if (placeholder) {
        placeholder.style.display = 'none';
      }

      this.updateCycleInfo();
    } catch (e) {
      console.error('Runtime initialization error:', e);
      this.displayError('Failed to initialize runtime: ' + e.message);
    }
  }

  /**
   * Execute one cycle
   */
  step() {
    if (!this.scheduler) {
      this.displayError('Please parse a program first');
      return;
    }

    try {
      this.scheduler.executeOneCycle();
      this.updateVisualization();
      this.updateCycleInfo();
    } catch (e) {
      console.error('Execution error:', e);
      this.displayError('Runtime error: ' + e.message);
    }
  }

  /**
   * Auto-play
   */
  play() {
    if (!this.scheduler) return;

    document.getElementById('btn-play').style.display = 'none';
    document.getElementById('btn-pause').style.display = 'inline-block';

    const speed = parseInt(document.getElementById('speed-slider').value);
    const delay = 1100 - speed * 100; // 1000ms at speed 1, 100ms at speed 10

    this.playInterval = setInterval(() => {
      this.step();
    }, delay);
  }

  /**
   * Pause playback
   */
  pause() {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }

    document.getElementById('btn-play').style.display = 'inline-block';
    document.getElementById('btn-pause').style.display = 'none';
  }

  /**
   * Set playback speed
   */
  setSpeed(speed) {
    if (this.playInterval) {
      this.pause();
      this.play(); // Restart with new speed
    }
  }

  /**
   * Reset to cycle 0
   */
  reset() {
    if (!this.scheduler) return;

    this.pause();

    // Reinitialize
    this.scheduler = new Scheduler(this.currentAST);
    this.updateVisualization();
    this.updateCycleInfo();
  }

  /**
   * Update visualization
   */
  updateVisualization() {
    if (!this.renderer || !this.scheduler) return;

    this.renderer.update(this.scheduler.runtime);
  }

  /**
   * Update cycle display
   */
  updateCycleInfo() {
    if (!this.scheduler) return;

    document.getElementById('cycle-count').textContent = this.scheduler.runtime.cycleCount;
    document.getElementById('phase-info').textContent = `(${this.scheduler.runtime.phase})`;
  }

  /**
   * Enable parse button and reset its state
   */
  enableParseButton() {
    const btn = document.getElementById('btn-parse');
    btn.disabled = false;
    btn.textContent = '✓ Parse';
    btn.classList.remove('error', 'warning', 'success');
  }

  /**
   * Enable/disable runtime controls
   */
  enableRuntimeControls() {
    ['btn-step', 'btn-play', 'btn-reset'].forEach(id => {
      document.getElementById(id).disabled = false;
    });
  }

  /**
   * Display error message
   */
  displayError(message, error = null) {
    const errorPanel = document.getElementById('error-panel');
    const errorList = document.getElementById('error-list');

    const errorItem = document.createElement('div');
    errorItem.className = 'error-item';

    if (error && error.line) {
      const location = document.createElement('div');
      location.className = 'location';
      location.textContent = `Line ${error.line}, Column ${error.column}`;
      errorItem.appendChild(location);
    }

    const msg = document.createElement('div');
    msg.className = 'message';
    msg.textContent = message;
    errorItem.appendChild(msg);

    errorList.appendChild(errorItem);
    errorPanel.style.display = 'block';
  }

  /**
   * Clear error messages
   */
  clearErrors() {
    document.getElementById('error-list').innerHTML = '';
    document.getElementById('error-panel').style.display = 'none';
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MycelialApp();
  console.log('Mycelial Simulator initialized');
});

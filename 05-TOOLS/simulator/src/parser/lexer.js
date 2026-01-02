/**
 * Lexer for Mycelial Language
 * Tokenizes .mycelial source code
 */

class Token {
  constructor(type, value, line, column) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
  }

  toString() {
    return `Token(${this.type}, "${this.value}", ${this.line}:${this.column})`;
  }
}

class Lexer {
  constructor(source, filename = 'input.mycelial') {
    this.source = source;
    this.filename = filename;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];

    // Keywords
    this.keywords = new Set([
      'network', 'frequencies', 'frequency', 'hyphae', 'hyphal',
      'state', 'on', 'signal', 'emit', 'report', 'spawn', 'die',
      'socket', 'fruiting_body', 'topology', 'config',
      'if', 'else', 'where', 'rest', 'cycle',
      'true', 'false', 'as',
    ]);

    // Type keywords - these are returned as IDENTIFIER for parser compatibility
    this.typeKeywords = new Set([
      'u32', 'i64', 'f64', 'string', 'binary', 'boolean',
      'vec', 'queue', 'map',
    ]);
  }

  /**
   * Current character without advancing
   */
  peek(offset = 0) {
    const pos = this.position + offset;
    if (pos >= this.source.length) return null;
    return this.source[pos];
  }

  /**
   * Advance position and return current character
   */
  advance() {
    if (this.position >= this.source.length) return null;

    const ch = this.source[this.position];
    this.position++;

    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }

    return ch;
  }

  /**
   * Skip whitespace
   */
  skipWhitespace() {
    while (this.peek() && /\s/.test(this.peek())) {
      this.advance();
    }
  }

  /**
   * Skip comments
   */
  skipComment() {
    if (this.peek() === '#') {
      while (this.peek() && this.peek() !== '\n') {
        this.advance();
      }
      if (this.peek() === '\n') {
        this.advance();
      }
      return true;
    }
    return false;
  }

  /**
   * Read a number (integer or float)
   */
  readNumber() {
    const startLine = this.line;
    const startCol = this.column;
    let num = '';

    // Read digits before decimal
    while (this.peek() && /\d/.test(this.peek())) {
      num += this.advance();
    }

    // Read decimal point and fraction
    if (this.peek() === '.' && /\d/.test(this.peek(1))) {
      num += this.advance(); // consume '.'
      while (this.peek() && /\d/.test(this.peek())) {
        num += this.advance();
      }
    }

    return new Token('NUMBER', parseFloat(num), startLine, startCol);
  }

  /**
   * Read a string (single or double quoted)
   */
  readString(quote) {
    const startLine = this.line;
    const startCol = this.column;
    let str = '';

    this.advance(); // consume opening quote

    while (this.peek() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance(); // consume backslash
        const next = this.advance();
        switch (next) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case 'r': str += '\r'; break;
          case '"': str += '"'; break;
          case "'": str += "'"; break;
          case '\\': str += '\\'; break;
          default: str += next;
        }
      } else {
        str += this.advance();
      }
    }

    if (!this.peek()) {
      throw new ParseError(`Unterminated string at ${startLine}:${startCol}`);
    }

    this.advance(); // consume closing quote

    return new Token('STRING', str, startLine, startCol);
  }

  /**
   * Read an identifier or keyword
   */
  readIdentifier() {
    const startLine = this.line;
    const startCol = this.column;
    let ident = '';

    while (this.peek() && /[a-zA-Z0-9_]/.test(this.peek())) {
      ident += this.advance();
    }

    // Check if it's a keyword
    if (this.keywords.has(ident)) {
      return new Token(ident.toUpperCase(), ident, startLine, startCol);
    }

    // Type keywords are returned as IDENTIFIER for parser compatibility
    if (this.typeKeywords.has(ident)) {
      return new Token('IDENTIFIER', ident, startLine, startCol);
    }

    return new Token('IDENTIFIER', ident, startLine, startCol);
  }

  /**
   * Get next token
   */
  nextToken() {
    // Skip whitespace and comments
    while (true) {
      this.skipWhitespace();
      if (!this.skipComment()) break;
    }

    // End of file
    if (this.position >= this.source.length) {
      return new Token('EOF', '', this.line, this.column);
    }

    const startLine = this.line;
    const startCol = this.column;
    const ch = this.peek();

    // Numbers
    if (/\d/.test(ch)) {
      return this.readNumber();
    }

    // Strings
    if (ch === '"' || ch === "'") {
      return this.readString(ch);
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      return this.readIdentifier();
    }

    // Two-character operators
    const twoChar = ch + (this.peek(1) || '');
    if (twoChar === '->') {
      this.advance();
      this.advance();
      return new Token('ARROW', '->', startLine, startCol);
    }

    if (twoChar === '==') {
      this.advance();
      this.advance();
      return new Token('EQ', '==', startLine, startCol);
    }

    if (twoChar === '!=') {
      this.advance();
      this.advance();
      return new Token('NE', '!=', startLine, startCol);
    }

    if (twoChar === '<=') {
      this.advance();
      this.advance();
      return new Token('LE', '<=', startLine, startCol);
    }

    if (twoChar === '>=') {
      this.advance();
      this.advance();
      return new Token('GE', '>=', startLine, startCol);
    }

    if (twoChar === '&&') {
      this.advance();
      this.advance();
      return new Token('AND', '&&', startLine, startCol);
    }

    if (twoChar === '||') {
      this.advance();
      this.advance();
      return new Token('OR', '||', startLine, startCol);
    }

    // Single-character tokens
    const singleCharTokens = {
      '{': 'LBRACE',
      '}': 'RBRACE',
      '(': 'LPAREN',
      ')': 'RPAREN',
      '[': 'LBRACKET',
      ']': 'RBRACKET',
      ',': 'COMMA',
      ':': 'COLON',
      '.': 'DOT',
      '=': 'ASSIGN',
      '+': 'PLUS',
      '-': 'MINUS',
      '*': 'STAR',
      '/': 'SLASH',
      '%': 'PERCENT',
      '<': 'LT',
      '>': 'GT',
      '!': 'NOT',
      '@': 'AT',
      '*': 'ASTERISK',
    };

    if (singleCharTokens.hasOwnProperty(ch)) {
      this.advance();
      return new Token(singleCharTokens[ch], ch, startLine, startCol);
    }

    // Unknown character
    throw new ParseError(
      `Unexpected character: '${ch}'`,
      new SourceLocation(startLine, startCol, this.filename)
    );
  }

  /**
   * Tokenize entire source
   */
  tokenize() {
    const tokens = [];

    while (true) {
      const token = this.nextToken();
      tokens.push(token);

      if (token.type === 'EOF') {
        break;
      }
    }

    return tokens;
  }

  /**
   * Get all tokens at once (convenience method)
   */
  getAllTokens() {
    if (this.tokens.length === 0) {
      this.tokens = this.tokenize();
    }
    return this.tokens;
  }

  /**
   * Peek at token stream (requires pre-tokenization)
   */
  peekToken(offset = 0) {
    if (this.tokens.length === 0) {
      this.getAllTokens();
    }
    // This would be used in a token-stream parser
    return this.tokens[offset] || new Token('EOF', '', 0, 0);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Lexer, Token };
}

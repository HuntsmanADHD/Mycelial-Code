import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;
const SIMULATOR_DIR = join(__dirname, '05-TOOLS', 'simulator');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.mycelial': 'text/plain',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname;

  // Redirect root to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = join(SIMULATOR_DIR, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(SIMULATOR_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const fileStats = await stat(filePath).catch(() => null);
  if (!fileStats || !fileStats.isFile()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const content = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
});

server.listen(PORT, () => {
  console.log(`
  Mycelial Simulator running at:

    http://localhost:${PORT}

  Press Ctrl+C to stop
  `);
});

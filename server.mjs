import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import search from './api/search.js';
import read from './api/read.js';
import health from './api/health.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 18736);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function responseAdapter(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  req.query = Object.fromEntries(url.searchParams);
  if (url.pathname === '/api/search') return search(req, responseAdapter(res));
  if (url.pathname === '/api/read') return read(req, responseAdapter(res));
  if (url.pathname === '/api/health') return health(req, responseAdapter(res));

  const route = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullPath = path.join(root, 'public', route);
  if (!fullPath.startsWith(path.join(root, 'public')) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(fullPath)] || 'application/octet-stream' });
  fs.createReadStream(fullPath).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));

// Servidor local do gerador de ícones 3D (página `scripts/icons/index.html`).
// Uso: `node scripts/icons/server.mjs` e abrir http://localhost:8099 (config "icon-gen" no `.claude/launch.json`).
// GET /body.json  = caminhos do boneco do `react-native-body-highlighter` (MIT) para montar os músculos em 3D.
// POST /save      = grava o PNG gerado em `assets/icons/<equipment|muscles>/<nome>.png`.
import fs from 'fs';
import http from 'http';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(import.meta.url);
const port = Number(process.env.PORT) || 8099;
const lib = path.join(root, 'node_modules/react-native-body-highlighter/dist');

function body() {
  const outline = [...fs.readFileSync(path.join(lib, 'components/SvgMaleWrapper.js'), 'utf8').matchAll(/d="(M [^"]+)"/g)].map((m) => m[1]);
  return {
    front: require(path.join(lib, 'assets/bodyFront.js')).bodyFront,
    back: require(path.join(lib, 'assets/bodyBack.js')).bodyBack,
    outline: { front: outline[0], back: outline[1] },
  };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (req.method === 'GET' && url.pathname === '/body.json') {
    res.writeHead(200, { 'content-type': TYPES['.json'] });
    return res.end(JSON.stringify(body()));
  }
  if (req.method === 'POST' && url.pathname === '/save') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try {
        const { dir, name, png } = JSON.parse(raw);
        if (!['equipment', 'muscles'].includes(dir) || !/^[a-z0-9-]+$/.test(name) || !png.startsWith('data:image/png;base64,')) throw new Error('bad request');
        const out = path.join(root, 'assets/icons', dir);
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
        res.writeHead(200);
        res.end('ok');
      } catch (e) {
        res.writeHead(400);
        res.end(String(e));
      }
    });
    return;
  }
  const file = path.join(here, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(here) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}).listen(port, () => console.log(`icon generator on http://localhost:${port}`));

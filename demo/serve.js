/**
 * demo/serve.js
 * Простой HTTP-сервер для запуска демо-страницы
 *
 * Использование:
 *   node demo/serve.js
 *   → откройте http://localhost:3020
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3020;
const DEMO_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md':   'text/markdown; charset=utf-8',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon'
};

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(DEMO_DIR, urlPath);

    // Защита от выхода за пределы demo/
    if (!filePath.startsWith(DEMO_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
});

server.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   kosmos-task Demo Server              ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`   🌐  http://localhost:${PORT}`);
    console.log(`   📁  ${DEMO_DIR}`);
    console.log('');
    console.log('   Ctrl+C для остановки');
    console.log('');
});

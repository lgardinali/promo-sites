const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const root = __dirname;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(path.resolve(root))) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { console.log('404', p); res.writeHead(404, {'Content-Type':'text/plain'}).end('404 ' + p); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(data);
  });
}).listen(4173, () => console.log('serving on http://localhost:4173'));

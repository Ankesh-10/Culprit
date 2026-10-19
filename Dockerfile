FROM node:22.20.0-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.20.0-alpine AS runtime

WORKDIR /app
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "-e", "const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path'); const root = path.resolve('dist'); const server = http.createServer((request, response) => { const requestPath = decodeURIComponent((request.url || '/').split('?')[0]); const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\\/+/, ''); const filePath = path.resolve(root, relativePath); if (!filePath.startsWith(root + path.sep)) { response.writeHead(400); response.end('Bad request'); return; } fs.readFile(filePath, (error, data) => { if (error) { fs.readFile(path.join(root, 'index.html'), (fallbackError, fallback) => { if (fallbackError) { response.writeHead(500); response.end('Server error'); return; } response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(fallback); }); return; } const contentType = filePath.endsWith('.js') ? 'text/javascript; charset=utf-8' : filePath.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream'; response.writeHead(200, { 'Content-Type': contentType }); response.end(data); }); }); server.listen(4173, '0.0.0.0');"]

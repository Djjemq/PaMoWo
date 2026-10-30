import http from 'node:http';
import fs from 'node:fs';
import { createApi } from './api.js';

export function makeServer(db) {
  const A = createApi(db);
  const send = (res, c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => s += d); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  return http.createServer(async (req, res) => {
    try {
      const p = new URL(req.url, 'http://x').pathname, m = req.method; let mt;
      if (m === 'GET' && (p === '/' || p === '/index.html')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(new URL('../public/index.html', import.meta.url))); }
      const b = m === 'POST' || m === 'PATCH' ? await body(req) : {};
      if (m === 'POST' && p === '/api/games') return send(res, 200, await A.newGame(b));
      if (m === 'POST' && p === '/api/rounds') return send(res, 200, await A.newRound(b));
      if (m === 'POST' && (mt = p.match(/^\/api\/rounds\/(\d+)\/answers$/))) return send(res, 200, await A.answer(+mt[1], b));
      if (m === 'POST' && p === '/api/claims') return send(res, 200, await A.newClaim(b));
      if (m === 'GET' && p === '/api/claims') return send(res, 200, await A.listClaims());
      if (m === 'PATCH' && (mt = p.match(/^\/api\/claims\/(\d+)$/))) return send(res, 200, await A.reviewClaim(+mt[1], b));
      send(res, 404, { error: 'no encontrado' });
    } catch (e) { send(res, 400, { error: e.message }); }
  });
}

// Genera docs/ (sitio estático para GitHub Pages): el mismo juego, con PostgreSQL (PGlite) dentro del navegador.
import fs from 'node:fs';
const R = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
fs.mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
for (const [from, to] of [['src/api.js', 'api.js'], ['src/scoring.js', 'scoring.js'], ['db/schema.sql', 'schema.sql'], ['db/seed.sql', 'seed.sql']])
  fs.writeFileSync(new URL('../docs/' + to, import.meta.url), R(from));
let h = R('public/index.html');
const swap = (a, b) => { if (!h.includes(a)) throw new Error('No encontrado: ' + a.slice(0, 40)); h = h.replace(a, b); };
const i = h.indexOf('async function api('), j = h.indexOf('\n', i);
h = h.slice(0, i) + `async function api(path,body){let m;
 if(path==='games')return A.newGame(body);if(path==='rounds')return A.newRound(body);
 if(path==='claims')return A.newClaim(body);
 if(m=path.match(/^rounds\\/(\\d+)\\/answers$/))return A.answer(+m[1],body);
 throw new Error('Ruta no disponible: '+path)}` + h.slice(j);
swap('<main id="app"></main>', '<main id="app"><p>Cargando la base de datos (la primera vez descarga unos MB)…</p></main>');
swap('<script>\n', `<script type="module">
import { PGlite } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.13/dist/index.js';
import { createApi } from './api.js';
const db = new PGlite('idb://juego-idiomas'); // se guarda en este navegador (IndexedDB)
if (!(await db.query("select to_regclass('public.verbos') as t")).rows[0].t) {
  await db.exec(await (await fetch('./schema.sql')).text());
  await db.exec(await (await fetch('./seed.sql')).text());
}
const A = createApi(db);
`);
fs.writeFileSync(new URL('../docs/index.html', import.meta.url), h);
fs.writeFileSync(new URL('../docs/.nojekyll', import.meta.url), '');
console.log('docs/ generado');

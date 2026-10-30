import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { makeServer } from '../src/server.js';
import { evaluate } from '../src/scoring.js';

let db, srv, base;
before(async () => { db = await openDb(); srv = makeServer(db); await new Promise(r => srv.listen(0, r)); base = 'http://localhost:' + srv.address().port; });
after(() => srv.close());
const api = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b && JSON.stringify(b) }); return { s: r.status, j: await r.json() }; };
const one = async (sql, p) => (await db.query(sql, p)).rows[0];
async function partida(o = {}) {
  const g = await api('POST', '/api/games', { lang: 'fr', ui: 'es', level: 2, tenses: [0, 1, 2, 3], players: ['Ana', 'Luis'], ...o });
  const r = await api('POST', '/api/rounds', { game: g.j.id });
  return { g: g.j, r: r.j };
}

test('el catálogo se cargó completo', async () => {
  assert.equal((await one('select count(*)::int n from verbos')).n, 30);
  assert.equal((await one('select count(*)::int n from tiempos')).n, 12);
  assert.equal((await one('select count(*)::int n from verbos v where (select count(distinct (tiempo_id,persona_id)) from conjugaciones c where c.verbo_id=v.id) < (select count(*)*3 from tiempos t where t.idioma=v.idioma)')).n, 0);
});
test('cada jugador recibe 3 retos con verbos distintos', async () => {
  const { r } = await partida();
  assert.equal(r.challenges.length, 2);
  for (const pl of r.challenges) { assert.equal(pl.length, 3); assert.equal(new Set(pl.map(x => x.inf)).size, 3); assert.ok(pl.every(x => x.form)); }
});
test('nivel 1 solo usa verbos regulares', async () => {
  for (let i = 0; i < 5; i++) {
    const { r } = await partida({ level: 1, lang: 'en' });
    const ids = r.challenges.flat().map(x => x.reto_id);
    const n = (await one('select count(*)::int n from retos r join verbos v on v.id=r.verbo_id where r.id=any($1::int[]) and v.irregular', [ids])).n;
    assert.equal(n, 0);
  }
});
test('flujo completo: el total lo calcula la base de datos y coincide con la suma', async () => {
  const { r } = await partida();
  const answers = r.challenges.map(pl => pl.map(c => c.form.split('|')[0] + ' dans la maison avec mes amis.'));
  const res = await api('POST', `/api/rounds/${r.id}/answers`, { answers });
  assert.equal(res.s, 200);
  res.j.evaluations.forEach((es, p) => assert.equal(es.reduce((a, e) => a + e.pts, 0), res.j.totals[p]));
  assert.ok(res.j.evaluations.flat().every(e => e.pts === e.c.reduce((a, b) => a + b, 0)));
  assert.ok(res.j.totals.every(t => t >= 0 && t <= 12));
});
test('no se puede responder dos veces la misma ronda ni enviar respuestas vacías', async () => {
  const { r } = await partida();
  const ok = r.challenges.map(pl => pl.map(c => c.form.split('|')[0] + ' ici et là.'));
  assert.equal((await api('POST', `/api/rounds/${r.id}/answers`, { answers: [['', 'a', 'b'], ['a', 'b', 'c']] })).s, 400);
  assert.equal((await api('POST', `/api/rounds/${r.id}/answers`, { answers: ok })).s, 200);
  assert.equal((await api('POST', `/api/rounds/${r.id}/answers`, { answers: ok })).s, 400);
});
test('la base rechaza puntuaciones fuera de 0/1 y no deja editar la respuesta original', async () => {
  const a = await one('select id from respuestas limit 1');
  await assert.rejects(db.query("insert into evaluaciones(respuesta_id,evaluador,conjugacion,gramatica,coherencia,vocabulario) values($1,'x',2,0,0,0)", [a.id]));
  await assert.rejects(db.query("update respuestas set texto='otra cosa' where id=$1", [a.id]));
});
test('reclamación: conserva la original; si se acepta, cambia los puntos de la ronda', async () => {
  const { r } = await partida();
  const answers = r.challenges.map(pl => pl.map(() => 'zzz'));
  const res = await api('POST', `/api/rounds/${r.id}/answers`, { answers });
  const ev = res.j.evaluations[0][0], antes = res.j.totals[0];
  const cl = await api('POST', '/api/claims', { evaluation: ev.evaluation_id, motivo: 'Mi frase es correcta' });
  assert.equal(cl.j.estado, 'pendiente');
  assert.equal((await api('POST', '/api/claims', { evaluation: ev.evaluation_id, motivo: 'otra vez' })).s, 400);
  await api('PATCH', `/api/claims/${cl.j.id}`, { estado: 'aceptada', puntos: 4, notas: 'revisada a mano' });
  const t = await one('select puntos from v_puntos where ronda_id=$1 order by jugador_id limit 1', [r.id]);
  assert.equal(t.puntos, antes - ev.pts + 4);
  assert.equal((await one('select texto from respuestas where id=(select respuesta_id from evaluaciones where id=$1)', [ev.evaluation_id])).texto, 'zzz');
});
test('reglas: «J’ai mangé…» cuenta como «ai mangé»; las mayúsculas y el punto no restan', () => {
  const e = evaluate({ forms: ['ai mangé'], text: 'j’ai mangé une salade de patates', level: 1 });
  assert.deepEqual(e.c, [1, 1, 1, 1]);
  assert.ok(e.flags.noCap && e.flags.noPun);
  assert.equal(evaluate({ forms: ['ate'], text: 'We eat eggs.', level: 1 }).c[0], 0);
});

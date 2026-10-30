import { evaluate } from './scoring.js';

// Reto con todas las formas válidas (la principal primero)
const RETOS = `select r.id reto_id, j.orden jo, r.posicion pos, v.infinitivo inf, t.nombre tense, p.pronombre pron,
 (select string_agg(c.forma,'|' order by c.principal desc, c.forma) from conjugaciones c where c.verbo_id=r.verbo_id and c.tiempo_id=r.tiempo_id and c.persona_id=r.persona_id) form
 from retos r join jugadores j on j.id=r.jugador_id join verbos v on v.id=r.verbo_id join tiempos t on t.id=r.tiempo_id join personas p on p.id=r.persona_id
 where r.ronda_id=$1 order by j.orden, r.posicion`;
// 3 verbos al azar (solo regulares en nivel 1) + tiempo y persona al azar por reto.
// "+v.id*0" hace que el subselect dependa de la fila y se sortee de nuevo en cada reto.
const GEN = `insert into retos(ronda_id,jugador_id,posicion,verbo_id,tiempo_id,persona_id)
 select $1::int,$2::int,(row_number() over())::int,v.id,
  (select t.id from tiempos t where t.idioma=$3 and t.orden=any($4::int[]) order by random()+v.id*0 limit 1),
  (select p.id from personas p where p.idioma=$3 order by random()+v.id*0 limit 1)
 from (select id from verbos where idioma=$3 and ($5::int>1 or not irregular) order by random() limit 3) v`;

// Lógica del juego sobre SQL. Sin dependencias de Node: la usan el servidor y la versión del navegador.
export function createApi(db) {
  const q = async (s, p) => (await db.query(s, p)).rows;
  const retos = async rid => { const out = []; for (const r of await q(RETOS, [rid])) (out[r.jo] ??= []).push(r); return out; };

  async function newGame(b) {
    const names = (b.players || []).slice(0, 4);
    if (!names.length) throw new Error('Faltan jugadores');
    const [g] = await q('insert into partidas(idioma_practica,idioma_ui,nivel,tiempos_elegidos) values($1,$2,$3,$4) returning id,codigo', [b.lang, b.ui, b.level, b.tenses]);
    for (const [i, n] of names.entries()) await q('insert into jugadores(partida_id,orden,nombre) values($1,$2,$3)', [g.id, i, String(n).slice(0, 20)]);
    return g;
  }
  async function newRound(b) {
    const [g] = await q('select * from partidas where id=$1', [b.game]);
    if (!g) throw new Error('Partida inexistente');
    const [r] = await q('insert into rondas(partida_id,numero) select $1::int, coalesce(max(numero),0)+1 from rondas where partida_id=$1::int returning id', [g.id]);
    for (const j of await q('select id from jugadores where partida_id=$1 order by orden', [g.id]))
      await q(GEN, [r.id, j.id, g.idioma_practica, g.tiempos_elegidos, g.nivel]);
    return { id: r.id, challenges: await retos(r.id) };
  }
  async function answer(rid, b) {
    const rs = await retos(rid), A = b.answers;
    const [{ nivel, partida_id }] = await q('select p.nivel, p.id partida_id from rondas ro join partidas p on p.id=ro.partida_id where ro.id=$1', [rid]);
    if (!Array.isArray(A) || A.length !== rs.length) throw new Error('Respuestas incompletas');
    const evaluations = [];
    await db.transaction(async tx => {
      for (const [pi, pl] of rs.entries()) {
        evaluations[pi] = [];
        for (const [i, r] of pl.entries()) {
          const text = String(A[pi]?.[i] ?? '').trim().slice(0, 200);
          if (!text) throw new Error('Respuesta vacía');
          const a = (await tx.query('insert into respuestas(reto_id,texto) values($1,$2) returning id', [r.reto_id, text])).rows[0];
          const e = evaluate({ forms: r.form.split('|'), text, level: nivel });
          const ev = (await tx.query("insert into evaluaciones(respuesta_id,evaluador,conjugacion,gramatica,coherencia,vocabulario,detalle) values($1,'reglas-v1',$2,$3,$4,$5,$6) returning id,total", [a.id, ...e.c, JSON.stringify(e.flags)])).rows[0];
          evaluations[pi][i] = { c: e.c, flags: e.flags, pts: ev.total, evaluation_id: ev.id };
        }
      }
    });
    const totals = (await q('select v.puntos from v_puntos v join jugadores j on j.id=v.jugador_id where v.ronda_id=$1 order by j.orden', [rid])).map(x => x.puntos);
    const cumulative = (await q('select coalesce(sum(v.puntos),0)::int t from jugadores j left join v_puntos v on v.jugador_id=j.id where j.partida_id=$1 group by j.id order by j.orden', [partida_id])).map(x => x.t);
    return { evaluations, totals, cumulative };
  }

  const newClaim = async b => (await q('insert into reclamaciones(evaluacion_id,motivo) values($1,$2) returning id,estado', [b.evaluation, b.motivo]))[0];
  const listClaims = () => q('select rc.id,rc.estado,rc.motivo,a.texto,e.total,e.detalle from reclamaciones rc join evaluaciones e on e.id=rc.evaluacion_id join respuestas a on a.id=e.respuesta_id order by rc.id');
  const reviewClaim = async (id, b) => (await q('update reclamaciones set estado=$2,puntos_revisados=$3,notas=$4,revisada=now() where id=$1 returning *', [id, b.estado, b.puntos ?? null, b.notas ?? null]))[0];
  return { newGame, newRound, answer, newClaim, listClaims, reviewClaim };
}

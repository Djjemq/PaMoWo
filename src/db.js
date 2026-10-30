import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const read = f => fs.readFileSync(new URL('../db/' + f, import.meta.url), 'utf8');
// dir indefinido = memoria (pruebas); con ruta = persistente en disco
export async function openDb(dir) {
  const db = new PGlite(dir);
  const { rows } = await db.query("select to_regclass('public.verbos') as t");
  if (!rows[0].t) { await db.exec(read('schema.sql')); await db.exec(read('seed.sql')); }
  return db;
}

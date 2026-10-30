# Juego de idiomas · versión de pruebas con base de datos (v0.3)

PostgreSQL real (PGlite, sin instalar nada) + servidor Node + el juego.

## Cómo ejecutarlo
1. Instala Node.js (versión 20 o superior).
2. En esta carpeta: `npm install`
3. `npm test` → 8 pruebas (catálogo, retos, puntuación, reclamaciones, restricciones SQL).
4. `npm start` → abre http://localhost:3000. Los datos quedan en `data/pg`; para empezar de cero, borra esa carpeta.

## Qué hay
- `db/schema.sql`: tablas, restricciones, trigger que protege la respuesta original, total calculado por la base de datos, vista `v_puntos`.
- `db/seed.sql`: 30 verbos, 12 tiempos, 363 formas (generado desde el catálogo del juego).
- `db/consultas.sql`: reclamaciones pendientes, falsos negativos, cobertura del catálogo, ranking.
- `src/scoring.js`: reglas de prueba (sin IA). Aquí se conectará la IA más adelante como otro `evaluador`.
- API: `POST /api/games`, `POST /api/rounds`, `POST /api/rounds/:id/answers`, `POST|GET /api/claims`, `PATCH /api/claims/:id` (revisión manual: `{"estado":"aceptada","puntos":4,"notas":"..."}`).

## Pasar a Supabase
Ejecuta `schema.sql` y luego `seed.sql` en el SQL Editor, activa Row Level Security en cada tabla y reemplaza PGlite por el cliente de Supabase en `src/db.js`.

## Probarlo directamente en GitHub
1. Crea un repositorio en github.com y sube el contenido de esta carpeta (incluidas las carpetas ocultas `.github` y `.devcontainer`). Con Git:
   `git init && git add . && git commit -m "Versión 0.3" && git branch -M main && git remote add origin https://github.com/TU_USUARIO/juego-idiomas.git && git push -u origin main`
2. **Pruebas automáticas:** pestaña *Actions* → se ejecutan `npm test` en cada subida.
3. **Enlace jugable (GitHub Pages):** *Settings → Pages →* Source: *Deploy from a branch*, rama `main`, carpeta `/docs`. La base de datos (PGlite) corre dentro del navegador y guarda los datos solo en ese navegador. Si cambias algo en `src/`, `db/` o `public/`, ejecuta `npm run build:pages` y sube `docs/`.
4. **Servidor completo (Codespaces):** botón verde *Code → Codespaces → Create codespace*. Instala y arranca solo; abre el puerto 3000.

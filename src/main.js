import { openDb } from './db.js';
import { makeServer } from './server.js';
const port = process.env.PORT || 3000;
const db = await openDb(process.env.DB_DIR || './data/pg');
makeServer(db).listen(port, () => console.log('Juego en http://localhost:' + port));

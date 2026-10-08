const { Pool } = require('pg');
const { createApp } = require('./app');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

async function initDb(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT false
      )`);
      return;
    } catch (e) {
      console.log(`Väntar på databasen (${i}/${retries}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Kunde inte nå databasen');
}

initDb()
  .then(() => createApp(pool).listen(3000, () => console.log('API lyssnar på :3000')))
  .catch((e) => { console.error(e); process.exit(1); });

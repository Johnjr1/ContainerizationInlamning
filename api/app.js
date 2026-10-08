const http = require('http');
const os = require('os');

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 10_000) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
  });
}

// Tar emot en pool med .query(sql, params), så att den kan bytas mot en fake i tester.
function createApp(pool, hostname = os.hostname()) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    try {
      if (req.method === 'GET' && path === '/health') {
        try { await pool.query('SELECT 1'); return send(res, 200, 'ok', 'text/plain'); }
        catch { return send(res, 503, 'db down', 'text/plain'); }
      }
      if (req.method === 'GET' && path === '/api/whoami') {
        return send(res, 200, { hostname });
      }
      if (req.method === 'GET' && path === '/api/todos') {
        const r = await pool.query('SELECT id, title, done FROM todos ORDER BY id');
        return send(res, 200, r.rows);
      }
      if (req.method === 'POST' && path === '/api/todos') {
        const body = await readBody(req);
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (!title || title.length > 200) return send(res, 400, { error: 'title krävs (max 200 tecken)' });
        const r = await pool.query('INSERT INTO todos (title) VALUES ($1) RETURNING id, title, done', [title]);
        return send(res, 201, r.rows[0]);
      }
      const m = path.match(/^\/api\/todos\/(\d+)$/);
      if (m && req.method === 'PATCH') {
        const r = await pool.query('UPDATE todos SET done = NOT done WHERE id = $1 RETURNING id, title, done', [m[1]]);
        return r.rows.length ? send(res, 200, r.rows[0]) : send(res, 404, { error: 'finns inte' });
      }
      if (m && req.method === 'DELETE') {
        const r = await pool.query('DELETE FROM todos WHERE id = $1', [m[1]]);
        return r.rowCount ? send(res, 204, '', 'text/plain') : send(res, 404, { error: 'finns inte' });
      }
      send(res, 404, { error: 'not found' });
    } catch (err) {
      console.error(err);
      send(res, 500, { error: 'serverfel' });
    }
  });
}

module.exports = { createApp };

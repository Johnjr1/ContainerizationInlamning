const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../app');

// Minimal fake-databas i minnet
function fakePool() {
  let rows = [], next = 1;
  return {
    async query(sql, p = []) {
      if (sql.startsWith('SELECT 1')) return { rows: [{ '?column?': 1 }] };
      if (sql.startsWith('SELECT id')) return { rows: [...rows] };
      if (sql.startsWith('INSERT')) { const r = { id: next++, title: p[0], done: false }; rows.push(r); return { rows: [r] }; }
      if (sql.startsWith('UPDATE')) { const r = rows.find((x) => x.id == p[0]); if (r) r.done = !r.done; return { rows: r ? [r] : [] }; }
      if (sql.startsWith('DELETE')) { const n = rows.length; rows = rows.filter((x) => x.id != p[0]); return { rowCount: n - rows.length }; }
      throw new Error('okänd query: ' + sql);
    },
  };
}

async function withServer(pool, fn) {
  const server = createApp(pool, 'testhost').listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('whoami returnerar hostname', async () => {
  await withServer(fakePool(), async (base) => {
    const r = await (await fetch(base + '/api/whoami')).json();
    assert.strictEqual(r.hostname, 'testhost');
  });
});

test('skapa, lista, växla och ta bort todo', async () => {
  await withServer(fakePool(), async (base) => {
    const post = await fetch(base + '/api/todos', { method: 'POST', body: JSON.stringify({ title: 'Lär mig Docker' }) });
    assert.strictEqual(post.status, 201);
    const created = await post.json();
    assert.strictEqual((await (await fetch(base + '/api/todos')).json()).length, 1);
    const patched = await (await fetch(`${base}/api/todos/${created.id}`, { method: 'PATCH' })).json();
    assert.strictEqual(patched.done, true);
    assert.strictEqual((await fetch(`${base}/api/todos/${created.id}`, { method: 'DELETE' })).status, 204);
    assert.strictEqual((await (await fetch(base + '/api/todos')).json()).length, 0);
  });
});

test('tom titel ger 400', async () => {
  await withServer(fakePool(), async (base) => {
    const r = await fetch(base + '/api/todos', { method: 'POST', body: JSON.stringify({ title: '  ' }) });
    assert.strictEqual(r.status, 400);
  });
});

test('/health ger 503 när databasen är nere', async () => {
  const broken = { query: async () => { throw new Error('down'); } };
  await withServer(broken, async (base) => {
    assert.strictEqual((await fetch(base + '/health')).status, 503);
  });
});

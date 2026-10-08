import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { extractJson } from '../src/claude.js';

let app, base, tmp;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-'));
  fs.mkdirSync(path.join(tmp, 'web'));
  fs.writeFileSync(path.join(tmp, 'web', 'index.html'), '<p>ok</p>');
  process.env.CLAUDE_BIN = path.join(tmp, 'absent-claude');
  app = createApp({ dataDir: tmp, webDir: path.join(tmp, 'web'), autoSnapshot: false, syncEngine: false });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => { app.server.close(); app.store.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const j = (p, opts = {}) => fetch(base + p, { ...opts, headers: { 'content-type': 'application/json' } })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

test('health', async () => {
  const r = await j('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('document : création, lecture, conflit', async () => {
  assert.equal((await j('/api/docs/pilot')).status, 404);
  const a = await j('/api/docs/pilot', { method: 'PUT', body: JSON.stringify({ data: { n: 1 }, baseRev: 0 }) });
  assert.equal(a.status, 200); assert.equal(a.body.rev, 1);
  const b = await j('/api/docs/pilot', { method: 'PUT', body: JSON.stringify({ data: { n: 2 }, baseRev: 1 }) });
  assert.equal(b.body.rev, 2);
  // version de départ dépassée : fusion ; la même valeur modifiée des deux côtés → la saisie l'emporte, conflit journalisé
  const c = await j('/api/docs/pilot', { method: 'PUT', body: JSON.stringify({ data: { n: 3 }, baseRev: 1 }) });
  assert.equal(c.status, 200); assert.equal(c.body.conflicts, 1);
  const g = await j('/api/docs/pilot');
  assert.equal(g.body.data.n, 3);
  // version de départ inconnue : refus explicite
  const d = await j('/api/docs/pilot', { method: 'PUT', body: JSON.stringify({ data: { n: 4 }, baseRev: 999 }) });
  assert.equal(d.status, 409);
});

test('identifiant invalide refusé', async () => {
  assert.equal((await j('/api/docs/..%2Fx')).status, 400);
});

test('révisions et restauration', async () => {
  await j('/api/docs/ideas', { method: 'PUT', body: JSON.stringify({ data: { v: 'a' }, reason: 'manual' }) });
  await j('/api/docs/ideas', { method: 'PUT', body: JSON.stringify({ data: { v: 'b' }, reason: 'manual' }) });
  const list = await j('/api/docs/ideas/revisions');
  assert.ok(list.body.length >= 2);
  const first = list.body[list.body.length - 1].rev;
  const r = await j(`/api/docs/ideas/restore/${first}`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal((await j('/api/docs/ideas')).body.data.v, 'a');
});

test('instantané de la base', async () => {
  const r = await j('/api/backup', { method: 'POST' });
  assert.equal(r.status, 200);
  assert.ok(fs.existsSync(path.join(tmp, 'snapshots', r.body.file)));
});

test('Claude Code absent : erreur claire', async () => {
  const s = await j('/api/claude/status');
  assert.equal(s.body.available, false);
  const r = await j('/api/claude', { method: 'POST', body: JSON.stringify({ prompt: 'x' }) });
  assert.equal(r.status, 503);
});

test('fichiers statiques et traversée refusée', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  const t = await fetch(base + '/..%2F..%2Fetc%2Fpasswd');
  assert.notEqual(t.status, 200);
});

test('extraction JSON', () => {
  assert.deepEqual(extractJson('Voici\n```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => extractJson('rien'));
});

test('journal des versions servi', async () => {
  const r = await fetch(base + '/api/changelog');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /## \[/);
});

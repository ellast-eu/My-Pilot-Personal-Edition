import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';

let app, base, tmp;
before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'set-'));
  app = createApp({ dataDir: tmp, webDir: tmp, autoSnapshot: false, syncEngine: false, syncToken: 'jeton-du-fichier-env-123' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => { app.server.close(); app.store.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const call = (p, method = 'GET', body, auth) => fetch(base + p, {
  method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: body && JSON.stringify(body),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const basic = (u, p) => 'Basic ' + Buffer.from(u + ':' + p).toString('base64');

test('premier démarrage signalé tant qu\'aucun mot de passe n\'est défini', async () => {
  const h = await call('/api/health');
  assert.equal(h.body.firstRun, true);
});

test('les secrets ne sont jamais renvoyés, la source est indiquée', async () => {
  const r = await call('/api/settings');
  const tok = r.body.items.find(i => i.key === 'sync_token');
  assert.equal(tok.set, true); assert.equal(tok.value, undefined); assert.equal(tok.source, '.env');
  const keep = r.body.items.find(i => i.key === 'keep_snapshots');
  assert.equal(keep.value, 30); assert.equal(keep.source, 'défaut');
});

test('valeurs refusées hors bornes ou trop courtes', async () => {
  assert.equal((await call('/api/settings', 'PUT', { keep_snapshots: 0 })).status, 400);
  assert.equal((await call('/api/settings', 'PUT', { app_password: 'court' })).status, 400);
  assert.equal((await call('/api/settings', 'PUT', { inconnu: 1 })).status, 400);
});

test('réglages appliqués sans redémarrage : sauvegardes, jeton de synchro, mot de passe', async () => {
  await call('/api/settings', 'PUT', { revision_interval: 60, keep_snapshots: 5 });
  assert.equal(app.store.revisionInterval, 60);
  assert.equal((await call('/api/backup/info')).body.keep, 5);
  // nouveau jeton : l'ancien (celui du .env) ne passe plus
  await call('/api/settings', 'PUT', { sync_token: 'nouveau-jeton-tres-long' });
  const essai = t => fetch(base + '/api/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: '{"device":"x"}' }).then(r => r.status);
  assert.equal(await essai('jeton-du-fichier-env-123'), 401);
  assert.equal(await essai('nouveau-jeton-tres-long'), 200);
  // mot de passe : l'interface exige désormais l'authentification
  await call('/api/settings', 'PUT', { app_password: 'motdepasse-solide' });
  assert.equal((await call('/api/health')).status, 401);
  assert.equal((await call('/api/health', 'GET', null, basic('pilot', 'motdepasse-solide'))).body.firstRun, false);
  // retour aux valeurs du .env (null)
  const r = await call('/api/settings', 'PUT', { sync_token: null, revision_interval: null }, basic('pilot', 'motdepasse-solide'));
  assert.equal(r.body.items.find(i => i.key === 'sync_token').source, '.env');
  assert.equal(app.store.revisionInterval, 300);
});

test('application de bureau : seuls les réglages qui la concernent', async () => {
  const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'set2-'));
  const a2 = createApp({ dataDir: t2, webDir: t2, autoSnapshot: false, syncEngine: false, mode: 'application' });
  await new Promise(r => a2.server.listen(0, '127.0.0.1', r));
  const r = await (await fetch(`http://127.0.0.1:${a2.server.address().port}/api/settings`)).json();
  assert.deepEqual(r.items.map(i => i.key).sort(), ['claude_token', 'keep_revisions', 'keep_snapshots', 'revision_interval', 'snapshot_hours']);
  const h = await (await fetch(`http://127.0.0.1:${a2.server.address().port}/api/health`)).json();
  assert.equal(h.firstRun, false);
  a2.server.close(); a2.store.close(); fs.rmSync(t2, { recursive: true, force: true });
});

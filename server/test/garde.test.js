import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { Garde, adresseClient } from '../src/garde.js';

test('essais en série : ralentis puis bloqués, et la réussite remet à zéro', () => {
  let t = 0;
  const g = new Garde({ log: () => {}, now: () => t });
  for (let i = 0; i < 5; i++) g.echec('1.2.3.4', 'x');
  assert.equal(g.attente('1.2.3.4'), 0);
  g.echec('1.2.3.4', 'x');
  assert.equal(g.attente('1.2.3.4'), 1000);
  assert.equal(g.attente('5.6.7.8'), 0);
  for (let i = 0; i < 14; i++) g.echec('1.2.3.4', 'x');
  t += 70000;
  assert.ok(g.attente('1.2.3.4') > 10 * 60 * 1000);       // bloquée 15 min
  g.reussite('1.2.3.4');
  assert.equal(g.attente('1.2.3.4'), 0);
  g.stop();
});

test('adresse réelle derrière Caddy seulement si le proxy est de confiance', () => {
  const req = { headers: { 'x-forwarded-for': '6.6.6.6, 9.9.9.9' }, socket: { remoteAddress: '172.18.0.2' } };
  assert.equal(adresseClient(req, true), '9.9.9.9');
  assert.equal(adresseClient(req, false), '172.18.0.2');
});

test('serveur : jeton faux répété → 429, état public minimal', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-'));
  const app = createApp({ dataDir: dir, webDir: dir, autoSnapshot: false, password: 'motdepasse-solide', syncToken: 'jeton-assez-long-1234' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const essai = () => fetch(base + '/api/sync', { method: 'POST', headers: { authorization: 'Bearer faux' }, body: '{}' }).then(r => r.status);
  const statuts = [];
  for (let i = 0; i < 7; i++) statuts.push(await essai());
  assert.deepEqual(statuts.slice(0, 6), [401, 401, 401, 401, 401, 401]);
  assert.equal(statuts[6], 429);
  assert.deepEqual(await fetch(base + '/api/health').then(r => r.json()), { ok: true });
  // un navigateur qui n'a encore rien envoyé n'est pas compté comme un échec
  const g = app.garde; g.reussite('127.0.0.1');
  for (let i = 0; i < 10; i++) assert.equal((await fetch(base + '/pilot/', { redirect: 'manual' })).status, 302);
  assert.equal(g.attente('127.0.0.1'), 0);
  app.server.close(); app.store.close(); fs.rmSync(dir, { recursive: true, force: true });
});

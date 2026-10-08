import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';

// Un hub (serveur Docker) et deux appareils (applications de bureau), chacun avec sa base.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-'));
const nodes = {};
const listen = app => new Promise(r => app.server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${app.server.address().port}`)));

before(async () => {
  for (const n of ['hub', 'a', 'b']) {
    fs.mkdirSync(path.join(tmp, n));
    const app = createApp({ dataDir: path.join(tmp, n), webDir: tmp, autoSnapshot: false,
      syncToken: n === 'hub' ? 'secret-hub' : undefined, mode: n === 'hub' ? 'serveur' : 'application' });
    nodes[n] = { app, url: await listen(app) };
  }
});
after(() => { for (const n of Object.values(nodes)) { n.app.server.close(); n.app.store.close(); } fs.rmSync(tmp, { recursive: true, force: true }); });

const call = (n, p, method = 'GET', body) => fetch(nodes[n].url + p, {
  method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const get = n => call(n, '/api/docs/pilot').then(r => (r.status === 200 ? r.body : null));
const put = async (n, mutate) => {
  const d = await get(n);
  const data = d ? d.data : { parametres: {}, chantiers: [], notes: [] };
  mutate(data);
  return call(n, '/api/docs/pilot', 'PUT', { data, baseRev: d ? d.rev : 0 });
};
const syncNow = n => call(n, '/api/sync/now', 'POST').then(r => r.body);
const libelles = async n => Object.fromEntries((await get(n)).data.chantiers.map(c => [c.id, c.libelle]));

test('jeton du hub obligatoire', async () => {
  const r = await fetch(nodes.hub.url + '/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"device":"x"}' });
  assert.equal(r.status, 401);
  for (const n of ['a', 'b']) {
    const s = await call(n, '/api/sync/config', 'PUT', { url: nodes.hub.url, token: 'mauvais', enabled: false }); // synchro manuelle : pas de course avec l'automatique
    assert.equal(s.status, 200);
  }
  const st = await syncNow('a');
  assert.match(st.lastError, /Jeton refusé/);
  for (const n of ['a', 'b']) await call(n, '/api/sync/config', 'PUT', { token: 'secret-hub' });
});

test('deux appareils hors ligne créent chacun une fiche : tout le monde a les deux', async () => {
  await put('a', d => d.chantiers.push({ id: 'a1', libelle: 'Potager' }));
  await put('b', d => d.chantiers.push({ id: 'b1', libelle: 'Banc' }));
  assert.equal((await syncNow('a')).lastError, null);
  await syncNow('b');
  await syncNow('a');
  assert.deepEqual(await libelles('a'), { a1: 'Potager', b1: 'Banc' });
  assert.deepEqual(await libelles('b'), { a1: 'Potager', b1: 'Banc' });
  // le hub lui-même les voit aussi (interface web du serveur)
  const hub = nodes.hub.app.store.getDoc('pilot').data.chantiers.map(c => c.id).sort();
  assert.deepEqual(hub, ['a1', 'b1']);
});

test('modifications de fiches différentes : fusion sans conflit, suppression propagée', async () => {
  await put('a', d => { d.chantiers.find(c => c.id === 'a1').libelle = 'Potager en carrés'; });
  await put('b', d => { d.chantiers = d.chantiers.filter(c => c.id !== 'b1'); });
  await syncNow('a'); await syncNow('b'); await syncNow('a');
  assert.deepEqual(await libelles('a'), { a1: 'Potager en carrés' });
  assert.deepEqual(await libelles('b'), { a1: 'Potager en carrés' });
  assert.equal((await call('a', '/api/sync/status')).body.conflicts, 0);
});

test('même fiche modifiée sur les deux appareils : la plus récente gagne, l\'autre est journalisée', async () => {
  await put('a', d => { d.chantiers[0].libelle = 'Version A'; });
  await new Promise(r => setTimeout(r, 5));
  await put('b', d => { d.chantiers[0].libelle = 'Version B'; });
  await syncNow('b');            // B arrive le premier au hub
  await syncNow('a');            // A envoie une version plus ancienne, reçoit celle de B
  assert.deepEqual(await libelles('a'), { a1: 'Version B' });
  assert.deepEqual(await libelles('b'), { a1: 'Version B' });
  const c = (await call('a', '/api/sync/conflicts')).body;
  assert.equal(c[0].lost.libelle, 'Version A');
  assert.equal(c[0].kept.libelle, 'Version B');
  await call('a', '/api/sync/conflicts/seen', 'POST');
  assert.equal((await call('a', '/api/sync/status')).body.conflicts, 0);
});

test('réglages locaux (meta) jamais synchronisés, rien en attente après échange', async () => {
  await put('a', d => { d.meta = { appareil: 'A' }; });
  await syncNow('a'); await syncNow('b');
  assert.equal((await get('b')).data.meta?.appareil, undefined);
  assert.equal((await call('a', '/api/sync/status')).body.pending, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/db.js';

const pilot = (chantiers, extra = {}) => ({ parametres: { nom_app: 'X' }, chantiers, notes: [], vigilances: [], contacts: [], organisations: [], meta: { m: 1 }, ...extra });

test('découpage et réassemblage fidèles', () => {
  const s = new Store(':memory:');
  const doc = pilot([{ id: 'a', libelle: 'A' }, { id: 'b', libelle: 'B' }]);
  s.putDoc('pilot', doc, 0);
  const g = s.getDoc('pilot');
  assert.deepEqual(g.data.chantiers.map(c => c.id), ['a', 'b']);
  assert.equal(g.data.parametres.nom_app, 'X');
  assert.deepEqual(g.data.meta, { m: 1 });
  assert.equal(s.listDocs()[0].records, 3);   // 2 activités + le réglage « parametres »
});

test('fusion à trois voies : deux onglets modifient deux fiches différentes', () => {
  const s = new Store(':memory:');
  const r1 = s.putDoc('pilot', pilot([{ id: 'a', v: 1 }, { id: 'b', v: 1 }]), 0);
  // onglet 1 modifie a
  const r2 = s.putDoc('pilot', pilot([{ id: 'a', v: 2 }, { id: 'b', v: 1 }]), r1.rev);
  // onglet 2, resté sur r1, modifie b et ajoute c
  const r3 = s.putDoc('pilot', pilot([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 1 }]), r1.rev);
  assert.equal(r3.conflicts, 0);
  assert.ok(r3.data, 'la page reçoit la version fusionnée');
  const by = Object.fromEntries(s.getDoc('pilot').data.chantiers.map(c => [c.id, c.v]));
  assert.deepEqual(by, { a: 2, b: 2, c: 1 });
  assert.ok(r2.rev < r3.rev);
});

test('suppression propagée et identifiant attribué si absent', () => {
  const s = new Store(':memory:');
  const r1 = s.putDoc('pilot', pilot([{ id: 'a' }, { libelle: 'sans id' }]), 0);
  assert.ok(r1.data, 'les identifiants attribués sont renvoyés');
  const sansId = r1.data.chantiers.find(c => c.libelle === 'sans id');
  assert.match(sansId.id, /^r[0-9a-f]{12}$/);
  s.putDoc('pilot', pilot([sansId]), r1.rev);
  assert.deepEqual(s.getDoc('pilot').data.chantiers.map(c => c.id), [sansId.id]);
});

test('horloge hybride croissante et application à distance « la plus récente gagne »', async () => {
  const a = new Store(':memory:', { deviceId: 'aaa' }), b = new Store(':memory:', { deviceId: 'bbb' });
  a.putDoc('pilot', pilot([{ id: 'x', v: 'a' }]), 0);
  await new Promise(r => setTimeout(r, 3));
  b.putDoc('pilot', pilot([{ id: 'x', v: 'b' }]), 0);   // plus récente
  const fromB = b.changesSince(0);
  a.applyRemote(fromB, { pendingAfter: 0 });
  assert.equal(a.getDoc('pilot').data.chantiers[0].v, 'b');
  assert.equal(a.listConflicts().filter(c => c.rid === 'x').length, 1, 'la version locale écrasée est journalisée');
  // réappliquer l'ancienne version de a sur b ne change rien
  b.applyRemote(new Store(':memory:', { deviceId: 'aaa' }).changesSince(0));
  assert.equal(b.getDoc('pilot').data.chantiers[0].v, 'b');
});

test('migration d\'une base v1 (document entier) vers les fiches', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-')), 'pilot.db');
  const db = new DatabaseSync(f);
  db.exec(`CREATE TABLE schema_version(v INTEGER NOT NULL); INSERT INTO schema_version VALUES (1);
    CREATE TABLE documents(id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE revisions(doc TEXT NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL, size INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT 'auto', created_at TEXT NOT NULL, PRIMARY KEY(doc, rev));`);
  db.prepare('INSERT INTO documents VALUES (?,?,?,?)').run('pilot', JSON.stringify(pilot([{ id: 'a', libelle: 'A' }])), 7, new Date().toISOString());
  db.close();
  const s = new Store(f);
  assert.equal(s.schemaVersion, 4);
  const d = s.getDoc('pilot');
  assert.equal(d.rev, 7);
  assert.equal(d.data.chantiers[0].libelle, 'A');
  const r = s.putDoc('pilot', { ...d.data, chantiers: [] }, 7);
  assert.equal(r.rev, 8);
});

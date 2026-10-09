import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { nouvelleIdentite, sceller, ouvrir, nouvelleCle, envelopper, desenvelopper, empreinte } from '../src/chiffre.js';

// Deux installations : celle de Stella (serveur S + appareils s1, s2) et celle de Paul (serveur P + appareil p1).
// L'espace partagé est hébergé par S ; chacun garde sa synchronisation privée vers son propre serveur.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'espaces-'));
const N = {};
const listen = app => new Promise(r => app.server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${app.server.address().port}`)));
const TOK = { S: 'jeton-prive-de-stella-123', P: 'jeton-prive-de-paul-4567' };

before(async () => {
  for (const [n, mode, tok] of [['S', 'serveur', TOK.S], ['P', 'serveur', TOK.P], ['s1', 'application'], ['s2', 'application'], ['p1', 'application']]) {
    fs.mkdirSync(path.join(tmp, n));
    const app = createApp({ dataDir: path.join(tmp, n), webDir: tmp, autoSnapshot: false, mode, syncToken: tok, log: () => {} });
    N[n] = { app, url: await listen(app) };
  }
  const priv = { s1: 'S', s2: 'S', p1: 'P' };
  for (const [d, h] of Object.entries(priv)) await call(d, '/api/sync/config', 'PUT', { url: N[h].url, token: TOK[h], enabled: false });
});
after(() => {
  for (const n of Object.values(N)) { n.app.server.close(); n.app.store.close(); }
  fs.rmSync(tmp, { recursive: true, force: true });
});

const call = (n, p, method = 'GET', body, headers = {}) => fetch(N[n].url + p, {
  method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const partage = n => call(n, '/api/partage').then(r => r.body);
const run = n => call(n, '/api/partage/sync', 'POST').then(r => r.body);
const syncPrive = n => call(n, '/api/sync/now', 'POST').then(r => r.body);
const getDoc = (n, id) => call(n, '/api/docs/' + id).then(r => (r.status === 200 ? r.body : null));
const putIdee = async (n, doc, idee) => {
  const d = await getDoc(n, doc);
  const data = d ? d.data : {};
  data.ideas = (data.ideas || []).filter(i => i.id !== idee.id).concat(idee);
  const r = await call(n, '/api/docs/' + doc, 'PUT', { data, baseRev: d ? d.rev : 0 });
  assert.equal(r.status, 200);
};
const titres = async (n, doc) => ((await getDoc(n, doc))?.data.ideas || []).map(i => i.titre).sort();
let espace, doc;

test('créer un espace : nom affiché et synchronisation privée requis', async () => {
  let r = await call('s1', '/api/partage/espaces', 'POST', { nom: 'Nous' });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /nom affiché/);
  await call('s1', '/api/partage/identite', 'PUT', { nom: 'Stella', couleur: '#aa3355' });
  r = await call('s1', '/api/partage/espaces', 'POST', { nom: 'Nous' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  espace = r.body.id; doc = 's-' + espace;
  assert.equal(r.body.role, 'proprietaire');
  assert.equal(r.body.status, 'actif');
  // l'application de bureau n'héberge pas d'espaces, le serveur ne gère pas d'espaces rejoints
  assert.equal((await call('s1', '/api/spaces', 'POST', {})).status, 404);
  assert.equal((await call('S', '/api/partage')).status, 404);
  // créer sur l'hôte exige le jeton privé
  assert.equal((await call('S', '/api/spaces', 'POST', { pub: nouvelleIdentite().pub }, { authorization: 'Bearer faux' })).status, 401);
});

test('invitation, arrivée de Paul, remise automatique de la clé', async () => {
  const inv = await call('s1', '/api/partage/espaces/' + espace + '/invitations', 'POST', { role: 'membre' });
  assert.equal(inv.status, 200);
  assert.match(inv.body.lien, new RegExp('^' + N.S.url + '/rejoindre/#v1\\.' + espace + '\\.'));
  await call('p1', '/api/partage/identite', 'PUT', { nom: 'Paul' });
  const j = await call('p1', '/api/partage/rejoindre', 'POST', { lien: inv.body.lien });
  assert.equal(j.status, 200, JSON.stringify(j.body));
  assert.equal(j.body.status, 'en_attente');
  assert.equal(j.body.nom, 'Nous');
  // le lien ne sert qu'une fois
  const bis = await call('s2', '/api/partage/identite', 'PUT', { nom: 'Stella (fixe)' }).then(() => call('s2', '/api/partage/rejoindre', 'POST', { lien: inv.body.lien }));
  assert.equal(bis.status, 502);
  assert.match(bis.body.message, /déjà utilisée/);
  await run('s1');                       // Stella voit l'arrivée, vérifie la preuve et remet la clé
  const p = await run('p1');             // Paul récupère la clé
  const e = p.espaces.find(x => x.id === espace);
  assert.equal(e.status, 'actif', e.last_error);
  await run('s1');
  const s = (await partage('s1')).espaces[0];
  assert.deepEqual(s.membres.map(m => m.nom).sort(), ['Paul', 'Stella']);
  assert.ok(s.membres.every(m => /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(m.empreinte)));
});

test('fiche vivante : chacun voit et modifie la même idée', async () => {
  await putIdee('s1', doc, { id: 'i1', titre: 'Potager en carrés' });
  await run('s1'); await run('p1');
  assert.deepEqual(await titres('p1', doc), ['Potager en carrés']);
  await putIdee('p1', doc, { id: 'i1', titre: 'Potager en carrés surélevés' });
  await putIdee('p1', doc, { id: 'i2', titre: 'Récupérateur d\'eau' });
  await run('p1'); await run('s1');
  assert.deepEqual(await titres('s1', doc), ['Potager en carrés surélevés', 'Récupérateur d\'eau']);
});

test('chiffrement de bout en bout : l\'hôte ne stocke aucun contenu lisible', async () => {
  const rows = N.S.app.store.db.prepare('SELECT coll, data FROM records WHERE doc=? AND deleted=0').all(doc);
  assert.ok(rows.length >= 4);
  for (const r of rows) {
    assert.doesNotMatch(r.data, /Potager|Récupérateur|Stella|Paul|Nous/);
    assert.deepEqual(Object.keys(JSON.parse(r.data)).sort(), ['ct', 'e', 'iv']);
  }
});

test('le privé reste privé, et les espaces ne passent pas par la synchro privée', async () => {
  const r = await call('s1', '/api/docs/pilot', 'PUT', { data: { parametres: {}, chantiers: [{ id: 'c1', libelle: 'Secret de Stella' }], notes: [] }, baseRev: 0 });
  assert.equal(r.status, 200);
  await syncPrive('s1'); await syncPrive('p1'); await syncPrive('s2');
  await run('s1'); await run('p1');
  assert.equal(await getDoc('p1', 'pilot'), null);                                   // rien du privé de Stella chez Paul
  assert.equal(N.P.app.store.db.prepare("SELECT count(*) n FROM records WHERE doc LIKE 's-%'").get().n, 0); // ni sur le serveur de Paul
  assert.equal(await getDoc('s2', doc), null);                                        // ni de chiffré via la synchro privée
  assert.equal((await getDoc('s2', 'pilot')).data.chantiers[0].libelle, 'Secret de Stella');
});

test('un hôte qui substitue la clé publique d\'un arrivant est démasqué', async () => {
  const inv = await call('s1', '/api/partage/espaces/' + espace + '/invitations', 'POST', { role: 'proprietaire' });
  const j = await call('s2', '/api/partage/rejoindre', 'POST', { lien: inv.body.lien });
  assert.equal(j.body.status, 'en_attente');
  const db = N.S.app.store.db;
  const vraie = db.prepare("SELECT pub FROM host_members WHERE space=? AND status='en_attente'").get(espace).pub;
  db.prepare("UPDATE host_members SET pub=? WHERE space=? AND status='en_attente'").run(nouvelleIdentite().pub, espace);
  await run('s1');
  assert.match((await partage('s1')).espaces[0].last_error, /ne correspond pas/);
  assert.equal(db.prepare("SELECT status FROM host_members WHERE space=? AND role='proprietaire' ORDER BY joined_at DESC").get(espace).status, 'en_attente');
  db.prepare("UPDATE host_members SET pub=? WHERE space=? AND status='en_attente'").run(vraie, espace);
  await run('s1'); await run('s2');
  const e = (await partage('s2')).espaces[0];
  assert.equal(e.status, 'actif', e.last_error);
  assert.equal(e.role, 'proprietaire');
  assert.deepEqual(await titres('s2', doc), ['Potager en carrés surélevés', 'Récupérateur d\'eau']);
});

test('fiche altérée sur l\'hôte : ignorée et signalée', async () => {
  await putIdee('s1', doc, { id: 'i3', titre: 'Composteur' });
  await run('s1');
  const db = N.S.app.store.db;
  const r = db.prepare("SELECT data FROM records WHERE doc=? AND coll='ideas' AND id='i3'").get(doc);
  const env = JSON.parse(r.data);
  const ct = Buffer.from(env.ct, 'base64'); ct[0] ^= 1; env.ct = ct.toString('base64');
  db.prepare("UPDATE records SET data=? WHERE doc=? AND coll='ideas' AND id='i3'").run(JSON.stringify(env), doc);
  await run('p1');
  const e = (await partage('p1')).espaces[0];
  assert.match(e.last_error, /altérée/);
  assert.ok(!(await titres('p1', doc)).includes('Composteur'));
});

test('retrait d\'un membre : son accès est coupé', async () => {
  const paul = (await partage('s1')).espaces[0].membres.find(m => m.nom === 'Paul');
  const r = await call('s1', '/api/partage/espaces/' + espace + '/membres/' + paul.member + '/retirer', 'POST', {});
  assert.equal(r.status, 200);
  const e = (await run('p1')).espaces[0];
  assert.equal(e.status, 'retire');
  // Paul ne peut pas retirer un propriétaire, et un membre retiré n'a plus accès à rien
  const tokenPaul = N.p1.app.store.db.prepare('SELECT token FROM my_spaces').get().token;
  assert.equal((await call('S', '/api/spaces/' + espace + '/sync', 'POST', { changes: [] }, { authorization: 'Bearer ' + tokenPaul })).status, 401);
  // quitter efface la copie locale
  assert.equal((await call('p1', '/api/partage/espaces/' + espace + '/quitter', 'POST', { forcer: true })).status, 200);
  assert.equal(await getDoc('p1', doc), null);
  assert.equal((await partage('p1')).espaces.length, 0);
});

test('lien d\'invitation illisible', async () => {
  const r = await call('p1', '/api/partage/rejoindre', 'POST', { lien: 'https://exemple.fr/rejoindre/#v1.abc' });
  assert.equal(r.status, 400);
});

test('primitives : fiche liée à son identifiant et à son horloge, clé liée à son destinataire', () => {
  const cle = nouvelleCle(), at = { doc: 's-x', coll: 'ideas', id: 'a', hlc: 'h1' };
  const env = sceller(cle, 1, at, { t: 'secret' });
  assert.deepEqual(ouvrir({ 1: cle }, at, env), { t: 'secret' });
  assert.throws(() => ouvrir({ 1: cle }, { ...at, id: 'b' }, env));
  assert.throws(() => ouvrir({ 1: cle }, { ...at, hlc: 'h0' }, env));
  const a = nouvelleIdentite(), b = nouvelleIdentite(), c = nouvelleIdentite();
  const w = envelopper({ priv: a.priv, pubDest: b.pub, cle, contexte: 'x|1|m' });
  assert.equal(desenvelopper({ priv: b.priv, pubSource: a.pub, env: w, contexte: 'x|1|m' }), cle);
  assert.throws(() => desenvelopper({ priv: c.priv, pubSource: a.pub, env: w, contexte: 'x|1|m' }));
  assert.throws(() => desenvelopper({ priv: b.priv, pubSource: a.pub, env: w, contexte: 'x|1|autre' }));
  assert.notEqual(empreinte(a.pub), empreinte(b.pub));
});

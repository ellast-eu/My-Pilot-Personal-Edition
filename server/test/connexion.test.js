import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { Sessions } from '../src/session.js';
import { motifRefus } from '../src/sync.js';

/** Serveur protégé par mot de passe ; toujours refermé, même si une assertion échoue. */
async function avecServeur(opts, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'connexion-'));
  fs.mkdirSync(path.join(dir, 'web', 'pilot'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'web', 'connexion'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'web', 'pilot', 'index.html'), '<p>pilote</p>');
  fs.writeFileSync(path.join(dir, 'web', 'connexion', 'index.html'), '<p>connexion</p>');
  const app = createApp({ dataDir: dir, webDir: path.join(dir, 'web'), autoSnapshot: false, syncEngine: false, veilles: false,
    password: 'motdepasse-solide', user: 'stella', ...opts });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try { await fn(base, app); }
  finally { app.server.close(); app.store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}
const connecter = (base, u, p, suite) => fetch(base + '/api/connexion', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utilisateur: u, mot_de_passe: p, suite }),
});
const connecte = (base, h) => fetch(base + '/api/health', { headers: h }).then(r => r.json()).then(j => 'version' in j);
const jetonDe = r => (/mppe_session=([^;]*)/.exec(r.headers.get('set-cookie') || '') || [])[1] || '';

test('sessions : signées, expirent, tombent quand le mot de passe change', () => {
  let t = 1_000_000_000_000, mdp = 'un-mot-de-passe';
  const s = new Sessions({ secret: 'x'.repeat(64), user: () => 'stella', pass: () => mdp, maintenant: () => t });
  const j = s.emettre();
  assert.ok(s.valide(j));
  assert.equal(s.valide(j.slice(0, -1) + (j.endsWith('A') ? 'B' : 'A')), false, 'signature altérée');
  assert.equal(s.valide('v1.99999999999.' + j.split('.')[2]), false, 'expiration altérée');
  mdp = 'autre-mot-de-passe';
  assert.equal(s.valide(j), false, 'mot de passe changé');
  mdp = 'un-mot-de-passe'; t += 31 * 86400 * 1000;
  assert.equal(s.valide(j), false, 'expirée');
  assert.match(s.cookie(j, { secure: true }), /HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/);
});

test('navigateur : page de connexion au lieu de la fenêtre « Basic », puis session par cookie', () => avecServeur({}, async (base) => {
  const r0 = await fetch(base + '/pilot/', { redirect: 'manual' });
  assert.equal(r0.status, 302);
  assert.equal(r0.headers.get('location'), '/connexion/?suite=%2Fpilot%2F');
  assert.equal(r0.headers.get('www-authenticate'), null, 'aucune fenêtre Basic');
  const api0 = await fetch(base + '/api/docs/pilot');
  assert.equal(api0.status, 401);
  assert.equal(api0.headers.get('www-authenticate'), null);
  assert.equal((await api0.json()).error, 'login_required');
  assert.equal((await fetch(base + '/connexion/')).status, 200);

  const ko = await connecter(base, 'stella', 'mauvais');
  assert.equal(ko.status, 401); assert.equal(jetonDe(ko), '');

  const ok = await connecter(base, 'stella', 'motdepasse-solide', '/pilot/');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).suite, '/pilot/');
  assert.match(ok.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.doesNotMatch(ok.headers.get('set-cookie'), /Secure/, 'pas de Secure en HTTP direct');
  const cookie = { cookie: 'mppe_session=' + jetonDe(ok) };
  assert.equal((await fetch(base + '/pilot/', { headers: cookie })).status, 200);
  assert.ok(await connecte(base, cookie));
  // déjà connecté : la page de connexion renvoie vers la suite
  const dej = await fetch(base + '/connexion/?suite=/pilot/', { headers: cookie, redirect: 'manual' });
  assert.equal(dej.status, 302); assert.equal(dej.headers.get('location'), '/pilot/');

  // une requête qui modifie, venue d'un autre site, est refusée même avec le cookie
  const ailleurs = await fetch(base + '/api/backup', { method: 'POST', headers: { ...cookie, origin: 'https://ailleurs.example' } });
  assert.equal(ailleurs.status, 403);

  // changer le mot de passe : la session en cours suit, l'ancien cookie ne vaut plus rien
  const chg = await fetch(base + '/api/settings', { method: 'PUT', headers: { ...cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_password: 'nouveau-mot-de-passe' }) });
  assert.equal(chg.status, 200);
  const nouveau = { cookie: 'mppe_session=' + jetonDe(chg) };
  assert.equal(await connecte(base, cookie), false);
  assert.ok(await connecte(base, nouveau));

  // déconnexion
  const dec = await fetch(base + '/api/deconnexion', { method: 'POST', headers: nouveau });
  assert.match(dec.headers.get('set-cookie'), /Max-Age=0/);
  // les scripts peuvent toujours envoyer l'identifiant en Basic
  const basic = { authorization: 'Basic ' + Buffer.from('stella:nouveau-mot-de-passe').toString('base64') };
  assert.ok(await connecte(base, basic));
}));

test('connexion : jamais de retour vers un autre site', () => avecServeur({}, async (base) => {
  for (const suite of ['https://ailleurs.example/', '//ailleurs.example/', '/\\ailleurs.example', '/connexion/']) {
    const r = await connecter(base, 'stella', 'motdepasse-solide', suite);
    assert.equal((await r.json()).suite, '/', suite);
  }
}));

test('derrière Caddy en HTTPS : cookie Secure', () => avecServeur({ trustProxy: true }, async (base) => {
  const r = await fetch(base + '/api/connexion', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-proto': 'https' },
    body: JSON.stringify({ utilisateur: 'stella', mot_de_passe: 'motdepasse-solide' }) });
  assert.match(r.headers.get('set-cookie'), /; Secure$/);
}));

test('synchronisation : motif précis quand le serveur n\'a pas de jeton', () => avecServeur({}, async (base) => {
  const r = await fetch(base + '/api/sync', { method: 'POST', headers: { authorization: 'Bearer un-jeton-quelconque-123' }, body: '{}' });
  assert.equal(r.status, 401);
  const j = await r.json();
  assert.equal(j.error, 'no_sync_token');
  assert.match(j.message, /pas de jeton de synchronisation/);
}));

test('synchronisation : motifs côté application (proxy Basic, portail web, jeton)', async () => {
  const rep = (status, headers, corps = '', extra = {}) => Object.assign(new Response(corps, { status, headers }), extra);
  assert.match(await motifRefus(rep(401, { 'www-authenticate': 'Basic realm="x"' })), /authentification « Basic » est configurée/);
  assert.match(await motifRefus(rep(200, { 'content-type': 'text/html' }, '<html>', { })), /page web au lieu de l'API/);
  assert.match(await motifRefus(rep(401, { 'content-type': 'application/json' }, JSON.stringify({ error: 'bad_token', message: 'Jeton de synchronisation refusé : x' }))),
    /Jeton de synchronisation refusé/);
  assert.match(await motifRefus(rep(404, {})), /404/);
  assert.match(await motifRefus(rep(401, { 'content-type': 'application/json' }, JSON.stringify({ error: 'login_required', message: 'Connexion requise' }))),
    /interface web, pas à la synchronisation/);
});

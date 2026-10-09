#!/usr/bin/env node
// Banc d'essai du partage, sur une seule machine, sans toucher à vos vraies données.
//
// Lance trois instances dans un dossier temporaire :
//   - un serveur « hôte » (comme votre serveur Docker),
//   - l'appareil de « Stella » et celui de « Paul » (comme deux applications de bureau),
// chacune ouverte dans le navigateur sur son propre port.
//
// Usage :  node scripts/banc-partage.mjs            → instances vides, tout se fait à la main
//          node scripts/banc-partage.mjs --pret     → espace « Banc d'essai » déjà créé et Paul déjà membre
// Options : --dossier CHEMIN (données conservées entre deux lancements), --port 8400 (premier port)
// Arrêt : Ctrl+C (le dossier temporaire est effacé, sauf avec --dossier).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const { createApp } = await import(path.join(ici, '..', 'server', 'src', 'server.js'));

const args = process.argv.slice(2);
const opt = (nom, def) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : def; };
const pret = args.includes('--pret');
const garder = !!opt('--dossier');
const dossier = opt('--dossier') || fs.mkdtempSync(path.join(os.tmpdir(), 'mppe-banc-'));
const port0 = +opt('--port', 8400);
const JETON = 'jeton-du-banc-d-essai-0123456789';

const noeuds = [
  { nom: 'hote', titre: 'Serveur hôte', mode: 'serveur', port: port0 },
  { nom: 'stella', titre: 'Appareil de Stella', mode: 'application', port: port0 + 1 },
  { nom: 'paul', titre: 'Appareil de Paul', mode: 'application', port: port0 + 2 },
];
for (const n of noeuds) {
  fs.mkdirSync(path.join(dossier, n.nom), { recursive: true });
  n.app = createApp({ dataDir: path.join(dossier, n.nom), mode: n.mode, autoSnapshot: false, ...(n.mode === 'serveur' ? { syncToken: JETON } : {}) });
  await new Promise((ok, ko) => { n.app.server.once('error', ko); n.app.server.listen(n.port, '127.0.0.1', ok); });
  n.url = `http://127.0.0.1:${n.port}`;
}
const [hote, stella, paul] = noeuds;
const appel = (n, p, method = 'GET', body) => fetch(n.url + '/api/' + p, {
  method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body),
}).then(async r => { const b = await r.json().catch(() => null); if (!r.ok) throw new Error((b && b.message) || r.status); return b; });

// la synchronisation privée de Stella pointe vers l'hôte : c'est lui qui hébergera ses espaces
await appel(stella, 'sync/config', 'PUT', { url: hote.url, token: JETON, enabled: true });

if (pret) {
  await appel(stella, 'partage/identite', 'PUT', { nom: 'Stella', couleur: '#B5562E' });
  await appel(paul, 'partage/identite', 'PUT', { nom: 'Paul', couleur: '#2F6DB2' });
  const e = await appel(stella, 'partage/espaces', 'POST', { nom: 'Banc d\'essai' });
  const { lien } = await appel(stella, `partage/espaces/${e.id}/invitations`, 'POST', { role: 'membre' });
  await appel(paul, 'partage/rejoindre', 'POST', { lien });
  await appel(stella, 'partage/sync', 'POST');
  await appel(paul, 'partage/sync', 'POST');
}

console.log(`
Banc d'essai du partage — données dans ${dossier}

  ${stella.titre.padEnd(20)} ${stella.url}/pilot/
  ${paul.titre.padEnd(20)} ${paul.url}/pilot/
  ${hote.titre.padEnd(20)} ${hote.url}  (n'affiche pas les espaces : il ne peut pas les lire)

${pret ? `Espace « Banc d'essai » prêt : Stella et Paul en sont membres.
Ouvrez les deux appareils côte à côte, onglet Idées : déposez une idée « Partagée dans … »,
elle arrive chez l'autre en moins de 30 secondes (ou tout de suite : Données → Partage → Synchroniser).`
  : `À la main : chez Stella, Données → Partage → choisir un nom, Créer un espace, Inviter une personne ;
chez Paul, choisir un nom puis Rejoindre un espace avec le lien.
La synchronisation privée de Stella vers l'hôte est déjà configurée (jeton ${JETON}).`}

Ctrl+C pour arrêter${garder ? '' : ' (le dossier temporaire sera effacé)'}.`);

const arret = () => {
  for (const n of noeuds) { try { n.app.server.close(); n.app.store.close(); } catch {} }
  if (!garder) fs.rmSync(dossier, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', arret); process.on('SIGTERM', arret);

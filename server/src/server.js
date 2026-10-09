// Serveur My Pilot Personal Edition : fichiers statiques + API JSON. Aucune dépendance externe.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './db.js';
import * as claude from './claude.js';
import { SyncEngine, hubExchange } from './sync.js';
import { Settings, baseFromEnv } from './settings.js';
import { Garde, adresseClient } from './garde.js';
import { Hote } from './espaces-hote.js';
import { Espaces } from './espaces.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
export const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();

const MAX_BODY = 25 * 1024 * 1024;
const DOC_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': isBuf || typeof body === 'string' ? (headers['Content-Type'] || 'text/plain; charset=utf-8') : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'too_large', 'Données trop volumineuses (25 Mo max)')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'bad_json', 'Corps JSON illisible')); }
    });
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function createApp(opts = {}) {
  const dataDir = opts.dataDir ?? process.env.DATA_DIR ?? path.join(ROOT, 'data');
  const webDir = opts.webDir ?? path.join(ROOT, 'web');
  const store = opts.store ?? new Store(opts.dbFile ?? path.join(dataDir, 'pilot.db'));
  const snapDir = opts.snapshotDir ?? process.env.SNAPSHOT_DIR ?? path.join(dataDir, 'snapshots');
  const mode = opts.mode || 'serveur';
  // Réglages : valeurs de départ = .env (ou options), modifiables ensuite depuis l'onglet Données
  const base = { ...baseFromEnv() };
  if (opts.user !== undefined) base.app_user = opts.user;
  if (opts.password !== undefined) base.app_password = opts.password;
  if (opts.syncToken !== undefined) base.sync_token = opts.syncToken;
  const settings = new Settings(store, { mode, base });
  const keepSnaps = () => settings.get('keep_snapshots');
  const user = () => settings.get('app_user');
  const pass = () => (mode === 'application' ? '' : settings.get('app_password'));
  const syncToken = () => (mode === 'application' ? '' : settings.get('sync_token'));
  const localToken = opts.localToken || '';            // application de bureau : jeton propre à la session
  function appliquerReglages() {
    store.revisionInterval = settings.get('revision_interval');
    store.keepRevisions = settings.get('keep_revisions');
    claude.setToken(settings.source('claude_token') === 'défaut' ? null : settings.get('claude_token'));
    planifierInstantanes();
  }
  const sync = opts.syncEngine === false ? null : new SyncEngine(store, { log: m => console.log(m) }).start();
  // Espaces partagés : hôte sur le serveur, membre dans l'application de bureau
  const hote = mode === 'application' ? null : new Hote(store);
  const espaces = mode === 'application' && opts.espaces !== false
    ? new Espaces(store, { configPrivee: () => (sync ? sync.config() : { url: '', token: '' }), log: m => console.log(m) }).start()
    : null;
  // Derrière Caddy : adresse réelle du visiteur, et freinage des essais d'identifiants
  const trustProxy = opts.trustProxy ?? process.env.TRUST_PROXY === '1';
  const garde = opts.garde ?? new Garde();
  const bearer = req => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; };

  function cookie(req, name) {
    const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)').exec(req.headers.cookie || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function authorized(req, url) {
    if (localToken) return safeEqual(cookie(req, 'mppe_local') || req.headers['x-local-token'] || '', localToken);
    const jeton = syncToken(), mdp = pass();
    if (url.pathname === '/api/sync' && jeton) {
      const h = req.headers.authorization || '';
      return h.startsWith('Bearer ') && safeEqual(h.slice(7), jeton);
    }
    if (!mdp) return true;
    const h = req.headers.authorization || '';
    if (!h.startsWith('Basic ')) return false;
    const [u, p] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(/:(.*)/s);
    return safeEqual(u, user() || 'pilot') && safeEqual(p ?? '', mdp);
  }

  async function api(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean).slice(1); // sans "api"
    const m = req.method;

    if (parts[0] === 'health' && m === 'GET') {
      return send(res, 200, { ok: true, version: VERSION, schema: store.schemaVersion, auth: !!pass(), mode, device: store.deviceId,
        firstRun: mode !== 'application' && !pass() });
    }

    if (parts[0] === 'partage') return apiPartage(req, res, parts.slice(1), m);

    if (parts[0] === 'docs') {
      const id = parts[1];
      if (!id && m === 'GET') return send(res, 200, store.listDocs());
      if (!DOC_ID.test(id || '')) throw new HttpError(400, 'bad_id', 'Identifiant de document invalide');

      if (parts[2] === 'rev' && m === 'GET') {
        const r = store.docRev(id);
        if (!r) throw new HttpError(404, 'not_found', 'Document absent');
        return send(res, 200, r);
      }
      if (parts.length === 2 && m === 'GET') {
        const d = store.getDoc(id);
        if (!d) throw new HttpError(404, 'not_found', 'Document absent');
        return send(res, 200, d);
      }
      if (parts.length === 2 && m === 'PUT') {
        const body = await readJson(req);
        if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) {
          throw new HttpError(400, 'bad_request', 'Champ "data" (objet) attendu');
        }
        const r = store.putDoc(id, body.data, body.baseRev ?? null, body.reason === 'manual' ? 'manual' : 'auto');
        if (!r.ok) return send(res, 409, { error: 'conflict', message: 'Modifié ailleurs entre-temps', rev: r.rev, updated_at: r.updated_at });
        return send(res, 200, { rev: r.rev, updated_at: r.updated_at, conflicts: r.conflicts, ...(r.data ? { data: r.data } : {}) });
      }
      if (parts[2] === 'revisions' && m === 'GET') {
        if (parts[3]) {
          const r = store.getRevision(id, +parts[3]);
          if (!r) throw new HttpError(404, 'not_found', 'Révision absente');
          return send(res, 200, r);
        }
        return send(res, 200, store.listRevisions(id, Math.min(+url.searchParams.get('limit') || 100, 500)));
      }
      if (parts[2] === 'restore' && parts[3] && m === 'POST') {
        const r = store.restore(id, +parts[3]);
        if (!r) throw new HttpError(404, 'not_found', 'Révision absente');
        return send(res, 200, { rev: r.rev, updated_at: r.updated_at });
      }
    }

    if (parts[0] === 'sync') {
      // rôle hub : un appareil envoie ses fiches et reçoit celles des autres
      if (!parts[1] && m === 'POST') {
        const body = await readJson(req);
        try { return send(res, 200, hubExchange(store, body)); }
        catch (e) { throw new HttpError(400, e.code || 'bad_request', e.message); }
      }
      // rôle appareil : réglages et état de la synchronisation vers un hub
      if (!sync) throw new HttpError(404, 'not_found', 'Synchronisation désactivée');
      if (parts[1] === 'status' && m === 'GET') return send(res, 200, sync.status());
      if (parts[1] === 'config' && m === 'PUT') {
        const body = await readJson(req);
        try { return send(res, 200, sync.setConfig(body)); }
        catch (e) { throw new HttpError(400, e.code || 'bad_request', e.message); }
      }
      if (parts[1] === 'now' && m === 'POST') { await sync.run('manuel'); return send(res, 200, sync.status()); }
      if (parts[1] === 'conflicts' && m === 'GET') return send(res, 200, store.listConflicts(+url.searchParams.get('limit') || 50));
      if (parts[1] === 'conflicts' && parts[2] === 'seen' && m === 'POST') { store.markConflictsSeen(); return send(res, 200, { ok: true }); }
    }
    if (parts[0] === 'settings') {
      if (!parts[1] && m === 'GET') {
        const st = await claude.status();
        return send(res, 200, {
          mode, items: settings.describe(),
          readonly: [
            { label: 'Dossier des données', value: dataDir },
            { label: 'Dossier des instantanés', value: snapDir },
            { label: 'Claude Code', value: st.available ? 'installé' + (st.version ? ' (' + st.version + ')' : '') : 'non disponible' },
            ...(mode === 'application' ? [] : [
              { label: 'Port et adresse d\'écoute', value: 'PORT et BIND_ADDR du fichier .env (Docker)' },
              { label: 'Installation de Claude Code dans l\'image', value: 'INSTALL_CLAUDE du fichier .env' },
              { label: 'Réplication distante (Litestream)', value: 'LITESTREAM_* / SFTP_* du .env et deploy/litestream.yml' },
            ]),
          ],
        });
      }
      if (!parts[1] && m === 'PUT') {
        const body = await readJson(req);
        try { settings.update(body); }
        catch (e) { throw new HttpError(400, e.code || 'bad_request', e.message); }
        return send(res, 200, { items: settings.describe(), auth: !!pass() });
      }
    }
    if (parts[0] === 'changelog' && m === 'GET') {
      let t = '';
      try { t = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8'); } catch {}
      return send(res, 200, t, { 'Content-Type': 'text/markdown; charset=utf-8' });
    }
    if (parts[0] === 'backup' && !parts[1] && m === 'POST') {
      const file = store.snapshot(snapDir, keepSnaps());
      return send(res, 200, { file: path.basename(file) });
    }
    if (parts[0] === 'backup' && parts[1] === 'info' && m === 'GET') {
      return send(res, 200, { dir: opts.mode === 'application' ? snapDir : null, canOpen: typeof opts.openPath === 'function', keep: keepSnaps() });
    }
    if (parts[0] === 'backup' && parts[1] === 'open' && m === 'POST') {
      // seulement dans l'application de bureau : ouvre le dossier des instantanés dans le gestionnaire de fichiers
      if (typeof opts.openPath !== 'function') throw new HttpError(404, 'not_found', 'Ouverture du dossier indisponible ici');
      fs.mkdirSync(snapDir, { recursive: true });
      const err = await opts.openPath(snapDir);
      if (err) throw new HttpError(500, 'open_failed', String(err));
      return send(res, 200, { ok: true });
    }
    if (parts[0] === 'backup' && !parts[1] && m === 'GET') {
      let files = [];
      try { files = fs.readdirSync(snapDir).filter(f => f.endsWith('.db')).sort().reverse(); } catch {}
      return send(res, 200, files.map(f => ({ file: f, size: fs.statSync(path.join(snapDir, f)).size })));
    }

    if (parts[0] === 'claude') {
      if (parts[1] === 'status' && m === 'GET') return send(res, 200, await claude.status());
      if (!parts[1] && m === 'POST') {
        const st = await claude.status();
        if (!st.available) throw new HttpError(503, st.reason === 'disabled' ? 'disabled' : 'not_installed', 'Claude Code n\'est pas disponible sur le serveur');
        const body = await readJson(req);
        try {
          return send(res, 200, await claude.ask(body));
        } catch (e) {
          const status = { bad_request: 400, rate_limited: 429, not_logged_in: 401, timeout: 504, bad_json: 502 }[e.code] || 502;
          throw new HttpError(status, e.code || 'cli_error', e.message);
        }
      }
    }
    throw new HttpError(404, 'not_found', 'Route inconnue');
  }

  /* ----- espaces partagés : rôle hôte (authentification propre : jeton de membre) ----- */
  async function apiEspaces(req, res, url, ip) {
    const parts = url.pathname.split('/').filter(Boolean).slice(2); // sans "api/spaces"
    const m = req.method;
    if (!hote) throw new HttpError(404, 'not_found', 'Les espaces sont hébergés par le serveur, pas par l\'application');
    const refuse = (quoi) => { garde.echec(ip, quoi); throw new HttpError(401, 'unauthorized', 'Accès refusé'); };
    const run = fn => { try { return fn(); } catch (e) { if (e.status) throw new HttpError(e.status, e.code, e.message); throw e; } };
    if (!parts.length && m === 'POST') {
      const jeton = syncToken();
      if (!jeton || !safeEqual(bearer(req), jeton)) refuse('création d\'espace');
      garde.reussite(ip);
      const body = await readJson(req);
      return send(res, 200, run(() => hote.creer(body)));
    }
    const [space, action, cible, sous] = parts;
    if (action === 'join' && m === 'POST') {
      const body = await readJson(req);
      try { return send(res, 200, run(() => hote.rejoindre(space, body))); }
      catch (e) { if (e.status === 403 || e.status === 404) garde.echec(ip, 'invitation'); throw e; }
    }
    const membre = hote.membre(space, bearer(req));
    if (!membre) refuse('jeton de membre');
    garde.reussite(ip);
    if (action === 'members' && !cible && m === 'GET') return send(res, 200, run(() => hote.membres(membre)));
    if (action === 'invites' && m === 'POST') { const b = await readJson(req); return send(res, 200, run(() => hote.inviter(membre, b))); }
    if (action === 'members' && cible && sous === 'approve' && m === 'POST') { const b = await readJson(req); return send(res, 200, run(() => hote.approuver(membre, cible, b))); }
    if (action === 'members' && cible && sous === 'revoke' && m === 'POST') return send(res, 200, run(() => hote.retirer(membre, cible)));
    if (action === 'key' && m === 'GET') {
      if (membre.status !== 'actif') throw new HttpError(403, 'pending', 'En attente de la clé de l\'espace');
      return send(res, 200, hote.cles(membre));
    }
    if (action === 'sync' && m === 'POST') { const b = await readJson(req); return send(res, 200, run(() => hote.echange(membre, b))); }
    throw new HttpError(404, 'not_found', 'Route inconnue');
  }

  /* ----- espaces partagés : rôle appareil (pages de l'application) ----- */
  async function apiPartage(req, res, parts, m) {
    if (!espaces) throw new HttpError(404, 'not_found', 'Le partage se gère depuis l\'application de bureau');
    const ok = async fn => { try { return send(res, 200, await fn()); } catch (e) {
      const st = { bad_request: 400, forbidden: 403, not_found: 404 }[e.code] || (e.status === 429 ? 429 : e.status ? 502 : 400);
      throw new HttpError(st, e.code || 'partage', e.message);
    } };
    if (!parts.length && m === 'GET') return send(res, 200, espaces.status());
    if (parts[0] === 'identite' && m === 'PUT') { const b = await readJson(req); return ok(() => espaces.setIdentite(b)); }
    if (parts[0] === 'espaces' && !parts[1] && m === 'POST') { const b = await readJson(req); return ok(() => espaces.creer(b.nom)); }
    if (parts[0] === 'rejoindre' && m === 'POST') { const b = await readJson(req); return ok(() => espaces.rejoindre(b.lien)); }
    if (parts[0] === 'sync' && m === 'POST') { await espaces.run('manuel'); return send(res, 200, espaces.status()); }
    if (parts[0] === 'espaces' && parts[1]) {
      const id = parts[1];
      if (parts[2] === 'invitations' && m === 'POST') { const b = await readJson(req); return ok(() => espaces.inviter(id, b)); }
      if (parts[2] === 'membres' && parts[3] && parts[4] === 'retirer' && m === 'POST') return ok(() => espaces.retirer(id, parts[3]));
      if (parts[2] === 'quitter' && m === 'POST') { const b = await readJson(req); return ok(() => espaces.quitter(id, b)); }
    }
    throw new HttpError(404, 'not_found', 'Route inconnue');
  }

  function serveStatic(req, res, url) {
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(webDir, p));
    if (!file.startsWith(webDir + path.sep)) return send(res, 403, 'Interdit');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        // /pilot → /pilot/
        if (!err && st.isDirectory()) return send(res, 301, '', { Location: url.pathname + '/' });
        return send(res, 404, 'Introuvable');
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    const url = new URL(req.url, 'http://local');
    const ip = adresseClient(req, trustProxy);
    try {
      // routes publiques : état minimal du serveur, page d'explication des liens d'invitation
      if (url.pathname === '/api/health' && req.method === 'GET' && !localToken && !authorized(req, url)) return send(res, 200, { ok: true });
      if (!localToken && (url.pathname === '/rejoindre' || url.pathname.startsWith('/rejoindre/')) && req.method === 'GET') return serveStatic(req, res, url);
      if (!localToken) {
        const attente = garde.attente(ip);
        if (attente > 0) return send(res, 429, { error: 'rate_limited', message: 'Trop de tentatives : réessayez dans ' + Math.ceil(attente / 1000) + ' s' },
          { 'Retry-After': String(Math.ceil(attente / 1000)) });
      }
      if (!localToken && (url.pathname === '/api/spaces' || url.pathname.startsWith('/api/spaces/'))) return await apiEspaces(req, res, url, ip);
      if (!authorized(req, url)) {
        if (localToken) return send(res, 403, 'Accès réservé à l\'application');
        if (req.headers.authorization) garde.echec(ip, url.pathname === '/api/sync' ? 'jeton de synchronisation' : 'mot de passe');
        return send(res, 401, 'Authentification requise', url.pathname === '/api/sync' ? {} : { 'WWW-Authenticate': 'Basic realm="My Pilot Personal Edition", charset="UTF-8"' });
      }
      if (!localToken && req.headers.authorization) garde.reussite(ip);
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non permise');
      return serveStatic(req, res, url);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.code, message: e.message });
      console.error(e);
      return send(res, 500, { error: 'internal', message: 'Erreur interne' });
    }
  });

  // Instantané automatique (en plus de la réplication continue Litestream), replanifié si le réglage change.
  let timer = null;
  function planifierInstantanes() {
    clearInterval(timer); timer = null;
    const every = settings.get('snapshot_hours');
    if (every > 0 && opts.autoSnapshot !== false) {
      timer = setInterval(() => {
        try { console.log('Instantané :', store.snapshot(snapDir, keepSnaps())); }
        catch (e) { console.error('Instantané impossible', e); }
      }, every * 3600 * 1000);
      timer.unref();
    }
  }
  appliquerReglages();
  settings.on(appliquerReglages);
  server.on('close', () => { if (timer) clearInterval(timer); if (sync) sync.stop(); if (espaces) espaces.stop(); if (!opts.garde) garde.stop(); });
  return { server, store, sync, settings, espaces, hote, garde };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.env.PORT || 8080);
  const host = process.env.HOST || '0.0.0.0';
  const app = createApp();
  const { server, store } = app;
  // Exposé derrière un proxy (Caddy) : sans mot de passe, le premier visiteur venu pourrait le choisir.
  if (process.env.TRUST_PROXY === '1' && !app.settings.get('app_password')) {
    console.error('TRUST_PROXY=1 (serveur exposé) mais aucun mot de passe : définissez APP_PASSWORD dans .env, puis relancez.');
    store.close(); process.exit(1);
  }
  server.listen(port, host, () => console.log(`My Pilot Personal Edition ${VERSION} sur http://${host}:${port}`));
  const stop = () => { server.close(); store.close(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}

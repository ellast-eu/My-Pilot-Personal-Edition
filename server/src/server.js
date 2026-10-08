// Serveur My Pilot Personal Edition : fichiers statiques + API JSON. Aucune dépendance externe.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './db.js';
import * as claude from './claude.js';
import { SyncEngine, hubExchange } from './sync.js';

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
  const store = opts.store ?? new Store(opts.dbFile ?? path.join(dataDir, 'pilot.db'), {
    revisionInterval: +(process.env.REVISION_INTERVAL ?? 300),
    keepRevisions: +(process.env.KEEP_REVISIONS ?? 300),
  });
  const snapDir = opts.snapshotDir ?? process.env.SNAPSHOT_DIR ?? path.join(dataDir, 'snapshots');
  const keepSnaps = +(process.env.KEEP_SNAPSHOTS ?? 30);
  const user = opts.user ?? process.env.APP_USER;
  const pass = opts.password ?? process.env.APP_PASSWORD;
  const syncToken = opts.syncToken ?? process.env.SYNC_TOKEN ?? '';
  const localToken = opts.localToken || '';            // application de bureau : jeton propre à la session
  const sync = opts.syncEngine === false ? null : new SyncEngine(store, { log: m => console.log(m) }).start();

  function cookie(req, name) {
    const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)').exec(req.headers.cookie || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function authorized(req, url) {
    if (localToken) return safeEqual(cookie(req, 'mppe_local') || req.headers['x-local-token'] || '', localToken);
    if (url.pathname === '/api/sync' && syncToken) {
      const h = req.headers.authorization || '';
      return h.startsWith('Bearer ') && safeEqual(h.slice(7), syncToken);
    }
    if (!pass) return true;
    const h = req.headers.authorization || '';
    if (!h.startsWith('Basic ')) return false;
    const [u, p] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(/:(.*)/s);
    return safeEqual(u, user || 'pilot') && safeEqual(p ?? '', pass);
  }

  async function api(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean).slice(1); // sans "api"
    const m = req.method;

    if (parts[0] === 'health' && m === 'GET') {
      return send(res, 200, { ok: true, version: VERSION, schema: store.schemaVersion, auth: !!pass, mode: opts.mode || 'serveur', device: store.deviceId });
    }

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
    if (parts[0] === 'changelog' && m === 'GET') {
      let t = '';
      try { t = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8'); } catch {}
      return send(res, 200, t, { 'Content-Type': 'text/markdown; charset=utf-8' });
    }
    if (parts[0] === 'backup' && !parts[1] && m === 'POST') {
      const file = store.snapshot(snapDir, keepSnaps);
      return send(res, 200, { file: path.basename(file) });
    }
    if (parts[0] === 'backup' && parts[1] === 'info' && m === 'GET') {
      return send(res, 200, { dir: opts.mode === 'application' ? snapDir : null, canOpen: typeof opts.openPath === 'function', keep: keepSnaps });
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
    if (!authorized(req, url)) {
      if (localToken) return send(res, 403, 'Accès réservé à l\'application');
      return send(res, 401, 'Authentification requise', url.pathname === '/api/sync' ? {} : { 'WWW-Authenticate': 'Basic realm="My Pilot Personal Edition", charset="UTF-8"' });
    }
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non permise');
      return serveStatic(req, res, url);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.code, message: e.message });
      console.error(e);
      return send(res, 500, { error: 'internal', message: 'Erreur interne' });
    }
  });

  // Instantané automatique (en plus de la réplication continue Litestream).
  const every = +(process.env.SNAPSHOT_HOURS ?? 24);
  let timer = null;
  if (every > 0 && opts.autoSnapshot !== false) {
    timer = setInterval(() => {
      try { console.log('Instantané :', store.snapshot(snapDir, keepSnaps)); }
      catch (e) { console.error('Instantané impossible', e); }
    }, every * 3600 * 1000);
    timer.unref();
  }
  server.on('close', () => { if (timer) clearInterval(timer); if (sync) sync.stop(); });
  return { server, store, sync };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.env.PORT || 8080);
  const host = process.env.HOST || '0.0.0.0';
  const { server, store } = createApp();
  server.listen(port, host, () => console.log(`My Pilot Personal Edition ${VERSION} sur http://${host}:${port}`));
  const stop = () => { server.close(); store.close(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}

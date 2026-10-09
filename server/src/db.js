// Stockage SQLite fiche par fiche.
//
// Chaque document (pilot, ideas) est découpé en enregistrements : une fiche par activité,
// note, contact, idée…, plus un enregistrement par réglage global (paramètres, carte Pause…).
// Chaque modification porte une horloge hybride (HLC) et un numéro de séquence local : c'est
// ce qui permet la fusion entre appareils (voir sync.js). Les pages, elles, continuent de lire
// et d'écrire un document entier : le découpage est fait ici.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/* collections découpées en fiches ; tout le reste d'un document est un réglage global */
export const COLLECTIONS = {
  pilot: ['chantiers', 'notes', 'vigilances', 'contacts', 'organisations'],
  ideas: ['ideas', 'unified', 'projects'],
};
/* espaces partagés : documents « s-<identifiant> », chiffrés de bout en bout lors de la synchronisation */
export const PREFIXE_ESPACE = 's-';
export const COLLECTIONS_ESPACE = ['ideas', 'unified', 'projects', 'chantiers', 'notes', 'comments', 'members'];
export const estEspace = doc => typeof doc === 'string' && doc.startsWith(PREFIXE_ESPACE);
const collectionsDe = doc => (estEspace(doc) ? COLLECTIONS_ESPACE : COLLECTIONS[doc] || []);
const SINGLE = '_';          // collection des réglages globaux d'un document
const LOCAL_KEYS = ['meta']; // propre à chaque appareil, jamais synchronisé

const MIGRATIONS = [
  // v1 : un document JSON entier par module
  `CREATE TABLE documents(id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL, updated_at TEXT NOT NULL);
   CREATE TABLE revisions(doc TEXT NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL, size INTEGER NOT NULL,
     reason TEXT NOT NULL DEFAULT 'auto', created_at TEXT NOT NULL, PRIMARY KEY(doc, rev));`,
  // v2 : fiches, horloge, état de synchronisation, conflits
  `CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE docs(id TEXT PRIMARY KEY, rev INTEGER NOT NULL, updated_at TEXT NOT NULL, local TEXT NOT NULL DEFAULT '{}');
   CREATE TABLE records(
     doc TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL,
     data TEXT, deleted INTEGER NOT NULL DEFAULT 0,
     hlc TEXT NOT NULL, origin TEXT NOT NULL, seq INTEGER NOT NULL, ord INTEGER NOT NULL,
     PRIMARY KEY(doc, coll, id));
   CREATE INDEX records_seq ON records(seq);
   CREATE TABLE bases(doc TEXT NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(doc, rev));
   CREATE TABLE sync_state(remote TEXT PRIMARY KEY, pushed_seq INTEGER NOT NULL DEFAULT 0,
     pulled_cursor INTEGER NOT NULL DEFAULT 0, last_ok TEXT, last_error TEXT);
   CREATE TABLE conflicts(id INTEGER PRIMARY KEY AUTOINCREMENT, doc TEXT NOT NULL, coll TEXT NOT NULL, rid TEXT NOT NULL,
     kept TEXT, lost TEXT, source TEXT NOT NULL, at TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0);`,
  // v3 : espaces partagés — côté hôte (espaces hébergés ici) et côté appareil (espaces rejoints)
  `CREATE TABLE host_spaces(id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
   CREATE TABLE host_members(space TEXT NOT NULL, member TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL,
     token_hash TEXT NOT NULL UNIQUE, pub TEXT NOT NULL, invite TEXT, proof TEXT, joined_at TEXT NOT NULL, revoked_at TEXT,
     PRIMARY KEY(space, member));
   CREATE TABLE host_keys(space TEXT NOT NULL, epoch INTEGER NOT NULL, member TEXT NOT NULL, wrap TEXT NOT NULL,
     PRIMARY KEY(space, epoch, member));
   CREATE TABLE host_invites(id_hash TEXT PRIMARY KEY, space TEXT NOT NULL, role TEXT NOT NULL, created_by TEXT NOT NULL,
     created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_by TEXT);
   CREATE TABLE my_spaces(id TEXT PRIMARY KEY, host TEXT NOT NULL, name TEXT NOT NULL, member TEXT NOT NULL,
     token TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, owner_pub TEXT, keys TEXT NOT NULL DEFAULT '{}',
     epoch INTEGER NOT NULL DEFAULT 0, invites TEXT NOT NULL DEFAULT '[]', members TEXT NOT NULL DEFAULT '[]',
     joined_at TEXT NOT NULL, last_ok TEXT, last_error TEXT);`,
  // v4 : boîte « Reçues » — ce que les autres membres ont fait dans les espaces partagés
  `CREATE TABLE inbox(id INTEGER PRIMARY KEY AUTOINCREMENT, space TEXT NOT NULL, coll TEXT NOT NULL, rid TEXT NOT NULL,
     kind TEXT NOT NULL, author TEXT NOT NULL, titre TEXT NOT NULL, at TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0);
   CREATE INDEX inbox_seen ON inbox(seen, at);`,
];

const stable = v => JSON.stringify(v);   // l'ordre des clés est celui de l'objet : suffisant ici
const nowIso = () => new Date().toISOString();

export class Store {
  /**
   * @param {string} file  chemin de la base (":memory:" pour les tests)
   * @param {{revisionInterval?:number, keepRevisions?:number, keepBases?:number, deviceId?:string}} opts
   */
  constructor(file, opts = {}) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.file = file;
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;');
    this.revisionInterval = opts.revisionInterval ?? 300;
    this.keepRevisions = opts.keepRevisions ?? 300;
    this.keepBases = opts.keepBases ?? 60;
    this.listeners = new Set();
    this.migrate();
    this.deviceId = this.getMeta('device_id') || this.setMeta('device_id', opts.deviceId || crypto.randomBytes(6).toString('hex'));
  }

  /* ---------- schéma ---------- */
  migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_version(v INTEGER NOT NULL)');
    const row = this.db.prepare('SELECT v FROM schema_version').get();
    let v = row ? row.v : 0;
    if (!row) this.db.prepare('INSERT INTO schema_version(v) VALUES (0)').run();
    while (v < MIGRATIONS.length) {
      this.db.exec('BEGIN');
      try {
        this.db.exec(MIGRATIONS[v]);
        if (v === 1) this.migrateDocumentsToRecords();
        v++;
        this.db.prepare('UPDATE schema_version SET v=?').run(v);
        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
    }
    this.schemaVersion = v;
  }

  /** v1 → v2 : chaque document entier est découpé en fiches. */
  migrateDocumentsToRecords() {
    const docs = this.db.prepare('SELECT id, data, rev, updated_at FROM documents').all();
    if (!this.getMeta('device_id')) this.setMeta('device_id', crypto.randomBytes(6).toString('hex'));
    this.deviceId = this.getMeta('device_id');
    for (const d of docs) {
      const data = JSON.parse(d.data);
      const parts = this.split(d.id, data);
      this.db.prepare('INSERT INTO docs(id, rev, updated_at, local) VALUES (?,?,?,?)').run(d.id, d.rev, d.updated_at, stable(parts.local));
      for (const [k, json] of parts.items) {
        const [coll, id] = splitKey(k);
        this.writeRecord(d.id, coll, id, json, this.nextHlc());
      }
      this.saveBase(d.id, d.rev, this.assemble(d.id));
    }
    this.db.exec('DROP TABLE documents');
  }

  /* ---------- petites tables ---------- */
  getMeta(key) { const r = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key); return r ? r.value : null; }
  setMeta(key, value) {
    if (value === null || value === undefined) this.db.prepare('DELETE FROM meta WHERE key=?').run(key);
    else this.db.prepare('INSERT INTO meta(key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
    return value;
  }
  counter(key) {
    const n = (+this.getMeta(key) || 0) + 1;
    this.setMeta(key, n);
    return n;
  }

  /* ---------- horloge hybride : « millisecondes-compteur-appareil », comparable comme du texte ---------- */
  nextHlc(remote) {
    const [lt, lc] = parseHlc(this.getMeta('hlc') || '');
    let t = Date.now(), c = 0;
    let [rt, rc] = remote ? parseHlc(remote) : [0, 0];
    const max = Math.max(t, lt, rt);
    if (max === lt && max === rt) c = Math.max(lc, rc) + 1;
    else if (max === lt) c = lc + 1;
    else if (max === rt) c = rc + 1;
    t = max;
    const h = formatHlc(t, c, this.deviceId || 'x');
    this.setMeta('hlc', h);
    return h;
  }
  observeHlc(remote) { this.nextHlc(remote); }

  /* ---------- découpage / assemblage ---------- */
  split(doc, data) {
    const colls = collectionsDe(doc);
    const items = new Map(), local = {};
    let assigned = false;
    for (const [k, v] of Object.entries(data || {})) {
      if (LOCAL_KEYS.includes(k)) { local[k] = v; continue; }
      if (colls.includes(k) && Array.isArray(v)) {
        v.forEach((it, i) => {
          if (!it || typeof it !== 'object') return;
          if (typeof it.id !== 'string' || !it.id) {
            it.id = 'r' + crypto.createHash('sha1').update(k + i + stable(it)).digest('hex').slice(0, 12);
            assigned = true;
          }
          items.set(joinKey(k, it.id), stable(it));
        });
      } else {
        items.set(joinKey(SINGLE, k), stable(v));
      }
    }
    return { items, local, assigned };
  }

  currentItems(doc) {
    const m = new Map();
    for (const r of this.db.prepare('SELECT coll, id, data, deleted FROM records WHERE doc=?').all(doc)) {
      m.set(joinKey(r.coll, r.id), r.deleted ? null : r.data);
    }
    return m;
  }

  assemble(doc) {
    const row = this.db.prepare('SELECT local FROM docs WHERE id=?').get(doc);
    if (!row) return null;
    const out = {};
    const colls = collectionsDe(doc);
    for (const c of colls) out[c] = [];
    for (const r of this.db.prepare('SELECT coll, id, data FROM records WHERE doc=? AND deleted=0 ORDER BY ord').all(doc)) {
      const v = JSON.parse(r.data);
      if (r.coll === SINGLE) out[r.id] = v;
      else (out[r.coll] || (out[r.coll] = [])).push(v);
    }
    return Object.assign(out, JSON.parse(row.local || '{}'));
  }

  writeRecord(doc, coll, id, json, hlc, origin = this.deviceId) {
    const seq = this.counter('seq');
    const cur = this.db.prepare('SELECT ord FROM records WHERE doc=? AND coll=? AND id=?').get(doc, coll, id);
    const ord = cur ? cur.ord : this.counter('ord');
    this.db.prepare(`INSERT INTO records(doc, coll, id, data, deleted, hlc, origin, seq, ord) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(doc, coll, id) DO UPDATE SET data=excluded.data, deleted=excluded.deleted, hlc=excluded.hlc,
      origin=excluded.origin, seq=excluded.seq`).run(doc, coll, id, json, json === null ? 1 : 0, hlc, origin, seq, ord);
  }

  saveBase(doc, rev, data) {
    this.db.prepare('INSERT OR REPLACE INTO bases(doc, rev, data) VALUES (?,?,?)').run(doc, rev, stable(data));
    this.db.prepare('DELETE FROM bases WHERE doc=? AND rev <= ?').run(doc, rev - this.keepBases);
  }
  getBase(doc, rev) {
    const r = this.db.prepare('SELECT data FROM bases WHERE doc=? AND rev=?').get(doc, rev);
    return r ? JSON.parse(r.data) : null;
  }

  /* ---------- API document ---------- */
  getDoc(id) {
    const d = this.db.prepare('SELECT rev, updated_at FROM docs WHERE id=?').get(id);
    if (!d) return null;
    return { id, rev: d.rev, updated_at: d.updated_at, data: this.assemble(id) };
  }
  docRev(id) {
    const d = this.db.prepare('SELECT rev, updated_at FROM docs WHERE id=?').get(id);
    return d ? { rev: d.rev, updated_at: d.updated_at } : null;
  }
  listDocs() {
    return this.db.prepare(`SELECT d.id, d.rev, d.updated_at,
      (SELECT count(*) FROM records r WHERE r.doc=d.id AND r.deleted=0) AS records FROM docs d ORDER BY d.id`).all();
  }

  /**
   * Écrit un document entier. Si la page partait d'une version plus ancienne (baseRev), ses
   * changements sont fusionnés fiche par fiche avec ce qui a changé entre-temps (autre onglet,
   * synchronisation) : seules les fiches modifiées des deux côtés sont en conflit, et la saisie
   * de la page l'emporte (l'autre version est gardée dans le journal des conflits).
   * @returns {{ok:true, rev, updated_at, data?:object, conflicts:number} | {ok:false, rev, updated_at}}
   */
  putDoc(id, data, baseRev, reason = 'auto') {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const cur = this.db.prepare('SELECT rev, updated_at FROM docs WHERE id=?').get(id);
      const curRev = cur ? cur.rev : 0;
      const mine = this.split(id, data);
      const theirs = this.currentItems(id);
      let base = null;
      const stale = baseRev !== undefined && baseRev !== null && baseRev !== curRev;
      if (stale) {
        const b = baseRev === 0 ? {} : this.getBase(id, baseRev);
        if (!b) { this.db.exec('ROLLBACK'); return { ok: false, rev: curRev, updated_at: cur ? cur.updated_at : null }; }
        base = this.split(id, b).items;
      }
      const keys = new Set([...mine.items.keys(), ...theirs.keys(), ...(base ? base.keys() : [])]);
      let writes = 0, remoteKept = false, conflicts = 0;
      for (const k of keys) {
        const m = mine.items.has(k) ? mine.items.get(k) : null;
        const t = theirs.has(k) ? theirs.get(k) : null;
        if (!base) {                                   // cas courant : la page part de la dernière version
          if (m !== t) { this.writeKey(id, k, m); writes++; }
          continue;
        }
        const b = base.has(k) ? base.get(k) : null;
        if (m === b) { if (t !== b) remoteKept = true; continue; }   // la page n'a pas touché : on garde l'existant
        if (t === b || m === t) { if (m !== t) { this.writeKey(id, k, m); writes++; } continue; }
        // modifiée des deux côtés : la saisie de la page l'emporte, l'autre version est journalisée
        this.logConflict(id, k, m, t, 'onglet');
        this.writeKey(id, k, m); writes++; conflicts++;
      }
      const localJson = stable(mine.local);
      let rev = curRev, updated = cur ? cur.updated_at : nowIso();
      if (!cur) {
        rev = 1; updated = nowIso();
        this.db.prepare('INSERT INTO docs(id, rev, updated_at, local) VALUES (?,?,?,?)').run(id, rev, updated, localJson);
      } else if (writes) {
        rev = curRev + 1; updated = nowIso();
        this.db.prepare('UPDATE docs SET rev=?, updated_at=?, local=? WHERE id=?').run(rev, updated, localJson, id);
      } else {
        this.db.prepare('UPDATE docs SET local=? WHERE id=?').run(localJson, id);
      }
      const assembled = this.assemble(id);
      if (!cur || writes) {
        this.saveBase(id, rev, assembled);
        this.maybeRevision(id, rev, assembled, reason);
      }
      this.db.exec('COMMIT');
      const out = { ok: true, rev, updated_at: updated, conflicts };
      if ((stale && (remoteKept || conflicts || !writes)) || mine.assigned) out.data = assembled;
      if (writes) this.emit({ type: 'local-change', doc: id });
      return out;
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw e;
    }
  }

  writeKey(doc, key, json) {
    const [coll, id] = splitKey(key);
    this.writeRecord(doc, coll, id, json, this.nextHlc());
  }

  logConflict(doc, key, kept, lost, source) {
    const [coll, rid] = splitKey(key);
    this.db.prepare('INSERT INTO conflicts(doc, coll, rid, kept, lost, source, at) VALUES (?,?,?,?,?,?,?)')
      .run(doc, coll, rid, kept, lost, source, nowIso());
  }
  listConflicts(limit = 50) {
    return this.db.prepare('SELECT * FROM conflicts ORDER BY id DESC LIMIT ?').all(limit)
      .map(c => ({ ...c, kept: c.kept && JSON.parse(c.kept), lost: c.lost && JSON.parse(c.lost), seen: !!c.seen }));
  }
  unseenConflicts() { return this.db.prepare('SELECT count(*) AS n FROM conflicts WHERE seen=0').get().n; }
  markConflictsSeen() { this.db.prepare('UPDATE conflicts SET seen=1 WHERE seen=0').run(); }

  maybeRevision(doc, rev, data, reason) {
    const json = stable(data);
    const last = this.db.prepare('SELECT created_at FROM revisions WHERE doc=? ORDER BY rev DESC LIMIT 1').get(doc);
    const due = !last || reason !== 'auto' || (Date.now() - Date.parse(last.created_at)) / 1000 >= this.revisionInterval;
    if (!due) return;
    this.db.prepare('INSERT OR REPLACE INTO revisions(doc, rev, data, size, reason, created_at) VALUES (?,?,?,?,?,?)')
      .run(doc, rev, json, json.length, reason, nowIso());
    this.db.prepare(`DELETE FROM revisions WHERE doc=? AND rev NOT IN
      (SELECT rev FROM revisions WHERE doc=? ORDER BY rev DESC LIMIT ?)`).run(doc, doc, this.keepRevisions);
  }

  listRevisions(id, limit = 100) {
    return this.db.prepare('SELECT rev, size, reason, created_at FROM revisions WHERE doc=? ORDER BY rev DESC LIMIT ?').all(id, limit);
  }
  getRevision(id, rev) {
    const r = this.db.prepare('SELECT rev, data, created_at FROM revisions WHERE doc=? AND rev=?').get(id, rev);
    return r ? { rev: r.rev, created_at: r.created_at, data: JSON.parse(r.data) } : null;
  }
  /** Restaure une révision en l'écrivant comme nouvelle version (rien n'est effacé, et elle se synchronise). */
  restore(id, rev) {
    const r = this.getRevision(id, rev);
    if (!r) return null;
    const cur = this.getDoc(id);
    if (cur) this.maybeRevision(id, cur.rev, cur.data, 'avant-restauration');
    return this.putDoc(id, r.data, cur ? cur.rev : 0, 'restauration-' + rev);
  }

  /* ---------- synchronisation ---------- */
  /** Modifications locales postérieures à `since` (séquence), au format d'échange. */
  changesSince(since, { limit = 1000, origin = null, excludeOrigin = null, doc = null, sansEspaces = false } = {}) {
    let sql = 'SELECT doc, coll, id, data, deleted, hlc, origin, seq FROM records WHERE seq > ?';
    const args = [since];
    if (doc) { sql += ' AND doc = ?'; args.push(doc); }
    if (sansEspaces) { sql += " AND doc NOT LIKE 's-%'"; }
    if (origin) { sql += ' AND origin = ?'; args.push(origin); }
    if (excludeOrigin) { sql += ' AND origin <> ?'; args.push(excludeOrigin); }
    sql += ' ORDER BY seq LIMIT ?'; args.push(limit);
    return this.db.prepare(sql).all(...args).map(r => ({
      doc: r.doc, coll: r.coll, id: r.id, data: r.deleted ? null : JSON.parse(r.data), hlc: r.hlc, origin: r.origin, seq: r.seq,
    }));
  }
  maxSeq() { return +this.getMeta('seq') || 0; }

  /**
   * Applique des modifications venues d'ailleurs : pour chaque fiche, la plus récente (HLC) gagne.
   * Si une modification locale pas encore envoyée est écrasée, elle part dans le journal des conflits.
   * @returns {{applied:number, docs:string[], conflicts:number}}
   */
  applyRemote(changes, { pendingAfter = Infinity, source = 'synchronisation' } = {}) {
    let applied = 0, conflicts = 0;
    const touched = new Set();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const ch of changes) {
        if (!ch || typeof ch.doc !== 'string' || typeof ch.coll !== 'string' || typeof ch.id !== 'string' || typeof ch.hlc !== 'string') continue;
        this.observeHlc(ch.hlc);
        const cur = this.db.prepare('SELECT data, deleted, hlc, origin, seq FROM records WHERE doc=? AND coll=? AND id=?').get(ch.doc, ch.coll, ch.id);
        if (cur && cur.hlc >= ch.hlc) continue;                  // l'existant est plus récent (ou identique)
        const json = ch.data === null || ch.data === undefined ? null : stable(ch.data);
        if (cur && cur.origin === this.deviceId && cur.seq > pendingAfter) {
          const curJson = cur.deleted ? null : cur.data;
          if (curJson !== json) { this.logConflict(ch.doc, joinKey(ch.coll, ch.id), json, curJson, source); conflicts++; }
        }
        if (!this.db.prepare('SELECT 1 FROM docs WHERE id=?').get(ch.doc)) {
          this.db.prepare('INSERT INTO docs(id, rev, updated_at, local) VALUES (?,0,?,?)').run(ch.doc, nowIso(), '{}');
        }
        this.writeRecord(ch.doc, ch.coll, ch.id, json, ch.hlc, ch.origin || 'distant');
        applied++; touched.add(ch.doc);
      }
      for (const doc of touched) {
        const d = this.db.prepare('SELECT rev FROM docs WHERE id=?').get(doc);
        const rev = d.rev + 1;
        this.db.prepare('UPDATE docs SET rev=?, updated_at=? WHERE id=?').run(rev, nowIso(), doc);
        const assembled = this.assemble(doc);
        this.saveBase(doc, rev, assembled);
        this.maybeRevision(doc, rev, assembled, 'auto');
      }
      this.db.exec('COMMIT');
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw e;
    }
    if (touched.size) this.emit({ type: 'remote-change', docs: [...touched] });
    return { applied, docs: [...touched], conflicts };
  }

  getSyncState(remote) {
    return this.db.prepare('SELECT * FROM sync_state WHERE remote=?').get(remote)
      || { remote, pushed_seq: 0, pulled_cursor: 0, last_ok: null, last_error: null };
  }
  setSyncState(remote, patch) {
    const s = { ...this.getSyncState(remote), ...patch };
    this.db.prepare(`INSERT INTO sync_state(remote, pushed_seq, pulled_cursor, last_ok, last_error) VALUES (?,?,?,?,?)
      ON CONFLICT(remote) DO UPDATE SET pushed_seq=excluded.pushed_seq, pulled_cursor=excluded.pulled_cursor,
      last_ok=excluded.last_ok, last_error=excluded.last_error`).run(remote, s.pushed_seq, s.pulled_cursor, s.last_ok, s.last_error);
    return s;
  }
  pendingCount(remote, doc = null) {
    const s = this.getSyncState(remote);
    if (doc) return this.db.prepare('SELECT count(*) AS n FROM records WHERE seq > ? AND origin = ? AND doc = ?').get(s.pushed_seq, this.deviceId, doc).n;
    return this.db.prepare("SELECT count(*) AS n FROM records WHERE seq > ? AND origin = ? AND doc NOT LIKE 's-%'").get(s.pushed_seq, this.deviceId).n;
  }

  /** Écrit une fiche isolée (hors page), par exemple sa propre carte de membre dans un espace. */
  putRecord(doc, coll, id, data) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (!this.db.prepare('SELECT 1 FROM docs WHERE id=?').get(doc)) {
        this.db.prepare('INSERT INTO docs(id, rev, updated_at, local) VALUES (?,0,?,?)').run(doc, nowIso(), '{}');
      }
      this.writeRecord(doc, coll, id, data === null ? null : stable(data), this.nextHlc());
      this.db.prepare('UPDATE docs SET rev=rev+1, updated_at=? WHERE id=?').run(nowIso(), doc);
      const d = this.db.prepare('SELECT rev FROM docs WHERE id=?').get(doc);
      this.saveBase(doc, d.rev, this.assemble(doc));
      this.db.exec('COMMIT');
    } catch (e) { try { this.db.exec('ROLLBACK'); } catch {} throw e; }
    this.emit({ type: 'local-change', doc });
  }
  getRecord(doc, coll, id) {
    const r = this.db.prepare('SELECT data, deleted FROM records WHERE doc=? AND coll=? AND id=?').get(doc, coll, id);
    return r && !r.deleted ? JSON.parse(r.data) : null;
  }
  /** Efface toutes les fiches d'un document localement (quitter un espace) — sans propagation. */
  dropDoc(doc) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const t of ['records', 'bases', 'revisions']) this.db.prepare(`DELETE FROM ${t} WHERE doc=?`).run(doc);
      this.db.prepare('DELETE FROM docs WHERE id=?').run(doc);
      this.db.exec('COMMIT');
    } catch (e) { try { this.db.exec('ROLLBACK'); } catch {} throw e; }
  }

  /* ---------- événements (pour relancer la synchronisation) ---------- */
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { for (const fn of this.listeners) { try { fn(ev); } catch {} } }

  /* ---------- instantanés ---------- */
  /** Copie cohérente de la base (VACUUM INTO), utilisable pendant que l'appli tourne. */
  snapshot(dir, keep = 30) {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `pilot-${stamp}.db`);
    this.db.prepare('VACUUM INTO ?').run(file);
    const all = fs.readdirSync(dir).filter(f => /^pilot-.*\.db$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - keep))) fs.rmSync(path.join(dir, f));
    return file;
  }

  close() { this.db.close(); }
}

function joinKey(coll, id) { return coll + '\u0000' + id; }
function splitKey(k) { const i = k.indexOf('\u0000'); return [k.slice(0, i), k.slice(i + 1)]; }
function parseHlc(h) {
  const m = /^(\d{13})-(\d{6})-/.exec(h || '');
  return m ? [+m[1], +m[2]] : [0, 0];
}
function formatHlc(t, c, dev) { return String(t).padStart(13, '0') + '-' + String(c).padStart(6, '0') + '-' + dev; }

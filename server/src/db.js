// Stockage SQLite : un document JSON par module (pilot, ideas…), avec historique de révisions.
// node:sqlite est intégré à Node : aucune dépendance native à compiler.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS = [
  // v1 : documents + révisions
  `CREATE TABLE documents(
     id TEXT PRIMARY KEY,
     data TEXT NOT NULL,
     rev INTEGER NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE revisions(
     doc TEXT NOT NULL,
     rev INTEGER NOT NULL,
     data TEXT NOT NULL,
     size INTEGER NOT NULL,
     reason TEXT NOT NULL DEFAULT 'auto',
     created_at TEXT NOT NULL,
     PRIMARY KEY(doc, rev)
   );`,
];

export class Store {
  /**
   * @param {string} file  chemin de la base (":memory:" pour les tests)
   * @param {{revisionInterval?:number, keepRevisions?:number}} opts
   */
  constructor(file, opts = {}) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.file = file;
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    // Une révision au plus toutes les N secondes par document (les enregistrements auto sont fréquents).
    this.revisionInterval = opts.revisionInterval ?? 300;
    this.keepRevisions = opts.keepRevisions ?? 300;
    this.migrate();
  }

  migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_version(v INTEGER NOT NULL)');
    const row = this.db.prepare('SELECT v FROM schema_version').get();
    let v = row ? row.v : 0;
    if (!row) this.db.prepare('INSERT INTO schema_version(v) VALUES (0)').run();
    while (v < MIGRATIONS.length) {
      this.db.exec('BEGIN');
      try {
        this.db.exec(MIGRATIONS[v]);
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

  getDoc(id) {
    const r = this.db.prepare('SELECT id, data, rev, updated_at FROM documents WHERE id=?').get(id);
    return r ? { id: r.id, rev: r.rev, updated_at: r.updated_at, data: JSON.parse(r.data) } : null;
  }

  listDocs() {
    return this.db.prepare('SELECT id, rev, updated_at, length(data) AS size FROM documents ORDER BY id').all();
  }

  /**
   * Écrit un document si baseRev correspond à la révision courante (verrou optimiste).
   * @returns {{ok:true, rev:number, updated_at:string} | {ok:false, rev:number, updated_at:string}}
   */
  putDoc(id, data, baseRev, reason = 'auto') {
    const json = JSON.stringify(data);
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const cur = this.db.prepare('SELECT rev, updated_at FROM documents WHERE id=?').get(id);
      const curRev = cur ? cur.rev : 0;
      if (baseRev !== undefined && baseRev !== null && baseRev !== curRev) {
        this.db.exec('ROLLBACK');
        return { ok: false, rev: curRev, updated_at: cur ? cur.updated_at : null };
      }
      const rev = curRev + 1;
      if (cur) this.db.prepare('UPDATE documents SET data=?, rev=?, updated_at=? WHERE id=?').run(json, rev, now, id);
      else this.db.prepare('INSERT INTO documents(id, data, rev, updated_at) VALUES (?,?,?,?)').run(id, json, rev, now);

      const last = this.db.prepare('SELECT created_at FROM revisions WHERE doc=? ORDER BY rev DESC LIMIT 1').get(id);
      const due = !last || reason !== 'auto' || (Date.parse(now) - Date.parse(last.created_at)) / 1000 >= this.revisionInterval;
      if (due) {
        this.db.prepare('INSERT INTO revisions(doc, rev, data, size, reason, created_at) VALUES (?,?,?,?,?,?)')
          .run(id, rev, json, json.length, reason, now);
        this.db.prepare(`DELETE FROM revisions WHERE doc=? AND rev NOT IN
          (SELECT rev FROM revisions WHERE doc=? ORDER BY rev DESC LIMIT ?)`).run(id, id, this.keepRevisions);
      }
      this.db.exec('COMMIT');
      return { ok: true, rev, updated_at: now };
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw e;
    }
  }

  listRevisions(id, limit = 100) {
    return this.db.prepare('SELECT rev, size, reason, created_at FROM revisions WHERE doc=? ORDER BY rev DESC LIMIT ?')
      .all(id, limit);
  }

  getRevision(id, rev) {
    const r = this.db.prepare('SELECT rev, data, created_at FROM revisions WHERE doc=? AND rev=?').get(id, rev);
    return r ? { rev: r.rev, created_at: r.created_at, data: JSON.parse(r.data) } : null;
  }

  /** Restaure une révision en l'écrivant comme nouvelle version (rien n'est effacé). */
  restore(id, rev) {
    const r = this.getRevision(id, rev);
    if (!r) return null;
    const cur = this.getDoc(id);
    // On fige d'abord l'état courant pour pouvoir revenir en arrière.
    if (cur) this.snapshotRevision(id, cur, 'avant-restauration');
    return this.putDoc(id, r.data, cur ? cur.rev : 0, 'restauration-' + rev);
  }

  snapshotRevision(id, cur, reason) {
    const json = JSON.stringify(cur.data);
    this.db.prepare(`INSERT OR REPLACE INTO revisions(doc, rev, data, size, reason, created_at) VALUES (?,?,?,?,?,?)`)
      .run(id, cur.rev, json, json.length, reason, new Date().toISOString());
  }

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

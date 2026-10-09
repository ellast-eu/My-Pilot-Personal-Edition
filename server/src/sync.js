// Synchronisation fiche par fiche entre un appareil et le serveur distant (« hub »).
//
// Un échange = l'appareil envoie ses fiches modifiées depuis le dernier envoi, le hub les
// applique (la plus récente gagne, fiche par fiche), puis renvoie les fiches modifiées
// ailleurs depuis le dernier passage de cet appareil. Le même serveur joue les deux rôles :
// hub quand on l'interroge, appareil quand une adresse de hub est configurée.

import { estEspace } from './db.js';

const BATCH = 500;
// Les espaces partagés (documents « s-… ») ne passent jamais par la synchronisation privée :
// ils ont leur propre canal chiffré vers leur hôte (espaces.js).
const prives = list => (Array.isArray(list) ? list : []).filter(ch => ch && !estEspace(ch.doc));

/** Côté hub : traite un échange (POST /api/sync). */
export function hubExchange(store, body) {
  const device = String(body.device || '').slice(0, 64);
  if (!device) throw Object.assign(new Error('Identifiant d\'appareil manquant'), { code: 'bad_request' });
  const since = Math.max(0, +body.since || 0);
  const incoming = prives(Array.isArray(body.changes) ? body.changes.slice(0, 5000) : []);
  const applied = incoming.length ? store.applyRemote(incoming, { source: 'appareil ' + device }) : { applied: 0 };
  const limit = Math.min(Math.max(+body.limit || BATCH, 1), 2000);
  const out = store.changesSince(since, { excludeOrigin: device, limit, sansEspaces: true });
  const more = out.length === limit;
  const cursor = more ? out[out.length - 1].seq : store.maxSeq();
  return { hub: store.deviceId, applied: applied.applied, changes: out.map(({ seq, ...c }) => c), cursor, more };
}

/** Côté appareil : moteur de synchronisation vers le hub configuré. */
export class SyncEngine {
  constructor(store, { interval = 30000, log = () => {} } = {}) {
    this.store = store;
    this.interval = interval;
    this.log = log;
    this.running = null;
    this.again = false;
    this.timer = null;
    this.debounce = null;
    this.lastResult = null;
    this.off = store.on(ev => {
      if (ev.type !== 'local-change' || !this.config().enabled) return;
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => this.run('modification'), 2500);
      this.debounce.unref?.();
    });
  }

  config() {
    const s = this.store;
    return {
      url: (s.getMeta('sync_url') || '').replace(/\/+$/, ''),
      token: s.getMeta('sync_token') || '',
      enabled: s.getMeta('sync_enabled') === '1',
    };
  }

  setConfig({ url, token, enabled }) {
    const s = this.store;
    if (url !== undefined) {
      const u = String(url || '').trim().replace(/\/+$/, '');
      if (u && !/^https?:\/\/[^\s]+$/i.test(u)) throw Object.assign(new Error('Adresse invalide : elle doit commencer par https://'), { code: 'bad_request' });
      s.setMeta('sync_url', u || null);
    }
    if (token !== undefined && token !== null) s.setMeta('sync_token', String(token) || null);
    if (enabled !== undefined) s.setMeta('sync_enabled', enabled ? '1' : '0');
    this.schedule();
    return this.status();
  }

  status() {
    const c = this.config(), st = c.url ? this.store.getSyncState(c.url) : null;
    return {
      device: this.store.deviceId,
      configured: !!c.url, url: c.url, hasToken: !!c.token, enabled: c.enabled,
      running: !!this.running,
      lastOk: st && st.last_ok, lastError: st && st.last_error,
      pending: c.url ? this.store.pendingCount(c.url) : 0,
      conflicts: this.store.unseenConflicts(),
      lastResult: this.lastResult,
    };
  }

  start() { this.schedule(); return this; }
  schedule() {
    clearInterval(this.timer);
    if (!this.config().enabled || !this.config().url) return;
    this.timer = setInterval(() => this.run('périodique'), this.interval);
    this.timer.unref?.();
    setTimeout(() => this.run('démarrage'), 500).unref?.();
  }
  stop() { clearInterval(this.timer); clearTimeout(this.debounce); this.off(); }

  /** Lance un échange (ou le reprogramme si un échange est en cours). */
  run(reason = 'manuel') {
    if (this.running) { this.again = true; return this.running; }
    this.running = this.exchange(reason)
      .catch(e => ({ ok: false, error: e.message }))
      .finally(() => {
        this.running = null;
        if (this.again) { this.again = false; setTimeout(() => this.run('relance'), 200).unref?.(); }
      });
    return this.running;
  }

  async exchange(reason) {
    const { url, token, enabled } = this.config();
    if (!url) return { ok: false, error: 'Aucun serveur de synchronisation configuré' };
    if (!enabled && reason !== 'manuel' && reason !== 'test') return { ok: false, error: 'Synchronisation désactivée' };
    const store = this.store;
    let sent = 0, received = 0, conflicts = 0;
    try {
      for (let round = 0; round < 200; round++) {
        const st = store.getSyncState(url);
        const changes = store.changesSince(st.pushed_seq, { origin: store.deviceId, limit: BATCH, sansEspaces: true });
        const res = await fetch(url + '/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({ device: store.deviceId, since: st.pulled_cursor, changes: changes.map(({ seq, ...c }) => c) }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.status === 401 || res.status === 403) throw new Error('Jeton refusé par le serveur de synchronisation');
        if (!res.ok) {
          let msg = ''; try { msg = (await res.json()).message || ''; } catch {}
          throw new Error(msg || 'Le serveur de synchronisation a répondu ' + res.status);
        }
        const body = await res.json();
        const pushed = changes.length ? changes[changes.length - 1].seq : st.pushed_seq;
        // une fiche envoyée dans cet échange puis remplacée par une version plus récente a « perdu » : on la journalise
        const r = store.applyRemote(prives(body.changes), { pendingAfter: st.pushed_seq, source: 'synchronisation' });
        store.setSyncState(url, { pushed_seq: pushed, pulled_cursor: +body.cursor || st.pulled_cursor });
        sent += changes.length; received += r.applied; conflicts += r.conflicts;
        if (changes.length < BATCH && !body.more) break;
      }
      const now = new Date().toISOString();
      store.setSyncState(url, { last_ok: now, last_error: null });
      this.lastResult = { ok: true, at: now, sent, received, conflicts, reason };
      if (sent || received) this.log(`Synchronisation (${reason}) : ${sent} envoyée(s), ${received} reçue(s)`);
      return this.lastResult;
    } catch (e) {
      const msg = e.name === 'TimeoutError' ? 'Le serveur de synchronisation ne répond pas'
        : e.cause?.code === 'ECONNREFUSED' || e.cause?.code === 'ENOTFOUND' || /fetch failed/.test(e.message) ? 'Serveur de synchronisation injoignable'
        : e.message;
      store.setSyncState(url, { last_error: msg });
      this.lastResult = { ok: false, at: new Date().toISOString(), error: msg, reason };
      return this.lastResult;
    }
  }
}

// Réglages modifiables depuis l'application (onglet Données → Réglages).
//
// Valeur effective = valeur saisie dans l'application (table meta, propre à cette machine,
// jamais synchronisée) ?? valeur de départ (.env ou options) ?? valeur par défaut.
// Les secrets ne sont jamais renvoyés à la page : seulement « renseigné » ou non.

export const SETTINGS = [
  { key: 'app_user', env: 'APP_USER', label: 'Identifiant de connexion', group: 'Accès à l\'interface web', type: 'text', def: 'pilot', scope: 'serveur' },
  { key: 'app_password', env: 'APP_PASSWORD', label: 'Mot de passe', group: 'Accès à l\'interface web', type: 'secret', def: '', scope: 'serveur' },
  { key: 'sync_token', env: 'SYNC_TOKEN', label: 'Jeton de synchronisation des applications', group: 'Synchronisation', type: 'secret', def: '', scope: 'serveur' },
  { key: 'ft_client_id', env: 'FRANCETRAVAIL_CLIENT_ID', label: 'Identifiant client France Travail (francetravail.io)', group: 'Veilles : offres France Travail', type: 'text', def: '', scope: 'tous' },
  { key: 'ft_client_secret', env: 'FRANCETRAVAIL_CLIENT_SECRET', label: 'Clé secrète France Travail', group: 'Veilles : offres France Travail', type: 'secret', def: '', scope: 'tous' },
  { key: 'claude_token', env: 'CLAUDE_CODE_OAUTH_TOKEN', label: 'Jeton Claude Code (claude setup-token)', group: 'Claude Code', type: 'secret', def: '', scope: 'tous' },
  { key: 'revision_interval', env: 'REVISION_INTERVAL', label: 'Écart minimal entre deux versions (secondes)', group: 'Sauvegardes', type: 'int', def: 300, min: 30, max: 86400, scope: 'tous' },
  { key: 'keep_revisions', env: 'KEEP_REVISIONS', label: 'Versions gardées par document', group: 'Sauvegardes', type: 'int', def: 300, min: 10, max: 5000, scope: 'tous' },
  { key: 'snapshot_hours', env: 'SNAPSHOT_HOURS', label: 'Instantané automatique toutes les (heures, 0 = jamais)', group: 'Sauvegardes', type: 'int', def: 24, min: 0, max: 720, scope: 'tous' },
  { key: 'keep_snapshots', env: 'KEEP_SNAPSHOTS', label: 'Instantanés gardés', group: 'Sauvegardes', type: 'int', def: 30, min: 1, max: 1000, scope: 'tous' },
];

const BY_KEY = Object.fromEntries(SETTINGS.map(s => [s.key, s]));
const metaKey = k => 'cfg_' + k;

export class Settings {
  /**
   * @param {import('./db.js').Store} store
   * @param {{mode:string, base:Record<string, any>}} opts  base : valeurs de départ (.env ou options)
   */
  constructor(store, { mode = 'serveur', base = {} } = {}) {
    this.store = store;
    this.mode = mode;
    this.base = base;
    this.listeners = new Set();
  }

  available(s) { return s.scope === 'tous' || this.mode !== 'application'; }

  baseValue(s) {
    const v = this.base[s.key];
    return v === undefined || v === null || v === '' ? undefined : v;
  }

  get(key) {
    const s = BY_KEY[key];
    const saved = this.store.getMeta(metaKey(key));
    let v = saved !== null ? saved : this.baseValue(s);
    if (v === undefined) v = s.def;
    return s.type === 'int' ? clampInt(v, s) : String(v ?? '');
  }

  source(key) {
    const s = BY_KEY[key];
    if (this.store.getMeta(metaKey(key)) !== null) return 'application';
    return this.baseValue(s) !== undefined ? '.env' : 'défaut';
  }

  /** Vue pour la page : pas de secrets en clair. */
  describe() {
    return SETTINGS.filter(s => this.available(s)).map(s => {
      const v = this.get(s.key);
      return {
        key: s.key, label: s.label, group: s.group, type: s.type, env: s.env,
        min: s.min, max: s.max, def: s.def,
        source: this.source(s.key),
        ...(s.type === 'secret' ? { set: v !== '' } : { value: v }),
        envSet: this.baseValue(s) !== undefined,
      };
    });
  }

  /**
   * Applique des changements : valeur → enregistrée ; null → retour à la valeur du .env.
   * Pour un secret, '' l'efface (même s'il est défini dans .env).
   */
  update(changes) {
    const done = [];
    for (const [key, raw] of Object.entries(changes || {})) {
      const s = BY_KEY[key];
      if (!s || !this.available(s)) throw Object.assign(new Error('Réglage inconnu : ' + key), { code: 'bad_request' });
      if (raw === null) { this.store.setMeta(metaKey(key), null); done.push(key); continue; }
      let v;
      if (s.type === 'int') {
        const n = Number(raw);
        if (!Number.isFinite(n) || Math.round(n) !== n) throw Object.assign(new Error(`${s.label} : nombre entier attendu`), { code: 'bad_request' });
        if (n < s.min || n > s.max) throw Object.assign(new Error(`${s.label} : entre ${s.min} et ${s.max}`), { code: 'bad_request' });
        v = String(n);
      } else {
        v = String(raw);
        if (v.length > 4096) throw Object.assign(new Error(`${s.label} : valeur trop longue`), { code: 'bad_request' });
        if (key === 'app_user' && !/^[^:\s]{1,64}$/.test(v)) throw Object.assign(new Error('Identifiant : sans espace ni deux-points'), { code: 'bad_request' });
        if (key === 'app_password' && v !== '' && v.length < 8) throw Object.assign(new Error('Mot de passe : 8 caractères au moins'), { code: 'bad_request' });
        if (key === 'sync_token' && v !== '' && v.length < 16) throw Object.assign(new Error('Jeton de synchronisation : 16 caractères au moins'), { code: 'bad_request' });
      }
      this.store.setMeta(metaKey(key), v);
      done.push(key);
    }
    if (done.length) for (const fn of this.listeners) { try { fn(done); } catch {} }
    return done;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

function clampInt(v, s) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return s.def;
  return Math.min(Math.max(n, s.min), s.max);
}

/** Valeurs de départ lues dans l'environnement (fichier .env via Docker Compose). */
export function baseFromEnv(env = process.env) {
  const b = {};
  for (const s of SETTINGS) if (env[s.env] !== undefined) b[s.key] = env[s.env];
  return b;
}

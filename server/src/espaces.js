// Rôle « appareil » des espaces partagés : identité, espaces rejoints, invitations, et
// synchronisation chiffrée de bout en bout avec l'hôte de chaque espace.
//
// Les fiches d'un espace vivent en clair dans la base locale (document « s-<id> »), comme le
// reste des données de l'appareil ; elles ne partent vers l'hôte que chiffrées.
import os from 'node:os';
import { PREFIXE_ESPACE } from './db.js';
import {
  nouvelleIdentite, empreinte, empreinteComplete, envelopper, desenvelopper, nouvelleCle,
  sceller, ouvrir, preuve, aleatoire, hacher, b64url,
} from './chiffre.js';

const BATCH = 500;
const nowIso = () => new Date().toISOString();
const err = (code, message) => Object.assign(new Error(message), { code });
const contexteCle = (space, epoch, member) => `${space}|${epoch}|${member}`;
const messagePreuve = (space, invite, pub) => `mppe-rejoindre|${space}|${invite}|${pub}`;

export class Espaces {
  /**
   * @param {import('./db.js').Store} store
   * @param {{configPrivee:()=>{url:string, token:string}, log?:Function, interval?:number}} opts
   */
  constructor(store, { configPrivee, log = () => {}, interval = 30000 } = {}) {
    this.store = store;
    this.db = store.db;
    this.configPrivee = configPrivee || (() => ({ url: '', token: '' }));
    this.log = log;
    this.interval = interval;
    this.running = null;
    this.again = false;
    this.timer = null;
    this.debounce = null;
    this.off = store.on(ev => {
      if (ev.type !== 'local-change' || !String(ev.doc || '').startsWith(PREFIXE_ESPACE)) return;
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => this.run('modification'), 2000);
      this.debounce.unref?.();
    });
  }

  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (this.liste().length) this.run('périodique'); }, this.interval);
    this.timer.unref?.();
    return this;
  }
  stop() { clearInterval(this.timer); clearTimeout(this.debounce); this.off(); }

  /* ---------- identité de l'appareil ---------- */
  identite() {
    let pub = this.store.getMeta('id_pub'), priv = this.store.getMeta('id_priv');
    if (!pub || !priv) {
      const k = nouvelleIdentite();
      this.store.setMeta('id_priv', k.priv); this.store.setMeta('id_pub', k.pub);
      pub = k.pub; priv = k.priv;
    }
    return { pub, priv, empreinte: empreinte(pub), nom: this.store.getMeta('id_nom') || '', couleur: this.store.getMeta('id_couleur') || '' };
  }
  setIdentite({ nom, couleur }) {
    if (nom !== undefined) {
      const n = String(nom || '').trim().slice(0, 60);
      if (!n) throw err('bad_request', 'Nom affiché obligatoire');
      this.store.setMeta('id_nom', n);
    }
    if (couleur !== undefined) {
      if (couleur && !/^#[0-9a-fA-F]{6}$/.test(couleur)) throw err('bad_request', 'Couleur attendue au format #RRGGBB');
      this.store.setMeta('id_couleur', couleur || null);
    }
    for (const sp of this.liste()) if (sp.status === 'actif') this.ecrireCarte(sp);
    return this.status();
  }

  /* ---------- espaces rejoints (table locale, jamais synchronisée) ---------- */
  liste() { return this.db.prepare('SELECT * FROM my_spaces ORDER BY joined_at').all().map(lire); }
  get(id) { const r = this.db.prepare('SELECT * FROM my_spaces WHERE id=?').get(id); return r ? lire(r) : null; }
  maj(id, patch) {
    const cur = this.get(id); if (!cur) return null;
    const s = { ...cur, ...patch };
    this.db.prepare(`UPDATE my_spaces SET name=?, role=?, status=?, owner_pub=?, keys=?, epoch=?, invites=?, members=?, last_ok=?, last_error=? WHERE id=?`)
      .run(s.name, s.role, s.status, s.owner_pub, JSON.stringify(s.keys), s.epoch, JSON.stringify(s.invites), JSON.stringify(s.members), s.last_ok, s.last_error, id);
    return s;
  }

  async appel(host, chemin, { method = 'GET', body, token } = {}) {
    let res;
    try {
      res = await fetch(host + '/api/spaces' + chemin, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      throw err('unreachable', e.name === 'TimeoutError' ? 'L\'hôte de l\'espace ne répond pas' : 'Hôte de l\'espace injoignable');
    }
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok) {
      const m = (data && data.message) || ('L\'hôte a répondu ' + res.status);
      throw Object.assign(new Error(res.status === 401 ? 'Accès refusé par l\'hôte (membre retiré ?)' : res.status === 429 ? 'Trop de tentatives : réessayez plus tard' : m),
        { code: (data && data.error) || 'http_' + res.status, status: res.status });
    }
    return data;
  }

  /* ---------- créer, inviter, rejoindre ---------- */
  async creer(nom) {
    const n = String(nom || '').trim().slice(0, 80);
    if (!n) throw err('bad_request', 'Nom de l\'espace obligatoire');
    const id = this.identite();
    if (!id.nom) throw err('bad_request', 'Choisissez d\'abord votre nom affiché');
    const { url, token } = this.configPrivee();
    if (!url || !token) throw err('bad_request', 'Configurez d\'abord la synchronisation avec votre serveur : il hébergera l\'espace');
    const r = await this.appel(url, '', { method: 'POST', body: { pub: id.pub }, token });
    this.db.prepare(`INSERT INTO my_spaces(id, host, name, member, token, role, status, owner_pub, keys, epoch, joined_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(r.space, url, n, r.member, r.token, 'proprietaire', 'actif',
      empreinteComplete(id.pub), JSON.stringify({ 1: nouvelleCle() }), 1, nowIso());
    const sp = this.get(r.space);
    this.ecrireCarte(sp);
    this.store.putRecord(PREFIXE_ESPACE + sp.id, 'members', '_espace', { id: '_espace', nom: n });
    this.run('création');
    return this.vue(sp);
  }

  async inviter(spaceId, { role = 'membre', jours = 7 } = {}) {
    const sp = this.exiger(spaceId);
    if (sp.role !== 'proprietaire') throw err('forbidden', 'Seuls les appareils propriétaires peuvent inviter');
    const r = await this.appel(sp.host, '/' + sp.id + '/invites', { method: 'POST', body: { role, jours }, token: sp.token });
    const secret = aleatoire(18);
    const id = this.identite();
    sp.invites = [...sp.invites.filter(i => i.expires_at > nowIso()),
      { hash: hacher(r.invite), invite: r.invite, secret, role, created_at: nowIso(), expires_at: r.expires_at }];
    this.maj(sp.id, { invites: sp.invites });
    const lien = `${sp.host}/rejoindre/#v1.${sp.id}.${r.invite}.${secret}.${empreinteComplete(id.pub)}.${b64url(Buffer.from(sp.name, 'utf8'))}`;
    return { lien, role, expires_at: r.expires_at };
  }

  analyserLien(lien) {
    const m = /^(https?:\/\/[^#\s]+?)\/rejoindre\/?#v1\.([a-f0-9]{16})\.([A-Za-z0-9_-]{10,60})\.([A-Za-z0-9_-]{10,60})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]*)$/.exec(String(lien || '').trim());
    if (!m) throw err('bad_request', 'Lien d\'invitation illisible : copiez-le en entier');
    let nom = '';
    try { nom = Buffer.from(m[6], 'base64url').toString('utf8').slice(0, 80); } catch {}
    return { host: m[1].replace(/\/+$/, ''), space: m[2], invite: m[3], secret: m[4], fp: m[5], nom: nom || 'Espace partagé' };
  }

  async rejoindre(lien) {
    const l = this.analyserLien(lien);
    if (this.get(l.space)) throw err('bad_request', 'Cet appareil fait déjà partie de cet espace');
    const id = this.identite();
    if (!id.nom) throw err('bad_request', 'Choisissez d\'abord votre nom affiché');
    const r = await this.appel(l.host, '/' + l.space + '/join', {
      method: 'POST', body: { invite: l.invite, pub: id.pub, proof: preuve(l.secret, messagePreuve(l.space, l.invite, id.pub)) },
    });
    this.db.prepare(`INSERT INTO my_spaces(id, host, name, member, token, role, status, owner_pub, joined_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(l.space, l.host, l.nom, r.member, r.token, r.role, r.status, l.fp, nowIso());
    await this.run('arrivée');
    return this.vue(this.get(l.space));
  }

  async retirer(spaceId, membre) {
    const sp = this.exiger(spaceId);
    await this.appel(sp.host, '/' + sp.id + '/members/' + encodeURIComponent(membre) + '/revoke', { method: 'POST', body: {}, token: sp.token });
    await this.run('retrait');
    return this.vue(this.get(sp.id));
  }

  /** Quitter : se retire de l'hôte puis efface la copie locale de l'espace. */
  async quitter(spaceId, { forcer = false } = {}) {
    const sp = this.exiger(spaceId);
    try { await this.appel(sp.host, '/' + sp.id + '/members/' + sp.member + '/revoke', { method: 'POST', body: {}, token: sp.token }); }
    catch (e) { if (e.code === 'last_owner' || (!forcer && e.status !== 401)) throw e; }
    this.store.dropDoc(PREFIXE_ESPACE + sp.id);
    this.db.prepare('DELETE FROM sync_state WHERE remote=?').run(this.remote(sp));
    this.db.prepare('DELETE FROM my_spaces WHERE id=?').run(sp.id);
    this.db.prepare('DELETE FROM inbox WHERE space=?').run(sp.id);
    return { ok: true };
  }

  exiger(id) { const sp = this.get(id); if (!sp) throw err('not_found', 'Espace inconnu sur cet appareil'); return sp; }
  remote(sp) { return sp.host + '#' + sp.id; }

  /* ---------- cycle de synchronisation ---------- */
  run(reason = 'manuel') {
    if (this.running) { this.again = true; return this.running; }
    this.running = this.cycle(reason).catch(e => this.log('Espaces : ' + e.message)).finally(() => {
      this.running = null;
      if (this.again) { this.again = false; setTimeout(() => this.run('relance'), 200).unref?.(); }
    });
    return this.running;
  }

  async cycle(reason) {
    for (const sp0 of this.liste()) {
      let sp = sp0;
      try {
        if (sp.status !== 'actif') sp = await this.recupererCle(sp);
        if (sp.status === 'actif') {
          sp = await this.rafraichirMembres(sp);
          if (sp.status === 'actif') await this.synchroniser(sp);
        }
        this.maj(sp.id, { last_ok: nowIso(), last_error: sp.alerte || null });
      } catch (e) {
        if (e.status === 401) this.maj(sp.id, { status: 'retire', last_error: 'Cet appareil a été retiré de l\'espace' });
        else this.maj(sp.id, { last_error: e.message });
        this.log(`Espace ${sp.name} (${reason}) : ${e.message}`);
      }
    }
  }

  /** Membre en attente : récupère et vérifie la clé remise par un appareil propriétaire. */
  async recupererCle(sp) {
    const cles = await this.appel(sp.host, '/' + sp.id + '/key', { token: sp.token }).catch(e => {
      if (e.code === 'pending') return [];
      throw e;
    });
    const id = this.identite();
    const keys = { ...sp.keys };
    let epoch = sp.epoch;
    for (const k of cles) {
      if (keys[k.epoch]) continue;
      // la première clé doit venir de l'appareil dont le lien donnait l'empreinte : sinon l'hôte a pu s'interposer
      if (!k.fromPub || empreinteComplete(k.fromPub) !== sp.owner_pub) {
        return this.maj(sp.id, { last_error: 'Clé reçue d\'un appareil inconnu : refusée (vérifiez le lien avec la personne qui vous a invitée)' });
      }
      try {
        keys[k.epoch] = desenvelopper({ priv: id.priv, pubSource: k.fromPub, env: k, contexte: contexteCle(sp.id, k.epoch, sp.member) });
        epoch = Math.max(epoch, k.epoch);
      } catch {
        return this.maj(sp.id, { last_error: 'Clé reçue illisible ou altérée : refusée' });
      }
    }
    if (!Object.keys(keys).length) return this.maj(sp.id, { status: 'en_attente' });
    const s = this.maj(sp.id, { keys, epoch, status: 'actif', last_error: null });
    this.ecrireCarte(s);
    return s;
  }

  /** Liste des membres ; un propriétaire remet aussi la clé aux arrivants dont la preuve est valide. */
  async rafraichirMembres(sp) {
    const membres = await this.appel(sp.host, '/' + sp.id + '/members', { token: sp.token });
    let alerte = null;
    if (sp.role === 'proprietaire') {
      const id = this.identite();
      let invites = sp.invites;
      for (const m of membres.filter(x => x.status === 'en_attente')) {
        const inv = invites.find(i => i.hash === m.invite);
        if (!inv) continue;                                   // invitation créée depuis un autre appareil
        const attendu = preuve(inv.secret, messagePreuve(sp.id, inv.invite, m.pub));
        if (attendu !== m.proof) { alerte = 'Une arrivée ne correspond pas au lien envoyé : clé non remise'; continue; }
        const wrap = envelopper({ priv: id.priv, pubDest: m.pub, cle: sp.keys[sp.epoch], contexte: contexteCle(sp.id, sp.epoch, m.member) });
        await this.appel(sp.host, '/' + sp.id + '/members/' + m.member + '/approve', { method: 'POST', body: { epoch: sp.epoch, wrap }, token: sp.token });
        m.status = 'actif';
        invites = invites.filter(i => i !== inv);
      }
      invites = invites.filter(i => i.expires_at > nowIso());
      sp = this.maj(sp.id, { invites });
    }
    const moi = membres.find(m => m.member === sp.member);
    const s = this.maj(sp.id, {
      members: membres.map(m => ({ member: m.member, role: m.role, status: m.status, empreinte: empreinte(m.pub), joined_at: m.joined_at, revoked_at: m.revoked_at })),
      ...(moi && moi.role !== sp.role ? { role: moi.role } : {}),
    });
    s.alerte = alerte;
    return s;
  }

  /** Échange de fiches : on envoie les nôtres chiffrées, on reçoit et déchiffre celles des autres. */
  async synchroniser(sp) {
    const store = this.store, doc = PREFIXE_ESPACE + sp.id, remote = this.remote(sp);
    const premier = store.getSyncState(remote).pulled_cursor === 0;   // arrivée : pas de notification pour l'existant
    let rejetees = 0;
    for (let round = 0; round < 200; round++) {
      const st = store.getSyncState(remote);
      const changes = store.changesSince(st.pushed_seq, { origin: store.deviceId, doc, limit: BATCH });
      const scellees = changes.map(c => ({
        doc, coll: c.coll, id: c.id, hlc: c.hlc,
        data: c.data === null ? null : sceller(sp.keys[sp.epoch], sp.epoch, { doc, coll: c.coll, id: c.id, hlc: c.hlc }, c.data),
      }));
      const body = await this.appel(sp.host, '/' + sp.id + '/sync', { method: 'POST', token: sp.token, body: { since: st.pulled_cursor, changes: scellees } });
      const claires = [];
      for (const c of body.changes || []) {
        if (c.doc !== doc) continue;
        try {
          claires.push({ doc, coll: c.coll, id: c.id, hlc: c.hlc, origin: c.origin,
            data: c.data === null ? null : ouvrir(sp.keys, { doc, coll: c.coll, id: c.id, hlc: c.hlc }, c.data) });
        } catch { rejetees++; }
      }
      if (!premier) this.noterRecues(sp, claires);
      store.applyRemote(claires, { pendingAfter: st.pushed_seq, source: 'espace ' + sp.name });
      store.setSyncState(remote, { pushed_seq: changes.length ? changes[changes.length - 1].seq : st.pushed_seq, pulled_cursor: +body.cursor || st.pulled_cursor });
      if (changes.length < BATCH && !body.more) break;
    }
    if (rejetees) sp.alerte = `${rejetees} fiche(s) reçue(s) illisible(s) ou altérée(s) : ignorée(s)`;
  }

  /* ---------- boîte « Reçues » ---------- */
  /** Avant d'appliquer des fiches reçues : ce qu'un autre membre a partagé, modifié, cristallisé ou retiré. */
  noterRecues(sp, fiches) {
    const doc = PREFIXE_ESPACE + sp.id, at = nowIso();
    const ins = this.db.prepare('INSERT INTO inbox(space, coll, rid, kind, author, titre, at) VALUES (?,?,?,?,?,?,?)');
    const memeContenu = (a, b) => JSON.stringify(withoutStamps(a)) === JSON.stringify(withoutStamps(b));
    const lot = new Map(fiches.filter(c => c.coll === 'chantiers' && c.data).map(c => [c.id, c.data]));
    const activite = id => (id && (lot.get(id) || this.store.getRecord(doc, 'chantiers', id))) || null;
    // activité qui arrive dans ce lot : ses notes et tâches ne sont pas signalées une par une
    const nouvelles = new Set(fiches.filter(c => c.coll === 'chantiers' && c.data && !this.store.getRecord(doc, 'chantiers', c.id)).map(c => c.id));
    const court = (t, n = 80) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
    for (const c of fiches) {
      const avant = this.store.getRecord(doc, c.coll, c.id), apres = c.data;
      let kind, titre;
      if (c.coll === 'ideas' || c.coll === 'unified') {
        if (!apres) { if (!avant) continue; kind = 'retire'; }
        else if (!avant) kind = c.coll === 'unified' ? 'cristallise' : 'partage';
        else if (c.coll === 'ideas' && apres.status === 'absorbee') continue;          // signalé par la cristallisation
        else if (c.coll === 'unified' && apres.status === 'projet' && avant.status !== 'projet') kind = 'activite';
        else if (memeContenu(avant, apres)) continue;
        else kind = 'modifie';
        titre = (apres && (apres.title || apres.titre)) || (avant && (avant.title || avant.titre)) || 'Sans titre';
      } else if (c.coll === 'chantiers') {
        if (!apres) { if (!avant) continue; kind = 'activite_retiree'; }
        else if (!avant) kind = 'activite_partagee';
        else if (memeContenu(avant, apres)) continue;
        else kind = 'activite_modifiee';
        titre = (apres && apres.libelle) || (avant && avant.libelle) || 'Activité';
      } else if (c.coll === 'notes') {
        if (!apres) continue;
        const s1 = apres.suite && apres.suite.texte ? apres.suite : null, s0 = avant && avant.suite && avant.suite.texte ? avant.suite : null;
        if (s1 && s1.pour === sp.member && (!s0 || s0.pour !== sp.member)) kind = 'tache_pour_vous';
        else if (!avant) { if (nouvelles.has(apres.chantier_id)) continue; kind = s1 ? 'tache' : 'note'; }
        else if (s1 && s1.fait && !(s0 && s0.fait)) kind = 'tache_faite';
        else continue;                                                                 // simple retouche d'une note : pas de bruit
        const a = activite(apres.chantier_id);
        titre = (a ? court(a.libelle, 50) + ' — ' : '') + court(s1 ? s1.texte : apres.contenu, 80);
      } else continue;
      titre = String(titre).slice(0, 200);
      const author = String((apres && apres.modifiePar) || c.origin || '').slice(0, 40);
      if (kind === 'modifie' || kind === 'activite_modifiee') {
        const deja = this.db.prepare('SELECT id FROM inbox WHERE space=? AND rid=? AND kind=? AND seen=0').get(sp.id, c.id, kind);
        if (deja) { this.db.prepare('UPDATE inbox SET at=?, author=?, titre=? WHERE id=?').run(at, author, titre, deja.id); continue; }
      }
      ins.run(sp.id, c.coll, c.id, kind, author, titre, at);
    }
    this.db.prepare('DELETE FROM inbox WHERE id NOT IN (SELECT id FROM inbox ORDER BY id DESC LIMIT 500)').run();
  }

  /** Entrées de la boîte, avec le nom de l'auteur ; ce qui vient de soi (même nom, autre appareil) est écarté. */
  recues({ limit = 100 } = {}) {
    const moi = this.identite().nom;
    const cartes = {}, noms = {};
    for (const sp of this.liste()) {
      noms[sp.id] = sp.name;
      const d = this.store.getDoc(PREFIXE_ESPACE + sp.id);
      for (const c of (d && d.data.members) || []) {
        if (!c || !c.id) continue;
        if (c.id === '_espace') noms[sp.id] = c.nom || sp.name; else cartes[sp.id + '|' + c.id] = c;
      }
    }
    const lignes = this.db.prepare('SELECT * FROM inbox ORDER BY id DESC LIMIT ?').all(Math.min(Math.max(+limit || 100, 1), 500))
      .filter(r => noms[r.space] !== undefined)
      .map(r => {
        const c = cartes[r.space + '|' + r.author] || {};
        return { id: r.id, espace: r.space, espaceNom: noms[r.space], coll: r.coll, rid: r.rid, kind: r.kind,
          auteur: c.nom || 'Un membre', couleur: c.couleur || '', titre: r.titre, at: r.at, vue: !!r.seen };
      })
      .filter(r => !moi || r.auteur !== moi);
    return { nonVues: lignes.filter(r => !r.vue).length, entrees: lignes };
  }
  marquerVues(ids) {
    if (Array.isArray(ids) && ids.length) {
      const st = this.db.prepare('UPDATE inbox SET seen=1 WHERE id=?');
      for (const id of ids.slice(0, 500)) st.run(+id);
    } else this.db.prepare('UPDATE inbox SET seen=1 WHERE seen=0').run();
    return this.recues();
  }
  notifications(v) {
    if (v !== undefined) this.store.setMeta('notif_systeme', v ? '1' : '0');
    return { systeme: this.store.getMeta('notif_systeme') !== '0' };
  }

  /** Carte de membre (nom, couleur, empreinte), chiffrée comme le reste de l'espace. */
  ecrireCarte(sp) {
    const id = this.identite();
    const carte = { id: sp.member, nom: id.nom || os.hostname(), couleur: id.couleur || '', empreinte: id.empreinte, appareil: os.hostname() };
    const doc = PREFIXE_ESPACE + sp.id;
    const cur = this.store.getRecord(doc, 'members', sp.member);
    if (!cur || JSON.stringify(cur) !== JSON.stringify(carte)) this.store.putRecord(doc, 'members', sp.member, carte);
  }

  /* ---------- état pour la page ---------- */
  vue(sp) {
    const doc = this.store.getDoc(PREFIXE_ESPACE + sp.id);
    const cartes = Object.fromEntries(((doc && doc.data.members) || []).filter(c => c && c.id).map(c => [c.id, c]));
    const meta = (doc && doc.data.members || []).find(c => c && c.id === '_espace');
    return {
      id: sp.id, nom: (meta && meta.nom) || sp.name, host: sp.host, role: sp.role, status: sp.status, member: sp.member, epoch: sp.epoch,
      invitations: sp.invites.filter(i => i.expires_at > nowIso()).length,
      membres: (sp.members.length ? sp.members : [{ member: sp.member, role: sp.role, status: sp.status }]).map(m => ({
        ...m, moi: m.member === sp.member,
        nom: cartes[m.member] ? cartes[m.member].nom : (m.member === sp.member ? this.identite().nom : ''),
        couleur: cartes[m.member] ? cartes[m.member].couleur : '',
        appareil: cartes[m.member] ? cartes[m.member].appareil : '',
        empreinte: m.empreinte || (cartes[m.member] && cartes[m.member].empreinte) || '',
      })),
      fiches: doc ? Object.entries(doc.data).filter(([k, v]) => Array.isArray(v) && k !== 'members').reduce((n, [, v]) => n + v.length, 0) : 0,
      pending: this.store.pendingCount(this.remote(sp), PREFIXE_ESPACE + sp.id),
      last_ok: sp.last_ok, last_error: sp.last_error,
    };
  }

  status() {
    const id = this.identite();
    return { identite: { nom: id.nom, couleur: id.couleur, empreinte: id.empreinte }, running: !!this.running,
      notifications: this.notifications(), espaces: this.liste().map(sp => this.vue(sp)) };
  }
}

function withoutStamps(o) {
  if (!o || typeof o !== 'object') return o;
  const { modifiePar, modifieLe, ...rest } = o;
  return rest;
}

function lire(r) {
  return { ...r, keys: JSON.parse(r.keys || '{}'), invites: JSON.parse(r.invites || '[]'), members: JSON.parse(r.members || '[]') };
}

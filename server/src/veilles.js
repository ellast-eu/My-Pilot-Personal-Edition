// Veilles : des flux RSS/Atom collectés à intervalle régulier, filtrés, dédoublonnés, et rangés en
// fiches dans l'onglet Veilles. Configuration et fiches vivent dans le document « veilles »
// (synchronisé comme le reste) ; chaque veille est exécutée par l'appareil qu'on lui a choisi :
// le serveur, ou une application de bureau donnée.
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import os from 'node:os';

export const DOC_VEILLES = 'veilles';
const MAX_OCTETS = 3 * 1024 * 1024;
const DELAI = 15000;
const FICHES_GARDEES = 100;          // par veille
const nowIso = () => new Date().toISOString();
const err = (code, message) => Object.assign(new Error(message), { code });

/* ---------- récupération protégée d'un flux ---------- */

/** Adresse du réseau local, de la machine elle-même, ou réservée : refusée (sauf réglage contraire). */
export function adressePrivee(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x.startsWith('::ffff:')) return adressePrivee(x.slice(7));
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80');
}

export async function telecharger(url, { reseauLocal = false, agent = 'MyPilotPersonalEdition (veille RSS)' } = {}) {
  let u;
  for (let saut = 0; saut < 4; saut++) {
    try { u = new URL(url); } catch { throw err('bad_url', 'Adresse invalide'); }
    if (!/^https?:$/.test(u.protocol)) throw err('bad_url', 'Seules les adresses http(s) sont acceptées');
    if (!reseauLocal) {
      const host = u.hostname.replace(/^\[|\]$/g, '');
      const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => { throw err('dns', 'Nom de domaine introuvable : ' + host); })).map(a => a.address);
      if (ips.some(adressePrivee)) throw err('prive', 'Adresse du réseau local refusée (réglage VEILLES_RESEAU_LOCAL=1 pour l\'autoriser)');
    }
    let res;
    try {
      res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(DELAI),
        headers: { 'User-Agent': agent, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' } });
    } catch (e) {
      throw err('reseau', e.name === 'TimeoutError' ? 'Le site ne répond pas' : 'Site injoignable');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), u).href; continue; }
    if (!res.ok) throw err('http', 'Le site a répondu ' + res.status);
    const lu = []; let total = 0;
    for await (const morceau of res.body) {
      total += morceau.length;
      if (total > MAX_OCTETS) throw err('trop_gros', 'Flux trop volumineux (3 Mo maximum)');
      lu.push(morceau);
    }
    return Buffer.concat(lu).toString('utf8');
  }
  throw err('redirections', 'Trop de redirections');
}

/* ---------- lecture RSS 2.0 / Atom (sans dépendance) ---------- */

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—' };
function decoder(t) {
  return String(t || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); try { return String.fromCodePoint(n); } catch { return m; } }
    return ENTITES[e.toLowerCase()] ?? m;
  });
}
const sansCdata = t => String(t || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
export function texte(html, n = 0) {
  let t = decoder(sansCdata(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '));
  t = decoder(t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();       // contenu doublement échappé
  return n && t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
}
function balise(bloc, noms) {
  for (const n of noms) {
    const m = new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i').exec(bloc);
    if (m) return sansCdata(m[1]).trim();
  }
  return '';
}
function lienAtom(bloc) {
  const liens = [...bloc.matchAll(/<link\b([^>]*?)\/?>/gi)].map(m => m[1]);
  const attr = (a, n) => (new RegExp(n + '\\s*=\\s*"([^"]*)"', 'i').exec(a) || new RegExp(n + "\\s*=\\s*'([^']*)'", 'i').exec(a) || [])[1];
  const alt = liens.find(a => !attr(a, 'rel') || attr(a, 'rel') === 'alternate');
  return decoder(attr(alt || liens[0] || '', 'href') || '');
}

/** @returns {{titre:string, items:{titre,lien,guid,date,extrait}[]}} */
export function lireFlux(xml) {
  const s = String(xml || '');
  if (!/<(rss|feed|rdf:RDF)\b/i.test(s)) throw err('format', 'Ce n\'est pas un flux RSS ou Atom');
  const atom = /<feed\b/i.test(s);
  const tete = s.split(atom ? /<entry\b/i : /<item\b/i)[0];
  const titre = texte(balise(tete, ['title']), 200);
  const blocs = [...s.matchAll(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]).slice(0, 300);
  const items = blocs.map(b => {
    const lien = atom ? lienAtom(b) : decoder(texte(balise(b, ['link']))) || decoder(balise(b, ['guid']));
    const dateBrute = balise(b, atom ? ['updated', 'published'] : ['pubDate', 'dc:date', 'published', 'updated']);
    const d = Date.parse(texte(dateBrute));
    return {
      titre: texte(balise(b, ['title']), 300) || '(sans titre)',
      lien: /^https?:\/\//i.test(lien) ? lien : '',
      guid: texte(balise(b, atom ? ['id'] : ['guid'])),
      date: Number.isFinite(d) ? new Date(d).toISOString() : '',
      extrait: texte(balise(b, atom ? ['summary', 'content'] : ['description', 'content:encoded', 'summary']), 400),
    };
  });
  return { titre, items };
}

/* ---------- filtres ---------- */
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const motsDe = t => String(t || '').split(/[\n,;]+/).map(x => norm(x).trim()).filter(Boolean);
export const cleItem = it => 'k' + crypto.createHash('sha1').update(it.guid || it.lien || it.titre).digest('hex').slice(0, 16);

export function filtrer(items, f = {}, maintenant = Date.now()) {
  const inclure = motsDe(f.inclure), exclure = motsDe(f.exclure);
  const age = +f.ageHeures > 0 ? +f.ageHeures * 3600000 : 0;
  return items.filter(it => {
    const t = norm(it.titre + ' ' + it.extrait);
    if (inclure.length && !inclure.some(m => t.includes(m))) return false;
    if (exclure.some(m => t.includes(m))) return false;
    if (age && it.date && maintenant - Date.parse(it.date) > age) return false;
    return true;
  });
}

/* ---------- rythme ---------- */
function partiesLocales(ms, fuseau) {
  let tz = fuseau || 'Europe/Paris';
  try { new Intl.DateTimeFormat('fr', { timeZone: tz }); } catch { tz = 'Europe/Paris'; }
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, js: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1 };
}
/** La veille doit-elle tourner maintenant ? derniere : date ISO de la dernière exécution (ou vide). */
export function aEcheance(r = {}, derniere, maintenant = Date.now()) {
  const der = derniere ? Date.parse(derniere) : 0;
  if (r.type === 'heures') return !der || maintenant - der >= Math.max(1, Math.min(168, +r.n || 6)) * 3600000 - 30000;
  const ici = partiesLocales(maintenant, r.fuseau), avant = der ? partiesLocales(der, r.fuseau) : null;
  const heure = /^\d\d:\d\d$/.test(r.heure || '') ? r.heure : '07:00';
  if (ici.hm < heure || (avant && avant.jour === ici.jour)) return false;
  if (r.type === 'semaine') return ici.js === (+r.jour || 1);
  return true;                                              // chaque jour (rattrapage si la machine était éteinte)
}

/* ---------- moteur ---------- */
export class Veilles {
  /**
   * @param {import('./db.js').Store} store
   * @param {{mode:string, reseauLocal?:boolean, log?:Function, interval?:number}} opts
   */
  constructor(store, { mode = 'serveur', reseauLocal = process.env.VEILLES_RESEAU_LOCAL === '1', log = () => {}, interval = 60000 } = {}) {
    this.store = store; this.mode = mode; this.reseauLocal = reseauLocal; this.log = log; this.interval = interval;
    this.enCours = new Set(); this.timer = null;
  }
  start() { this.timer = setInterval(() => this.tour().catch(e => this.log('Veilles : ' + e.message)), this.interval); this.timer.unref?.(); setTimeout(() => this.tour().catch(() => {}), 5000).unref?.(); return this; }
  stop() { clearInterval(this.timer); }

  /** Identifiant d'exécutant de cette instance : « serveur » ou « appareil:<id> ». */
  moi() { return this.mode === 'application' ? 'appareil:' + this.store.deviceId : 'serveur'; }
  info() { return { executeur: this.moi(), mode: this.mode, appareil: os.hostname() }; }

  donnees() { const d = this.store.getDoc(DOC_VEILLES); return (d && d.data) || { veilles: [], fiches: [], etats: [] }; }

  async tour() {
    const d = this.donnees();
    for (const v of d.veilles || []) {
      if (!v || !v.id || !v.actif || v.executeur !== this.moi() || this.enCours.has(v.id)) continue;
      const etat = (d.etats || []).find(e => e.id === v.id) || {};
      if (!aEcheance({ ...(v.rythme || {}), fuseau: v.fuseau }, etat.derniere)) continue;
      await this.executer(v).catch(e => this.log(`Veille « ${v.nom} » : ${e.message}`));
    }
  }

  /** Collecte + filtres + dédoublonnage. essai : rien n'est enregistré. */
  async collecter(v, { essai = false } = {}) {
    const sources = (v.sources || []).filter(s => s && s.url).slice(0, 20);
    if (!sources.length) throw err('bad_request', 'Aucune source : ajoutez au moins un flux');
    const erreurs = [], tous = [];
    await Promise.all(sources.map(async s => {
      try {
        const f = lireFlux(await telecharger(s.url, { reseauLocal: this.reseauLocal }));
        for (const it of f.items) tous.push({ ...it, source: s.nom || f.titre || new URL(s.url).hostname });
      } catch (e) { erreurs.push({ url: s.url, message: e.message }); }
    }));
    const gardes = filtrer(tous, v.filtres || {});
    const vus = new Set();
    for (const f of this.donnees().fiches || []) if (f && f.veille === v.id) for (const it of f.items || []) vus.add(it.k);
    const nouveaux = [];
    for (const it of gardes) {
      const k = cleItem(it);
      if (vus.has(k)) continue;
      vus.add(k);
      nouveaux.push({ k, titre: it.titre, lien: it.lien, source: it.source, date: it.date, extrait: it.extrait });
    }
    nouveaux.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const max = Math.min(Math.max(+((v.filtres || {}).max) || 30, 1), 200);
    return { collectes: tous.length, gardes: gardes.length, nouveaux: nouveaux.slice(0, max), ecartes: Math.max(0, nouveaux.length - max), erreurs, essai };
  }

  /** Exécution réelle : une fiche (si du nouveau, ou si la veille le demande) et l'état de la veille. */
  async executer(v) {
    if (this.enCours.has(v.id)) throw err('busy', 'Cette veille tourne déjà');
    this.enCours.add(v.id);
    const at = nowIso();
    try {
      const r = await this.collecter(v);
      let fiche = null;
      if (r.nouveaux.length || (v.sortie && v.sortie.ficheVide)) {
        fiche = { id: 'f' + crypto.randomBytes(6).toString('hex'), veille: v.id, nom: v.nom, at, items: r.nouveaux,
          stats: { collectes: r.collectes, gardes: r.gardes, nouveaux: r.nouveaux.length, ecartes: r.ecartes },
          erreurs: r.erreurs, par: this.moi(), lue: false };
        this.store.putRecord(DOC_VEILLES, 'fiches', fiche.id, fiche);
        this.elaguer(v.id);
      }
      this.store.putRecord(DOC_VEILLES, 'etats', v.id, { id: v.id, derniere: at, ok: !r.erreurs.length || r.erreurs.length < (v.sources || []).length,
        erreur: r.erreurs.map(e => e.url + ' : ' + e.message).join(' · ').slice(0, 500), nouveaux: r.nouveaux.length, par: this.moi() });
      return { ...r, fiche };
    } catch (e) {
      this.store.putRecord(DOC_VEILLES, 'etats', v.id, { id: v.id, derniere: at, ok: false, erreur: e.message, nouveaux: 0, par: this.moi() });
      throw e;
    } finally { this.enCours.delete(v.id); }
  }

  elaguer(veille) {
    const f = (this.donnees().fiches || []).filter(x => x && x.veille === veille).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    for (const x of f.slice(FICHES_GARDEES)) this.store.putRecord(DOC_VEILLES, 'fiches', x.id, null);
  }
}

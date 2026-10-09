// Protection contre les essais de mots de passe et de jetons en série (serveur exposé sur Internet).
//
// Par adresse : les 5 premiers échecs sur 15 min passent sans délai, puis chaque échec impose une
// attente qui double (1 s, 2 s, 4 s… jusqu'à 60 s) ; au 20e échec l'adresse est bloquée 15 min.
// Une authentification réussie efface le compteur de l'adresse.

const FENETRE = 15 * 60 * 1000;
const GRATUITS = 5;
const BLOCAGE_A = 20;
const BLOCAGE_DUREE = 15 * 60 * 1000;

export class Garde {
  constructor({ log = (m) => console.warn(m), now = () => Date.now() } = {}) {
    this.log = log;
    this.now = now;
    this.ips = new Map();      // ip → {n, debut, attente, bloqueJusqua}
    this.menage = setInterval(() => this.nettoyer(), 60 * 1000);
    this.menage.unref?.();
  }

  etat(ip) {
    const t = this.now();
    let e = this.ips.get(ip);
    if (e && t - e.debut > FENETRE && !(e.bloqueJusqua > t)) { this.ips.delete(ip); e = null; }
    return e;
  }

  /** Millisecondes à attendre avant d'accepter une tentative de cette adresse (0 = libre). */
  attente(ip) {
    const e = this.etat(ip);
    if (!e) return 0;
    const t = this.now();
    if (e.bloqueJusqua > t) return e.bloqueJusqua - t;
    return Math.max(0, e.prochaine - t);
  }

  echec(ip, quoi) {
    const t = this.now();
    let e = this.etat(ip);
    if (!e) { e = { n: 0, debut: t, prochaine: 0, bloqueJusqua: 0 }; this.ips.set(ip, e); }
    e.n++;
    if (e.n > GRATUITS) e.prochaine = t + Math.min(60000, 1000 * 2 ** (e.n - GRATUITS - 1));
    if (e.n >= BLOCAGE_A) {
      e.bloqueJusqua = t + BLOCAGE_DUREE;
      this.log(`Sécurité : ${ip} bloquée 15 min après ${e.n} échecs (${quoi})`);
    } else if (e.n > GRATUITS) {
      this.log(`Sécurité : échec d'authentification n° ${e.n} depuis ${ip} (${quoi})`);
    }
  }

  reussite(ip) { this.ips.delete(ip); }

  nettoyer() {
    const t = this.now();
    for (const [ip, e] of this.ips) if (t - e.debut > FENETRE && !(e.bloqueJusqua > t)) this.ips.delete(ip);
  }

  stop() { clearInterval(this.menage); }
}

/**
 * Adresse du visiteur. Derrière Caddy (TRUST_PROXY=1), l'adresse réelle est la dernière de
 * X-Forwarded-For : c'est celle que Caddy a ajoutée, les précédentes viennent du client et ne
 * sont pas fiables.
 */
export function adresseClient(req, trustProxy) {
  if (trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket.remoteAddress || 'inconnue';
}

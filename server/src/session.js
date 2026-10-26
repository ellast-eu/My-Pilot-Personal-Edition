// Sessions de l'interface web : un cookie signé remplace l'authentification « Basic » du navigateur,
// que certains navigateurs gérés (Edge en entreprise, par stratégie) n'affichent jamais.
//
// Jeton : « v1.<expiration>.<signature> », signature HMAC-SHA256 de l'expiration, de l'identifiant et
// d'une empreinte du mot de passe. Rien n'est stocké côté serveur : la session survit aux redémarrages,
// et changer d'identifiant ou de mot de passe invalide aussitôt toutes les sessions ouvertes.
import crypto from 'node:crypto';

export const COOKIE = 'mppe_session';
export const DUREE_JOURS = 30;

export class Sessions {
  /**
   * @param {{secret:string, user:()=>string, pass:()=>string, maintenant?:()=>number, dureeJours?:number}} o
   */
  constructor(o) {
    this.secret = o.secret;
    this.user = o.user;
    this.pass = o.pass;
    this.maintenant = o.maintenant || Date.now;
    this.duree = (o.dureeJours ?? DUREE_JOURS) * 86400;
  }

  signer(exp) {
    const empreinte = crypto.createHash('sha256').update(String(this.pass() || '')).digest('hex');
    return crypto.createHmac('sha256', this.secret)
      .update('v1|' + exp + '|' + (this.user() || '') + '|' + empreinte).digest('base64url');
  }

  /** Nouveau jeton de session, valable DUREE_JOURS jours. */
  emettre() {
    const exp = Math.floor(this.maintenant() / 1000) + this.duree;
    return 'v1.' + exp + '.' + this.signer(exp);
  }

  /** Le jeton est-il valide, non expiré, et signé pour l'identifiant et le mot de passe actuels ? */
  valide(jeton) {
    const m = /^v1\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(String(jeton || ''));
    if (!m || !this.pass()) return false;
    if (+m[1] <= Math.floor(this.maintenant() / 1000)) return false;
    const attendu = Buffer.from(this.signer(+m[1])), recu = Buffer.from(m[2]);
    return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
  }

  /** En-tête Set-Cookie. secure : uniquement en HTTPS (derrière Caddy). */
  cookie(jeton, { secure }) {
    return COOKIE + '=' + jeton + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + this.duree + (secure ? '; Secure' : '');
  }

  effacer({ secure }) {
    return COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + (secure ? '; Secure' : '');
  }
}

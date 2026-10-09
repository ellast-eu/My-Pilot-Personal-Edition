// Chiffrement de bout en bout des espaces partagés, avec node:crypto uniquement.
//
// - Identité d'un appareil : paire X25519.
// - Clé d'espace : 32 octets aléatoires (AES-256-GCM), numérotée par époque.
// - Remise de la clé : enveloppée par un échange Diffie-Hellman statique entre la clé privée de
//   l'appareil qui la remet et la clé publique du destinataire (HKDF-SHA256 puis AES-256-GCM).
//   Seuls ces deux appareils peuvent calculer le secret : le destinataire sait donc que la clé
//   vient bien de l'appareil dont il a vérifié l'empreinte (donnée par le lien d'invitation).
// - Fiche : AES-256-GCM, données associées = espace|collection|id|hlc, pour que l'hôte ne puisse
//   ni échanger deux fiches ni rejouer une ancienne version sous une autre horloge.
import crypto from 'node:crypto';

const SPKI_X25519 = Buffer.from('302a300506032b656e032100', 'hex');
const b64 = b => Buffer.from(b).toString('base64');
const unb64 = s => Buffer.from(String(s || ''), 'base64');
export const b64url = b => Buffer.from(b).toString('base64url');

export function nouvelleIdentite() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  const pub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  return { pub: b64(pub), priv: b64(privateKey.export({ type: 'pkcs8', format: 'der' })) };
}

export function clePubliqueValide(pub) {
  try { return unb64(pub).length === 32 && !!pubKey(pub); } catch { return false; }
}

function pubKey(pub) {
  return crypto.createPublicKey({ key: Buffer.concat([SPKI_X25519, unb64(pub)]), format: 'der', type: 'spki' });
}
function privKey(priv) {
  return crypto.createPrivateKey({ key: unb64(priv), format: 'der', type: 'pkcs8' });
}

/** Empreinte lisible d'une clé publique : 16 caractères en 4 groupes (base32, 80 bits). */
export function empreinte(pub) {
  const h = crypto.createHash('sha256').update(unb64(pub)).digest();
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let bits = 0, val = 0, out = '';
  for (const byte of h.subarray(0, 10)) {
    val = (val << 8) | byte; bits += 8;
    while (bits >= 5) { out += A[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return out.match(/.{4}/g).join('-');
}

/** Empreinte complète (pour le lien d'invitation) : SHA-256 de la clé publique, base64url. */
export function empreinteComplete(pub) {
  return b64url(crypto.createHash('sha256').update(unb64(pub)).digest());
}

function cleEchange(priv, pub, contexte) {
  const secret = crypto.diffieHellman({ privateKey: privKey(priv), publicKey: pubKey(pub) });
  return Buffer.from(crypto.hkdfSync('sha256', secret, Buffer.alloc(0), Buffer.from('mppe-enveloppe|' + contexte), 32));
}

/** Enveloppe une clé d'espace pour un destinataire. */
export function envelopper({ priv, pubDest, cle, contexte }) {
  const k = cleEchange(priv, pubDest, contexte);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  c.setAAD(Buffer.from(contexte));
  const ct = Buffer.concat([c.update(unb64(cle)), c.final(), c.getAuthTag()]);
  return { iv: b64(iv), ct: b64(ct) };
}

export function desenvelopper({ priv, pubSource, env, contexte }) {
  const k = cleEchange(priv, pubSource, contexte);
  const buf = unb64(env.ct);
  const d = crypto.createDecipheriv('aes-256-gcm', k, unb64(env.iv));
  d.setAAD(Buffer.from(contexte));
  d.setAuthTag(buf.subarray(-16));
  return b64(Buffer.concat([d.update(buf.subarray(0, -16)), d.final()]));
}

export const nouvelleCle = () => b64(crypto.randomBytes(32));

const aadFiche = (doc, coll, id, hlc) => Buffer.from(['mppe-fiche', doc, coll, id, hlc].join('|'));

/** Chiffre le contenu d'une fiche. */
export function sceller(cle, epoque, { doc, coll, id, hlc }, data) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', unb64(cle), iv);
  c.setAAD(aadFiche(doc, coll, id, hlc));
  const ct = Buffer.concat([c.update(JSON.stringify(data), 'utf8'), c.final(), c.getAuthTag()]);
  return { e: epoque, iv: b64(iv), ct: b64(ct) };
}

/** Déchiffre une fiche ; lève une erreur si la clé manque ou si la fiche a été altérée. */
export function ouvrir(cles, { doc, coll, id, hlc }, env) {
  const cle = cles[env.e];
  if (!cle) throw new Error('clé de l\'époque ' + env.e + ' absente');
  const buf = unb64(env.ct);
  const d = crypto.createDecipheriv('aes-256-gcm', unb64(cle), unb64(env.iv));
  d.setAAD(aadFiche(doc, coll, id, hlc));
  d.setAuthTag(buf.subarray(-16));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(0, -16)), d.final()]).toString('utf8'));
}

export function estEnveloppe(v) {
  return !!v && typeof v === 'object' && Number.isInteger(v.e) && typeof v.iv === 'string' && typeof v.ct === 'string'
    && Object.keys(v).length === 3 && v.ct.length <= 4 * 1024 * 1024;
}

/** Preuve que l'arrivant détient le secret du lien (que l'hôte ne voit jamais). */
export function preuve(secret, message) {
  return crypto.createHmac('sha256', Buffer.from(String(secret), 'utf8')).update(message).digest('base64url');
}

export const aleatoire = (n = 18) => b64url(crypto.randomBytes(n));
export const hacher = s => crypto.createHash('sha256').update(String(s)).digest('hex');
export function egal(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

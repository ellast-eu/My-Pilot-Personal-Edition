// Rôle « hôte » des espaces partagés : le serveur stocke et relaie des fiches chiffrées qu'il ne
// peut pas lire, et gère qui y a accès (membres, jetons, invitations, clés enveloppées).
//
// Un membre = un appareil (sa paire de clés). Rôles : « proprietaire » (invite, approuve, retire)
// et « membre ». Statuts : « en_attente » (a rejoint, attend sa clé), « actif », « retire ».
import { COLLECTIONS_ESPACE, PREFIXE_ESPACE } from './db.js';
import { aleatoire, hacher, clePubliqueValide, estEnveloppe } from './chiffre.js';

const ID_ESPACE = /^[a-f0-9]{16}$/;
const ID_MEMBRE = /^m[A-Za-z0-9_-]{8,20}$/;
const nowIso = () => new Date().toISOString();
const err = (status, code, message) => Object.assign(new Error(message), { status, code });

export class Hote {
  constructor(store) { this.store = store; this.db = store.db; }

  espaceValide(id) { return ID_ESPACE.test(id || '') && !!this.db.prepare('SELECT 1 FROM host_spaces WHERE id=?').get(id); }

  /** Création par la propriétaire du serveur (jeton de synchronisation privée). */
  creer({ pub }) {
    if (!clePubliqueValide(pub)) throw err(400, 'bad_request', 'Clé publique invalide');
    const space = hacher(aleatoire(24)).slice(0, 16);
    this.db.prepare('INSERT INTO host_spaces(id, created_at) VALUES (?,?)').run(space, nowIso());
    const { member, token } = this.ajouterMembre(space, { pub, role: 'proprietaire', status: 'actif' });
    return { space, member, token, epoch: 1 };
  }

  ajouterMembre(space, { pub, role, status, invite = null, proof = null }) {
    const member = 'm' + aleatoire(9);
    const token = aleatoire(32);
    this.db.prepare(`INSERT INTO host_members(space, member, role, status, token_hash, pub, invite, proof, joined_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(space, member, role, status, hacher(token), pub, invite, proof, nowIso());
    return { member, token };
  }

  /** Membre correspondant à un jeton (null si inconnu ou retiré). */
  membre(space, token) {
    if (!ID_ESPACE.test(space || '') || !token) return null;
    const m = this.db.prepare('SELECT * FROM host_members WHERE space=? AND token_hash=?').get(space, hacher(token));
    return m && m.status !== 'retire' ? m : null;
  }

  exigerProprietaire(m) { if (m.role !== 'proprietaire' || m.status !== 'actif') throw err(403, 'forbidden', 'Réservé aux propriétaires de l\'espace'); }
  exigerActif(m) { if (m.status !== 'actif') throw err(403, 'pending', 'En attente de la clé de l\'espace'); }

  inviter(m, { role = 'membre', jours = 7 } = {}) {
    this.exigerProprietaire(m);
    if (!['membre', 'proprietaire', 'lecteur'].includes(role)) throw err(400, 'bad_request', 'Rôle inconnu');
    const j = Math.min(Math.max(+jours || 7, 1), 30);
    const invite = aleatoire(18);
    this.db.prepare(`INSERT INTO host_invites(id_hash, space, role, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?)`)
      .run(hacher(invite), m.space, role, m.member, nowIso(), new Date(Date.now() + j * 86400000).toISOString());
    return { invite, expires_at: new Date(Date.now() + j * 86400000).toISOString() };
  }

  /** Arrivée d'un appareil avec un lien d'invitation : il devient membre « en attente ». */
  rejoindre(space, { invite, pub, proof }) {
    if (!this.espaceValide(space)) throw err(404, 'not_found', 'Espace inconnu');
    if (!clePubliqueValide(pub) || typeof proof !== 'string' || proof.length > 100) throw err(400, 'bad_request', 'Demande incomplète');
    const inv = this.db.prepare('SELECT * FROM host_invites WHERE id_hash=? AND space=?').get(hacher(invite || ''), space);
    if (!inv) throw err(403, 'bad_invite', 'Invitation inconnue');
    if (inv.used_by) throw err(403, 'bad_invite', 'Invitation déjà utilisée');
    if (inv.expires_at < nowIso()) throw err(403, 'bad_invite', 'Invitation expirée');
    const r = this.ajouterMembre(space, { pub, role: inv.role, status: 'en_attente', invite: hacher(invite), proof });
    this.db.prepare('UPDATE host_invites SET used_by=? WHERE id_hash=?').run(r.member, inv.id_hash);
    return { ...r, role: inv.role, status: 'en_attente' };
  }

  membres(m) {
    return this.db.prepare('SELECT member, role, status, pub, invite, proof, joined_at, revoked_at FROM host_members WHERE space=? ORDER BY joined_at')
      .all(m.space).map(x => (m.role === 'proprietaire' ? x : { member: x.member, role: x.role, status: x.status, pub: x.pub, joined_at: x.joined_at, revoked_at: x.revoked_at }));
  }

  /** Remise des clés (toutes les époques) à un membre en attente, enveloppées par l'appareil propriétaire. */
  approuver(m, cible, { epoch, wrap, wraps }) {
    this.exigerProprietaire(m);
    const t = this.db.prepare('SELECT * FROM host_members WHERE space=? AND member=?').get(m.space, cible);
    if (!t || t.status === 'retire') throw err(404, 'not_found', 'Membre inconnu');
    const liste = Array.isArray(wraps) ? wraps : [{ epoch, ...(wrap || {}) }];
    if (!liste.length || liste.length > 1000 || liste.some(w => !w || !Number.isInteger(w.epoch) || w.epoch < 1 || typeof w.iv !== 'string' || typeof w.ct !== 'string')) {
      throw err(400, 'bad_request', 'Clé enveloppée invalide');
    }
    const ins = this.db.prepare('INSERT OR REPLACE INTO host_keys(space, epoch, member, wrap) VALUES (?,?,?,?)');
    for (const w of liste) ins.run(m.space, w.epoch, cible, JSON.stringify({ from: m.member, iv: w.iv, ct: w.ct }));
    this.db.prepare("UPDATE host_members SET status='actif' WHERE space=? AND member=?").run(m.space, cible);
    return { ok: true };
  }

  /** Nouvelle époque de clé (après un retrait) : une enveloppe par membre restant. */
  renouveler(m, { epoch, wraps }) {
    this.exigerProprietaire(m);
    const max = this.db.prepare('SELECT max(epoch) AS e FROM host_keys WHERE space=?').get(m.space).e || 1;
    if (epoch !== max + 1) throw err(409, 'epoch', 'Une autre clé a été créée entre-temps : réessayez');
    if (!Array.isArray(wraps) || wraps.length > 1000) throw err(400, 'bad_request', 'Enveloppes attendues');
    const membres = new Set(this.db.prepare("SELECT member FROM host_members WHERE space=? AND status<>'retire'").all(m.space).map(x => x.member));
    const ins = this.db.prepare('INSERT OR REPLACE INTO host_keys(space, epoch, member, wrap) VALUES (?,?,?,?)');
    for (const w of wraps) {
      if (!w || !membres.has(w.member) || typeof w.iv !== 'string' || typeof w.ct !== 'string') throw err(400, 'bad_request', 'Enveloppe invalide');
      ins.run(m.space, epoch, w.member, JSON.stringify({ from: m.member, iv: w.iv, ct: w.ct }));
    }
    return { ok: true, epoch };
  }

  retirer(m, cible) {
    if (cible !== m.member) this.exigerProprietaire(m);       // chacun peut se retirer lui-même
    const t = this.db.prepare('SELECT * FROM host_members WHERE space=? AND member=?').get(m.space, cible);
    if (!t) throw err(404, 'not_found', 'Membre inconnu');
    const restants = this.db.prepare("SELECT count(*) AS n FROM host_members WHERE space=? AND role='proprietaire' AND status='actif' AND member<>?").get(m.space, cible).n;
    if (t.role === 'proprietaire' && t.status === 'actif' && !restants) throw err(400, 'last_owner', 'Dernier appareil propriétaire : il ne peut pas être retiré');
    this.db.prepare("UPDATE host_members SET status='retire', revoked_at=? WHERE space=? AND member=?").run(nowIso(), m.space, cible);
    this.db.prepare('DELETE FROM host_keys WHERE space=? AND member=?').run(m.space, cible);
    return { ok: true };
  }

  /** Clés enveloppées pour ce membre, avec la clé publique de l'appareil qui les a remises. */
  cles(m) {
    return this.db.prepare('SELECT epoch, wrap FROM host_keys WHERE space=? AND member=? ORDER BY epoch').all(m.space, m.member).map(k => {
      const w = JSON.parse(k.wrap);
      const src = this.db.prepare('SELECT pub FROM host_members WHERE space=? AND member=?').get(m.space, w.from);
      return { epoch: k.epoch, from: w.from, fromPub: src && src.pub, iv: w.iv, ct: w.ct };
    });
  }

  /** Échange de fiches chiffrées. */
  echange(m, body) {
    this.exigerActif(m);
    const doc = PREFIXE_ESPACE + m.space;
    const brut = Array.isArray(body.changes) ? body.changes.slice(0, 5000) : [];
    const ok = ch => ch && ch.doc === doc && COLLECTIONS_ESPACE.includes(ch.coll) && typeof ch.id === 'string' && ch.id.length <= 120
      && typeof ch.hlc === 'string' && ch.hlc.length <= 80 && (ch.data === null || estEnveloppe(ch.data))
      && (ch.bases === undefined || (Array.isArray(ch.bases) && ch.bases.length === 1 && estEnveloppe(ch.bases[0])))
      && (m.role !== 'lecteur' || (ch.coll === 'members' && ch.id === m.member));     // un lecteur n'écrit que sa carte
    const rangs = brut.map((ch, i) => (ok(ch) ? i : -1)).filter(i => i >= 0);
    const incoming = rangs.map(i => ({ doc, coll: brut[i].coll, id: brut[i].id, hlc: brut[i].hlc, data: brut[i].data, origin: m.member,
      ...(brut[i].bases ? { bases: brut[i].bases } : {}) }));
    const r = incoming.length ? this.store.applyRemote(incoming, { source: 'membre ' + m.member }) : { applied: 0, accepted: [] };
    const applied = r.applied;
    const since = Math.max(0, +body.since || 0);
    const limit = Math.min(Math.max(+body.limit || 500, 1), 2000);
    const out = this.store.changesSince(since, { doc, excludeOrigin: m.member, limit });
    const more = out.length === limit;
    return { applied, accepted: r.accepted.map(i => rangs[i]), changes: out.map(({ seq, ...c }) => c), cursor: more ? out[out.length - 1].seq : this.store.maxSeq(), more };
  }
}

export { ID_ESPACE, ID_MEMBRE };

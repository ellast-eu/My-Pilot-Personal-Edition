// Fusion à trois voies, champ par champ.
//
// À partir de la version commune (base), de la nôtre et de l'autre : un champ modifié d'un seul
// côté prend la valeur modifiée ; un champ modifié des deux côtés, différemment, est un conflit
// et prend la valeur du côté « gagnant ». Les objets imbriqués (la « suite » d'une note…) sont
// fusionnés de la même façon ; les listes sont traitées comme des valeurs entières.

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const estObjet = v => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * @param {any} base   version commune (undefined si inconnue)
 * @param {any} mien
 * @param {any} sien
 * @param {'mien'|'sien'} gagnant  côté retenu pour un champ modifié des deux côtés
 * @returns {{valeur:any, conflits:string[]}}  conflits : chemins des champs en conflit
 */
export function fusionner3(base, mien, sien, gagnant = 'mien') {
  if (eq(mien, sien)) return { valeur: mien, conflits: [] };
  if (eq(mien, base)) return { valeur: sien, conflits: [] };
  if (eq(sien, base)) return { valeur: mien, conflits: [] };
  if (estObjet(mien) && estObjet(sien)) {
    const b = estObjet(base) ? base : {};
    const out = {}, conflits = [];
    const cles = [...Object.keys(mien), ...Object.keys(sien).filter(k => !(k in mien))];
    for (const k of cles) {
      const r = fusionner3(b[k], mien[k], sien[k], gagnant);
      if (r.valeur !== undefined) out[k] = r.valeur;
      for (const c of r.conflits) conflits.push(c ? k + '.' + c : k);
    }
    return { valeur: out, conflits };
  }
  return { valeur: gagnant === 'mien' ? mien : sien, conflits: [''] };
}

/** Champs techniques qui ne comptent pas comme une modification (auteur, date de modification). */
export const TAMPONS = ['modifiePar', 'modifieLe'];

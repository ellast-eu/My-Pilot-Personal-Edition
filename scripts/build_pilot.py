#!/usr/bin/env python3
"""Construit web/pilot/index.html à partir de la version d'origine de PST·PILOT.

L'original reste intact dans vendor/ : pour reprendre une nouvelle version de PST·PILOT,
déposez-la dans vendor/, mettez à jour SOURCE ci-dessous et relancez ce script.
Chaque patch vérifie que son ancre existe une seule fois : s'il échoue, l'original a changé
à cet endroit et le patch doit être ajusté.

Usage : python3 scripts/build_pilot.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'vendor' / 'pst-pilot-3.13.1.html'
TARGET = ROOT / 'web' / 'pilot' / 'index.html'

PATCHES = [
    # (description, motif, remplacement, regex?)
    ("titre de l'onglet",
     r'<title>PST Pilot v[\d.]+</title>', '<title>Pilot Perso</title>', True),
    ("onglet Idées dans la navigation",
     '<button data-vue="chantiers">Activités</button>',
     '<button data-vue="chantiers">Activités</button>\n    <button data-vue="idees">Idées</button>', False),
    ("démarrage différé : la couche perso charge d'abord les données du serveur",
     '(function init(){', 'window.__pilotInit = (function init(){', False),
    ("fin du démarrage différé",
     r'(\n  if\(!localDispo\(\)\) setTimeout\(function\(\)\{\n    toast\("Sauvegarde automatique indisponible ici[^\n]*\n  \},1400\);\n)\}\)\(\);',
     r'\1});', True),
    ("plus de message « tampon du navigateur » : les données viennent du serveur",
     '  if(local) setTimeout(function(){ toast("Données reprises du tampon de ce navigateur") },500);\n', '', False),
    ("bloc Fichier de données remplacé par le bloc serveur et sauvegardes",
     r"\+'<div class=\"bloc\"><div class=\"bloc-tete\"><h2>Fichier de données</h2></div><div class=\"bloc-corps\">'.*?\+'<hr class=\"sep\">'",
     "+'<div class=\"bloc\"><div class=\"bloc-tete\"><h2>Données et sauvegardes</h2></div><div class=\"bloc-corps\">'\n"
     "    +(window.persoBlocDonnees?window.persoBlocDonnees():'')\n    +'<hr class=\"sep\">'", True),
    ("couche perso chargée après le script principal",
     '</body>', '<script src="perso.js"></script>\n</body>', False),
]


def main() -> int:
    src = SOURCE.read_text(encoding='utf-8')
    out = src
    for desc, pat, rep, is_re in PATCHES:
        n = len(re.findall(pat, out, flags=re.S)) if is_re else out.count(pat)
        if n != 1:
            print(f"Patch impossible ({desc}) : ancre trouvée {n} fois", file=sys.stderr)
            return 1
        out = re.sub(pat, lambda m: m.expand(rep), out, count=1, flags=re.S) if is_re else out.replace(pat, rep, 1)
    header = ('<!-- Généré par scripts/build_pilot.py depuis ' + SOURCE.name +
              ' : ne pas modifier ici, modifier le script ou web/pilot/perso.js -->\n')
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(out.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + header, 1), encoding='utf-8')
    print(f"{TARGET.relative_to(ROOT)} : {len(PATCHES)} patchs appliqués")
    return 0


if __name__ == '__main__':
    sys.exit(main())

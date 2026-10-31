#!/usr/bin/env python3
"""Construit web/pilot/index.html à partir de la version d'origine de My Pilot Pro (ex-PST·PILOT).

L'original reste intact dans vendor/ : pour reprendre une nouvelle version de la pro,
déposez-la dans vendor/, mettez à jour SOURCE ci-dessous et relancez ce script.
Chaque patch vérifie que son ancre existe une seule fois : s'il échoue, l'original a changé
à cet endroit et le patch doit être ajusté.

Usage : python3 scripts/build_pilot.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'vendor' / 'mypilot-pro-3.33.0.html'
TARGET = ROOT / 'web' / 'pilot' / 'index.html'

PATCHES = [
    # (description, motif, remplacement, regex?)
    # --- reprise de My Pilot Pro (3.21.0, puis 3.33.0) ---
    ("titre de l'onglet",
     r'<title>My Pilot Professional Edition</title>',
     '<title>My Pilot Personal Edition</title>', True),
    ("nom par défaut de l'application (en-tête, onglet, À propos, rapport)",
     'var NOM_DEFAUT = "My Pilot Professional Edition";',
     'var NOM_DEFAUT = "My Pilot Personal Edition";', False),
    ("onglet Veilles dans la navigation",
     '<button data-vue="idees">Idées</button>',
     '<button data-vue="idees">Idées</button>\n    <button data-vue="veilles">Veilles</button>', False),
    ("Diagnostic du poste remplacé par celui de My Pilot Personal Edition",
     r"\+'<div class=\"bloc\" style=\"margin-top:18px\"><div class=\"bloc-tete\">"
     r"<h2>Diagnostic du poste</h2>.*?\n  \+'</div></div>'\n  \+'</div><div>'",
     "+(window.persoDiagnostic?window.persoDiagnostic():'')\n  +'</div><div>'", True),
    ("listes gérables : la fenêtre de saisie de la couche perso",
     'saisirValeur("Nouvelle valeur à ajouter à la liste")',
     'window.persoSaisir("Nouvelle valeur à ajouter à la liste")', False),
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
    # --- modules professionnels retirés (assistance téléphonique, compteur de traitement) ---
    ("paramètres : plus de titre de compteur",
     "      +'<label class=\"champ\">Titre du compteur<input type=\"text\" id=\"titreDt\" value=\"'+esc(D.parametres.titre_dtdict||\"\")+'\"></label>'\n", '', False),
    ("paramètres : plus d'interrupteurs Assistance téléphonique et Compteur",
     r"      \+'<label style=\"font-size:13\.5px;display:flex;gap:6px;align-items:center\">'\n        \+'<input type=\"checkbox\" id=\"modPerm\".*?Compteur de traitement</label>'\n", '', True),
    ("exports CSV DT/DICT et appels retirés",
     "      +'<button class=\"b creux\" data-act=\"exp-csvd\">Exporter le suivi DT/DICT (CSV)</button>'\n"
     "      +'<button class=\"b creux\" data-act=\"exp-csva\">Exporter les appels (CSV)</button>'\n", '', False),
    ("rapport PDF : tableaux compteur et assistance retirés",
     "  h+='<div class=\"rp-duo\">'\n    +'<div><h2>'+esc(P.titre_dtdict", "  if(false) h+='<div class=\"rp-duo\">'\n    +'<div><h2>'+esc(P.titre_dtdict", False),
    ("journal : plus de filtre ni de compte des appels",
     "    +'<span class=\"compte\">'+nbN+' note(s) · '+nbA+' appel(s)</span></div>'",
     "    +'<span class=\"compte\">'+nbN+' note(s)</span></div>'", False),
    ("journal : recherche dans les notes seules",
     "placeholder=\"Rechercher dans les notes et les appels…\"", "placeholder=\"Rechercher dans les notes…\"", False),
    ("journal : sélecteur notes/appels retiré",
     "    +'<select id=\"fjournal\">'+selOpts([[\"\",\"Notes et appels\"],[\"notes\",\"Notes seules\"],[\"appels\",\"Appels seuls\"]],filtreJournal)+'</select>'\n", '', False),
    ("journal vide : texte sans permanence",
     "Les notes et les appels de permanence apparaîtront ici.", "Les notes apparaîtront ici.", False),
    # --- nettoyage du cadre professionnel (v0.3) ---
    ("paramètres : plus de filtre gestionnaire pour l'import Excel",
     "    +'<label class=\"champ\">Gestionnaire retenu à l\\'import Excel'\n"
     "      +'<input type=\"text\" id=\"gestFiltre\" value=\"'+esc(D.parametres.gestionnaire||\"\")+'\" placeholder=\"vide = toutes les lignes\"></label>'\n"
     "    +'<div class=\"note-aide\">Seules les lignes dont la colonne Gestionnaire correspond seront importées.</div>'\n"
     "    +'<hr class=\"sep\">'\n", '', False),
    ("rubriques : plus de rubrique DT-DICT",
     "'Les rubriques servent à rattacher les notes qui ne relèvent d\\'aucun dossier daté. '\n"
     "      +'La rubrique DT-DICT récupère automatiquement le temps chronométré des sessions.</div>'",
     "'Les rubriques servent à rattacher les notes qui ne relèvent d\\'aucune activité datée.</div>'", False),
    ("listes : seulement celles du pilotage personnel",
     r"\+\[\[\"types_intervention\",\"Types d'intervention \(dossiers\)\"\],.*?\[\"ouvrages\",\"Ouvrages\"\]\]\.map",
     "+(window.persoListes?window.persoListes():[]).map", True),
    ("catégories : modèle personnel au lieu du modèle Enedis",
     "charger le modèle fourni (dossier, convocation, animation, transverse)",
     "rétablir les catégories personnelles (projet, maison, formation, démarche, loisir)", False),
    ("catégories : confirmation du modèle personnel",
     "Rétablir les 4 catégories d'origine ?", "Rétablir les 5 catégories personnelles ?", False),
    ("catégories : message du modèle personnel",
     'toast("Modèle fourni chargé")', 'toast("Catégories personnelles rétablies")', False),
    ("fiche activité : référence générique",
     "'<label class=\"champ\">Référence / n° dossier<input type=\"text\" name=\"reference\" value=\"'+esc(c.reference)+'\" placeholder=\"'+(cat===\"convocation\"?\"N° de constat\":\"DT-DICT, n° affaire…\")+'\"></label>'",
     "'<label class=\"champ\">Référence<input type=\"text\" name=\"reference\" value=\"'+esc(c.reference)+'\" placeholder=\"Ex. : n° de commande, de contrat…\"></label>'", False),
    ("liaison de note : filtre générique",
     "placeholder=\"Filtrer la liste (poste, PRM, commune…)\"", "placeholder=\"Filtrer la liste (libellé, commune…)\"", False),
    ("liste des activités : filtre actives / archivées",
     "[[\"actifs\",\"Dossiers actifs\"]", "[[\"actifs\",\"Activités en cours\"]", False),
    ("rapport : tuiles du compteur et de la permanence retirées",
     "    +'<div class=\"rp-cle\"><div class=\"v\">'+o.dt.traites+'</div><div class=\"l\">dossiers traités au compteur</div><div class=\"e\">'+ecart(o.dt.traites,q.dt.traites)+'</div></div>'\n"
     "    +'<div class=\"rp-cle\"><div class=\"v\">'+o.perm.appels+'</div><div class=\"l\">appels de permanence</div><div class=\"e\">'+ecart(o.perm.appels,q.perm.appels)+'</div></div>'\n",
     "", False),
    ("rapport : activités suivies",
     "<div class=\"l\">dossiers suivis sur la période</div>", "<div class=\"l\">activités suivies sur la période</div>", False),
    ("rapport : nature des activités",
     "<h2>Nature des affaires</h2>", "<h2>Nature des activités</h2>", False),
    ("rapport : mention de confidentialité générique",
     "aucune référence de dossier et aucun '\n    +'identifiant de point de livraison. Édité le",
     "ni aucune référence. Édité le", False),
    ("rapport : mention courte générique",
     "'Aucune donnée nominative, aucune référence de dossier, aucun PRM.'", "'Aucune donnée nominative ni référence.'", False),
    ("rapport : rattachement d'une activité à la période",
     "Un dossier est rattaché à la période '\n    +'dès qu\\'il y porte une trace d\\'activité",
     "Une activité est rattachée à la période '\n    +'dès qu\\'elle y porte une trace",
     False),
    ("vue Données : rapports de période et compte-rendu retirés",
     r"    \+'<hr class=\"sep\" style=\"margin:14px 0 10px\">'\n    \+'<div class=\"ligne\">'\n      \+'<span class=\"puce-lbl\">Rapport de période</span>'.*?Vos données sont conservées dans le fichier lié\. Aucun autre fichier n\\'est lu au démarrage\.</div>'\n",
     "", True),
    # --- menu Pause ---
    ("pause : desserts, sans référence aux sessions de traitement",
     '["dessert","Desserts","Faciles — jamais proposés en session"]', '["dessert","Desserts","Faciles — jamais proposés d\'office"]', False),
    ("pause : proposition à la fin de n'importe quelle activité",
     "'<span><b>Quand je clôture un dossier, une convocation ou une animation</b>'\n"
     "      +'<em>Au moment où vous passez une activité en « Réalisé ».</em></span></label>'",
     "'<span><b>Quand je termine une activité</b>'\n"
     "      +'<em>Au moment où une activité passe à son statut de clôture (Réalisé, Terminé…).</em></span></label>'", False),
    ("pause : la carte vit sur le serveur",
     "'<div class=\"note-aide\">Cette carte est enregistrée avec vos données, dans '\n"
     "      +'<span class=\"mono\">'+esc(nomFichier)+'</span> : rien de plus à ouvrir le matin. '\n"
     "      +'Elle reste absente de tous les exports d\\'activité, et le bouton Exporter permet de la sortir à part.</div>'",
     "'<div class=\"note-aide\">Cette carte est enregistrée avec vos données sur le serveur. '\n"
     "      +'Elle n\\'apparaît dans aucun export d\\'activité ; le bouton Exporter permet de la sauvegarder à part.</div>'", False),
    # --- fenêtre À propos : celle de la perso, et deux journaux séparés (reprise 3.21.0) ---
    ("versions de la perso chargées avant le script principal",
     '</head>', '<script src="versions.js"></script>\n</head>', False),
    ("à propos : sous-titre du bandeau",
     r"""+'<div class="ap-sous">pilotage d\u2019activité</div>'""",
     r"""+'<div class="ap-sous">pilotage personnel</div>'""", False),
    ("à propos : présentation de la perso",
     "    +'<p class=\"ap-intro\">'+esc(nom)+' suit votre activité au quotidien : vos dossiers, '\n"
     "      +'vos rendez-vous, ce que vous en faites, le temps que vous y passez, et ce qu’il en '\n"
     "      +'reste à présenter.</p>'\n"
     "    +'<p class=\"ap-intro\">Un seul fichier, qui fonctionne hors ligne. Aucune connexion, aucun '\n"
     "      +'service tiers, aucune dépendance extérieure : vos données ne quittent jamais votre poste '\n"
     "      +'et vivent dans le fichier que vous liez.</p>'\n",
     "    +'<p class=\"ap-intro\">'+esc(nom)+' pilote votre vie personnelle au quotidien : vos activités '\n"
     "      +'et leurs tâches, votre journal, vos contacts, vos idées et vos veilles.</p>'\n"
     "    +'<p class=\"ap-intro\">Vos données vivent sur votre propre serveur et se synchronisent entre '\n"
     "      +'vos appareils ; l\\'application continue de fonctionner hors ligne. Les espaces partagés '\n"
     "      +'sont chiffrés de bout en bout. Claude n\\'intervient que lorsque vous le demandez, '\n"
     "      +'avec votre propre abonnement.</p>'\n", False),
    ("à propos : fonctionnement et base",
     "      +'<div>Fonctionnement<b>fichier unique, hors ligne</b></div>'",
     "      +'<div>Fonctionnement<b>serveur personnel, synchronisation, hors ligne possible</b></div>'\n"
     "      +'<div>Base<b>My Pilot Pro v'+esc(window.persoBase||\"\")+'</b></div>'", False),
    ("à propos : deux journaux séparés",
     "      +'<button class=\"lien\" data-act=\"ap-versions\">Journal des versions</button>'\n"
     "      +'<span class=\"note-aide\" style=\"margin:0\">'+JOURNAL_VERSIONS.length+' versions '\n"
     "      +'depuis la v'+esc(JOURNAL_VERSIONS[JOURNAL_VERSIONS.length-1][0])+'</span>'\n"
     "    +'</div>';",
     "      +'<button class=\"lien\" data-act=\"ap-versions-perso\">Journal des versions</button>'\n"
     "      +'<span class=\"note-aide\" style=\"margin:0\">'+(window.persoVersions||[]).length+' versions '\n"
     "      +((window.persoVersions||[]).length?'depuis la v'+esc(window.persoVersions[window.persoVersions.length-1][0]):'')+'</span>'\n"
     "    +'</div>'\n"
     "    +'<div class=\"ligne\" style=\"margin-top:6px\">'\n"
     "      +'<button class=\"lien\" data-act=\"ap-versions\">Journal de My Pilot Pro</button>'\n"
     "      +'<span class=\"note-aide\" style=\"margin:0\">'+JOURNAL_VERSIONS.length+' versions '\n"
     "      +'depuis la v'+esc(JOURNAL_VERSIONS[JOURNAL_VERSIONS.length-1][0])+', base de la perso</span>'\n"
     "    +'</div>';", False),
    ("à propos : un journal au choix",
     "function fragJournalVersions(){\n  return '<div class=\"diag\">'+JOURNAL_VERSIONS.map(",
     "function fragJournalVersions(liste){\n  return '<div class=\"diag\">'+(liste||JOURNAL_VERSIONS).map(", False),
    ("à propos : ouverture de l'un ou l'autre journal",
     "  if(page===\"versions\"){\n    arreterAnimApropos();\n    ouvrirModale(\"Journal des versions\",fragJournalVersions(),[",
     "  if(page===\"versions\"||page===\"versions-perso\"){\n    arreterAnimApropos();\n"
     "    ouvrirModale(page===\"versions\"?\"Journal de My Pilot Pro\":\"Journal des versions\","
     "fragJournalVersions(page===\"versions\"?JOURNAL_VERSIONS:(window.persoVersions||[])),[", False),
    ("à propos : bouton du journal de la perso",
     'else if(a==="ap-versions") ouvrirApropos("versions");',
     'else if(a==="ap-versions") ouvrirApropos("versions");\n    else if(a==="ap-versions-perso") ouvrirApropos("versions-perso");', False),
    ("couche perso et aide chargées après le script principal",
     '</body>', '<script src="aide.js"></script>\n<script src="perso.js"></script>\n</body>', False),
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

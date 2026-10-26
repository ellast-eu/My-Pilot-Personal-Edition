/* Aide intégrée de My Pilot Personal Edition.
   Contenu : un tableau de rubriques (id, titre, vues associées, texte HTML). La fenêtre d'aide
   s'ouvre avec le bouton « Aide » de l'en-tête, la touche F1 (sur la rubrique de l'onglet affiché)
   ou le menu Aide de l'application de bureau. Pour ajouter une rubrique : un objet de plus ici. */
(function(){
"use strict";

var A = window.AIDE = [
{ id:"prise-en-main", titre:"Prise en main", vues:[], html:
 '<p class="pa-intro">My Pilot Personal Edition est un tableau de bord pour piloter votre vie personnelle : '
+'vos projets, la maison, la formation, les démarches et les loisirs, vos idées, vos contacts et votre veille.</p>'
+'<h4>Les onglets</h4><dl>'
+'<dt>Aujourd’hui</dt><dd>Votre journée : planning, points de vigilance, journal, tâches en attente.</dd>'
+'<dt>Prochain jour</dt><dd>Ce qui vous attend au prochain jour : activités prévues, dernières notes, tâches arrivées à échéance.</dd>'
+'<dt>Activités</dt><dd>Toutes vos activités, avec leurs notes et leurs tâches.</dd>'
+'<dt>Idées</dt><dd>Le Cristallisoir : vos idées se regroupent seules, Claude les développe, elles deviennent des activités.</dd>'
+'<dt>Veilles</dt><dd>Des flux d’information collectés pour vous chaque jour et rangés en fiches.</dd>'
+'<dt>Journal</dt><dd>Toutes vos notes, jour par jour, avec une recherche.</dd>'
+'<dt>Contacts</dt><dd>Les personnes et les organisations, reliées à vos activités.</dd>'
+'<dt>Données</dt><dd>Sauvegardes, synchronisation, partage, réglages et Claude.</dd></dl>'
+'<h4>Vos données sont enregistrées toutes seules</h4>'
+'<p>Chaque modification est enregistrée en une ou deux secondes. L’état est affiché en haut à droite : '
+'<b>Enregistré</b>, <b>Enregistrement…</b> ou <b>Hors ligne</b>. Hors ligne, rien n’est perdu : la saisie est gardée et envoyée au retour de la connexion. '
+'<kbd>Ctrl</kbd>+<kbd>S</kbd> enregistre tout de suite.</p>'
+'<h4>Pour bien démarrer</h4><ol>'
+'<li>Dans <b>Données → Paramètres</b>, vérifiez les catégories d’activité (Projet, Maison, Formation, Démarche, Loisir) et adaptez-les.</li>'
+'<li>Créez une première activité depuis <b>Aujourd’hui</b> (boutons « + Projet », « + Maison »…).</li>'
+'<li>Notez ce que vous faites dans le <b>Journal du jour</b> : une ligne suffit.</li>'
+'<li>Déposez vos envies dans l’onglet <b>Idées</b>.</li>'
+'<li>Si vous avez plusieurs appareils, configurez la <b>synchronisation</b> (voir la rubrique Données).</li></ol>'
+'<p class="pa-astuce">Cette aide s’ouvre à tout moment avec le bouton <b>Aide</b> en haut, ou la touche <kbd>F1</kbd> : elle montre alors la rubrique de l’onglet affiché.</p>' },

{ id:"aujourdhui", titre:"Aujourd’hui et Prochain jour", vues:["jour","suivant"], html:
 '<h4>Points de vigilance</h4>'
+'<p>Ce qui doit rester sous vos yeux, hors activité : une consigne, un aléa, une alerte. Choisissez le niveau '
+'(<i>information</i>, <i>attention</i>, <i>critique</i>) et, si besoin, la date jusqu’à laquelle il reste affiché. Un point dépassé est signalé.</p>'
+'<h4>Planning du jour</h4>'
+'<p>Les activités prévues aujourd’hui. Les boutons « + Projet », « + Maison »… créent une activité de la catégorie correspondante, datée du jour. '
+'Un clic sur une activité ouvre sa fenêtre.</p>'
+'<h4>Journal du jour</h4>'
+'<p>Notez en une ligne ce que vous venez de faire, de dire ou de constater, puis <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> ou « Ajouter la note ». '
+'Vous pouvez choisir un <b>type</b>, <b>rattacher</b> la note à une activité ou à une rubrique, et indiquer le <b>temps passé</b> (5, 10, 15… minutes) : '
+'il alimente « Où passe le temps ».</p>'
+'<h4>En attente</h4>'
+'<p>Les tâches à faire, triées par échéance. Les boutons d’horizon (aujourd’hui, 1 semaine, 2 semaines…) limitent la liste ; '
+'une tâche en retard est en rouge. « Marquer fait » la clôt ; « Ouvrir la note » permet de la modifier ou de la reporter.</p>'
+'<h4>Où passe le temps</h4><p>La répartition du temps noté, par catégorie et par rubrique, sur la journée ou les 7 derniers jours.</p>'
+'<h4>Prochain jour</h4><p>Les activités prévues au prochain jour, avec leur dernière note, les points de vigilance et les tâches qui arrivent à échéance d’ici là : de quoi préparer la suite.</p>' },

{ id:"activites", titre:"Activités", vues:["chantiers"], html:
 '<p>Une <b>activité</b> est tout ce que vous menez : un projet, des travaux dans la maison, une formation, une démarche administrative, un loisir. '
+'Chacune a une catégorie, une date (facultative), un statut et une priorité.</p>'
+'<h4>Créer et retrouver</h4>'
+'<p>Les boutons « + Projet », « + Maison »… créent une activité. La liste se filtre par texte, catégorie, statut et période ; '
+'« Activités en cours » masque celles qui sont archivées.</p>'
+'<h4>La fenêtre d’une activité</h4><ul>'
+'<li>Les champs principaux (libellé, date, heure, durée, nature, personne ou structure, contact, lieu) et ceux propres à la catégorie (objectifs, points de vigilance…).</li>'
+'<li><b>+ Note</b> ajoute une note rattachée ; <b>+ Tâche</b> ajoute une tâche avec échéance, qui apparaîtra dans « En attente ».</li>'
+'<li>Les <b>notes liées</b> forment l’historique de l’activité.</li>'
+'<li><b>Archiver</b> range une activité terminée (on vous demande son issue) ; elle reste consultable et peut être réactivée.</li></ul>'
+'<h4>Tâches</h4>'
+'<p>Une tâche est une note avec une « suite à donner » et une échéance. Ouvrez la note pour la modifier, la reporter ou la marquer terminée.</p>'
+'<p class="pa-astuce">Une activité peut être <b>partagée</b> avec d’autres personnes : voir la rubrique « Partage à plusieurs ».</p>' },

{ id:"journal", titre:"Journal", vues:["journal"], html:
 '<p>Toutes vos notes, regroupées par jour, de la plus récente à la plus ancienne. La recherche porte sur le texte des notes. '
+'Un clic sur une note l’ouvre : vous pouvez la modifier, changer son rattachement, ajouter une suite à donner ou la supprimer.</p>'
+'<p class="pa-astuce">Les notes sont la mémoire de vos activités : une ligne par étape suffit, et vous retrouverez tout ici.</p>' },

{ id:"contacts", titre:"Contacts", vues:["contacts"], html:
 '<p>Les <b>contacts</b> (personnes) et les <b>organisations</b> (associations, administrations, artisans, commerces…). '
+'Recherchez par nom, entreprise, fonction ou téléphone ; filtrez par organisation ou par relation.</p>'
+'<p>Un contact peut être relié à des activités. Les contacts s’importent et s’exportent en CSV, par exemple depuis votre carnet d’adresses.</p>' },

{ id:"idees", titre:"Idées (Cristallisoir)", vues:["idees"], html:
 '<p>Le Cristallisoir transforme des envies en projets, en trois temps.</p>'
+'<h4>1. Déposer</h4>'
+'<p>Dans la <b>boîte à idées</b>, écrivez l’idée en quelques mots, une note si vous voulez, une catégorie, puis « Déposer l’idée ». '
+'Pas besoin de trier : c’est le rôle de l’étape suivante.</p>'
+'<h4>2. Regrouper</h4>'
+'<p>Les idées proches se rassemblent d’elles-mêmes en <b>méta-idées</b> (les membranes en pointillés). '
+'Le curseur <b>Sensibilité</b> règle ce regroupement : large, moyen ou strict. Une idée peut être « détachée » ou exclue du regroupement depuis sa fenêtre. '
+'Le bouton <b>Bulles / Tableau</b> change de vue ; en tableau, vous pouvez cocher plusieurs idées et les cristalliser ensemble.</p>'
+'<h4>3. Cristalliser</h4>'
+'<p>« Cristalliser avec Claude » fusionne une méta-idée (ou une idée seule) en une <b>idée unifiée</b> : titre, synthèse, objectifs, premières étapes, points de vigilance. '
+'Relisez, modifiez si besoin, puis <b>Créer l’activité</b> : elle apparaît dans Activités, et ses premières étapes deviennent des tâches. '
+'L’onglet « Devenues activités » garde la trace du chemin.</p>'
+'<p>Claude se règle dans <b>Données → Idées et Claude</b> (voir la rubrique Claude). Les catégories des idées sont celles des activités.</p>'
+'<p class="pa-astuce">Les idées peuvent être partagées : « Partager… » dans la fenêtre d’une idée, ou « Partagée dans… » au moment de la déposer.</p>' },

{ id:"veilles", titre:"Veilles", vues:["veilles"], html:
 '<p>Une <b>veille</b> collecte de l’information à votre rythme, la filtre et la range en <b>fiches</b>. Rien n’est repris deux fois.</p>'
+'<h4>Créer une veille</h4>'
+'<p>« + Nouvelle veille », puis un modèle (Point cyber, Point CVE, Failles exploitées, CVE critiques, Offres d’emploi) ou une veille vide. Dans la fenêtre :</p><dl>'
+'<dt>Sources</dt><dd>Flux RSS ou Atom (l’adresse se trouve souvent derrière l’icône orange, ou en ajoutant <code>/feed/</code> à l’adresse d’un site), '
+'failles exploitées (CISA KEV), CVE récentes (NVD) ou offres France Travail. « Vérifier » montre ce que la source contient.</dd>'
+'<dt>Filtres</dt><dd>Mots-clés à garder ou à écarter (sans tenir compte des accents ni des majuscules), ancienneté, nombre d’éléments par fiche, score CVSS minimum, contrats gardés pour les offres.</dd>'
+'<dt>Rythme</dt><dd>Toutes les N heures, chaque jour ou chaque semaine, à l’heure choisie.</dd>'
+'<dt>Exécutée par</dt><dd><b>Le serveur</b> tourne même quand vos appareils sont éteints ; <b>cet appareil</b> seulement quand l’application y est ouverte.</dd>'
+'<dt>Opérations par Claude</dt><dd>Facultatives : note de pertinence selon votre critère (avec un seuil sous lequel l’élément est écarté), résumé, suggestion « à creuser » ou « à faire », '
+'synthèse de la fiche, questions de révision chaque semaine. Une seule demande à Claude par exécution, et un plafond par jour.</dd></dl>'
+'<p><b>Tester</b> fait un essai à blanc : vous voyez ce qui serait collecté et gardé, sans rien enregistrer. « Exécuter maintenant » lance une vraie exécution.</p>'
+'<h4>Lire les fiches</h4>'
+'<p>Les fiches non lues sont signalées par une pastille sur l’onglet. Sur chaque élément : <b>→ Idée à creuser</b> le dépose dans le Cristallisoir, '
+'<b>→ Activité à faire</b> crée une activité. Quand Claude a fait une suggestion, le bouton correspondant est mis en avant.</p>'
+'<p class="pa-astuce">Offres France Travail : créez un accès gratuit sur francetravail.io (API « Offres d’emploi v2 ») et saisissez l’identifiant et la clé dans Données → Réglages, sur l’appareil ou le serveur qui exécute la veille.</p>' },

{ id:"partage", titre:"Partage à plusieurs", vues:[], html:
 '<p>Partagez des idées et des activités avec une autre personne, qui garde sa propre installation : ses données privées restent chez elle, les vôtres chez vous.</p>'
+'<h4>Comment ça marche</h4><ul>'
+'<li>Un <b>espace partagé</b> est hébergé par votre serveur et <b>chiffré de bout en bout</b> : le serveur ne voit que des fiches illisibles.</li>'
+'<li>Une idée ou une activité partagée est une <b>fiche vivante</b> : la même pour tous les membres, chacun peut la modifier.</li>'
+'<li>Si deux personnes modifient deux champs différents d’une même fiche, les deux modifications sont gardées. Pour un même champ, la plus récente l’emporte, et l’autre valeur est conservée dans le journal des conflits.</li></ul>'
+'<h4>Mettre en place (application de bureau, onglet Données, bloc Partage)</h4><ol>'
+'<li>Choisissez votre <b>nom affiché</b> et une couleur.</li>'
+'<li><b>Créer un espace</b> (votre synchronisation doit être configurée : votre serveur hébergera l’espace, joignable en HTTPS).</li>'
+'<li><b>Inviter une personne</b> (ou en <b>lecture seule</b>, ou <b>votre autre appareil</b>) : un lien à usage unique, valable 7 jours, à transmettre par un canal sûr.</li>'
+'<li>La personne colle le lien dans « Rejoindre un espace ». La clé lui est remise automatiquement à votre prochaine synchronisation.</li></ol>'
+'<h4>Partager</h4><ul>'
+'<li><b>Idées</b> : « Partager… » dans la fenêtre d’une idée, ou déposez-la directement dans un espace. Le filtre « Toutes / Mes idées / espace » choisit ce qui s’affiche.</li>'
+'<li><b>Activités</b> : « Partager cette activité… » dans sa fenêtre ; ses notes et tâches suivent. Une tâche peut être attribuée à un membre (champ « Pour »).</li>'
+'<li><b>Retirer du partage</b> ramène une copie dans votre privé et retire la fiche de l’espace pour tous.</li></ul>'
+'<h4>Rester au courant</h4>'
+'<p>Une pastille sur les onglets Idées et Activités compte les nouveautés ; la liste <b>Reçues</b> dit qui a fait quoi. '
+'Une notification du système apparaît si l’application est en arrière-plan (réglable dans le bloc Partage).</p>'
+'<h4>Retirer quelqu’un</h4><p>Son accès est coupé immédiatement et une nouvelle clé est remise aux autres membres : ce que l’espace contiendra désormais lui restera illisible.</p>' },

{ id:"donnees", titre:"Données, sauvegardes et synchronisation", vues:["donnees"], html:
 '<h4>Sauvegardes</h4><ul>'
+'<li><b>Historique des versions</b> : une version est gardée régulièrement pendant la saisie et à chaque « Enregistrer ». Vous pouvez revenir à une version antérieure ; rien n’est effacé, la restauration devient une nouvelle version.</li>'
+'<li><b>Instantanés</b> : une copie complète de la base, chaque jour et à la demande (« Instantané de la base »). Dans l’application de bureau, « Ouvrir le dossier des instantanés » vous montre les fichiers.</li>'
+'<li><b>Exporter / Importer</b> : « Exporter en JSON » produit un fichier de toutes vos données, à garder ailleurs. « Importer un fichier (remplacer) » le reprend en entier ; « Importer et fusionner » ajoute son contenu au vôtre. Les activités et les notes s’exportent aussi en CSV, pour un tableur.</li>'
+'<li>Les <b>idées</b> s’exportent et s’importent à part, dans le bloc « Idées et Claude ».</li></ul>'
+'<h4>Synchronisation entre vos appareils</h4>'
+'<p>Dans le bloc <b>Synchronisation</b> : l’adresse de votre serveur et son jeton. Ensuite, tout se synchronise fiche par fiche, toutes les 30 secondes et après chaque modification. '
+'Hors connexion, chaque appareil continue de fonctionner et se resynchronise au retour.</p>'
+'<p>Le jeton doit être <b>défini sur le serveur</b> (Données → Réglages du serveur, ou SYNC_TOKEN) et saisi à l’identique dans chaque application ; le mot de passe de l’interface web ne sert pas à la synchronisation. '
+'En cas de refus, le bloc Synchronisation affiche le motif exact : pas de jeton sur le serveur, jeton différent, authentification imposée par un proxy devant le serveur, page web au lieu du serveur.</p>'
+'<p class="pa-astuce">Depuis un navigateur, le serveur demande l’identifiant et le mot de passe sur sa <b>page de connexion</b> ; la session dure 30 jours. « Se déconnecter » se trouve dans Données → Réglages du serveur.</p>'
+'<p>Le <b>journal des conflits</b> garde la valeur écartée quand un même champ a été modifié sur deux appareils ; « Remettre l’écartée » la rétablit.</p>'
+'<h4>Réglages</h4>'
+'<p>« Modifier les réglages » : mot de passe et jeton du serveur, jeton Claude Code, rythmes des sauvegardes, identifiants France Travail. '
+'Ils sont appliqués sans redémarrage et ne sont jamais réaffichés en clair.</p>' },

{ id:"reglages", titre:"Paramètres, catégories et listes", vues:["param"], html:
 '<p>Les <b>Paramètres</b> (depuis Données) adaptent l’application à votre vie :</p><ul>'
+'<li><b>Catégories d’activité</b> : nom, couleur, symbole, champs propres, statuts. Elles servent aussi aux idées.</li>'
+'<li><b>Rubriques</b> : pour rattacher le temps passé qui ne relève d’aucune activité (maison, administratif, formation…).</li>'
+'<li><b>Listes</b> : types de note, natures, catégories d’organisation… Dans une liste déroulante, « + Ajouter à la liste… » ajoute une valeur sans passer par ici.</li>'
+'<li>Le <b>nom de l’application</b>, affiché en haut.</li></ul>' },

{ id:"claude", titre:"Claude", vues:[], html:
 '<p>Claude cristallise vos idées et enrichit vos veilles. Il fonctionne avec votre <b>abonnement claude.ai</b> (Pro ou Max), sans compte API payant.</p>'
+'<h4>Deux façons de l’utiliser</h4><dl>'
+'<dt>Claude Code (automatique)</dt><dd>Installez Claude Code sur l’ordinateur (ou le serveur) et connectez-le à votre compte : '
+'<code>claude</code> puis <code>/login</code>, ou un jeton obtenu avec <code>claude setup-token</code>, à saisir dans Données → Réglages. '
+'Les demandes partent ensuite toutes seules.</dd>'
+'<dt>Copier-coller</dt><dd>Sans Claude Code : la demande s’affiche, vous la collez dans une conversation claude.ai, puis vous collez la réponse dans l’application.</dd></dl>'
+'<p>Le choix et le test de connexion se font dans <b>Données → Idées et Claude → Connexion à Claude</b>. Le modèle Haiku est le plus économe en quota, Opus le plus approfondi.</p>'
+'<p class="pa-astuce">Pour les veilles exécutées par le serveur, Claude Code doit être connecté sur le serveur ; pour celles exécutées par un appareil, sur cet appareil.</p>' },

{ id:"pause", titre:"Pauses", vues:[], html:
 '<p>En haut à droite, « Pause dans… » compte le temps avant la prochaine pause. Le moment venu, une fenêtre vous propose une pause ; '
+'« Révéler » montre le menu suggéré (des idées de pause, selon le temps dont vous disposez), « Autre suggestion » en propose une autre.</p>'
+'<p>« OK, j’ai pris ma pause » relance le compteur ; « Plus tard, dans… » reporte de quelques minutes. Le bouton <b>Pause</b> ouvre ce menu à tout moment.</p>' },

{ id:"raccourcis", titre:"Raccourcis clavier", vues:[], html:
 '<table class="pa-tab"><tbody>'
+'<tr><td><kbd>F1</kbd></td><td>Ouvrir l’aide sur la rubrique de l’onglet affiché</td></tr>'
+'<tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Enregistrer tout de suite</td></tr>'
+'<tr><td><kbd>Ctrl</kbd>+<kbd>Entrée</kbd></td><td>Ajouter la note du journal du jour</td></tr>'
+'<tr><td><kbd>Entrée</kbd></td><td>Valider une tâche, un point de vigilance ou une idée en cours de saisie</td></tr>'
+'<tr><td><kbd>Échap</kbd></td><td>Fermer la fenêtre ouverte</td></tr>'
+'</tbody></table>' },

{ id:"depannage", titre:"Questions fréquentes", vues:[], html:
 '<dl>'
+'<dt>« Hors ligne, gardé dans ce navigateur »</dt><dd>Le serveur ne répond pas. Continuez : vos saisies sont gardées et envoyées automatiquement au retour de la connexion.</dd>'
+'<dt>« Conflit : données modifiées ailleurs »</dt><dd>Les données ont changé sur un autre appareil ou onglet pendant votre saisie. Choisissez de recharger la version du serveur ou de garder la vôtre ; l’autre reste dans l’historique des versions.</dd>'
+'<dt>Claude ne répond pas</dt><dd>Vérifiez la connexion dans Données → Idées et Claude (« Tester la connexion »). Si Claude Code n’est pas installé ou pas connecté, utilisez le copier-coller.</dd>'
+'<dt>Une veille ne trouve rien</dt><dd>Ouvrez-la et cliquez « Tester » : vous verrez combien d’éléments sont collectés et combien passent les filtres. Les filtres trop stricts sont la cause la plus fréquente ; une source en erreur est signalée en rouge.</dd>'
+'<dt>Je ne reçois pas les notifications</dt><dd>Elles n’apparaissent que si l’application est en arrière-plan. Vérifiez la case dans Données → Partage, et l’autorisation des notifications dans votre système.</dd>'
+'<dt>Où sont mes données ?</dt><dd>Dans l’application de bureau : menu Fichier → « Ouvrir le dossier des données ». Sur le serveur : dans le volume Docker <code>pilot-data</code>. '
+'Le chemin exact est affiché dans Données → Réglages.</dd>'
+'<dt>J’ai supprimé quelque chose par erreur</dt><dd>Données → Historique des versions : choisissez une version d’avant la suppression et restaurez-la.</dd>'
+'</dl>' }
];

var VUE_RUBRIQUE = {};
A.forEach(function(r){ r.vues.forEach(function(v){ VUE_RUBRIQUE[v] = r.id; }); });

var css = ''
+'#ppAide{padding:0;border:0;margin:0;background:transparent;width:100vw;height:100vh;max-width:none;max-height:none;align-items:center;justify-content:center}'
+'#ppAide[open]{display:flex}#ppAide::backdrop{background:rgba(25,28,27,.45)}'
+'#ppAide .pa-boite{background:#FBFBF9;width:min(1040px,calc(100vw - 32px));height:min(760px,calc(100vh - 40px));display:grid;grid-template-columns:250px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);border-top:3px solid var(--rouge,#D8232A);box-shadow:0 20px 60px rgba(0,0,0,.25)}'
+'#ppAide .pa-tete{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--trait,#d5d7d2)}'
+'#ppAide .pa-tete h3{margin:0;font-size:14px;letter-spacing:.12em;text-transform:uppercase}'
+'#ppAide .pa-tete input{margin-left:auto;width:240px;padding:6px 8px;border:1px solid var(--trait,#d5d7d2);border-radius:2px;font:inherit;font-size:13.5px}'
+'#ppAide .pa-tete button{border:0;background:none;font-size:18px;cursor:pointer;color:#5C625E;padding:2px 6px}'
+'#ppAide .pa-nav{border-right:1px solid var(--trait,#d5d7d2);overflow:auto;padding:8px 0}'
+'#ppAide .pa-nav button{display:block;width:100%;height:auto;text-align:left;border:0;border-left:3px solid transparent;border-radius:0;background:none;padding:7px 16px;margin:0;font:inherit;font-size:13.5px;letter-spacing:normal;text-transform:none;cursor:pointer;color:#191C1B;flex:none}'
+'#ppAide .pa-nav button:hover{background:#F0F1EE}'
+'#ppAide .pa-nav button[aria-current=true]{border-left-color:var(--rouge,#D8232A);background:#F0F1EE;font-weight:600}'
+'#ppAide .pa-corps{outline:none;overflow:auto;padding:18px 26px 30px;font-size:14.5px;line-height:1.55;color:#191C1B}'
+'#ppAide .pa-corps h2{margin:0 0 12px;font-size:20px}'
+'#ppAide .pa-corps h4{margin:20px 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#3b403d}'
+'#ppAide .pa-corps p{margin:0 0 10px}#ppAide .pa-corps ul,#ppAide .pa-corps ol{margin:0 0 10px;padding-left:22px}#ppAide .pa-corps li{margin:3px 0}'
+'#ppAide .pa-corps dt{font-weight:600;margin-top:10px}#ppAide .pa-corps dd{margin:2px 0 0 0;color:#2d322f}'
+'#ppAide .pa-intro{font-size:15.5px}'
+'#ppAide .pa-astuce{background:#F3F3F0;border-left:3px solid #2B4C6F;padding:8px 12px;margin-top:14px}'
+'#ppAide kbd{display:inline-block;padding:0 5px;border:1px solid #c9cbc5;border-bottom-width:2px;border-radius:3px;font:12px/18px var(--data,monospace);background:#fff}'
+'#ppAide code{font:12.5px var(--data,monospace);background:#F0F1EE;padding:0 4px}'
+'#ppAide .pa-tab td{padding:6px 14px 6px 0;border-bottom:1px dashed var(--trait,#d5d7d2)}'
+'#ppAide mark{background:#FFE9A8;padding:0}'
+'#ppAide .pa-pied{display:flex;justify-content:space-between;margin-top:26px;padding-top:12px;border-top:1px solid var(--trait,#d5d7d2)}'
+'#ppAide .pa-pied button{border:1px solid #191C1B;background:none;padding:6px 12px;font:inherit;font-size:12.5px;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}'
+'@media (max-width:760px){#ppAide .pa-boite{grid-template-columns:1fr;grid-template-rows:auto auto minmax(0,1fr)}#ppAide .pa-nav{border-right:0;border-bottom:1px solid var(--trait,#d5d7d2);display:flex;overflow-x:auto;padding:0}#ppAide .pa-nav button{white-space:nowrap;border-left:0;border-bottom:3px solid transparent}#ppAide .pa-nav button[aria-current=true]{border-bottom-color:var(--rouge,#D8232A)}#ppAide .pa-tete input{width:140px}}';

var boite = null, courante = A[0].id, avantFocus = null;
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function sansAccents(t){ return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function texteDe(html){ var d = document.createElement("div"); d.innerHTML = html; return d.textContent || ""; }

function construire(){
  if (boite) return boite;
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  boite = document.createElement("dialog");      /* fenêtre au premier plan, même au-dessus d'une autre fenêtre ouverte */
  boite.id = "ppAide"; boite.setAttribute("role", "dialog"); boite.setAttribute("aria-modal", "true"); boite.setAttribute("aria-label", "Aide");
  boite.innerHTML = '<div class="pa-boite"><div class="pa-tete"><h3>Aide</h3>'
    + '<input type="search" id="paCherche" placeholder="Rechercher dans l’aide…" aria-label="Rechercher dans l’aide">'
    + '<button id="paFermer" title="Fermer (Échap)" aria-label="Fermer">✕</button></div>'
    + '<div class="pa-nav" id="paNav" role="navigation" aria-label="Rubriques"></div><div class="pa-corps" id="paCorps" tabindex="-1"></div></div>';
  document.body.appendChild(boite);
  boite.addEventListener("click", function(e){
    if (e.target === boite || e.target.id === "paFermer" || e.target.closest("#paFermer")) return fermer();
    var b = e.target.closest("[data-pa]"); if (b) { afficher(b.dataset.pa); }
  });
  boite.querySelector("#paCherche").addEventListener("input", function(){ menu(); var q = this.value.trim(); if (q) { var r = resultats(q)[0]; if (r) afficher(r.id, true); } });
  boite.addEventListener("cancel", function(e){ e.preventDefault(); fermer(); });
  boite.addEventListener("keydown", function(e){
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (e.target.id === "paCherche" && e.target.value) return;      /* Échap vide d'abord la recherche */
    e.preventDefault(); fermer();
  });
  return boite;
}
function resultats(q){
  var mots = sansAccents(q).split(/\s+/).filter(Boolean);
  return A.filter(function(r){ var t = sansAccents(r.titre + " " + texteDe(r.html)); return mots.every(function(m){ return t.indexOf(m) >= 0; }); });
}
function menu(){
  var q = boite.querySelector("#paCherche").value.trim(), l = q ? resultats(q) : A;
  boite.querySelector("#paNav").innerHTML = l.length ? l.map(function(r){
    return '<button data-pa="' + r.id + '" aria-current="' + (r.id === courante) + '">' + esc(r.titre) + '</button>';
  }).join("") : '<div style="padding:10px 16px;font-size:13px;color:#5C625E">Aucun résultat</div>';
}
function surligner(html, q){
  var mots = sansAccents(q).split(/\s+/).filter(function(m){ return m.length > 2; });
  if (!mots.length) return html;
  var d = document.createElement("div"); d.innerHTML = html;
  var w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT), n, aTraiter = [];
  while ((n = w.nextNode())) aTraiter.push(n);
  aTraiter.forEach(function(t){
    var s = t.nodeValue, ns = sansAccents(s), i, j, morceaux = [], dernier = 0, pos = [];
    mots.forEach(function(m){ for (i = ns.indexOf(m); i >= 0; i = ns.indexOf(m, i + m.length)) pos.push([i, i + m.length]); });
    if (!pos.length) return;
    pos.sort(function(a, b){ return a[0] - b[0]; });
    var f = document.createDocumentFragment();
    pos.forEach(function(p){ if (p[0] < dernier) return; f.appendChild(document.createTextNode(s.slice(dernier, p[0])));
      var mk = document.createElement("mark"); mk.textContent = s.slice(p[0], p[1]); f.appendChild(mk); dernier = p[1]; });
    f.appendChild(document.createTextNode(s.slice(dernier))); t.parentNode.replaceChild(f, t);
  });
  return d.innerHTML;
}
function afficher(id, depuisRecherche){
  var r = A.filter(function(x){ return x.id === id; })[0] || A[0], i = A.indexOf(r);
  courante = r.id; menu();
  var q = boite.querySelector("#paCherche").value.trim();
  var c = boite.querySelector("#paCorps");
  c.innerHTML = '<h2>' + esc(r.titre) + '</h2>' + (q ? surligner(r.html, q) : r.html)
    + '<div class="pa-pied">' + (i > 0 ? '<button data-pa="' + A[i - 1].id + '">← ' + esc(A[i - 1].titre) + '</button>' : '<span></span>')
    + (i < A.length - 1 ? '<button data-pa="' + A[i + 1].id + '">' + esc(A[i + 1].titre) + ' →</button>' : '<span></span>') + '</div>';
  c.scrollTop = 0;
  if (!depuisRecherche) c.focus({ preventScroll: true });
}
function ouvrir(id){
  construire();
  if (!boite.open) { avantFocus = document.activeElement; boite.showModal(); }
  afficher(id || courante);
}
function fermer(){
  if (!boite) return;
  if (boite.open) boite.close();
  if (avantFocus && avantFocus.focus) try { avantFocus.focus(); } catch (e) {}
}
/** Ouvre l'aide ; sans argument, sur la rubrique de l'onglet affiché. */
window.ouvrirAide = function(id){
  ouvrir(id || VUE_RUBRIQUE[typeof vueActive !== "undefined" ? vueActive : ""] || courante);
};
window.fermerAide = fermer;

document.addEventListener("keydown", function(e){
  if (e.key === "F1") { e.preventDefault(); window.ouvrirAide(); }
});
/* bouton « Aide » de l'en-tête, et liens « Aide » posés dans les pages (data-aide="rubrique") */
document.addEventListener("click", function(e){
  var b = e.target.closest && e.target.closest("#btnAide,[data-aide]");
  if (!b) return;
  e.preventDefault();
  window.ouvrirAide(b.dataset.aide || undefined);
});
(function(){ var st = document.createElement("style");
  st.textContent = "#btnAide{border-color:#4A514C;color:#C9CFC9;background:transparent;margin-right:6px}#btnAide:hover{border-color:#8C938E;color:#fff;opacity:1}"
    + ".pp-aide-lien{border:0;background:none;color:#2B4C6F;text-decoration:underline;text-underline-offset:2px;cursor:pointer;font:inherit;font-size:12.5px;padding:0;margin-left:8px}";
  document.head.appendChild(st); })();
/* depuis l'onglet Idées (cadre intégré) */
window.addEventListener("message", function(e){
  if (e.origin === location.origin && e.data && e.data.src === "cristallisoir" && e.data.type === "aide") window.ouvrirAide(e.data.rubrique || "idees");
});
})();

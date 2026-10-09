# Incubation — proposition

Statut : **en cours sous le nom « Veilles »**. 0.11 : socle sans Claude, livré (onglet Veilles, flux RSS/Atom, filtres, rythme, exécutant au choix entre le serveur et un appareil, essai à blanc, fiches, notifications, vers Idées/Activités). Suite : 0.12 opérations Claude (notation, résumés, synthèse, actions proposées), 0.13 sources spécialisées (NVD, CISA KEV, France Travail) et révision.

Décisions : nom « Veilles » ; chaque veille est exécutée, au choix, par le serveur ou par une application de bureau donnée.

Objectif : une section **Incubation** qui produit chaque jour une fiche courte par sujet, lisible en 3 minutes et reliée au reste de l'application. Ce qui mérite d'être retenu devient une idée, une activité ou une candidature.

## Principe : collecter sans Claude, synthétiser avec Claude

1. **Collecte, sans Claude** : le serveur (24 h/24) récupère chaque nuit des sources fiables (flux RSS, API publiques, fichiers JSON officiels). Il dédoublonne et filtre par règles simples : mots-clés, seuil de gravité, zone géographique.
2. **Synthèse, avec Claude** : un appel par sujet et par jour, via le pont Claude Code existant. Claude reçoit les éléments filtrés et rend une fiche structurée :
   - 5 points au plus ;
   - « ce que ça change pour moi » ;
   - le lien vers chaque source.
3. **Agent exploratoire (option)** : pour un sujet sans source connue, Claude Code cherche lui-même sur le web. Il n'a que des outils de lecture (recherche, lecture de pages), ni commandes ni écriture. Cela consomme plus de quota, donc c'est réservé aux sujets personnalisés.

Avantages :
- points reproductibles et vérifiables, chaque affirmation étant sourcée ;
- consommation de l'abonnement prévisible (environ 4 à 6 appels par jour), avec un plafond réglable.

## Sujets de départ

| Sujet | Sources possibles | Apport de la fiche |
|---|---|---|
| **Point CVE** | CISA KEV (failles exploitées activement), avis CERT-FR, NVD, base européenne EUVD (ENISA) | Failles qui concernent une liste de logiciels déclarée (Debian, Qubes, Node, Electron…), triées par gravité et exploitation réelle |
| **Point cyber général** | CERT-FR (alertes, actualités), ANSSI, flux RSS de médias spécialisés choisis | 3 à 5 faits marquants, avec « pourquoi c'est important » |
| **Marché du travail IT** | Études APEC, Numeum, DARES, publications sectorielles (rythme hebdomadaire) | Métiers qui recrutent, salaires publiés, compétences demandées |
| **Offres d'emploi** | API officielle des offres de France Travail (gratuite, sur inscription) | Nouvelles offres selon les critères (poste, alternance AIS, région lyonnaise…), avec score de pertinence et « pourquoi ça colle ou pas » |

Exclus : la collecte automatique sur LinkedIn ou Indeed, qui est contraire à leurs conditions d'utilisation. Une offre peut en revanche être collée à la main pour analyse.

## Sujets personnalisables

Un sujet se définit par une fiche de réglage :
- **nom** ;
- **sources** : connecteurs prêts à l'emploi ou adresses RSS ;
- **mots-clés** inclus et exclus ;
- **angle** : consigne donnée à Claude, par exemple « explique comme à une alternante AIS » ou « impact pour une micro-entreprise » ;
- **fréquence** : quotidienne ou hebdomadaire ;
- **seuil** ;
- **format** : fiche courte, détaillée, ou liste.

Sans source, le sujet bascule en mode exploratoire.

## Rendre l'information assimilable

- **Actions sur chaque élément** :
  - « À creuser » : l'élément devient une idée dans le Cristallisoir ;
  - « À faire » : il devient une activité ou une tâche (ex. « patcher Node sur le serveur ») ;
  - « Candidater » : il crée une activité de candidature avec relance à J+7 ;
  - 👍 / 👎 : affine les filtres.
- **Synthèse de la semaine** (le dimanche) : ce qui a compté, les tendances, ce qui est devenu une action.
- **Révision** : quelques questions de mémorisation tirées de la semaine, espacées dans le temps.
- **Archive consultable** : recherche dans les fiches passées par sujet, CVE ou employeur.

## Intégration à l'existant

- Le travail tourne sur le **serveur Docker** avec un planificateur (ex. 6 h). Les fiches sont des fiches synchronisées comme les autres et arrivent sur les appareils.
- Claude Code utilise l'abonnement via `CLAUDE_CODE_OAUTH_TOKEN`, comme aujourd'hui.
- **Sécurité** :
  - le contenu venu du web est traité comme de la donnée, jamais comme des consignes ;
  - l'agent n'a que des outils de lecture ;
  - sa réponse est vérifiée contre un format attendu ;
  - aucune action, candidature comprise, n'est déclenchée sans clic de l'utilisatrice.
- Avec le partage (0.8+), un sujet pourra plus tard alimenter un espace partagé.

## Découpage indicatif (après 0.10)

1. **Socle et Point CVE** : planificateur, sujets, collecte, archive. Le Point CVE peut fonctionner sans Claude : KEV + CERT-FR filtrés sur la liste de logiciels.
2. **Synthèse par Claude** : Point cyber et marché du travail ; actions vers Idées et Activités.
3. **Offres d'emploi** : API France Travail, score de pertinence, suivi des candidatures.
4. **Sujets personnalisés** : agent exploratoire, synthèse de la semaine, révision.

## Points à préciser avant de commencer

- Critères des offres suivies : alternance, CDI, zone géographique.
- Liste des logiciels à surveiller pour le Point CVE.
- Vérifier les outils web disponibles pour Claude Code utilisé avec un abonnement (mode exploratoire).

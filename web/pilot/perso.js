/* My Pilot Personal Edition — couche personnelle posée sur PST·PILOT (non modifié, voir scripts/build_pilot.py).
 *
 * 1. Profil personnel : listes, catégories et modules adaptés à la vie hors travail.
 * 2. Persistance serveur : les données vivent dans la base SQLite, via /api/docs/pilot.
 *    Le localStorage ne sert plus que de tampon hors ligne.
 * 3. Onglet Idées : le Cristallisoir, intégré, qui transforme une idée en activité.
 */
"use strict";
(function(){

var DOC = "pilot";
var API = "../api/";
var CLE_SYNC = "my-pilot-personal-edition-sync";        /* { base: rev du serveur au moment de la modif locale } */

/* ================= 1. profil personnel ================= */
CLE = "my-pilot-personal-edition-v1";
/* reprise des tampons enregistrés sous l'ancien préfixe (versions 0.1 à 0.5) */
(function(){
  try{
    [["pilot-perso-v1",CLE],["pilot-perso-sync",CLE_SYNC]].forEach(function(x){
      var v=localStorage.getItem(x[0]);
      if(v!==null && localStorage.getItem(x[1])===null) localStorage.setItem(x[1],v);
      if(v!==null) localStorage.removeItem(x[0]);
    });
  }catch(e){}
})();
nomFichier = "my-pilot-personal-edition-data.json";                   /* tampon distinct de celui de PST·PILOT */
NOM_DEFAUT = "My Pilot Personal Edition";
TYPES_DEFAUT = ["Rendez-vous","Atelier","Démarche","Entraînement","Achat","Autre"];
TYPES_NOTE = ["Avancement","Idée","Appel","Démarche","Lecture","Autre"];
OUVRAGES = [];
MOTIFS_APPEL = ["Autre"];
MOTIFS_CONVOC = [];
THEMES_ANIM = [];
TYPES_TRANSV = [];
ETATS_AFFAIRE = [];
STATUTS_DESH = [];
SEGMENTS = [];
TYPES_DOSSIER = [];
FAMILLES = [["essentiel","Essentiel"],["entretien","Entretien"],["progres","Progrès"]];
RUBRIQUES_DEFAUT = [
  {id:"r-maison",nom:"Maison",famille:"entretien",auto:""},
  {id:"r-admin",nom:"Administratif perso",famille:"essentiel",auto:""},
  {id:"r-formation",nom:"Formation",famille:"progres",auto:""},
  {id:"r-projets",nom:"Projets",famille:"progres",auto:""}
];
var CATS_ORG_PERSO = ["Association","Club","Administration","Commerce / artisan","Santé","Proche","Autre"];
var LISTES_PERSO = {
  types_projet:["Création","Aménagement","Apprentissage","Engagement","Autre"],
  types_maison:["Entretien","Rénovation","Jardin","Équipement","Autre"],
  types_formation:["Cours en ligne","Certification","Lecture","Atelier","Exercice pratique","Autre"],
  types_demarche:["Administratif","Banque / assurance","Santé","Impôts","Logement","Autre"],
  types_loisir:["Sport","Sortie","Voyage","Création","Autre"]
};
function categoriesPerso(){
  return [
    {cle:"projet",lib:"Projet",plur:"Projets",genre:"m",sym:"◇",couleur:"#3E5BA9",liste:"types_projet",
     champ:"Nature",tiers:"Personne / structure",tiers_type:"mixte",statuts:"statuts_simples",clos:"realise",
     place:"Ex : Potager en carrés surélevés",
     champs:[{cle:"origine",lib:"Origine",type:"texte"},
             {cle:"objectifs",lib:"Objectifs",type:"texte_long"},
             {cle:"vigilance",lib:"Points de vigilance",type:"texte_long"}]},
    {cle:"maison",lib:"Maison",plur:"Maison",genre:"f",sym:"⌂",couleur:"#2F8C6A",liste:"types_maison",
     champ:"Type de travaux",tiers:"Artisan / fournisseur",tiers_type:"mixte",statuts:"statuts_simples",clos:"realise",
     place:"Ex : Remplacer la gouttière",
     champs:[{cle:"lieu",lib:"Lieu",type:"texte"},{cle:"budget",lib:"Budget estimé (€)",type:"nombre"}]},
    {cle:"formation",lib:"Formation",plur:"Formations",genre:"f",sym:"✎",couleur:"#7D5BA6",liste:"types_formation",
     champ:"Format",tiers:"Organisme / formateur",tiers_type:"mixte",statuts:"statuts_simples",clos:"realise",
     place:"Ex : Module réseau, chapitre 4",
     champs:[{cle:"plateforme",lib:"Plateforme",type:"texte"},{cle:"objectif_fin",lib:"Objectif de fin",type:"date"}]},
    {cle:"demarche",lib:"Démarche",plur:"Démarches",genre:"f",sym:"§",couleur:"#8A6320",liste:"types_demarche",
     champ:"Nature",tiers:"Organisme",tiers_type:"organisation",statuts:"statuts_rdv",clos:"termine",
     place:"Ex : Renouveler l'assurance habitation"},
    {cle:"loisir",lib:"Loisir",plur:"Loisirs",genre:"m",sym:"♪",couleur:"#C4607A",liste:"types_loisir",
     champ:"Activité",tiers:"Club / personne",tiers_type:"mixte",statuts:"statuts_simples",clos:"realise",
     place:"Ex : Stage du week-end"}
  ].map(normaliserCat);
}
modeleCategories=function(){
  for(var k in LISTES_PERSO) if(!estTableau(D.parametres[k])) D.parametres[k]=LISTES_PERSO[k].slice();
  return categoriesPerso();
};
function appliquerProfil(v,p){
  /* première ouverture d'un jeu de données sans profil : réglages personnels */
  var P=v.parametres;
  P.profil="perso";
  P.mod_dtdict=false;
  P.mod_permanence=false;
  if(p.gestionnaire==null) P.gestionnaire="";
  if(!p.jours_ouvres) P.jours_ouvres=[1,2,3,4,5,6,0];
  if(!p.categories_org) P.categories_org=CATS_ORG_PERSO.slice();
  if(!p.nom_app) P.nom_app=NOM_DEFAUT;
  if(!estTableau(p.categories) || !p.categories.length) P.categories=categoriesPerso();
  P.rubriques=(P.rubriques||[]).filter(function(r){ return r.auto!=="appels" && r.auto!=="dtdict" });
  if(!P.rubriques.length) P.rubriques=RUBRIQUES_DEFAUT.map(function(r){return {id:r.id,nom:r.nom,famille:r.famille,auto:r.auto}});
  for(var k in LISTES_PERSO) if(!estTableau(P[k])) P[k]=LISTES_PERSO[k].slice();
  v.permanence.rappels=[];
}
var vierge0=vierge;
vierge=function(){
  var v=vierge0();
  appliquerProfil(v,{});
  return v;
};
var normaliser0=normaliser;
normaliser=function(o){
  var v=normaliser0(o),p=(o&&o.parametres)||{},k;
  /* PST·PILOT ne garde que les clés qu'il connaît : on conserve les nôtres */
  for(k in p) if(p.hasOwnProperty(k) && !(k in v.parametres)) v.parametres[k]=p[k];
  for(k in o) if(o.hasOwnProperty(k) && !(k in v)) v[k]=o[k];
  if(p.profil!=="perso") appliquerProfil(v,p);
  else if(!p.mig_appels) v.parametres.rubriques=v.parametres.rubriques.filter(function(r){ return r.auto!=="appels" });
  for(k in LISTES_PERSO) if(!estTableau(v.parametres[k])) v.parametres[k]=LISTES_PERSO[k].slice();
  /* anciens noms par défaut → nouveau nom ; un nom choisi par l'utilisatrice est conservé */
  if(["Pilot Perso","My Pilot","PST Pilot",""].indexOf(String(v.parametres.nom_app||"").trim())!==-1) v.parametres.nom_app=NOM_DEFAUT;
  sansModulesPro(v);
  sansValeurAjout(v);
  return v;
};
/* « ＋ Ajouter à la liste… » enregistré tel quel (bug de l'application de bureau, 0.7.0) : on l'efface */
function sansValeurAjout(v){
  Object.keys(v).forEach(function(k){
    if(!estTableau(v[k])) return;
    v[k].forEach(function(f){ if(f && typeof f==="object") for(var c in f) if(f[c]==="__add__") f[c]="" });
  });
  for(var k in v.parametres) if(estTableau(v.parametres[k])) v.parametres[k]=v.parametres[k].filter(function(x){ return x!=="__add__" });
}
/* assistance téléphonique et compteur de traitement : supprimés de la version personnelle */
function sansModulesPro(v){
  v.parametres.mod_dtdict=false;
  v.parametres.mod_permanence=false;
  v.parametres.rubriques=(v.parametres.rubriques||[]).filter(function(r){ return r.auto!=="appels" && r.auto!=="dtdict" });
  v.permanence.actif=false; v.permanence.rappels=[];
  v.parametres.gestionnaire="";
  (v.parametres.categories||[]).forEach(function(K){ K["import"]=false; K.filtre=""; K.regle_lib="" });
}
tickPermanence=function(){};
tickCompteur=function(){};
var serialise0=serialise;
serialise=function(format){
  var t=serialise0(format);
  D.meta.app="My Pilot Personal Edition"; D.meta.base="PST Pilot";
  return t;
};

/* ================= 2. persistance serveur ================= */
var Sync={rev:0,etat:"init",envoi:false,encore:false,dernier:null,erreur:"",version:"",schema:""};
var BASE_PST=APP_VERSION;            /* version de PST·PILOT dont dérive le pilotage */
window.__pilotSync=Sync;            /* diagnostic : état de la synchronisation */

function api(chemin,opts){
  opts=opts||{};
  return fetch(API+chemin,{method:opts.method||"GET",
    headers:opts.body?{"Content-Type":"application/json"}:{},
    body:opts.body?JSON.stringify(opts.body):undefined,credentials:"same-origin"})
  .then(function(r){
    return r.json().catch(function(){return null}).then(function(b){ return {status:r.status,ok:r.ok,body:b} });
  });
}
function lireSync(){ try{ return JSON.parse(localStorage.getItem(CLE_SYNC)||"null") }catch(e){ return null } }
function poserSync(v){ try{ v?localStorage.setItem(CLE_SYNC,JSON.stringify(v)):localStorage.removeItem(CLE_SYNC) }catch(e){} }

fsaDispo=function(){ return false };            /* jamais de sélecteur de fichier : le serveur fait foi */
autoActif=function(){ return D.parametres.auto!==false };
tickSauvegarde=function(){};
lierFichier=function(){ $("#fichierCache").dataset.mode="remplacer"; $("#fichierCache").click() };
ouvrirFichier=function(){
  if(sale && !donneesVides()
     && !confirm("Importer un fichier remplacera les données affichées (l'historique du serveur garde la version actuelle). Continuer ?")) return;
  lierFichier();
};
var modifie0=modifie;
modifie=function(){
  Sync.gen=(Sync.gen||0)+1;
  if(!lireSync()) poserSync({base:Sync.rev});
  modifie0();
};
ecrireFichier=function(silencieux){ return envoyer(silencieux?"auto":"manual") };
enregistrer=function(){
  ecrireLocal();
  envoyer("manual").then(function(ok){ if(ok) toast("Enregistré sur le serveur") });
};

function envoyer(raison,forcer){
  if(Sync.envoi){ Sync.encore=true; return Promise.resolve(false) }
  if(Sync.etat==="conflit" && !forcer) return Promise.resolve(false);
  Sync.envoi=true; majEtat();
  var genEnvoi=Sync.gen||0;
  D.meta.modifie_le=D.meta.modifie_le||new Date().toISOString();
  D.meta.app="My Pilot Personal Edition"; D.meta.app_version=Sync.version; D.meta.version=VERSION;
  affecterPartages();
  return pousserPartages().then(function(){ return api("docs/"+DOC,{method:"PUT",body:{data:privD(),baseRev:Sync.rev,reason:raison}}) })
  .then(function(r){
    if(r.status===409){ Sync.etat="conflit"; conflit(r.body); return false }
    if(!r.ok) throw new Error((r.body&&r.body.message)||("HTTP "+r.status));
    Sync.etat="ok"; Sync.erreur=""; Sync.dernier=new Date(); dernierEnr="à "+hNow();
    if(r.body.data){
      /* le serveur a fusionné nos changements avec d'autres (autre onglet, synchronisation) */
      if((Sync.gen||0)===genEnvoi && calme()) adopter(r.body.data,r.body.rev);
      else if((Sync.gen||0)===genEnvoi){ sale=false; poserSync(null) }
      /* sinon (saisie en cours) : on garde l'ancienne base ; le prochain envoi refusionnera,
         et suivreServeur() reprendra la version fusionnée dès que la saisie sera terminée */
      if(r.body.conflicts) toast(r.body.conflicts+" fiche(s) modifiée(s) aussi ailleurs : votre saisie a été gardée (voir Données, Synchronisation)",true);
      return true;
    }
    Sync.rev=r.body.rev;
    if((Sync.gen||0)===genEnvoi){ sale=false; poserSync(null); }
    return true;
  })
  .catch(function(e){
    Sync.etat="horsligne"; Sync.erreur=e.message||"";
    return false;
  })
  .then(function(ok){
    Sync.envoi=false;
    if(Sync.encore){ Sync.encore=false; setTimeout(function(){ envoyer("auto") },60) }
    majEtat(); if(vueActive==="donnees") rendreDonneesSiCalme();
    return ok;
  });
}
/* aucune saisie en cours : on peut remplacer les données affichées sans rien perdre */
function calme(){
  var mod=$("#modale"), a=document.activeElement;
  if(mod && mod.open) return false;
  if(a && a!==document.body && $("#vue").contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.value) return false;
  return true;
}
function adopter(data,rev){
  D=avecPartages(normaliser(data)); M=D.carte;
  Sync.rev=rev; sale=false; poserSync(null); ecrireLocal();
  rendre();
}
/* changements arrivés d'ailleurs (synchronisation, autre onglet) : repris dès que la saisie le permet */
function suivreServeur(){
  if(Sync.etat!=="ok" || Sync.envoi || sale || !calme()) return;
  var gen=Sync.gen||0;
  api("docs/"+DOC+"/rev").then(function(r){
    if(!r.ok || r.body.rev<=Sync.rev) return;
    return api("docs/"+DOC).then(function(d){
      if(!d.ok || (Sync.gen||0)!==gen || sale || Sync.envoi || !calme()) return;
      adopter(d.body.data,d.body.rev);
    });
  }).catch(function(){});
}
setInterval(suivreServeur,5000);
function rendreDonneesSiCalme(){
  var a=document.activeElement;
  if(!a || a===document.body || !$("#vue").contains(a)) rendre();
}
function conflit(b){
  ouvrirModale("Données modifiées ailleurs",
    '<p style="margin:0 0 10px;font-size:14px">Les données du serveur ont changé depuis votre dernier chargement '
    +'(autre appareil ou autre onglet'+(b&&b.updated_at?', le '+esc(new Date(b.updated_at).toLocaleString("fr-FR")):"")+').</p>'
    +'<div class="note-aide">Recharger affiche la version du serveur : vos modifications non enregistrées sont perdues. '
    +'Garder ma version l\'envoie au serveur ; la version écrasée reste dans l\'historique des versions.</div>',
    [{txt:"Garder ma version",classe:"creux",fn:function(){
        fermerModale(); Sync.rev=b.rev; Sync.etat="ok"; envoyer("manual",true);
      }},
     {txt:"Recharger la version du serveur",classe:"",droite:true,fn:function(){
        fermerModale(); recharger();
      }}]);
}
function recharger(){
  return api("docs/"+DOC).then(function(r){
    if(!r.ok) throw new Error("HTTP "+r.status);
    adopterServeur(r.body);
    toast("Version du serveur chargée");
  }).catch(function(){ toast("Serveur injoignable : rechargement impossible",true) });
}
function adopterServeur(doc){
  D=avecPartages(normaliser(doc.data)); M=D.carte;
  Sync.rev=doc.rev; Sync.etat="ok"; Sync.dernier=new Date(doc.updated_at);
  sale=false; poserSync(null); ecrireLocal(); rendre();
}

majEtat=function(){
  var e=$("#etat"),p=$("#pastille"),t=$("#etatTxt"),b=$("#btnEnr");
  if(!e) return;
  b.textContent="Enregistrer"; b.classList.toggle("creux",autoActif() && Sync.etat==="ok");
  var alerte=false,txt;
  if(Sync.etat==="init") txt="Connexion au serveur…";
  else if(Sync.etat==="conflit"){ txt="Conflit : données modifiées ailleurs"; alerte=true }
  else if(Sync.etat==="horsligne"){ txt="Hors ligne, gardé dans ce navigateur"; alerte=true }
  else if(Sync.envoi) txt="Enregistrement…";
  else if(sale){ txt=autoActif()?"Enregistrement…":"Modifications non enregistrées"; alerte=!autoActif() }
  else txt="Enregistré"+(dernierEnr?" "+dernierEnr:"");
  e.classList.toggle("sale",alerte); p.classList.toggle("sale",alerte);
  t.textContent=txt;
  t.title=Sync.erreur||"";
};

/* bloc de la vue Données */
/* ---- vue Données : diagnostic, journal des versions et listes du pilotage personnel ---- */
window.persoDiagnostic=function(){
  var etat={ok:["ok","synchronisé"],horsligne:["ko","hors ligne"],conflit:["ko","en conflit"],init:["","connexion…"]}[Sync.etat]||["",""];
  var loc=localDispo(), ko=Math.round(JSON.stringify(D).length/1024);
  var ligne=function(l,v,c){ return '<div>'+l+'<b class="'+(c||"")+'">'+v+'</b></div>' };
  return '<div class="bloc" style="margin-top:18px"><div class="bloc-tete"><h2>Diagnostic</h2></div><div class="bloc-corps diag">'
    +ligne("Serveur",etat[1],etat[0])
    +ligne("Version des données","n°"+Sync.rev+(Sync.dernier?" · "+esc(Sync.dernier.toLocaleString("fr-FR")):""))
    +ligne("Tampon hors ligne",loc?"actif":"indisponible",loc?"ok":"ko")
    +ligne("Claude",esc(Idees.claude||"…"),/indisponible|non renseignée/.test(Idees.claude||"")?"ko":"ok")
    +ligne("Version de l'application","My Pilot Personal Edition v"+esc(Sync.version||"?"))
    +ligne("Schéma de la base",Sync.schema?"v"+esc(String(Sync.schema)):"?")
    +ligne("Base","PST·PILOT v"+esc(BASE_PST))
    +ligne("Volume",D.chantiers.length+" activités · "+D.notes.length+" notes · "+(D.contacts||[]).length+" contacts · "+ko+" Ko")
  +'</div></div>';
};
/* journal des versions de la perso : affiché en tête de celui de la pro, dans la fenêtre À propos.
   Du plus récent au plus ancien ; le détail reste dans CHANGELOG.md. */
window.persoVersions=[
 ["0.14.1","Perso · En-tête stable sur fenêtre étroite ou en portrait : ligne d'état sur une deuxième ligne fixe, largeurs réservées."],
 ["0.14.0","Perso · Aide intégrée (bouton Aide, F1, recherche) et fenêtre de bienvenue au premier lancement."],
 ["0.13.0","Perso · Veilles : sources CISA KEV, NVD et France Travail, filtres score CVSS et contrats, questions de révision hebdomadaires."],
 ["0.12.0","Perso · Veilles : notes, résumés, actions proposées et synthèse par Claude, avec plafond quotidien."],
 ["0.11.0","Perso · Onglet Veilles : flux RSS et Atom, filtres, rythme, exécution par le serveur ou un appareil, fiches."],
 ["0.10.0","Perso · Partage : fusion champ par champ, nouvelle clé au retrait d'un membre, rôle lecteur."],
 ["0.9.0","Perso · Activités partagées : tâches attribuées, notes signées, boîte Reçues étendue aux activités."],
 ["0.8.0","Perso · Partage d'idées dans le Cristallisoir, boîte Reçues et notifications."],
 ["0.8.0-a","Perso · Espaces partagés chiffrés de bout en bout, invitations par lien, exposition par Caddy."],
 ["0.7.1","Perso · Correctifs : saisie « Ajouter à la liste » dans l'application de bureau, listes déroulantes qui ne débordent plus."],
 ["0.7.0","Perso · Réglages modifiables depuis l'application : mot de passe, jetons, Claude Code, instantanés."],
 ["0.6.0","Perso · Application de bureau autonome et synchronisation fiche par fiche avec le serveur."],
 ["0.5.2","Perso · Pause et libellés sans référence professionnelle."],
 ["0.5.1","Perso · Préfixe technique my-pilot-personal-edition et archive versionnée."],
 ["0.5.0","Perso · Nom par défaut My Pilot Personal Edition ; rapports de période retirés."],
 ["0.4.0","Perso · Idées : fiches en fenêtres centrées, idée unifiée modifiable avant de créer l'activité."],
 ["0.3.0","Perso · Restes du cadre professionnel retirés, diagnostic propre, listes limitées aux catégories actives."],
 ["0.2.0","Perso · Assistance téléphonique et compteur retirés ; catégories des idées partagées avec les activités."],
 ["0.1.0","Perso · Première version : pilotage personnel sur serveur, Cristallisoir intégré, pont Claude Code."]
];
/* listes modifiables : celles des catégories actives, plus les listes communes */
var LISTES_PRO={types_intervention:1,motifs_appel:1,motifs_convocation:1,themes_animation:1,types_transverse:1,
  etats_affaire:1,statuts_desherence:1,segments:1,types_dossier:1,marqueurs_fait:1,actes_prevention:1,ouvrages:1};
window.persoListes=function(){
  var l=[],vus={};
  categories().forEach(function(K){
    if(K.liste && !vus[K.liste]){ vus[K.liste]=1; l.push([K.liste,K.champ+" ("+K.plur+")"]) }
    (K.champs||[]).forEach(function(f){
      if(f.type==="liste" && f.liste && !vus[f.liste]){ vus[f.liste]=1; l.push([f.liste,f.lib+" ("+K.plur+")"]) }
    });
  });
  [["types_note","Types de note (journal)"],["categories_org","Catégories d'organisation"],["civilites","Civilités"],
   ["types_relation","Types de relation (libellé|réciproque)"]].forEach(function(x){ if(!vus[x[0]]){ vus[x[0]]=1; l.push(x) } });
  return l;
};
/* export CSV des activités : colonnes communes, puis les champs propres de chaque catégorie */
exportChantiersCSV=function(){
  var extra=[];
  categories().forEach(function(K){ (K.champs||[]).forEach(function(f){ extra.push({cat:K.cle,cle:f.cle,lib:f.lib+" ("+K.lib+")"}) }) });
  var e=["Date","Heure","Durée (min)","Catégorie","Référence","Libellé","Type","Personne / structure","Contact","Téléphone",
    "Commune","Lieu","Statut","Priorité","Commentaire"].concat(extra.map(function(x){ return x.lib }));
  var l=D.chantiers.filter(function(c){ return dansPeriode(c.date) })
    .sort(function(a,b){ return (a.date||"").localeCompare(b.date||"") })
    .map(function(c){
      return [c.date,c.heure,c.duree,catDe(c).lib,c.reference,c.libelle,c.type,c.tiers,c.contact_nom,c.contact_tel,
        c.commune,c.adresse,libStatut(c.statut),c.priorite,c.commentaire]
        .concat(extra.map(function(x){ return c.categorie===x.cat ? (c[x.cle]||"") : "" }));
    });
  telecharger("my-pilot-personal-edition-activites-"+suffixePeriode()+".csv",csv(e,l),"text/csv;charset=utf-8");
};
var listesDispo0=listesDispo;
listesDispo=function(){ return listesDispo0().filter(function(x){ return !LISTES_PRO[x[0]] && x[0]!=="contacts_ecartes" && x[0]!=="orgs_ecartees" }) };
(function(){
  var st=document.createElement("style");
  st.textContent='[data-k="col"]{display:none}';      /* colonne Excel des champs : sans objet ici */
  document.head.appendChild(st);
})();

/* ---- réglages (valeurs du .env modifiables depuis l'application) ---- */
var Reglages={data:null,charge:false};
function chargerReglages(){
  return api("settings").then(function(r){
    if(!r.ok) return;
    Reglages.data=r.body;
    if(vueActive==="donnees") rendreDonneesSiCalme();
  }).catch(function(){});
}
var SOURCE_LIB={application:"saisi ici",".env":"fichier .env","défaut":"par défaut"};
window.persoBlocReglages=function(){
  if(!Reglages.charge){ Reglages.charge=true; chargerReglages() }
  var d=Reglages.data, app=SyncDist.mode==="application";
  var titre=app?"Réglages de l'application":"Réglages du serveur";
  if(!d) return '<div class="bloc" style="margin-top:18px"><div class="bloc-tete"><h2>'+titre+'</h2></div><div class="bloc-corps"><div class="note-aide" style="margin:0">Chargement…</div></div></div>';
  var groupes={},ordre=[];
  d.items.forEach(function(it){ if(!groupes[it.group]){ groupes[it.group]=[]; ordre.push(it.group) } groupes[it.group].push(it) });
  var val=function(it){
    if(it.type==="secret") return it.set?'<b class="ok">renseigné</b>':'<b>non renseigné</b>';
    return '<b>'+esc(String(it.value))+'</b>';
  };
  return '<div class="bloc" style="margin-top:18px"><div class="bloc-tete"><h2>'+titre+'</h2></div><div class="bloc-corps">'
    +ordre.map(function(g){
      return '<div class="puce-lbl" style="margin:8px 0 4px">'+esc(g)+'</div><div class="diag">'
        +groupes[g].map(function(it){
          return '<div>'+esc(it.label)+' <span class="mono" style="font-size:11px;color:var(--encre-3)">'+esc(SOURCE_LIB[it.source]||it.source)+'</span>'+val(it)+'</div>';
        }).join("")+'</div>';
    }).join("")
    +'<div class="ligne" style="margin-top:12px"><button class="b" data-pp="reglages">Modifier les réglages</button></div>'
    +'<div class="puce-lbl" style="margin:14px 0 4px">'+"Informations"+'</div><div class="diag">'
      +d.readonly.map(function(x){ return '<div>'+esc(x.label)+'<b style="font-weight:400">'+esc(x.value)+'</b></div>' }).join("")
    +'</div>'
    +'<div class="note-aide">Une valeur saisie ici est enregistrée sur '+(app?"cet appareil":"ce serveur")+' et l\'emporte sur le fichier .env ; '
      +'elle n\'est pas synchronisée. Les secrets ne sont jamais réaffichés.'+(app?"":" Les réglages du fichier .env lus par Docker au démarrage restent à modifier dans ce fichier.")+'</div>'
  +'</div></div>';
};
function champReglage(it){
  var id="rg_"+it.key, h='<label class="champ" style="margin-top:10px">'+esc(it.label);
  if(it.type==="int"){
    h+='<input type="number" id="'+id+'" min="'+it.min+'" max="'+it.max+'" step="1" value="'+esc(String(it.value))+'"></label>'
      +'<div class="note-aide" style="margin-top:2px">Par défaut : '+esc(String(it.def))+'.</div>';
  }else if(it.type==="text"){
    h+='<input type="text" id="'+id+'" value="'+esc(String(it.value))+'" autocomplete="off"></label>';
  }else{
    h+='<input type="password" id="'+id+'" autocomplete="new-password" style="padding:6px 8px;border:1px solid var(--trait);border-radius:2px;background:#fff" '
      +'placeholder="'+(it.set?"renseigné : laisser vide pour le garder":"non renseigné")+'"></label>';
    if(it.key==="sync_token") h+='<div class="ligne" style="margin-top:4px"><button class="b mini creux" data-pp="rg-generer">Générer un jeton</button>'
      +'<span class="note-aide" id="rg_gen_note" style="margin:0"></span></div>';
    if(it.set) h+='<label style="font-size:13px;display:flex;gap:6px;align-items:center;margin-top:4px;text-transform:none;letter-spacing:0;font-family:var(--corps)">'
      +'<input type="checkbox" id="'+id+'_eff"> Effacer'+(it.key==="app_password"?" (l'interface ne sera plus protégée)":"")+'</label>';
  }
  if(it.source==="application") h+='<label style="font-size:13px;display:flex;gap:6px;align-items:center;margin-top:4px;text-transform:none;letter-spacing:0;font-family:var(--corps)">'
    +'<input type="checkbox" id="'+id+'_raz"> Revenir à la valeur '+(it.envSet?"du fichier .env":"par défaut")+'</label>';
  return h;
}
function modaleReglages(){
  var d=Reglages.data; if(!d) return;
  var groupes={},ordre=[];
  d.items.forEach(function(it){ if(!groupes[it.group]){ groupes[it.group]=[]; ordre.push(it.group) } groupes[it.group].push(it) });
  ouvrirModale(SyncDist.mode==="application"?"Réglages de l'application":"Réglages du serveur",
    ordre.map(function(g){ return '<div class="puce-lbl" style="margin:12px 0 0">'+esc(g)+'</div>'+groupes[g].map(champReglage).join("") }).join("")
    +'<div id="rgRes" class="note-aide" style="margin-top:12px;font-size:13.5px" role="status"></div>',
    [{txt:"Annuler",classe:"creux",fn:fermerModale},
     {txt:"Enregistrer",droite:true,fn:enregistrerReglages}]);
}
function enregistrerReglages(){
  var d=Reglages.data, ch={}, mdp=false;
  d.items.forEach(function(it){
    var id="rg_"+it.key, e=$("#"+id), raz=$("#"+id+"_raz"), eff=$("#"+id+"_eff");
    if(raz && raz.checked){ ch[it.key]=null; return }
    if(eff && eff.checked){ ch[it.key]=""; if(it.key==="app_password") mdp=true; return }
    if(!e) return;
    var v=e.value.trim();
    if(it.type==="int"){ if(v!=="" && +v!==it.value) ch[it.key]=+v }
    else if(it.type==="text"){ if(v!=="" && v!==it.value) ch[it.key]=v }
    else if(v!==""){ ch[it.key]=v; if(it.key==="app_password"||it.key==="app_user") mdp=true }
    if(it.key==="app_user" && v!==it.value) mdp=true;
  });
  var z=$("#rgRes");
  if(!Object.keys(ch).length){ fermerModale(); return }
  if(ch.app_password && ch.app_password.length<8){ z.textContent="Mot de passe : 8 caractères au moins."; z.style.color="var(--rouge)"; return }
  api("settings",{method:"PUT",body:ch}).then(function(r){
    if(!r.ok) throw new Error((r.body&&r.body.message)||"réglages refusés");
    Reglages.data.items=r.body.items;
    fermerModale(); rendre();
    if(mdp && r.body.auth){
      toast("Accès modifié : le navigateur va demander l'identifiant et le mot de passe");
      setTimeout(function(){ location.reload() },1800);
    } else toast("Réglages enregistrés");
    chargerReglages();
  }).catch(function(e){ z.textContent=e.message; z.style.color="var(--rouge)" });
}
function genererJeton(){
  var a=new Uint8Array(32); crypto.getRandomValues(a);
  var t=Array.prototype.map.call(a,function(x){ return ("0"+x.toString(16)).slice(-2) }).join("");
  var e=$("#rg_sync_token"); if(!e) return;
  e.type="text"; e.value=t; e.select();
  var n=$("#rg_gen_note");
  if(n) n.textContent="Copiez ce jeton maintenant : il ne sera plus affiché. Saisissez-le ensuite dans chaque application (Données → Synchronisation).";
  try{ navigator.clipboard.writeText(t).then(function(){ if(n) n.textContent="Jeton copié dans le presse-papiers. "+n.textContent },function(){}) }catch(x){}
}
/* premier accès à un serveur sans mot de passe : on le fait choisir avant tout */
function premierAcces(){
  var local=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  ouvrirModale("Protéger l'accès au serveur",
    '<p style="margin:0 0 10px;font-size:14px">Ce serveur n\'a pas encore de mot de passe : toute personne qui l\'atteint peut lire et modifier vos données. '
    +'Choisissez un identifiant et un mot de passe ; le navigateur les demandera ensuite.</p>'
    +'<div class="grille">'
      +'<label class="champ">Identifiant<input type="text" id="paUser" value="pilot" autocomplete="username"></label>'
      +'<label class="champ">Mot de passe (8 caractères au moins)<input type="password" id="paMdp" autocomplete="new-password" style="padding:6px 8px;border:1px solid var(--trait);border-radius:2px;background:#fff"></label>'
      +'<label class="champ">Confirmation<input type="password" id="paMdp2" autocomplete="new-password" style="padding:6px 8px;border:1px solid var(--trait);border-radius:2px;background:#fff"></label>'
    +'</div><div id="paRes" class="note-aide" style="margin-top:10px;font-size:13.5px" role="status"></div>',
    (local?[{txt:"Plus tard",classe:"creux",fn:fermerModale}]:[]).concat([{txt:"Protéger l'accès",droite:true,fn:function(){
      var u=$("#paUser").value.trim()||"pilot", p=$("#paMdp").value, p2=$("#paMdp2").value, z=$("#paRes");
      if(p.length<8){ z.textContent="Le mot de passe doit faire 8 caractères au moins."; z.style.color="var(--rouge)"; return }
      if(p!==p2){ z.textContent="Les deux saisies ne correspondent pas."; z.style.color="var(--rouge)"; return }
      api("settings",{method:"PUT",body:{app_user:u,app_password:p}}).then(function(r){
        if(!r.ok) throw new Error((r.body&&r.body.message)||"refusé");
        z.textContent="Accès protégé. Le navigateur va maintenant demander l'identifiant et le mot de passe."; z.style.color="var(--vert)";
        setTimeout(function(){ location.reload() },1800);
      }).catch(function(e){ z.textContent=e.message; z.style.color="var(--rouge)" });
    }}]));
  if(!local){
    var x=$("#modX"), dlg=$("#modale");
    if(x) x.style.display="none";
    if(dlg) dlg.addEventListener("cancel",function(e){ e.preventDefault() });   /* pas d'échappement avant protection */
  }
}

/* ---- synchronisation entre appareils ---- */
var SyncDist={st:null,mode:"",charge:false};
function majSyncDist(rendu){
  return api("sync/status").then(function(r){
    if(!r.ok) return;
    var avant=JSON.stringify(SyncDist.st); SyncDist.st=r.body;
    if(rendu!==false && vueActive==="donnees" && avant!==JSON.stringify(r.body)) rendreDonneesSiCalme();
  }).catch(function(){});
}
setInterval(function(){ if(vueActive==="donnees") majSyncDist() },10000);
window.persoBlocSync=function(){
  if(!SyncDist.charge){ SyncDist.charge=true; majSyncDist() }
  var st=SyncDist.st, hub=SyncDist.mode!=="application";
  var ligne=function(l,v,c){ return '<div>'+l+'<b class="'+(c||"")+'">'+v+'</b></div>' };
  var corps;
  if(!st) corps='<div class="note-aide" style="margin:0">Chargement…</div>';
  else{
    var etat=!st.configured?["","non configurée"]:!st.enabled?["","en pause"]:st.lastError?["ko",esc(st.lastError)]
      :st.lastOk?["ok","à jour, "+esc(new Date(st.lastOk).toLocaleString("fr-FR"))]:["","jamais lancée"];
    corps='<div class="diag" style="margin-bottom:10px">'
      +ligne("Serveur",st.configured?'<span class="mono">'+esc(st.url)+'</span>':"aucun")
      +ligne("État",etat[1],etat[0])
      +ligne("Fiches en attente d'envoi",String(st.pending),st.pending?"":"ok")
      +ligne("Conflits à consulter",String(st.conflicts),st.conflicts?"ko":"ok")
      +ligne("Identifiant de cet appareil",'<span class="mono">'+esc(st.device)+'</span>')
    +'</div>'
    +'<div class="ligne">'
      +'<button class="b" data-pp="sync-config">'+(st.configured?"Modifier":"Configurer")+'</button>'
      +(st.configured?'<button class="b creux" data-pp="sync-now">Synchroniser maintenant</button>':"")
      +'<button class="b creux" data-pp="sync-conflits">Journal des conflits</button>'
    +'</div>'
    +'<div class="note-aide">'+(hub
      ?'Ce serveur sert de point de synchronisation pour les applications de bureau (jeton SYNC_TOKEN de son fichier .env). '
       +'Il peut aussi se synchroniser lui-même avec un autre serveur.'
      :'Les fiches se synchronisent une par une : une modification faite ici et une autre faite ailleurs sur une fiche différente '
       +'sont toutes les deux gardées. Si la même fiche a changé des deux côtés, la plus récente l\'emporte et l\'autre version '
       +'est conservée dans le journal des conflits.')+'</div>';
  }
  return '<div class="bloc" style="margin-top:18px"><div class="bloc-tete"><h2>Synchronisation</h2></div><div class="bloc-corps">'+corps+'</div></div>';
};
function modaleSync(){
  var st=SyncDist.st||{};
  ouvrirModale("Synchronisation",
    '<label class="champ">Adresse du serveur<input type="text" id="syUrl" value="'+esc(st.url||"")+'" placeholder="https://pilot.exemple.fr"></label>'
    +'<label class="champ" style="margin-top:10px">Jeton de synchronisation<input type="password" id="syTok" autocomplete="off" '
      +'style="padding:6px 8px;border:1px solid var(--trait);border-radius:2px;background:#fff" '
      +'placeholder="'+(st.hasToken?"déjà renseigné : laisser vide pour le garder":"valeur de SYNC_TOKEN sur le serveur")+'"></label>'
    +'<div class="ligne" style="margin-top:10px"><label style="font-size:13.5px;display:flex;gap:6px;align-items:center">'
      +'<input type="checkbox" id="syOn"'+(st.enabled||!st.configured?" checked":"")+'> Synchroniser automatiquement (toutes les 30 s et après chaque modification)</label></div>'
    +'<div class="note-aide">Le serveur est votre installation Docker, accessible en HTTPS (proxy ou VPN). '
      +'Le jeton est la valeur SYNC_TOKEN de son fichier .env ; il reste enregistré sur cet appareil.</div>'
    +'<div id="syRes" class="note-aide" style="margin-top:10px;font-size:13.5px" role="status"></div>',
    [{txt:"Fermer",classe:"creux",fn:fermerModale},
     {txt:"Enregistrer et synchroniser",droite:true,fn:function(){
        var z=$("#syRes"), corps={url:$("#syUrl").value.trim(),enabled:$("#syOn").checked};
        var t=$("#syTok").value; if(t) corps.token=t;
        z.textContent="Synchronisation en cours…"; z.style.color="";
        api("sync/config",{method:"PUT",body:corps}).then(function(r){
          if(!r.ok) throw new Error((r.body&&r.body.message)||"réglages refusés");
          return api("sync/now",{method:"POST"});
        }).then(function(r){
          SyncDist.st=r.body;
          if(r.body.lastError){ z.textContent=r.body.lastError; z.style.color="var(--rouge)"; return }
          z.textContent="Synchronisation réussie."; z.style.color="var(--vert)";
          suivreServeur();
        }).catch(function(e){ z.textContent=e.message; z.style.color="var(--rouge)" });
     }}]);
}
function syncMaintenant(){
  api("sync/now",{method:"POST"}).then(function(r){
    SyncDist.st=r.body;
    if(r.body.lastError) toast(r.body.lastError,true); else toast("Synchronisation terminée");
    suivreServeur(); rendreDonneesSiCalme();
  }).catch(function(){ toast("Synchronisation impossible",true) });
}
var COLL_LIB={chantiers:"Activité",notes:"Note",vigilances:"Point de vigilance",contacts:"Contact",organisations:"Organisation",
  ideas:"Idée",unified:"Idée unifiée",projects:"Projet",_:"Réglage"};
function resumeFiche(o,coll,rid){
  if(o===null || o===undefined) return "<em>supprimée</em>";
  if(coll==="_") return esc(rid);
  return esc(o.libelle||o.title||o.nom||o.texte||trunc(o.contenu||"",60)||rid);
}
function trunc(t,n){ t=String(t||""); return t.length>n?t.slice(0,n-1)+"…":t }
function journalConflits(){
  api("sync/conflicts?limit=60").then(function(r){
    if(!r.ok) throw new Error();
    var l=r.body||[];
    ouvrirModale("Journal des conflits",
      (l.length?'<div class="note-aide" style="margin-top:0">Une fiche modifiée sur deux appareils (ou deux onglets) avant leur synchronisation : '
        +'les champs modifiés d\'un seul côté sont tous gardés ; pour un même champ modifié des deux côtés, la valeur la plus récente l\'emporte. '
        +'La valeur écartée peut être remise en place pour les activités, notes et contacts.</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:13.5px">'
        +'<tr><th style="text-align:left">Quand</th><th style="text-align:left">Fiche</th><th style="text-align:left">Gardée</th><th style="text-align:left">Écartée</th><th></th></tr>'
        +l.map(function(c,i){
          var remettable=c.doc==="pilot" && c.coll!=="_" && c.lost;
          return '<tr style="border-top:1px solid #ddd'+(c.seen?'':';background:#FFF7E0')+'"><td style="padding:6px 4px">'+esc(new Date(c.at).toLocaleString("fr-FR"))+'</td>'
            +'<td>'+esc(COLL_LIB[c.coll]||c.coll)+(c.champs?'<div class="note-aide" style="margin:0">champ'+(c.champs.length>1?'s':'')+' : '+esc(c.champs.join(", "))+'</div>':"")+'</td><td>'+resumeFiche(c.kept,c.coll,c.rid)+'</td><td>'+resumeFiche(c.lost,c.coll,c.rid)+'</td>'
            +'<td style="text-align:right">'+(remettable?'<button class="b mini creux" data-pp="conflit-remettre" data-i="'+i+'">Remettre l\'écartée</button>':"")+'</td></tr>';
        }).join("")+'</table>'
      :'<p>Aucun conflit enregistré.</p>'),
      [{txt:"Fermer",fn:function(){ fermerModale(); api("sync/conflicts/seen",{method:"POST"}).then(function(){ majSyncDist() }) }}]);
    journalConflits.liste=l;
  }).catch(function(){ toast("Journal indisponible",true) });
}
function remettreConflit(i){
  var c=(journalConflits.liste||[])[i]; if(!c||!c.lost) return;
  var liste=D[c.coll]; if(!estTableau(liste)) return;
  var k=-1; liste.forEach(function(x,j){ if(x&&x.id===c.rid) k=j });
  if(k>=0 && c.champs && c.champs.length){
    /* conflit sur quelques champs : seuls ces champs reprennent la valeur écartée */
    c.champs.forEach(function(ch){
      var p=ch.split("."), o=liste[k], l=c.lost, i;
      for(i=0;i<p.length-1;i++){ if(!o[p[i]]||typeof o[p[i]]!=="object") o[p[i]]={}; o=o[p[i]]; l=l&&l[p[i]] }
      if(l && p[p.length-1] in l) o[p[p.length-1]]=l[p[p.length-1]]; else delete o[p[p.length-1]];
    });
  }
  else if(k>=0) liste[k]=c.lost; else liste.push(c.lost);
  modifie(); fermerModale(); rendre(); toast("Version écartée remise en place");
}
document.addEventListener("click",function(e){
  var el=e.target.closest&&e.target.closest("[data-pp]");
  if(!el) return;
  var a=el.dataset.pp;
  if(a==="sync-config") modaleSync();
  else if(a==="sync-now") syncMaintenant();
  else if(a==="sync-conflits") journalConflits();
  else if(a==="reglages") modaleReglages();
  else if(a==="rg-generer") genererJeton();
  else if(a==="conflit-remettre") remettreConflit(+el.dataset.i);
});

/* ===== Partage : identité de l'appareil et espaces partagés (application de bureau) ===== */
var Partage={st:null,charge:false,indispo:false};
function majPartage(rendu){
  return api("partage").then(function(r){
    if(r.status===404){ Partage.indispo=true; return }
    if(!r.ok) return;
    var avant=JSON.stringify(Partage.st); Partage.st=r.body;
    if(rendu!==false && vueActive==="donnees" && avant!==JSON.stringify(r.body)) rendreDonneesSiCalme();
  }).catch(function(){});
}
setInterval(function(){ if(vueActive==="donnees" && !Partage.indispo) majPartage() },15000);
var STATUT_ESPACE={actif:["ok","actif"],en_attente:["","en attente de la clé (remise à la prochaine synchronisation de la personne qui invite)"],retire:["ko","retiré de l'espace"]};
var STATUT_MEMBRE={actif:"",en_attente:" · en attente",retire:" · retiré"};
var ROLE_LIB={proprietaire:"propriétaire",membre:"membre",lecteur:"lecteur"};
window.persoBlocPartage=function(){
  if(!Partage.charge){ Partage.charge=true; majPartage() }
  var titre='<div class="bloc" style="margin-top:18px"><div class="bloc-tete"><h2>Partage</h2></div><div class="bloc-corps">';
  if(Partage.indispo) return titre+'<div class="note-aide" style="margin:0">Les espaces partagés se créent et se rejoignent depuis l\'application de bureau. '
    +'Ce serveur les héberge chiffrés : il ne peut pas en lire le contenu.</div></div></div>';
  var st=Partage.st;
  if(!st) return titre+'<div class="note-aide" style="margin:0">Chargement…</div></div></div>';
  var id=st.identite, h='<div class="diag" style="margin-bottom:10px">'
    +'<div>Votre nom affiché<b>'+(id.nom?(id.couleur?'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+esc(id.couleur)+';margin-right:6px"></span>':"")+esc(id.nom):'<span class="ko">à choisir</span>')+'</b></div>'
    +'<div>Empreinte de cet appareil<b class="mono">'+esc(id.empreinte)+'</b></div></div>';
  st.espaces.forEach(function(e){
    var se=STATUT_ESPACE[e.status]||["",e.status], prop=e.role==="proprietaire" && e.status==="actif";
    h+='<div style="border:1px solid var(--trait);border-radius:2px;padding:10px 12px;margin:10px 0">'
      +'<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b style="font-size:15px">'+esc(e.nom)+'</b>'
        +'<span class="note-aide" style="margin:0">'+(ROLE_LIB[e.role]||e.role)+(e.role==="lecteur"?" (lecture seule)":"")+' · hébergé par <span class="mono">'+esc(e.host.replace(/^https?:\/\//,""))+'</span></span></div>'
      +'<div class="diag" style="margin:6px 0">'
        +'<div>État<b class="'+se[0]+'">'+esc(se[1])+'</b></div>'
        +(e.last_error?'<div>Alerte<b class="ko">'+esc(e.last_error)+'</b></div>':"")
        +'<div>Fiches partagées<b>'+e.fiches+(e.pending?' · '+e.pending+' à envoyer':"")+'</b></div>'
        +(e.status==="actif"?'<div>Clé de chiffrement<b>n° '+e.epoch+(e.epoch>1?' (renouvelée après un retrait)':"")+'</b></div>':"")
        +(e.last_ok?'<div>Dernier échange<b>'+esc(new Date(e.last_ok).toLocaleString("fr-FR"))+'</b></div>':"")
      +'</div>'
      +'<div style="font-size:13.5px;margin:8px 0 4px">Membres</div>'
      +e.membres.map(function(m){
        return '<div style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:13.5px'+(m.status==="retire"?';opacity:.55':"")+'">'
          +'<span style="width:10px;height:10px;border-radius:50%;flex:none;background:'+esc(m.couleur||"var(--trait)")+'"></span>'
          +'<span>'+esc(m.nom||"(nom pas encore reçu)")+(m.moi?" (cet appareil)":"")+(m.appareil&&!m.moi?' <span class="note-aide" style="margin:0">'+esc(m.appareil)+'</span>':"")
          +' <span class="note-aide" style="margin:0">'+(ROLE_LIB[m.role]||m.role)+(STATUT_MEMBRE[m.status]||"")+'</span></span>'
          +'<span class="mono" style="margin-left:auto;font-size:12px">'+esc(m.empreinte||"")+'</span>'
          +(prop && !m.moi && m.status!=="retire"?'<button class="b mini creux" data-pt="retirer" data-e="'+esc(e.id)+'" data-m="'+esc(m.member)+'" data-n="'+esc(m.nom||"ce membre")+'">Retirer</button>':"")
          +'</div>';
      }).join("")
      +'<div class="ligne" style="margin-top:8px">'
        +(prop?'<button class="b" data-pt="inviter" data-e="'+esc(e.id)+'" data-r="membre">Inviter une personne</button>'
          +'<button class="b creux" data-pt="inviter" data-e="'+esc(e.id)+'" data-r="lecteur">Inviter en lecture seule</button>'
          +'<button class="b creux" data-pt="inviter" data-e="'+esc(e.id)+'" data-r="proprietaire">Ajouter mon autre appareil</button>':"")
        +'<button class="b creux" data-pt="quitter" data-e="'+esc(e.id)+'" data-n="'+esc(e.nom)+'">'+(e.status==="retire"?"Effacer de cet appareil":"Quitter")+'</button>'
      +'</div></div>';
  });
  h+='<div class="ligne" style="margin-top:10px">'
    +'<button class="b'+(id.nom?" creux":"")+'" data-pt="identite">'+(id.nom?"Modifier mon nom":"Choisir mon nom affiché")+'</button>'
    +'<button class="b creux" data-pt="creer">Créer un espace</button>'
    +'<button class="b creux" data-pt="rejoindre">Rejoindre un espace</button>'
    +(st.espaces.length?'<button class="b creux" data-pt="sync">Synchroniser les espaces</button>':"")
  +'</div>'
  +(st.espaces.length?'<div class="ligne" style="margin-top:10px"><label style="font-size:13.5px;display:flex;gap:6px;align-items:center">'
    +'<input type="checkbox" id="ptNotif"'+(st.notifications&&st.notifications.systeme===false?"":" checked")+'> '
    +'Notification du système quand un membre partage, modifie ou cristallise une idée (application en arrière-plan)</label></div>':"")
  +'<div class="note-aide">Un espace partagé est hébergé par votre serveur et chiffré de bout en bout : le serveur ne voit que des fiches illisibles. '
    +'La personne invitée garde ses données privées chez elle. Le partage d\'idées depuis l\'onglet Idées arrive avec la prochaine version.</div>';
  return titre+h+'<div class="note-aide"><button class="pp-aide-lien" style="margin:0" data-aide="partage">Comment fonctionne le partage ?</button></div></div></div>';
};
function resPartage(z,msg,ok){ z.textContent=msg; z.style.color=ok?"var(--vert)":"var(--rouge)" }
function appelPartage(chemin,corps,z){
  if(z) resPartage(z,"En cours…",true), z.style.color="";
  return api("partage/"+chemin,{method:"POST",body:corps||{}}).then(function(r){
    if(!r.ok) throw new Error((r.body&&r.body.message)||"opération refusée");
    return r.body;
  });
}
function modaleIdentite(){
  var id=(Partage.st||{}).identite||{};
  ouvrirModale("Votre nom affiché",
    '<label class="champ">Nom vu par les autres membres<input type="text" id="ptNom" maxlength="60" value="'+esc(id.nom||"")+'" placeholder="ex. Stella"></label>'
    +'<label class="champ" style="margin-top:10px">Couleur<input type="color" id="ptCoul" value="'+esc(id.couleur||"#2f6f8f")+'" style="width:60px;height:32px;padding:0"></label>'
    +'<div class="note-aide">Le nom et la couleur ne circulent que chiffrés, dans les espaces dont vous êtes membre.</div>'
    +'<div id="ptRes" class="note-aide" role="status"></div>',
    [{txt:"Annuler",classe:"creux",fn:fermerModale},{txt:"Enregistrer",droite:true,fn:function(){
      var z=$("#ptRes");
      api("partage/identite",{method:"PUT",body:{nom:$("#ptNom").value,couleur:$("#ptCoul").value}}).then(function(r){
        if(!r.ok) throw new Error((r.body&&r.body.message)||"refusé");
        Partage.st=r.body; fermerModale(); rendre();
      }).catch(function(e){ resPartage(z,e.message) });
    }}]);
}
function modaleCreer(){
  ouvrirModale("Créer un espace partagé",
    '<label class="champ">Nom de l\'espace<input type="text" id="ptEsp" maxlength="80" placeholder="ex. Maison, Projets avec Paul"></label>'
    +'<div class="note-aide">L\'espace est hébergé par le serveur de votre synchronisation ('+esc((SyncDist.st&&SyncDist.st.url)||"à configurer dans le bloc Synchronisation")+'). '
      +'Il doit être joignable en HTTPS par les personnes que vous inviterez.</div>'
    +'<div id="ptRes" class="note-aide" role="status"></div>',
    [{txt:"Annuler",classe:"creux",fn:fermerModale},{txt:"Créer",droite:true,fn:function(){
      var z=$("#ptRes");
      appelPartage("espaces",{nom:$("#ptEsp").value},z).then(function(){ fermerModale(); toast("Espace créé"); majPartage() })
        .catch(function(e){ resPartage(z,e.message) });
    }}]);
}
function inviter(espace,role){
  appelPartage("espaces/"+encodeURIComponent(espace)+"/invitations",{role:role}).then(function(r){
    var autre=role==="proprietaire", lect=role==="lecteur";
    ouvrirModale(autre?"Lien pour votre autre appareil":"Lien d'invitation",
      '<textarea id="ptLien" readonly style="width:100%;height:96px;font-family:var(--data);font-size:12.5px;word-break:break-all">'+esc(r.lien)+'</textarea>'
      +'<div class="ligne" style="margin-top:8px"><button class="b" data-pt="copier-lien">Copier le lien</button><span id="ptRes" class="note-aide" role="status" style="margin:0"></span></div>'
      +'<div class="note-aide">'
        +(autre?'Sur votre autre appareil : Données → Partage → « Rejoindre un espace », puis collez ce lien. Il deviendra propriétaire de l\'espace comme celui-ci.'
          :(lect?'Cette personne pourra tout lire dans l\'espace mais rien y modifier. ':'')
           +'Envoyez ce lien à la personne par un canal que vous jugez sûr (messagerie chiffrée, de vive voix…). '
           +'Elle le colle dans son application : Données → Partage → « Rejoindre un espace ».')
        +' Le lien sert une seule fois et expire le '+esc(new Date(r.expires_at).toLocaleDateString("fr-FR"))+'. '
        +'La clé de l\'espace est remise automatiquement à la prochaine synchronisation de cet appareil, après vérification que l\'arrivant détient bien ce lien.</div>',
      [{txt:"Fermer",droite:true,fn:function(){ fermerModale(); majPartage() }}]);
  }).catch(function(e){ toast(e.message,true) });
}
function modaleRejoindre(){
  ouvrirModale("Rejoindre un espace partagé",
    '<label class="champ">Lien d\'invitation reçu<textarea id="ptLienR" style="width:100%;height:96px;font-family:var(--data);font-size:12.5px" placeholder="https://…/rejoindre/#v1…"></textarea></label>'
    +((Partage.st&&Partage.st.identite.nom)?"":'<label class="champ" style="margin-top:10px">Votre nom affiché<input type="text" id="ptNomR" maxlength="60"></label>')
    +'<div class="note-aide">Vos données privées restent sur cet appareil et votre serveur. Seul le contenu de l\'espace est partagé, chiffré.</div>'
    +'<div id="ptRes" class="note-aide" role="status"></div>',
    [{txt:"Annuler",classe:"creux",fn:fermerModale},{txt:"Rejoindre",droite:true,fn:function(){
      var z=$("#ptRes"), nom=$("#ptNomR");
      (nom?api("partage/identite",{method:"PUT",body:{nom:nom.value}}).then(function(r){ if(!r.ok) throw new Error((r.body&&r.body.message)||"nom refusé") }):Promise.resolve())
        .then(function(){ return appelPartage("rejoindre",{lien:$("#ptLienR").value.trim()},z) })
        .then(function(e){
          fermerModale(); majPartage();
          toast(e.status==="actif"?"Espace « "+e.nom+" » rejoint":"Demande envoyée : la clé arrivera à la prochaine synchronisation de la personne qui vous a invité·e");
        }).catch(function(e){ resPartage(z,e.message) });
    }}]);
}
function confirmerPartage(titre,texte,bouton,fn){
  ouvrirModale(titre,'<p style="margin:0;font-size:14px">'+texte+'</p><div id="ptRes" class="note-aide" role="status"></div>',
    [{txt:"Annuler",classe:"creux",fn:fermerModale},{txt:bouton,droite:true,fn:function(){
      fn().then(function(){ fermerModale(); majPartage() }).catch(function(e){ resPartage($("#ptRes"),e.message) });
    }}]);
}
document.addEventListener("change",function(e){
  if(e.target.id!=="ptNotif") return;
  var on=e.target.checked;
  api("partage/notifications",{method:"PUT",body:{systeme:on}}).then(function(r){
    if(r.ok && Partage.st) Partage.st.notifications=r.body;
    if(on && window.Notification && Notification.permission==="default") Notification.requestPermission();
    toast(on?"Notifications du système activées":"Notifications du système coupées");
  });
});
document.addEventListener("click",function(e){
  var el=e.target.closest&&e.target.closest("[data-pt]");
  if(!el) return;
  var a=el.dataset.pt, d=el.dataset;
  if(a==="identite") modaleIdentite();
  else if(a==="creer") modaleCreer();
  else if(a==="rejoindre") modaleRejoindre();
  else if(a==="inviter") inviter(d.e,d.r);
  else if(a==="sync") api("partage/sync",{method:"POST"}).then(function(r){ if(r.ok){ Partage.st=r.body; rendreDonneesSiCalme(); toast("Espaces synchronisés") } });
  else if(a==="copier-lien"){
    var t=$("#ptLien"); t.select();
    (navigator.clipboard?navigator.clipboard.writeText(t.value):Promise.reject()).then(function(){ resPartage($("#ptRes"),"Copié.",true) },
      function(){ try{ document.execCommand("copy"); resPartage($("#ptRes"),"Copié.",true) }catch(x){ resPartage($("#ptRes"),"Copiez-le à la main.") } });
  }
  else if(a==="retirer") confirmerPartage("Retirer un membre",
    "Retirer <b>"+esc(d.n)+"</b> de l'espace ? Son accès est coupé immédiatement et une nouvelle clé de chiffrement est remise aux autres membres : "
      +"ce que l'espace contiendra désormais lui restera illisible. Ce qu'il ou elle a déjà reçu reste sur son appareil.",
    "Retirer",function(){ return appelPartage("espaces/"+encodeURIComponent(d.e)+"/membres/"+encodeURIComponent(d.m)+"/retirer") });
  else if(a==="quitter") confirmerPartage("Quitter l'espace",
    "Quitter <b>"+esc(d.n)+"</b> ? La copie de l'espace est effacée de cet appareil ; les autres membres gardent la leur.",
    "Quitter",function(){ return appelPartage("espaces/"+encodeURIComponent(d.e)+"/quitter",{forcer:true}) });
});

/* ===== activités partagées (application de bureau) =====
   Une activité partagée, ses notes et ses tâches vivent dans le document de l'espace (« s-<id> »).
   Elles sont fusionnées dans D.chantiers / D.notes avec un marqueur _sp : tout le pilotage les traite
   comme les autres. À l'envoi, chacune repart vers son document. Une note suit toujours son activité. */
var PA={docs:{}};
function espaceP(id){ return ((Partage.st&&Partage.st.espaces)||[]).filter(function(e){ return e.id===id })[0] }
function espacesActifsP(){ return ((Partage.st&&Partage.st.espaces)||[]).filter(function(e){ return e.status==="actif" }) }
function moiP(sp){ var e=espaceP(sp); return e?e.member:"" }
function roP(sp){ var e=espaceP(sp); return !!(e && e.role==="lecteur") }
function espacesEcriture(){ return espacesActifsP().filter(function(e){ return e.role!=="lecteur" }) }
function membreP(sp,mid){ var e=espaceP(sp); return e?e.membres.filter(function(m){ return m.member===mid })[0]:null }
function nomP(sp,mid){ var m=membreP(sp,mid); return m?(m.moi?"vous":(m.nom||"un membre")):"un membre" }
function couleurP(sp,mid){ var m=membreP(sp,mid); return (m&&m.couleur)||"#8A90A6" }
var TAMPONS_P=["_sp","modifiePar","modifieLe"];
function propreP(o){ var c={},k; for(k in o) if(o.hasOwnProperty(k) && TAMPONS_P.indexOf(k)<0) c[k]=o[k]; return c }
function sansSp(o){ var c=Object.assign({},o); delete c._sp; return c }
/* une note suit son activité */
function affecterPartages(){
  /* D remplacé ailleurs (import de fichier…) : on remet les activités partagées connues, pour ne
     jamais envoyer à l'espace une liste vidée par accident */
  if(PA.D!==D){
    Object.keys(PA.docs).forEach(function(id){
      var d=PA.docs[id];
      if(d.last && !D.chantiers.some(function(c){ return c._sp===id }) && !D.notes.some(function(n){ return n._sp===id })) fusionnerP(id,JSON.parse(d.last));
    });
    PA.D=D;
  }
  D.notes.forEach(function(n){
    var c=n.chantier_id?chantierPar(n.chantier_id):null;
    /* espace en lecture seule : les notes venues de l'espace y restent, celles écrites ici restent privées */
    if(c && c._sp && roP(c._sp)){ var d=PA.docs[c._sp]; if(!(d && d.items && d.items["n"+n.id])) delete n._sp; else n._sp=c._sp }
    else if(c && c._sp) n._sp=c._sp; else delete n._sp;
  });
}
function privD(){
  return Object.assign({},D,{chantiers:D.chantiers.filter(function(c){ return !c._sp }),notes:D.notes.filter(function(n){ return !n._sp })});
}
function itemsP(id){
  return {chantiers:D.chantiers.filter(function(c){ return c._sp===id }).map(sansSp),notes:D.notes.filter(function(n){ return n._sp===id }).map(sansSp)};
}
function avecPartages(nd){
  if(typeof D==="undefined" || !D || !D.chantiers) return nd;
  nd.chantiers=nd.chantiers.filter(function(c){ return !c._sp }).concat(D.chantiers.filter(function(c){ return c._sp }));
  nd.notes=nd.notes.filter(function(n){ return !n._sp }).concat(D.notes.filter(function(n){ return n._sp }));
  PA.D=nd;
  return nd;
}
function fusionnerP(id,data){
  PA.D=D;
  var tag=function(x){ return Object.assign({},x,{_sp:id}) };
  D.chantiers=D.chantiers.filter(function(c){ return c._sp!==id }).concat(((data&&data.chantiers)||[]).filter(function(x){ return x&&x.id }).map(tag));
  D.notes=D.notes.filter(function(n){ return n._sp!==id }).concat(((data&&data.notes)||[]).filter(function(x){ return x&&x.id }).map(tag));
}
function retenirP(id,doc,items){
  items=items||itemsP(id);
  var d=PA.docs[id]||(PA.docs[id]={});
  d.rev=doc.rev; d.data=doc.data||{}; d.last=JSON.stringify(items); d.items={};
  items.chantiers.forEach(function(x){ d.items["c"+x.id]=JSON.stringify(propreP(x)) });
  items.notes.forEach(function(x){ d.items["n"+x.id]=JSON.stringify(propreP(x)) });
}
function chargerP(id){
  return api("docs/s-"+id).then(function(r){
    if(r.status===404) return null;
    if(!r.ok) throw new Error("HTTP "+r.status);
    fusionnerP(id,r.body.data); retenirP(id,r.body); return r.body;
  });
}
/* espaces rejoints ou quittés : on charge ou retire leurs activités */
function majEspacesP(){
  if(Partage.indispo || !fichierCharge) return Promise.resolve(false);
  return majPartage(false).then(function(){
    if(Partage.indispo) return false;
    var actifs={},change=false,attente=[];
    espacesActifsP().forEach(function(e){ actifs[e.id]=1 });
    Object.keys(PA.docs).forEach(function(id){ if(!actifs[id]){ delete PA.docs[id]; fusionnerP(id,null); change=true } });
    Object.keys(actifs).forEach(function(id){ if(!PA.docs[id]) attente.push(chargerP(id).then(function(d){ if(d) change=true }).catch(function(){})) });
    return Promise.all(attente).then(function(){ return change });
  });
}
function pousserPartages(){
  var ids=Object.keys(PA.docs);
  return ids.reduce(function(p,id){ return p.then(function(){ return pousserP(id) }) },Promise.resolve());
}
function pousserP(id){
  var d=PA.docs[id]; if(!d || d.envoi) { if(d) d.encore=true; return Promise.resolve() }
  var items=itemsP(id);
  if(JSON.stringify(items)===d.last) return Promise.resolve();
  if(roP(id)){                                   /* lecture seule : la modification est annulée */
    fusionnerP(id,JSON.parse(d.last||'{"chantiers":[],"notes":[]}')); rendre();
    toast("Espace « "+(espaceP(id)||{}).nom+" » en lecture seule : modification annulée",true);
    return Promise.resolve();
  }
  var me=moiP(id),now=Date.now();
  var tamponner=function(k,x,liste){
    if(d.items[k+x.id]===JSON.stringify(propreP(x))) return;
    liste.forEach(function(o){ if(o.id===x.id && o._sp===id){ o.modifiePar=me; o.modifieLe=now; if(!o.par) o.par=me } });
  };
  items.chantiers.forEach(function(x){ tamponner("c",x,D.chantiers) });
  items.notes.forEach(function(x){ tamponner("n",x,D.notes) });
  items=itemsP(id);
  var json=JSON.stringify(items), data=Object.assign({},d.data||{},{chantiers:items.chantiers,notes:items.notes});
  d.envoi=true;
  return api("docs/s-"+id,{method:"PUT",body:{data:data,baseRev:d.rev||0}}).then(function(r){
    if(r.status===409) return chargerP(id).then(function(){ rendre(); toast("Activités partagées modifiées ailleurs : version la plus récente reprise",true) });
    if(!r.ok) return;
    if(r.body.data && JSON.stringify(itemsP(id))===json && calme()){ fusionnerP(id,r.body.data); retenirP(id,{rev:r.body.rev,data:r.body.data}); rendre() }
    else retenirP(id,{rev:r.body.rev,data:r.body.data||data},items);
  }).catch(function(){}).then(function(){
    d.envoi=false;
    if(d.encore){ d.encore=false; setTimeout(function(){ pousserP(id) },200) }
  });
}
/* changements des autres membres : repris quand rien n'est en cours de saisie */
function suivrePartages(){
  if(Partage.indispo || !calme()) return;
  var ids=Object.keys(PA.docs), change=false;
  ids.reduce(function(p,id){ return p.then(function(){
    var d=PA.docs[id]; if(!d || d.envoi || JSON.stringify(itemsP(id))!==d.last) return;
    return api("docs/s-"+id+"/rev").then(function(r){
      if(!r.ok || r.body.rev<=d.rev || !calme() || JSON.stringify(itemsP(id))!==d.last) return;
      return chargerP(id).then(function(){ change=true });
    }).catch(function(){});
  }) },Promise.resolve()).then(function(){ if(change) rendre() });
}
setInterval(suivrePartages,5000);
setTimeout(function(){ majEspacesP().then(function(c){ if(c) rendre() }) },1500);
setInterval(function(){ majEspacesP().then(function(c){ if(c) rendre() }) },20000);

/* les tâches attribuées à un autre membre ne figurent pas dans vos listes « En attente » */
var suitesOuvertes0=suitesOuvertes;
suitesOuvertes=function(){
  return suitesOuvertes0().filter(function(n){ return !(n._sp && (roP(n._sp) || (n.suite.pour && n.suite.pour!==moiP(n._sp)))) });
};

/* partager / retirer une activité */
function partagerActivite(id,sp){
  var c=chantierPar(id), e=espaceP(sp); if(!c || !e) return;
  var n=D.notes.filter(function(x){ return x.chantier_id===id }).length;
  lireChantier(c);
  c._sp=sp; if(!c.par) c.par=e.member; c.categorie_lib=catDe(c).lib;
  if(!PA.docs[sp]) PA.docs[sp]={rev:0,data:{},last:"",items:{}};
  affecterPartages(); fermerModale(); modifie(); rendre(); editerChantier(id);
  toast("Activité partagée dans « "+e.nom+" »"+(n?" avec ses "+n+" note(s) et tâche(s)":""));
}
function retirerActivite(id){
  var c=chantierPar(id); if(!c || !c._sp) return;
  var e=espaceP(c._sp);
  if(!confirm("Retirer cette activité du partage ?\n\nUne copie, avec ses notes et tâches, reste dans votre pilotage privé ; elle disparaît de l'espace « "+(e?e.nom:"")+" » pour tous les membres.")) return;
  lireChantier(c);
  ["_sp","par","modifiePar","modifieLe"].forEach(function(k){ delete c[k] });
  D.notes.forEach(function(n){ if(n.chantier_id===id){ ["par","modifiePar","modifieLe"].forEach(function(k){ delete n[k] }); if(n.suite) delete n.suite.pour } });
  affecterPartages(); fermerModale(); modifie(); rendre(); editerChantier(id);
  toast("Activité revenue dans votre pilotage privé");
}
function quandP(t){ return t?new Date(t).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"" }
function boitePartageActivite(c){
  if(Partage.indispo || !Partage.st) return "";
  if(c._sp){
    var e=espaceP(c._sp);
    return '<hr class="sep"><div class="pp-part" style="border:1px dashed var(--trait);padding:10px 12px;font-size:13.5px">'
      +'<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+esc(couleurP(c._sp,c.par))+';margin-right:6px"></span>'
      +'Partagée dans <b>« '+esc(e?e.nom:"")+' »</b>'+(c.par?', proposée par '+esc(nomP(c._sp,c.par)):"")
      +(c.modifiePar?'. Dernière modification : '+esc(nomP(c._sp,c.modifiePar))+', '+esc(quandP(c.modifieLe)):"")+'.'
      +'<div class="note-aide" style="margin:4px 0 8px">Les notes et tâches de cette activité sont partagées avec elle, signées par leur auteur. '
      +'Une tâche peut être attribuée à un membre depuis la note qui la porte.</div>'
      +(roP(c._sp)?'<div class="note-aide" style="margin:0"><b>Lecture seule</b> : vous ne pouvez pas modifier cette activité. Les notes et tâches que vous y ajoutez restent privées.</div>'
        :'<button class="b mini creux" data-pa="retirer" data-id="'+esc(c.id)+'">Retirer du partage</button>')+'</div>';
  }
  var l=espacesEcriture();
  if(!l.length) return "";
  return '<hr class="sep"><div class="ligne" style="font-size:13.5px">Partager cette activité, avec ses notes et tâches, dans '
    +'<select id="paDest">'+l.map(function(e){ return '<option value="'+esc(e.id)+'">'+esc(e.nom)+'</option>' }).join("")+'</select>'
    +'<button class="b mini" data-pa="partager" data-id="'+esc(c.id)+'">Partager</button></div>';
}
var editerChantier0=editerChantier;
editerChantier=function(id){
  editerChantier0(id);
  var c=chantierPar(id), corps=$("#modCorps");
  if(!c || !corps) return;
  var box=boitePartageActivite(c);
  if(box){ var o=corps.querySelector("#ficheAjout"); (o?o.parentNode:corps).insertAdjacentHTML(o?"beforeend":"beforeend",box) }
  decorerNotes(corps);
  if(c._sp && roP(c._sp)) lectureSeule(corps,["Archiver","Désarchiver","Supprimer","Enregistrer"],"#ficheAjout");
};
/* fenêtre en lecture seule : champs désactivés, boutons d'écriture retirés */
function lectureSeule(corps,boutons,garder){
  Array.prototype.forEach.call(corps.querySelectorAll("input,textarea,select"),function(e){ if(!(garder && e.closest(garder))) e.disabled=true });
  Array.prototype.forEach.call($("#modPied").querySelectorAll("button"),function(b){ if(boutons.indexOf(b.textContent.trim())>=0) b.remove() });
}
/* « Pour » sur une tâche d'une activité partagée */
var editerNote0=editerNote;
editerNote=function(id){
  editerNote0(id);
  var n=notePar(id), c=n&&n.chantier_id?chantierPar(n.chantier_id):null;
  if(!n || !c || !c._sp) return;
  var e=espaceP(c._sp); if(!e) return;
  if(n._sp && roP(n._sp)){ lectureSeule($("#modCorps"),["Supprimer","Traiter l\u2019action","Enregistrer"]); return }
  var pour=(n.suite&&n.suite.pour)||"";
  var ech=$("#modCorps").querySelector('[name="suite_ech"]');
  if(!ech) return;
  ech.closest(".grille").insertAdjacentHTML("beforeend",'<label class="champ">Pour<select id="paPour"><option value="">Tout le monde</option>'
    +e.membres.filter(function(m){ return m.status!=="retire" }).map(function(m){
      return '<option value="'+esc(m.member)+'"'+(m.member===pour?" selected":"")+'>'+esc((m.nom||"membre")+(m.moi?" (vous)":""))+'</option>' }).join("")
    +'</select></label>');
  if(n.par || n.modifiePar) $("#modCorps").insertAdjacentHTML("afterbegin",'<div class="note-aide" style="margin:0 0 8px">Note '
    +(n.par?'de '+esc(nomP(c._sp,n.par)):"")+(n.modifiePar&&n.modifiePar!==n.par?', modifiée par '+esc(nomP(c._sp,n.modifiePar)):"")
    +(n.modifieLe?', '+esc(quandP(n.modifieLe)):"")+' — activité partagée dans « '+esc(e.nom)+' ».</div>');
};
var lireNote0=lireNote;
lireNote=function(n){
  var r=lireNote0(n), s=$("#paPour");
  if(s && n.suite){ if(s.value) n.suite.pour=s.value; else delete n.suite.pour }
  return r;
};
/* auteurs et attributions affichés sur les notes et tâches partagées */
function decorerNotes(racine){
  if(!racine) return;
  Array.prototype.forEach.call(racine.querySelectorAll(".note"),function(el){
    if(el.querySelector(".pp-sig")) return;
    var b=el.matches("[data-note]")?el:el.querySelector("[data-note],[data-fait]");
    var id=b&&(b.dataset.note||b.dataset.fait); if(!id) return;
    var n=notePar(id); if(!n || !n._sp) return;
    var auteur=n.par||n.modifiePar, pour=n.suite&&n.suite.pour;
    var t=(auteur?"par "+nomP(n._sp,auteur):"partagée")+(pour?" · pour "+nomP(n._sp,pour):"");
    var h=el.querySelector(".h")||el;
    h.insertAdjacentHTML("beforeend",' <span class="pp-sig" style="font-size:11.5px;color:var(--gris,#6b706c)">'
      +'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+esc(couleurP(n._sp,auteur))+';margin:0 3px 0 6px"></span>'+esc(t)+'</span>');
  });
}
function decorerActivites(racine){
  Array.prototype.forEach.call(racine.querySelectorAll("tr[data-chantier]"),function(tr){
    var c=chantierPar(tr.dataset.chantier); if(!c || !c._sp || tr.querySelector(".pp-sig")) return;
    var td=tr.children[2]||tr.children[0], e=espaceP(c._sp);
    td.insertAdjacentHTML("beforeend",' <span class="pp-sig" title="Activité partagée'+(c.par?', proposée par '+esc(nomP(c._sp,c.par)):"")+'" style="font-size:11.5px;color:var(--gris,#6b706c);white-space:nowrap">'
      +'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+esc(couleurP(c._sp,c.par))+';margin:0 3px 0 4px"></span>'+esc(e?e.nom:"partagée")+'</span>');
  });
}
document.addEventListener("click",function(e){
  var el=e.target.closest&&e.target.closest("[data-pa]");
  if(!el) return;
  if(el.dataset.pa==="partager") partagerActivite(el.dataset.id,($("#paDest")||{}).value);
  else if(el.dataset.pa==="retirer") retirerActivite(el.dataset.id);
  else if(el.dataset.pa==="recue"){
    var n=notePar(el.dataset.id), cible=el.dataset.c==="notes"?(n&&n.chantier_id):el.dataset.id;
    if(cible && chantierPar(cible)) editerChantier(cible); else toast("Cette activité n'est plus partagée",true);
  }
  else if(el.dataset.pa==="recues-vues") marquerRecuesP();
});

/* ===== nouveautés des espaces partagés : pastille sur l'onglet Idées et notification du système ===== */
var Recues={idees:0,activites:0,entrees:[],dernier:null,pret:false};
var COLL_IDEES={ideas:1,unified:1};
function estRecueIdee(e){ return !!COLL_IDEES[e.coll] }
function pastille(vue,n,quoi){
  var b=document.querySelector('#nav [data-vue="'+vue+'"]'); if(!b) return;
  var p=b.querySelector(".pp-pastille");
  if(!n){ if(p) p.remove(); b.removeAttribute("title"); return }
  if(!p){ p=document.createElement("span"); p.className="pp-pastille";
    p.style.cssText="display:inline-block;min-width:18px;padding:0 5px;margin-left:6px;border-radius:9px;background:var(--rouge,#D8232A);color:#fff;font-size:11px;line-height:18px;text-align:center;letter-spacing:0;font-weight:600";
    b.appendChild(p) }
  p.textContent=n>99?"99+":String(n);
  b.title=n+" nouveauté(s) "+quoi;
}
function pastilleIdees(){
  pastille("idees",Recues.idees,"dans les idées partagées");
  pastille("chantiers",Recues.activites,"dans les activités partagées");
}
var LIB_RECUE={partage:"a partagé une idée",modifie:"a modifié",cristallise:"a cristallisé",activite:"en a fait une activité",retire:"a retiré du partage",
  activite_partagee:"a partagé l'activité",activite_modifiee:"a modifié l'activité",activite_retiree:"a retiré l'activité",
  note:"a ajouté une note",tache:"a ajouté une tâche",tache_pour_vous:"vous a attribué une tâche",tache_faite:"a terminé une tâche"};
function surveillerRecues(){
  if(Partage.indispo) return Promise.resolve();
  return api("partage/recues?limit=100").then(function(r){
    if(r.status===404){ Partage.indispo=true; return }
    if(!r.ok) return;
    var b=r.body, max=b.entrees.reduce(function(m,e){ return Math.max(m,e.id) },0);
    var neuves=Recues.pret?b.entrees.filter(function(e){ return !e.vue && e.id>(Recues.dernier||0) }):[];
    var avant=Recues.activites;
    Recues.entrees=b.entrees;
    Recues.idees=b.entrees.filter(function(e){ return !e.vue && estRecueIdee(e) }).length;
    Recues.activites=b.entrees.filter(function(e){ return !e.vue && !estRecueIdee(e) }).length;
    Recues.dernier=Math.max(Recues.dernier||0,max); Recues.pret=true;
    pastilleIdees();
    if(vueActive==="chantiers" && avant!==Recues.activites) rendreDonneesSiCalme();
    if(!neuves.length) return;
    var e=neuves[0], titre=neuves.length>1?neuves.length+" nouveautés dans vos espaces partagés":e.auteur+" "+(LIB_RECUE[e.kind]||"")+" : « "+e.titre+" »";
    var corps=neuves.length>1?neuves.slice(0,3).map(function(x){ return x.auteur+" : "+x.titre }).join("\n"):"Espace « "+e.espaceNom+" »";
    var cible=estRecueIdee(e)?"idees":"chantiers";
    var dehors=document.hidden || !document.hasFocus();
    if(dehors && Partage.st && Partage.st.notifications && Partage.st.notifications.systeme!==false && window.Notification){
      var go=function(){
        try{ var n=new Notification(titre,{body:corps,tag:"mppe-recues",silent:false});
          n.onclick=function(){ window.focus(); vueActive=cible; rendre(); n.close() } }catch(x){}
      };
      if(Notification.permission==="granted") go();
      else if(Notification.permission!=="denied") Notification.requestPermission().then(function(p){ if(p==="granted") go() });
    } else toast(titre);
  }).catch(function(){});
}
/* vue Activités : ce que les autres membres ont fait dans les activités partagées */
function afficherRecuesActivites(v){
  var l=Recues.entrees.filter(function(e){ return !estRecueIdee(e) && !e.vue });
  if(!l.length) return;
  var q=function(t){ return new Date(t).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) };
  v.insertAdjacentHTML("afterbegin",'<div class="bloc" style="margin-bottom:18px"><div class="bloc-tete"><h2>Reçues — activités partagées</h2><span class="compte">'+l.length+'</span></div><div class="bloc-corps">'
    +l.slice(0,15).map(function(e){
      return '<div style="display:flex;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px dashed var(--trait);font-size:13.5px">'
        +'<span style="width:9px;height:9px;border-radius:50%;flex:none;background:'+esc(e.couleur||"#8A90A6")+'"></span>'
        +'<span><b>'+esc(e.auteur)+'</b> '+esc(LIB_RECUE[e.kind]||e.kind)+' : « '+esc(e.titre)+' » <span class="note-aide" style="margin:0">dans '+esc(e.espaceNom||"")+'</span></span>'
        +(e.kind!=="activite_retiree"?'<button class="lien" data-pa="recue" data-c="'+esc(e.coll)+'" data-id="'+esc(e.rid)+'" style="margin-left:auto">Ouvrir</button>':'<span style="margin-left:auto"></span>')
        +'<span class="mono" style="font-size:11.5px;white-space:nowrap">'+esc(q(e.at))+'</span></div>';
    }).join("")
    +'<div class="ligne" style="margin-top:10px"><button class="b mini creux" data-pa="recues-vues">Tout marquer comme vu</button></div></div></div>');
}
function marquerRecuesP(){
  var ids=Recues.entrees.filter(function(e){ return !estRecueIdee(e) && !e.vue }).map(function(e){ return e.id });
  if(!ids.length) return;
  api("partage/recues/vues",{method:"POST",body:{ids:ids}}).then(function(){ return surveillerRecues() }).then(function(){ rendre() });
}
setTimeout(function(){ majPartage(false).then(surveillerRecues) },3000);
setInterval(surveillerRecues,20000);

/* ===== Veilles : flux RSS collectés, filtrés et rangés en fiches (document « veilles ») ===== */
var VE={doc:null,rev:0,info:null,sel:"",dernierLu:null,pret:false,essai:null};
var MODELES_VEILLE=[
  {cle:"vide",nom:"Veille vide",desc:"Vos propres flux RSS ou Atom.",v:{nom:"Nouvelle veille",sources:[],filtres:{ageHeures:72,max:30},rythme:{type:"jour",heure:"07:30"}}},
  {cle:"cyber",nom:"Point cyber",desc:"CERT-FR, flux complet : alertes, avis, actualités.",v:{nom:"Point cyber",sources:[{nom:"CERT-FR",url:"https://cert.ssi.gouv.fr/feed/"}],filtres:{ageHeures:48,max:30},rythme:{type:"jour",heure:"07:30"}}},
  {cle:"cve",nom:"Point CVE",desc:"Avis et alertes du CERT-FR et failles activement exploitées (CISA), filtrés sur vos logiciels (liste à compléter).",v:{nom:"Point CVE",sources:[{nom:"CERT-FR avis",url:"https://cert.ssi.gouv.fr/avis/feed/"},{nom:"CERT-FR alertes",url:"https://cert.ssi.gouv.fr/alerte/feed/"},{type:"kev",nom:"CISA KEV",jours:30}],filtres:{inclure:"debian, linux, openssh, node.js, electron, firefox, qubes, xen",ageHeures:72,max:40},rythme:{type:"jour",heure:"07:30"}}},
  {cle:"kev",nom:"Failles exploitées",desc:"Catalogue CISA des failles activement exploitées (KEV) : ce qui est attaqué en ce moment.",v:{nom:"Failles exploitées",sources:[{type:"kev",nom:"CISA KEV",jours:7}],filtres:{ageHeures:0,max:40},rythme:{type:"jour",heure:"07:30"}}},
  {cle:"nvd",nom:"CVE critiques",desc:"Nouvelles CVE publiées par le NIST (NVD), score CVSS 9 ou plus.",v:{nom:"CVE critiques",sources:[{type:"nvd",nom:"NVD",jours:2}],filtres:{scoreMin:9,ageHeures:0,max:40},rythme:{type:"jour",heure:"07:30"}}},
  {cle:"emploi",nom:"Offres d'emploi",desc:"Offres France Travail sur vos mots-clés, contrat de professionnalisation ou CDI (identifiants francetravail.io à saisir dans Données → Réglages).",
    v:{nom:"Offres d'emploi",sources:[{type:"francetravail",nom:"France Travail",motsCles:"administrateur systèmes, admin sys, MCO, purple team, red team, pentest, audit sécurité, OSINT",departement:"69",jours:7}],
      filtres:{contrats:"professionnalisation, CDI",ageHeures:0,max:50},rythme:{type:"jour",heure:"08:00"},
      claude:{noter:true,critere:"proche de mon profil : alternance en administration d'infrastructures sécurisées, cybersécurité (pentest, red/purple team, audit, OSINT, MCO)",seuil:2,resumer:true,actions:true,modele:"haiku",plafond:4}}}
];
var TYPES_SRC=[["rss","Flux RSS ou Atom"],["kev","Failles exploitées (CISA KEV)"],["nvd","CVE récentes (NVD)"],["francetravail","Offres France Travail"]];
var JOURS=["","lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
function apiVeilles(){ return api("docs/veilles").then(function(r){
  if(r.status===404){ VE.doc={veilles:[],fiches:[],etats:[]}; VE.rev=0; return }
  if(r.ok){ VE.doc=r.body.data; VE.rev=r.body.rev; ["veilles","fiches","etats"].forEach(function(k){ if(!estTableau(VE.doc[k])) VE.doc[k]=[] }) }
}) }
function enregistrerVeilles(){
  return api("docs/veilles",{method:"PUT",body:{data:VE.doc,baseRev:VE.rev}}).then(function(r){
    if(r.status===409) return apiVeilles().then(function(){ throw new Error("modifié ailleurs entre-temps : réessayez") });
    if(!r.ok) throw new Error((r.body&&r.body.message)||"enregistrement refusé");
    VE.rev=r.body.rev; if(r.body.data) VE.doc=r.body.data;
  });
}
function veillePar(id){ return (VE.doc.veilles||[]).filter(function(v){ return v.id===id })[0] }
function etatVeille(id){ return (VE.doc.etats||[]).filter(function(e){ return e.id===id })[0]||{} }
function fichesDe(id){ return (VE.doc.fiches||[]).filter(function(f){ return f && (!id||f.veille===id) }).sort(function(a,b){ return (b.at||"").localeCompare(a.at||"") }) }
function nonLues(){ return (VE.doc&&VE.doc.fiches||[]).filter(function(f){ return f && !f.lue }) }
function libExecuteur(v){
  if(v.executeur==="serveur") return "le serveur";
  if(VE.info && v.executeur===VE.info.executeur) return "cet appareil";
  return v.executeurNom?"l'appareil « "+v.executeurNom+" »":"un autre appareil";
}
function libRythme(r){
  r=r||{};
  if(r.type==="heures") return "toutes les "+(r.n||6)+" h";
  if(r.type==="semaine") return "chaque "+(JOURS[r.jour||1])+" à "+(r.heure||"07:00");
  return "chaque jour à "+(r.heure||"07:00");
}
function quandV(t){ return t?new Date(t).toLocaleString("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"" }
function vueVeilles(){
  if(!VE.doc) return '<div class="bloc"><div class="bloc-corps"><div class="note-aide">Chargement des veilles…</div></div></div>';
  var l=VE.doc.veilles.filter(function(v){ return v&&v.id });
  var gauche='<div class="bloc"><div class="bloc-tete"><h2>Mes veilles</h2><button class="pp-aide-lien" data-aide="veilles">Aide</button><span class="compte">'+l.length+'</span></div><div class="bloc-corps">'
    +(l.length?l.map(function(v){
      var e=etatVeille(v.id), nl=fichesDe(v.id).filter(function(f){ return !f.lue }).length, sel=VE.sel===v.id;
      return '<div style="padding:9px 10px;margin:0 -10px;border-bottom:1px dashed var(--trait);'+(sel?'background:#F3F3F0;':'')+'cursor:pointer" data-ve="choisir" data-id="'+esc(v.id)+'">'
        +'<div style="display:flex;gap:8px;align-items:baseline"><b style="font-size:14.5px">'+esc(v.nom)+'</b>'
        +(nl?'<span class="pp-pastille" style="display:inline-block;min-width:18px;padding:0 5px;border-radius:9px;background:var(--rouge,#D8232A);color:#fff;font-size:11px;line-height:18px;text-align:center">'+nl+'</span>':"")
        +'<span class="note-aide" style="margin:0 0 0 auto">'+(v.actif?esc(libRythme(v.rythme)):"en pause")+'</span></div>'
        +'<div class="note-aide" style="margin:2px 0 0">'+(v.sources||[]).length+' source(s)'+(v.claude&&(v.claude.noter||v.claude.resumer||v.claude.actions||v.claude.synthese)?' · avec Claude':"")+' · exécutée par '+esc(libExecuteur(v))
        +(e.derniere?' · dernière '+esc(quandV(e.derniere))+(e.nouveaux!=null?' ('+e.nouveaux+' nouveau'+(e.nouveaux>1?'x':'')+')':""):' · jamais exécutée')+'</div>'
        +(e.erreur?'<div class="note-aide" style="margin:2px 0 0;color:var(--rouge)">'+esc(e.erreur)+'</div>':"")
        +'<div class="ligne" style="margin-top:6px"><button class="b mini creux" data-ve="modifier" data-id="'+esc(v.id)+'">Modifier</button>'
        +'<button class="b mini creux" data-ve="executer" data-id="'+esc(v.id)+'">Exécuter maintenant</button></div></div>';
    }).join(""):'<div class="vide"><b>Aucune veille</b>Créez-en une à partir d\'un modèle ou de vos propres flux RSS.</div>')
    +'<div class="ligne" style="margin-top:12px"><button class="b" data-ve="nouvelle">+ Nouvelle veille</button>'
    +(VE.sel?'<button class="b creux" data-ve="choisir" data-id="">Toutes les fiches</button>':"")+'</div></div></div>';
  var fiches=fichesDe(VE.sel).slice(0,40), nlt=fiches.filter(function(f){ return !f.lue }).length;
  var droite='<div class="bloc"><div class="bloc-tete"><h2>Fiches'+(VE.sel&&veillePar(VE.sel)?' — '+esc(veillePar(VE.sel).nom):"")+'</h2><span class="compte">'+(nlt?nlt+' non lue(s)':fiches.length)+'</span></div><div class="bloc-corps">'
    +(nlt?'<div class="ligne" style="margin:-4px 0 10px"><button class="b mini creux" data-ve="tout-lu">Tout marquer comme lu</button></div>':"")
    +(fiches.length?fiches.map(ficheHTML).join(""):'<div class="vide"><b>Aucune fiche pour l\'instant</b>Une fiche apparaît à chaque exécution qui trouve du nouveau.</div>')
    +'</div></div>';
  return '<div style="display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:18px;align-items:start" class="pp-veilles">'+gauche+droite+'</div>'
    +'<style>@media (max-width:860px){.pp-veilles{grid-template-columns:1fr !important}}</style>';
}
function ficheHTML(f){
  var ouverte=!f.lue || VE.ouvertes&&VE.ouvertes[f.id];
  if(f.type==="revision") return '<div style="border:1px solid var(--trait);border-left:3px solid '+(f.lue?"var(--trait)":"#2B4C6F")+';padding:10px 12px;margin-bottom:12px;background:#F7F8FA">'
    +'<div style="display:flex;gap:10px;align-items:baseline;cursor:pointer" data-ve="deplier" data-id="'+esc(f.id)+'"><b>'+esc(f.nom)+'</b><span class="mono" style="font-size:12px">'+esc(quandV(f.at))+'</span>'
    +'<span class="note-aide" style="margin:0 0 0 auto">'+(f.questions||[]).length+' question(s)</span></div>'
    +(ouverte?(f.questions||[]).map(function(q,i){
      return '<details style="padding:7px 0;border-top:1px dashed var(--trait);margin-top:7px"><summary style="cursor:pointer;font-weight:600">'+(i+1)+'. '+esc(q.q)+'</summary>'
        +'<div style="margin:6px 0 0 18px;font-size:13.5px">'+esc(q.r)+(q.lien?' <a href="'+esc(q.lien)+'" target="_blank" rel="noopener noreferrer" style="color:#2B4C6F">source</a>':"")+'</div></details>';
    }).join("")+(f.lue?"":'<div class="ligne" style="margin-top:8px"><button class="b mini creux" data-ve="lue" data-id="'+esc(f.id)+'">Marquer comme lue</button></div>'):"")
    +'</div>';
  return '<div style="border:1px solid var(--trait);border-left:3px solid '+(f.lue?"var(--trait)":"var(--rouge,#D8232A)")+';padding:10px 12px;margin-bottom:12px">'
    +'<div style="display:flex;gap:10px;align-items:baseline;cursor:pointer" data-ve="deplier" data-id="'+esc(f.id)+'"><b>'+esc(f.nom||"Veille")+'</b>'
    +'<span class="mono" style="font-size:12px">'+esc(quandV(f.at))+'</span>'
    +'<span class="note-aide" style="margin:0 0 0 auto">'+(f.items||[]).length+' élément(s)'+(f.stats?' · '+f.stats.collectes+' collecté(s), '+f.stats.gardes+' après filtres'+(f.stats.ecartesNote?', '+f.stats.ecartesNote+' écarté(s) par la note':""):"")
      +(f.claude&&f.claude.appels?' · Claude ('+esc(f.claude.modele)+')':"")+'</span></div>'
    +(ouverte?(syntheseHTML(f.synthese)
      +(f.claude&&f.claude.erreur?'<div class="note-aide" style="color:var(--rouge);margin:6px 0 0">'+esc(f.claude.erreur)+'</div>':"")
      +((f.items||[]).map(function(it,i){
        var sug=it.action&&it.action!=="aucune";
        return '<div style="padding:8px 0;border-top:1px dashed var(--trait);margin-top:8px">'
          +'<div>'+noteHTML(it)+'<a href="'+esc(it.lien||"#")+'" target="_blank" rel="noopener noreferrer" style="font-weight:600;color:#2B4C6F">'+esc(it.titre)+'</a></div>'
          +'<div class="note-aide" style="margin:2px 0">'+esc(it.source||"")+(it.date?' · '+esc(quandV(it.date)):"")+'</div>'
          +(it.resume?'<div style="font-size:13.5px">'+esc(it.resume)+'</div>':it.extrait?'<div style="font-size:13.5px">'+esc(it.extrait)+'</div>':"")
          +(sug?'<div class="note-aide" style="margin:4px 0 0">Suggestion de Claude : <b>'+(it.action==="faire"?"à faire":"à creuser")+'</b>'+(it.raison?" — "+esc(it.raison):"")+'</div>':"")
          +'<div class="ligne" style="margin-top:4px">'
          +'<button class="'+(sug&&it.action==="creuser"?"b mini":"lien")+'" data-ve="vers-idee" data-f="'+esc(f.id)+'" data-i="'+i+'">→ Idée à creuser</button>'
          +'<button class="'+(sug&&it.action==="faire"?"b mini":"lien")+'" data-ve="vers-activite" data-f="'+esc(f.id)+'" data-i="'+i+'">→ Activité à faire</button></div></div>';
      }).join(""))
      +((f.erreurs||[]).length?'<div class="note-aide" style="color:var(--rouge)">Sources en erreur : '+esc(f.erreurs.map(function(e){ return e.url+" ("+e.message+")" }).join(" · "))+'</div>':"")
      +(f.lue?"":'<div class="ligne" style="margin-top:8px"><button class="b mini creux" data-ve="lue" data-id="'+esc(f.id)+'">Marquer comme lue</button></div>'))
    :"")
    +'</div>';
}
/* fenêtre d'une veille */
function modaleVeille(v,neuve){
  v=JSON.parse(JSON.stringify(v));
  v.sources=v.sources||[]; v.filtres=v.filtres||{}; v.rythme=v.rythme||{type:"jour",heure:"07:30"}; v.sortie=v.sortie||{notifier:true};
  VE.edit=v; VE.essai=null;
  var srv=SyncDist.mode!=="application" || (SyncDist.st&&SyncDist.st.configured);
  if(!v.executeur) v.executeur=srv?"serveur":VE.info.executeur;
  var opts=[];
  if(srv) opts.push(["serveur","Le serveur (recommandé)"]);
  if(VE.info.executeur!=="serveur") opts.push([VE.info.executeur,"Cet appareil ("+VE.info.appareil+")"]);
  if(!opts.some(function(o){ return o[0]===v.executeur })) opts.push([v.executeur,"Autre appareil"+(v.executeurNom?" (« "+v.executeurNom+" »)":"")]);
  var r=v.rythme;
  ouvrirModale(neuve?"Nouvelle veille":"Veille — "+v.nom,
    '<div class="grille"><label class="champ">Nom<input type="text" id="veNom" value="'+esc(v.nom)+'"></label>'
    +'<label class="champ">Exécutée par<select id="veExe">'+opts.map(function(o){ return '<option value="'+esc(o[0])+'"'+(o[0]===v.executeur?" selected":"")+'>'+esc(o[1])+'</option>' }).join("")+'</select></label>'
    +'<label class="champ">Rythme<select id="veRyt">'+selOpts([["jour","Chaque jour"],["semaine","Chaque semaine"],["heures","Toutes les N heures"]],r.type||"jour")+'</select></label>'
    +'<label class="champ" id="veHeureL">Heure<input type="time" id="veHeure" value="'+esc(r.heure||"07:30")+'"></label>'
    +'<label class="champ" id="veJourL">Jour<select id="veJour">'+selOpts(JOURS.slice(1).map(function(j,i){ return [String(i+1),j] }),String(r.jour||1))+'</select></label>'
    +'<label class="champ" id="veNL">Toutes les (heures)<input type="number" id="veN" min="1" max="168" value="'+esc(r.n||6)+'"></label></div>'
    +'<div class="note-aide" style="margin:4px 0 0">Le serveur exécute la veille même quand vos appareils sont éteints. Un appareil ne l\'exécute que lorsque l\'application y est ouverte.</div>'
    +'<hr class="sep"><h3 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">Sources</h3><div id="veSources"></div>'
    +'<div class="ligne" style="margin-top:6px"><button class="b mini creux" data-ve="src-ajout">+ Ajouter une source</button>'
    +'</div>'
    +'<hr class="sep"><h3 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">Filtres</h3>'
    +'<div class="grille"><label class="champ">Garder si contient (un mot par ligne ou virgule ; vide = tout)<textarea id="veInc" style="min-height:60px">'+esc(v.filtres.inclure||"")+'</textarea></label>'
    +'<label class="champ">Écarter si contient<textarea id="veExc" style="min-height:60px">'+esc(v.filtres.exclure||"")+'</textarea></label>'
    +'<label class="champ">Ancienneté maximale (heures, 0 = sans limite)<input type="number" id="veAge" min="0" value="'+esc(v.filtres.ageHeures!=null?v.filtres.ageHeures:72)+'"></label>'
    +'<label class="champ">Éléments au plus par fiche<input type="number" id="veMax" min="1" max="200" value="'+esc(v.filtres.max||30)+'"></label>'
    +'<label class="champ">Score CVSS minimum (CVE, 0 = tous)<input type="number" id="veScore" min="0" max="10" step="0.1" value="'+esc(v.filtres.scoreMin||0)+'"></label>'
    +'<label class="champ">Contrats gardés (offres ; vide = tous)<input type="text" id="veContrats" value="'+esc(v.filtres.contrats||"")+'" placeholder="ex. professionnalisation, CDI"></label></div>'
    +'<div class="note-aide">Ce qui a déjà figuré dans une fiche de cette veille n\'est jamais repris.</div>'
    +blocClaudeVeille(v)
    +'<hr class="sep"><div class="ligne" style="flex-wrap:wrap;gap:14px">'
    +'<label style="font-size:13.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="veActif"'+(v.actif!==false?" checked":"")+'> Active</label>'
    +'<label style="font-size:13.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="veNotif"'+(v.sortie.notifier!==false?" checked":"")+'> Me prévenir à chaque nouvelle fiche</label>'
    +'<label style="font-size:13.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="veVide"'+(v.sortie.ficheVide?" checked":"")+'> Fiche même sans nouveauté</label></div>'
    +'<div id="veRes" class="note-aide" role="status" style="margin-top:10px"></div>',
    [{txt:"Annuler",classe:"creux",fn:fermerModale}]
      .concat(neuve?[]:[{txt:"Supprimer",classe:"creux",fn:function(){
        if(!confirm("Supprimer la veille « "+v.nom+" » et ses fiches ?")) return;
        VE.doc.veilles=VE.doc.veilles.filter(function(x){ return x.id!==v.id });
        VE.doc.fiches=VE.doc.fiches.filter(function(x){ return x.veille!==v.id });
        VE.doc.etats=VE.doc.etats.filter(function(x){ return x.id!==v.id });
        enregistrerVeilles().then(function(){ fermerModale(); if(VE.sel===v.id) VE.sel=""; rendre(); toast("Veille supprimée") }).catch(function(e){ toast(e.message,true) });
      }}])
      .concat([{txt:"Tester",classe:"creux",droite:true,fn:testerVeille},
               {txt:"Enregistrer",droite:true,fn:function(){ enregistrerVeille(neuve) }}]));
  rendreSources(); majRythme(); majEtatClaudeVeille();
}
function caseV(id,lib,on){ return '<label style="font-size:13.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="'+id+'"'+(on?" checked":"")+'> '+lib+'</label>' }
function blocClaudeVeille(v){
  var c=v.claude||{};
  return '<hr class="sep"><h3 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">Opérations par Claude</h3>'
    +'<div class="note-aide" style="margin:0 0 8px">Facultatives. Une seule demande à Claude par exécution (jusqu\'à 40 éléments), avec votre abonnement via Claude Code '
    +'sur l\'exécutant de la veille. <span id="veClaudeEtat"></span></div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px 18px">'
      +caseV("veCNoter","Noter la pertinence (0 à 5)",c.noter)+caseV("veCResumer","Résumer chaque élément",c.resumer)
      +caseV("veCActions","Proposer « à creuser » ou « à faire »",c.actions)+caseV("veCSynthese","Synthèse de la fiche et « ce que ça change pour moi »",c.synthese)
      +caseV("veCRevision","Questions de révision, une fois par semaine",c.revision)
    +'</div>'
    +'<div class="grille" style="margin-top:8px">'
    +'<label class="champ">Critère de pertinence<input type="text" id="veCCritere" value="'+esc(c.critere||"")+'" placeholder="ex. faille qui touche mes logiciels, utile pour une alternante AIS"></label>'
    +'<label class="champ">Écarter sous la note<select id="veCSeuil">'+selOpts([["0","ne rien écarter"],["2","2"],["3","3"],["4","4"]],String(c.seuil||0))+'</select></label>'
    +'<label class="champ">Modèle<select id="veCModele">'+selOpts([["haiku","Haiku : rapide, économe"],["sonnet","Sonnet : équilibré"],["opus","Opus : approfondi, coûteux en quota"]],c.modele||"haiku")+'</select></label>'
    +'<label class="champ">Appels à Claude au plus par jour<input type="number" id="veCPlafond" min="1" max="100" value="'+esc(c.plafond||6)+'"></label>'
    +'</div>'
    +'<label class="champ">Consigne (angle, ton, ce qui vous intéresse)<textarea id="veCConsigne" style="min-height:52px" placeholder="ex. explique comme à une alternante en administration d\'infrastructures sécurisées, en 2 phrases">'+esc(c.consigne||"")+'</textarea></label>';
}
function majEtatClaudeVeille(){
  var z=$("#veClaudeEtat"); if(!z) return;
  var exe=($("#veExe")||{}).value;
  if(VE.info && exe===VE.info.executeur){
    api("claude/status").then(function(r){ var ok=r.ok&&r.body.available; z.innerHTML=ok?'<b style="color:var(--vert)">Claude Code est prêt ici.</b>'
      :'<b style="color:var(--rouge)">Claude Code n\'est pas disponible ici</b> : la veille tournera sans ces opérations (voir Données, Idées et Claude).' });
  } else z.textContent="Claude Code doit être installé et connecté sur l'exécutant choisi ; sinon la veille tourne sans ces opérations.";
}
function rendreSources(){
  var z=$("#veSources"); if(!z) return;
  var v=VE.edit;
  z.innerHTML=v.sources.length?v.sources.map(function(s,i){
    var t=s.type||"rss", ch=function(cle,ph,st,typ){ return '<input type="'+(typ||"text")+'" data-src="'+cle+'" data-i="'+i+'" value="'+esc(s[cle]!=null?s[cle]:"")+'" placeholder="'+esc(ph)+'" style="'+st+'">' };
    var champs=t==="rss"?ch("url","https://…/feed/","flex:1;min-width:220px","url")
      :t==="francetravail"?ch("motsCles","mots-clés, séparés par des virgules (une recherche chacun)","flex:1;min-width:220px")
        +ch("departement","dépt (69)","width:80px")+ch("jours","jours","width:70px","number")
      :ch("jours",t==="nvd"?"jours (2)":"jours (30)","width:90px","number")
        +'<span class="note-aide" style="margin:0">'+(t==="nvd"?"publiées ces N jours ; filtrez avec le score minimum et les mots-clés":"ajoutées au catalogue ces N jours")+'</span>';
    return '<div class="ligne" style="margin-bottom:6px;align-items:flex-start;flex-wrap:wrap">'
      +'<select data-src="type" data-i="'+i+'" style="width:200px">'+selOpts(TYPES_SRC,t)+'</select>'
      +'<input type="text" data-src="nom" data-i="'+i+'" value="'+esc(s.nom||"")+'" placeholder="Nom" style="width:130px">'
      +champs
      +'<button class="b mini creux" data-ve="src-verif" data-i="'+i+'">Vérifier</button>'
      +'<button class="b mini creux" data-ve="src-retirer" data-i="'+i+'">Retirer</button>'
      +'<div id="veSrc'+i+'" class="note-aide" style="flex-basis:100%;margin:2px 0 0"></div></div>';
  }).join(""):'<div class="note-aide" style="margin:0">Aucune source : ajoutez l\'adresse d\'un flux RSS ou Atom (souvent signalé par l\'icône orange, ou en ajoutant /feed/ à l\'adresse d\'un site), ou une source spécialisée.</div>';
  if(v.sources.some(function(s){ return s.type==="francetravail" })) z.insertAdjacentHTML("beforeend",'<div class="note-aide" style="margin:2px 0 0">Offres France Travail : '
    +'créez un accès gratuit sur francetravail.io (API « Offres d\'emploi v2 »), puis saisissez son identifiant et sa clé dans Données → Réglages, sur l\'appareil ou le serveur qui exécute la veille.</div>');
}
function majRythme(){
  var t=($("#veRyt")||{}).value||"jour";
  $("#veHeureL").style.display=t==="heures"?"none":""; $("#veJourL").style.display=t==="semaine"?"":"none"; $("#veNL").style.display=t==="heures"?"":"none";
}
function lireVeille(){
  var v=VE.edit;
  v.nom=$("#veNom").value.trim()||"Veille";
  v.executeur=$("#veExe").value;
  if(VE.info && v.executeur===VE.info.executeur && v.executeur!=="serveur") v.executeurNom=VE.info.appareil;
  var t=$("#veRyt").value;
  v.rythme={type:t,heure:$("#veHeure").value||"07:30",jour:+$("#veJour").value||1,n:Math.max(1,Math.min(168,+$("#veN").value||6))};
  try{ v.fuseau=Intl.DateTimeFormat().resolvedOptions().timeZone }catch(e){}
  v.sources=v.sources.filter(function(s){ return (s.type&&s.type!=="rss") || (s.url && s.url.trim()) }).map(function(s){
    var t=s.type||"rss", o={type:t,nom:(s.nom||"").trim()};
    if(t==="rss") o.url=s.url.trim();
    if(t!=="rss") o.jours=Math.max(1,+s.jours||(t==="nvd"?2:t==="kev"?30:7));
    if(t==="francetravail"){ o.motsCles=String(s.motsCles||"").trim(); o.departement=String(s.departement||"").trim() }
    return o;
  });
  v.filtres={inclure:$("#veInc").value.trim(),exclure:$("#veExc").value.trim(),ageHeures:Math.max(0,+$("#veAge").value||0),max:Math.max(1,Math.min(200,+$("#veMax").value||30)),
    scoreMin:Math.max(0,Math.min(10,+$("#veScore").value||0)),contrats:$("#veContrats").value.trim()};
  v.actif=$("#veActif").checked;
  v.sortie={notifier:$("#veNotif").checked,ficheVide:$("#veVide").checked};
  v.claude={noter:$("#veCNoter").checked,resumer:$("#veCResumer").checked,actions:$("#veCActions").checked,synthese:$("#veCSynthese").checked,revision:$("#veCRevision").checked,
    critere:$("#veCCritere").value.trim(),seuil:+$("#veCSeuil").value||0,modele:$("#veCModele").value,
    plafond:Math.max(1,Math.min(100,+$("#veCPlafond").value||6)),consigne:$("#veCConsigne").value.trim()};
  return v;
}
function testerVeille(){
  var v=lireVeille(), z=$("#veRes");
  var c=v.claude, avecC=(c.noter||c.resumer||c.actions||c.synthese) && VE.info && v.executeur===VE.info.executeur
    && confirm("Inclure les opérations par Claude dans l'essai ?\n\nOK : une demande à Claude sur 10 éléments au plus (consomme un peu de quota, hors plafond).\nAnnuler : collecte et filtres seulement.");
  z.style.color=""; z.textContent=avecC?"Collecte, puis Claude… (jusqu'à une minute)":"Collecte en cours…";
  api("veilles/essai",{method:"POST",body:{veille:v,avecClaude:!!avecC}}).then(function(r){
    if(!r.ok) throw new Error((r.body&&r.body.message)||"essai impossible");
    var b=r.body;
    z.innerHTML='<b>Essai</b> : '+b.collectes+' élément(s) collecté(s), '+b.gardes+' après filtres, <b>'+b.nouveaux.length+' nouveau(x)</b>'+(b.ecartes?' (+'+b.ecartes+' au-delà du maximum)':"")
      +(b.ecartesNote?', '+b.ecartesNote+' écarté(s) par la note':"")+'. Rien n\'a été enregistré.'
      +(b.claude&&b.claude.erreur?'<div style="color:var(--rouge)">'+esc(b.claude.erreur)+'</div>':"")
      +(b.erreurs.length?'<div style="color:var(--rouge)">'+esc(b.erreurs.map(function(e){ return e.url+" : "+e.message }).join(" · "))+'</div>':"")
      +(b.synthese?syntheseHTML(b.synthese):"")
      +(b.nouveaux.length?'<ul style="margin:6px 0 0;padding-left:18px">'+b.nouveaux.slice(0,8).map(function(it){ return '<li>'+noteHTML(it)+esc(it.titre)+' <span class="mono" style="font-size:11.5px">'+esc(it.source||"")+'</span>'
        +(it.resume?'<div style="font-size:12.5px">'+esc(it.resume)+'</div>':"")+(it.action&&it.action!=="aucune"?'<div class="note-aide" style="margin:0">Suggestion : '+(it.action==="faire"?"à faire":"à creuser")+(it.raison?" — "+esc(it.raison):"")+'</div>':"")+'</li>' }).join("")+(b.nouveaux.length>8?'<li>…</li>':"")+'</ul>':"");
  }).catch(function(e){ z.style.color="var(--rouge)"; z.textContent=e.message });
}
function noteHTML(it){
  if(it.note==null) return "";
  var c=it.note>=4?"var(--rouge,#D8232A)":it.note>=3?"#B8901C":"#8B918C";
  return '<span title="Pertinence selon votre critère" style="display:inline-block;min-width:30px;padding:0 5px;margin-right:6px;border-radius:2px;background:'+c+';color:#fff;font:600 11px/18px var(--data,monospace);text-align:center">'+it.note+'/5</span>';
}
function syntheseHTML(s){
  if(!s || (!s.points.length && !s.pourMoi)) return "";
  return '<div style="background:#F3F3F0;border:1px solid var(--trait);padding:10px 12px;margin:10px 0 4px;font-size:13.5px">'
    +'<div style="font:600 12px var(--display,inherit);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Synthèse</div>'
    +(s.points.length?'<ul style="margin:0 0 6px;padding-left:18px">'+s.points.map(function(p){ return '<li>'+esc(p)+'</li>' }).join("")+'</ul>':"")
    +(s.pourMoi?'<div><b>Ce que ça change pour moi :</b> '+esc(s.pourMoi)+'</div>':"")+'</div>';
}
function enregistrerVeille(neuve){
  var v=lireVeille(), z=$("#veRes");
  if(!v.sources.length){ z.style.color="var(--rouge)"; z.textContent="Ajoutez au moins une source."; return }
  var l=VE.doc.veilles, i=-1; l.forEach(function(x,k){ if(x.id===v.id) i=k });
  if(i>=0) l[i]=v; else l.push(v);
  enregistrerVeilles().then(function(){ fermerModale(); VE.sel=v.id; rendre(); toast(neuve?"Veille créée : elle sera exécutée par "+libExecuteur(v):"Veille enregistrée") })
    .catch(function(e){ z.style.color="var(--rouge)"; z.textContent=e.message });
}
function choisirModele(){
  ouvrirModale("Nouvelle veille",MODELES_VEILLE.map(function(m){
    return '<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px dashed var(--trait)"><div><b>'+esc(m.nom)+'</b><div class="note-aide" style="margin:2px 0 0">'+esc(m.desc)+'</div></div>'
      +'<button class="b mini" style="margin-left:auto" data-ve="modele" data-m="'+m.cle+'">Choisir</button></div>';
  }).join(""),[{txt:"Annuler",classe:"creux",fn:fermerModale}]);
}
function versIdee(f,i){
  var it=fichePar(f).items[i]; if(!it) return;
  boite();
  var essai=0;
  (function attendre(){
    if(!Idees.prete){ if(++essai>40) return toast("L'onglet Idées ne répond pas",true); return setTimeout(attendre,250) }
    demanderIdees("ajouter-idee",{titre:it.titre,note:((it.resume||it.extrait)?(it.resume||it.extrait)+"\n":"")+(it.lien||"")+"\n(veille : "+(fichePar(f).nom||"")+")"})
      .then(function(){ toast("Idée déposée dans l'onglet Idées") }).catch(function(e){ toast(e.message,true) });
  })();
}
function versActivite(f,i){
  var it=fichePar(f).items[i]; if(!it) return;
  try{ var c=creerActivite({titre:it.titre,synthese:(it.resume||it.extrait||"")+(it.raison?"\n\nPourquoi : "+it.raison:"")+(it.lien?"\n\nSource : "+it.lien:""),categorie:""}); toast("Activité créée : "+c.libelle); }
  catch(e){ toast(e.message,true) }
}
function fichePar(id){ return (VE.doc.fiches||[]).filter(function(f){ return f.id===id })[0]||{items:[]} }
function marquerLues(ids){
  var n=0; (VE.doc.fiches||[]).forEach(function(f){ if(ids.indexOf(f.id)>=0 && !f.lue){ f.lue=true; n++ } });
  if(!n) return;
  pastilleVeilles(); rendre();
  enregistrerVeilles().catch(function(){});
}
function pastilleVeilles(){ pastille("veilles",VE.doc?nonLues().length:0,"dans vos veilles") }
document.addEventListener("click",function(e){
  var el=e.target.closest&&e.target.closest("[data-ve]");
  if(!el) return;
  var a=el.dataset.ve, d=el.dataset;
  if(a==="choisir"){ if(e.target.closest("button")&&e.target.closest("button")!==el) return; VE.sel=d.id||""; rendre() }
  else if(a==="nouvelle") choisirModele();
  else if(a==="modele"){ var m=MODELES_VEILLE.filter(function(x){ return x.cle===d.m })[0]; fermerModale(); modaleVeille(Object.assign({id:"v"+uid(),actif:true},JSON.parse(JSON.stringify(m.v))),true) }
  else if(a==="modifier"){ e.stopPropagation(); modaleVeille(veillePar(d.id),false) }
  else if(a==="executer"){
    e.stopPropagation(); toast("Exécution de la veille…");
    api("veilles/"+encodeURIComponent(d.id)+"/executer",{method:"POST"}).then(function(r){
      if(!r.ok) throw new Error((r.body&&r.body.message)||"échec");
      return apiVeilles().then(function(){ VE.sel=d.id; rendre(); toast(r.body.nouveaux.length?r.body.nouveaux.length+" nouveau(x) élément(s)":"Rien de nouveau") });
    }).catch(function(x){ toast("Veille : "+x.message,true); apiVeilles().then(rendre) });
  }
  else if(a==="deplier"){ VE.ouvertes=VE.ouvertes||{}; VE.ouvertes[d.id]=!VE.ouvertes[d.id]; rendre() }
  else if(a==="lue") marquerLues([d.id]);
  else if(a==="tout-lu") marquerLues(fichesDe(VE.sel).map(function(f){ return f.id }));
  else if(a==="vers-idee") versIdee(d.f,+d.i);
  else if(a==="vers-activite") versActivite(d.f,+d.i);
  else if(a==="src-ajout"){ lireSourcesSaisies(); VE.edit.sources.push({nom:"",url:""}); rendreSources(); var x=$('#veSources [data-src="url"][data-i="'+(VE.edit.sources.length-1)+'"]'); if(x) x.focus() }
  else if(a==="src-retirer"){ lireSourcesSaisies(); VE.edit.sources.splice(+d.i,1); rendreSources() }
  else if(a==="src-verif"){
    lireSourcesSaisies();
    var s=VE.edit.sources[+d.i], z=$("#veSrc"+d.i); if(!s||((s.type||"rss")==="rss"&&!s.url)){ z.textContent="Saisissez d'abord l'adresse."; return }
    z.style.color=""; z.textContent="Vérification…";
    api("veilles/flux",{method:"POST",body:{source:s}}).then(function(r){
      if(!r.ok) throw new Error((r.body&&r.body.message)||"flux illisible");
      if(!s.nom && r.body.titre){ s.nom=r.body.titre.slice(0,60); var n=$('#veSources [data-src="nom"][data-i="'+d.i+'"]'); if(n) n.value=s.nom }
      z.style.color="var(--vert)";
      z.innerHTML='Source valide : « '+esc(r.body.titre||"sans titre")+' », '+r.body.nombre+' élément(s). Derniers : '+esc(r.body.items.slice(0,3).map(function(x){ return x.titre }).join(" · "));
    }).catch(function(x){ z.style.color="var(--rouge)"; z.textContent=x.message });
  }
});
function lireSourcesSaisies(){
  Array.prototype.forEach.call(document.querySelectorAll("#veSources [data-src]"),function(e){
    var s=VE.edit.sources[+e.dataset.i]; if(s) s[e.dataset.src]=e.value;
  });
}
document.addEventListener("change",function(e){
  if(e.target.id==="veRyt") majRythme(); if(e.target.id==="veExe") majEtatClaudeVeille();
  if(e.target.dataset && e.target.dataset.src==="type" && VE.edit){ lireSourcesSaisies(); rendreSources() }
});
document.addEventListener("input",function(e){ if(e.target.dataset && e.target.dataset.src && VE.edit){ var s=VE.edit.sources[+e.target.dataset.i]; if(s) s[e.target.dataset.src]=e.target.value } });
/* suivi : nouvelles fiches (exécutées ici ou ailleurs), pastille et notification */
function suivreVeilles(){
  if(!fichierCharge) return;
  var p=VE.info?Promise.resolve():api("veilles/info").then(function(r){ if(r.ok) VE.info=r.body });
  p.then(function(){ return api("docs/veilles/rev") }).then(function(r){
    if(r && r.status===404 && !VE.doc){ VE.doc={veilles:[],fiches:[],etats:[]}; VE.rev=0; if(vueActive==="veilles") rendre(); return }
    if(!r || !r.ok || (VE.doc && r.body.rev<=VE.rev)) return;
    var mod=$("#modale"); if(vueActive==="veilles" && mod && mod.open) return;
    return apiVeilles().then(function(){
      var nl=nonLues(), neuves=VE.pret?nl.filter(function(f){ return (f.at||"")>(VE.dernierLu||"") }):[];
      VE.dernierLu=nl.reduce(function(m,f){ return f.at>m?f.at:m },VE.dernierLu||""); VE.pret=true;
      pastilleVeilles();
      if(vueActive==="veilles") rendreDonneesSiCalme();
      neuves=neuves.filter(function(f){ var v=veillePar(f.veille); return !v || !v.sortie || v.sortie.notifier!==false });
      if(neuves.length){
        var f=neuves[0], n=(f.items||[]).length;
        notifier(neuves.length>1?neuves.length+" nouvelles fiches de veille":"Veille « "+f.nom+" » : "+n+" nouveau"+(n>1?"x":"")+" élément"+(n>1?"s":""),
          neuves.length>1?neuves.map(function(x){ return x.nom }).join(", "):(f.items||[]).slice(0,3).map(function(x){ return "• "+x.titre }).join("\n"),"veilles");
      }
    });
  }).catch(function(){});
}
function notifier(titre,corps,cible){
  var dehors=document.hidden || !document.hasFocus();
  var permis=!(Partage.st && Partage.st.notifications && Partage.st.notifications.systeme===false);
  if(dehors && permis && window.Notification){
    var go=function(){ try{ var n=new Notification(titre,{body:corps,tag:"mppe-"+cible});
      n.onclick=function(){ window.focus(); vueActive=cible; rendre(); n.close() } }catch(x){} };
    if(Notification.permission==="granted") go();
    else if(Notification.permission!=="denied") Notification.requestPermission().then(function(p){ if(p==="granted") go() });
  } else toast(titre);
}
setTimeout(suivreVeilles,2500);
setInterval(suivreVeilles,10000);

window.persoBlocIdees=function(){
  var st=Idees.claude;
  return '<div class="bloc" style="margin-top:18px"><div class="bloc-tete"><h2>Idées et Claude</h2></div><div class="bloc-corps">'
    +'<div class="note-aide" style="margin:0 0 10px">'
      +(st?'Claude : <b>'+esc(st)+'</b>.':'Chargement de l\'onglet Idées…')
      +' Les catégories des idées sont celles des activités.</div>'
    +'<div class="ligne">'
      +'<button class="b" data-pp="claude">Connexion à Claude</button>'
      +'<button class="b creux" data-act="param">Catégories</button>'
      +'<button class="b creux" data-pp="idees-export">Exporter les idées</button>'
      +'<button class="b creux" data-pp="idees-import">Importer des idées</button>'
    +'</div></div></div>';
};
window.persoBlocDonnees=function(){
  var etat={ok:"enregistrées",horsligne:"hors ligne (gardées dans ce navigateur)",conflit:"en conflit",init:"en cours de chargement"}[Sync.etat]||"";
  return '<div class="ligne">'
      +'<button class="b" data-act="enr">Enregistrer maintenant</button>'
      +'<button class="b creux" data-pp="historique">Historique des versions</button>'
      +'<button class="b creux" data-pp="instantane">Instantané de la base</button>'
      +(InfoInst.canOpen?'<button class="b creux" data-pp="instantanes-ouvrir">Ouvrir le dossier des instantanés</button>':"")
    +'</div>'
    +'<div class="note-aide">Instantanés : '+(InfoInst.dir
        ?'<span class="mono">'+esc(InfoInst.dir)+'</span>'
        :'dossier <span class="mono">/data/snapshots</span> du serveur (volume Docker <span class="mono">pilot-data</span>)')
      +', les '+(InfoInst.keep||30)+' plus récents sont gardés.</div>'
    +'<div class="ligne" style="margin-top:10px">'
      +'<button class="b creux" data-act="ouvrir">Importer un fichier (remplacer)</button>'
      +'<button class="b creux" data-act="fusion">Importer et fusionner</button>'
    +'</div>'
    +'<div class="ligne" style="margin-top:10px"><label style="font-size:13.5px;display:flex;gap:6px;align-items:center">'
      +'<input type="checkbox" id="autoEnr" '+(D.parametres.auto!==false?"checked":"")+'>'
      +'Enregistrer automatiquement à chaque modification</label></div>'
    +'<div class="note-aide">Données '+etat+' — version n°'+Sync.rev
      +(Sync.dernier?', '+esc(Sync.dernier.toLocaleString("fr-FR")):"")
      +'. Elles vivent dans la base du serveur, qui garde un historique des versions et peut être '
      +'répliquée vers un serveur distant. Un fichier PST·PILOT (pstp-data.json) peut être importé ici.</div>';
};

function historique(){
  api("docs/"+DOC+"/revisions?limit=60").then(function(r){
    if(!r.ok) throw new Error();
    var l=r.body||[];
    var raisons={auto:"automatique",manual:"manuel","avant-restauration":"avant restauration"};
    ouvrirModale("Historique des versions",
      (l.length?'<div class="note-aide" style="margin-top:0">Une version est gardée au plus toutes les 5 minutes pendant la saisie, '
        +'et à chaque enregistrement manuel. Restaurer crée une nouvelle version : rien n\'est effacé.</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:14px">'
        +l.map(function(x){
          return '<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 4px">n°'+x.rev+'</td>'
            +'<td>'+esc(new Date(x.created_at).toLocaleString("fr-FR"))+'</td>'
            +'<td>'+esc(raisons[x.reason]||x.reason.replace("restauration-","restauration de n°"))+'</td>'
            +'<td class="mono">'+Math.round(x.size/1024)+' Ko</td>'
            +'<td style="text-align:right">'+(x.rev===Sync.rev?'<em>actuelle</em>':'<button class="b mini creux" data-pp="restaurer" data-rev="'+x.rev+'">Restaurer</button>')+'</td></tr>';
        }).join("")+'</table>'
      :'<p>Aucune version enregistrée pour l\'instant.</p>'),
      [{txt:"Fermer",fn:fermerModale}]);
  }).catch(function(){ toast("Historique indisponible : serveur injoignable",true) });
}
function restaurer(rev){
  if(!confirm("Restaurer la version n°"+rev+" ? La version actuelle reste dans l'historique.")) return;
  var avant=sale?envoyer("manual"):Promise.resolve(true);
  avant.then(function(){ return api("docs/"+DOC+"/restore/"+rev,{method:"POST"}) })
  .then(function(r){ if(!r.ok) throw new Error(); fermerModale(); return recharger() })
  .then(function(){ toast("Version n°"+rev+" restaurée") })
  .catch(function(){ toast("Restauration impossible",true) });
}
var InfoInst={dir:null,canOpen:false,keep:30};
api("backup/info").then(function(r){ if(r.ok){ InfoInst=r.body; if(vueActive==="donnees") rendreDonneesSiCalme() } }).catch(function(){});
function ouvrirInstantanes(){
  api("backup/open",{method:"POST"}).then(function(r){
    if(!r.ok) throw new Error((r.body&&r.body.message)||"");
  }).catch(function(e){ toast("Ouverture du dossier impossible"+(e.message?" : "+e.message:""),true) });
}
function instantane(){
  api("backup",{method:"POST"}).then(function(r){
    if(!r.ok) throw new Error();
    toast("Instantané créé : "+r.body.file+(InfoInst.canOpen?" (bouton « Ouvrir le dossier des instantanés » pour le retrouver)":""));
  }).catch(function(){ toast("Instantané impossible : serveur injoignable",true) });
}
document.addEventListener("click",function(e){
  var el=e.target.closest&&e.target.closest("[data-pp]");
  if(!el) return;
  var a=el.dataset.pp;
  if(a==="historique") historique();
  else if(a==="instantane") instantane();
  else if(a==="instantanes-ouvrir") ouvrirInstantanes();
  else if(a==="restaurer") restaurer(+el.dataset.rev);
});
window.addEventListener("beforeunload",function(e){
  if(sale || Sync.etat==="horsligne"){ e.preventDefault(); e.returnValue="" }
});

/* ================= 3. onglet Idées (Cristallisoir) ================= */
var boiteIdees=null;
function boite(){
  if(boiteIdees) return boiteIdees;
  boiteIdees=document.createElement("div");
  boiteIdees.id="vueIdees";
  boiteIdees.style.cssText="display:none;padding:0;margin:0";
  boiteIdees.innerHTML='<iframe src="../cristallisoir/?embed=1" title="Idées" '
    +'style="display:block;width:100%;border:0;background:transparent"></iframe>';
  $("#vue").insertAdjacentElement("afterend",boiteIdees);
  ajuster();
  return boiteIdees;
}
/* quand une fenêtre s'ouvre dans l'onglet Idées, le reste du pilotage s'assombrit comme pour ses propres fenêtres */
var voile=null;
function voilePilote(on){
  if(!voile){
    voile=document.createElement("div");
    voile.style.cssText="position:fixed;inset:0;background:rgba(25,28,27,.45);z-index:60;display:none";
    voile.addEventListener("click",function(){
      var w=fenetreIdees(); if(w) w.postMessage({src:"pilot",type:"fermer-fenetre"},location.origin);
    });
    document.body.appendChild(voile);
  }
  voile.style.display=on?"block":"none";
  var b=boite(); b.style.position="relative"; b.style.zIndex=on?"61":"";
}
function ajuster(){
  if(!boiteIdees) return;
  var f=boiteIdees.querySelector("iframe"),top=boiteIdees.getBoundingClientRect().top;
  f.style.height=Math.max(420,window.innerHeight-Math.max(top,0)-4)+"px";
}
window.addEventListener("resize",ajuster);
var rendre0=rendre;
rendre=function(){
  var b=boite(),v=$("#vue");
  if(vueActive==="idees"){
    v.style.display="none"; b.style.display="";
    document.documentElement.style.overflow="hidden";     /* la fenêtre Idées occupe toute la hauteur */
    Array.prototype.forEach.call($("#nav").children,function(x){
      x.disabled=!fichierCharge && x.dataset.vue!=="donnees";
      x.setAttribute("aria-current",x.dataset.vue==="idees"?"true":"false");
    });
    majEtat(); ajuster();
    return;
  }
  b.style.display="none"; v.style.display="";
  document.documentElement.style.overflow="";
  rendre0();
  if(vueActive==="veilles"){
    if(!VE.doc || !VE.info){ Promise.all([VE.doc?null:apiVeilles(),VE.info?null:api("veilles/info").then(function(r){ if(r.ok) VE.info=r.body })]).then(function(){ if(vueActive==="veilles") rendre() }) }
    v.innerHTML=vueVeilles(); pastilleVeilles(); return;
  }
  decorerNotes(v);
  if(vueActive==="chantiers"){ decorerActivites(v); afficherRecuesActivites(v) }
  if(vueActive==="donnees"){
    var blocs=v.querySelectorAll(".bloc"),i;
    for(i=0;i<blocs.length;i++){
      var h=blocs[i].querySelector(".bloc-tete h2");
      if(h && h.textContent==="Données et sauvegardes"){ blocs[i].insertAdjacentHTML("afterend",window.persoBlocSync()+window.persoBlocPartage()+window.persoBlocReglages()+window.persoBlocIdees()); break }
    }
  }
};

/* --- dialogue avec l'onglet Idées (même origine, messages vérifiés) --- */
var Idees={claude:null,attente:{},prete:false};
window.__pilotIdees=Idees;
function fenetreIdees(){ var f=boite().querySelector("iframe"); return f && f.contentWindow }
function demanderIdees(type,data,delai){
  return new Promise(function(ok,ko){
    var w=fenetreIdees();
    if(!w || !Idees.prete) return ko(new Error("l'onglet Idées n'est pas encore chargé"));
    var id=uid(); Idees.attente[id]=ok;
    w.postMessage(Object.assign({src:"pilot",type:type,requestId:id},data||{}),location.origin);
    setTimeout(function(){
      if(Idees.attente[id]){ delete Idees.attente[id]; ko(new Error("l'onglet Idées ne répond pas")) }
    },delai||10000);
  });
}
function catsPourIdees(){
  return categories().map(function(K){ return {cle:K.cle,lib:K.lib,couleur:K.couleur,desc:K.place||""} });
}
var dernieresCats="",minuteurCats=null;
function pousserCats(){
  var l=catsPourIdees(),j=JSON.stringify(l),w=fenetreIdees();
  if(j===dernieresCats || !Idees.prete || !w) return;
  dernieresCats=j;
  w.postMessage({src:"pilot",type:"categories",liste:l},location.origin);
}
var modifie1=modifie;
modifie=function(){
  modifie1();
  clearTimeout(minuteurCats); minuteurCats=setTimeout(pousserCats,300);
};

function modaleClaude(){
  demanderIdees("get-claude").then(function(r){
    var c=r.cfg||{},L=r.local||{};
    var opts=function(l,v){ return l.map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===v?" selected":"")+'>'+esc(x[1])+'</option>' }).join("") };
    ouvrirModale("Connexion à Claude",
      '<div class="note-aide" style="margin:0 0 12px">Claude Code sur le serveur : <b>'
        +(L.available?"disponible"+(L.version?" ("+esc(L.version)+")":""):"indisponible")+'</b>'
        +' · clé API : <b>'+(r.hasKey?"renseignée":"aucune")+'</b>'
        +' · mode utilisé : <b>'+esc(r.libelle||"")+'</b></div>'
      +'<div class="grille">'
        +'<label class="champ">Mode<select id="ccMode">'+opts([["auto","Automatique"],["local","Claude Code sur le serveur"],
            ["manuel","Copier-coller via claude.ai"],["cle","Clé API Anthropic"]],c.mode||"auto")+'</select></label>'
        +'<label class="champ">Modèle Claude Code<select id="ccModel">'+opts([["haiku","Haiku : rapide, peu de quota"],
            ["sonnet","Sonnet : équilibré"],["opus","Opus : approfondi, plus de quota"]],c.ccModel||"sonnet")+'</select></label>'
      +'</div>'
      +'<div class="note-aide">Automatique : Claude Code du serveur s\'il est prêt, sinon la clé API si elle est renseignée, sinon le copier-coller. '
        +'Claude Code et le copier-coller utilisent votre abonnement claude.ai ; la clé API est facturée à part.</div>'
      +'<label class="champ" style="margin-top:12px">Conversation dédiée pour le copier-coller (facultatif)'
        +'<input type="text" id="ccConv" value="'+esc(c.convUrl||"")+'" placeholder="https://claude.ai/project/…"></label>'
      +'<label class="champ" style="margin-top:12px">Consignes personnelles, ajoutées à chaque demande'
        +'<textarea id="ccPerso" style="width:100%;min-height:60px;padding:8px;border:1px solid var(--trait);border-radius:2px" '
        +'placeholder="Ex. : surtout des week-ends libres, budget modeste, étapes courtes">'+esc(c.consignes||"")+'</textarea></label>'
      +'<hr class="sep">'
      +'<div class="grille">'
        +'<label class="champ">Clé API (mode clé API)<input type="password" id="ccKey" autocomplete="off" style="padding:6px 8px;border:1px solid var(--trait);border-radius:2px;background:#fff" placeholder="'
          +(r.hasKey?"déjà renseignée : laisser vide pour la garder":"sk-ant-…")+'"></label>'
        +'<label class="champ">Modèle API<input type="text" id="ccApiModel" value="'+esc(c.model||"claude-sonnet-5-5")+'"></label>'
        +'<label class="champ">Longueur max (jetons)<input type="number" id="ccMax" min="200" max="8000" step="100" value="'+(+c.maxTokens||1200)+'"></label>'
      +'</div>'
      +'<div class="ligne" style="margin-top:8px">'
        +'<label style="font-size:13.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="ccKeep"'+(r.keepKey?" checked":"")+'> Mémoriser la clé dans ce navigateur</label>'
        +(r.hasKey?'<label style="font-size:13.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="ccClear"> Effacer la clé</label>':"")
      +'</div>'
      +'<div class="note-aide">La clé reste dans ce navigateur : elle n\'est jamais envoyée au serveur My Pilot Personal Edition ni incluse dans les exports.</div>'
      +'<div id="ccTest" class="note-aide" style="margin-top:12px;font-size:13.5px" role="status"></div>',
      [{txt:"Fermer",classe:"creux",fn:fermerModale},
       {txt:"Tester la connexion",classe:"creux",droite:true,fn:function(){ enregistrerClaude().then(testerClaude) }},
       {txt:"Enregistrer",droite:true,fn:function(){ enregistrerClaude().then(function(ok){ if(ok){ fermerModale(); toast("Connexion à Claude enregistrée") } }) }}]);
  }).catch(function(e){ toast("Réglages de Claude indisponibles : "+e.message,true) });
}
function enregistrerClaude(){
  var cle=valChamp("ccKey") || ($("#ccKey")?$("#ccKey").value.trim():"");
  var eff=$("#ccClear") && $("#ccClear").checked;
  var cfg={mode:$("#ccMode").value,ccModel:$("#ccModel").value,convUrl:$("#ccConv").value.trim(),
    consignes:$("#ccPerso").value,model:$("#ccApiModel").value.trim(),maxTokens:+$("#ccMax").value||1200};
  return demanderIdees("set-claude",{cfg:cfg,apiKey:eff?"":(cle||null),keepKey:$("#ccKeep").checked})
    .then(function(r){ Idees.claude=r.claude; return true })
    .catch(function(e){ toast("Enregistrement impossible : "+e.message,true); return false });
}
function testerClaude(ok){
  var z=$("#ccTest"); if(!ok||!z) return;
  z.textContent="Test en cours…"; z.style.color="";
  demanderIdees("test-claude",{},200000).then(function(r){
    z.textContent=r.t; z.style.color=r.ok?"var(--vert)":"var(--rouge)";
  }).catch(function(e){ z.textContent=e.message; z.style.color="var(--rouge)" });
}
function exporterIdees(){
  api("docs/ideas").then(function(r){
    if(r.status===404){ toast("Aucune idée enregistrée pour l'instant",true); return }
    if(!r.ok) throw new Error();
    telecharger("my-pilot-personal-edition-idees-"+auj()+".json",JSON.stringify(r.body.data,null,2));
  }).catch(function(){ toast("Export impossible : serveur injoignable",true) });
}
var entreeIdees=document.createElement("input");
entreeIdees.type="file"; entreeIdees.accept=".json,application/json"; entreeIdees.style.display="none";
document.body.appendChild(entreeIdees);
entreeIdees.addEventListener("change",function(){
  var f=entreeIdees.files[0]; entreeIdees.value="";
  if(!f) return;
  var lr=new FileReader();
  lr.onload=function(){
    var o; try{ o=JSON.parse(lr.result) }catch(e){ toast("Fichier illisible : ce n'est pas du JSON valide",true); return }
    if(!o || !estTableau(o.ideas)){ toast("Fichier non reconnu : choisissez un export des idées",true); return }
    if(!confirm("Remplacer les idées actuelles par celles du fichier ("+o.ideas.length+" idée(s)) ? La version actuelle reste dans l'historique du serveur.")) return;
    demanderIdees("importer",{data:o}).then(function(){ toast("Idées importées") })
      .catch(function(e){ toast("Import impossible : "+e.message,true) });
  };
  lr.readAsText(f);
});
document.addEventListener("click",function(e){
  var el=e.target.closest&&e.target.closest("[data-pp]");
  if(!el) return;
  var a=el.dataset.pp;
  if(a==="claude") modaleClaude();
  else if(a==="idees-export") exporterIdees();
  else if(a==="idees-import") entreeIdees.click();
});

function catProjet(){
  var l=categories(),i;
  for(i=0;i<l.length;i++) if(l[i].cle==="projet") return l[i];
  return l[0]||null;
}
function catParNom(nom){
  var n=String(nom||"").toLowerCase().trim(),l=categories(),i,premier=n.split(/[\s&,/]+/)[0];
  for(i=0;i<l.length;i++) if(l[i].lib.toLowerCase()===n || l[i].plur.toLowerCase()===n) return l[i];
  /* « Maison & jardin » côté idées → « Maison » côté activités */
  for(i=0;i<l.length;i++) if(premier.length>3 && l[i].lib.toLowerCase().split(/[\s&,/]+/)[0]===premier) return l[i];
  return null;
}
function creerActivite(p){
  var K=catParNom(p.categorie)||catProjet();
  if(!K) throw new Error("Aucune catégorie d'activité");
  var c={id:uid(),categorie:K.cle,cree_le:new Date().toISOString(),
    libelle:String(p.titre||"Projet").slice(0,200),reference:"",date:dateValide(p.date)?p.date:"",heure:"",duree:0,
    type:"",tiers:"",contact_nom:"",contact_tel:"",commune:"",adresse:"",
    statut:statutAdmis(K,"planifie")?"planifie":"",priorite:"",
    commentaire:String(p.synthese||""),eprouvante:false};
  var champs={};
  (K.champs||[]).forEach(function(f){ champs[f.cle]=1 });
  if(champs.origine) c.origine="Cristallisoir : "+(p.sources||[]).join(", ");
  if(champs.objectifs) c.objectifs=(p.objectifs||[]).join("\n");
  else if((p.objectifs||[]).length) c.commentaire+="\n\nObjectifs :\n- "+p.objectifs.join("\n- ");
  if(champs.vigilance) c.vigilance=(p.vigilance||[]).join("\n");
  else if((p.vigilance||[]).length) c.commentaire+="\n\nPoints de vigilance :\n- "+p.vigilance.join("\n- ");
  var esp=p.espace?espacesEcriture().filter(function(e){ return e.id===p.espace })[0]:null;
  if(esp){ c._sp=esp.id; c.par=esp.member; c.categorie_lib=K.lib; if(!PA.docs[esp.id]) PA.docs[esp.id]={rev:0,data:{},last:"",items:{}} }
  D.chantiers.push(c);
  (p.etapes||[]).forEach(function(t){
    D.notes.push({id:uid(),date:auj(),heure:hNow(),type:"",chantier_id:c.id,rubrique_id:"",
      contenu:"",duree:0,suite:{texte:String(t),echeance:"",fait:false}});
  });
  modifie();
  return c;
}
window.addEventListener("message",function(e){
  if(e.origin!==location.origin || !e.data || e.data.src!=="cristallisoir") return;
  var m=e.data,rep=function(o){ e.source.postMessage(Object.assign({src:"pilot",requestId:m.requestId},o),e.origin) };
  if(m.type==="reponse"){
    var f=Idees.attente[m.requestId];
    if(f){ delete Idees.attente[m.requestId]; f(m) }
    return;
  }
  if(m.type==="pret" || m.type==="etat-claude"){
    if(m.type==="pret"){ Idees.prete=true; dernieresCats=""; pousserCats() }
    Idees.claude=m.claude||Idees.claude;
    if(vueActive==="donnees") rendreDonneesSiCalme();
    return;
  }
  if(m.type==="ouvrir-categories"){ vueActive="param"; rendre(); return }
  if(m.type==="voile"){ voilePilote(!!m.on); return }
  if(m.type==="creer-activite"){
    try{
      var c=creerActivite(m.payload||{});
      rep({type:"activite-creee",id:c.id,libelle:c.libelle,categorie:catParCle(c.categorie).lib});
      toast("Activité créée : "+c.libelle);
    }catch(err){ rep({type:"erreur",message:err.message}) }
  }else if(m.type==="recues"){
    surveillerRecues();
  }else if(m.type==="ouvrir-activite"){
    if(!chantierPar(m.id)){ toast("Cette activité n'existe plus",true); return }
    vueActive="chantiers"; rendre(); editerChantier(m.id);
  }else if(m.type==="categories"){
    rep({type:"categories",liste:catsPourIdees()});
  }else if(m.type==="etat-activites"){
    rep({type:"etat-activites",liste:(m.ids||[]).map(function(id){
      var c=chantierPar(id); return {id:id,existe:!!c,libelle:c?c.libelle:"",clos:c?estClos(c):false};
    })});
  }
});

/* ================= démarrage ================= */
function texteAccueil(){
  var b=document.querySelector('#nav button[data-vue="suivant"]');
  if(b) b.textContent="Prochain jour";
  var s=$("#spSous"); if(s) s.textContent="pilotage personnel";
}
function demarrer(donnees,rev,etat){
  var lu=false,lireLocal0=lireLocal;
  lireLocal=function(){ if(!lu){ lu=true; return donnees } return lireLocal0() };
  Sync.rev=rev; Sync.etat=etat;
  marquerCharge();
  window.__pilotInit();
  lireLocal=lireLocal0;
  texteAccueil();
  majEtat();
  setTimeout(accueillir,2600);
}
/* premier lancement : une fenêtre de bienvenue propose la visite (une seule fois, pour tous vos appareils) */
function accueillir(){
  if(!D || !D.parametres || D.parametres.aide_bienvenue) return;
  var m=$("#modale"); if(m && m.open){ setTimeout(accueillir,4000); return }
  var vu=function(){};
  D.parametres.aide_bienvenue=new Date().toISOString(); modifie();      /* montrée une fois, même si on la ferme par la croix */
  ouvrirModale("Bienvenue",
    '<p style="margin:0 0 10px;font-size:15px">My Pilot Personal Edition vous aide à piloter vos activités personnelles : '
    +'projets, maison, formation, démarches, loisirs, mais aussi vos idées, vos contacts et votre veille.</p>'
    +'<ul style="margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.6">'
    +'<li><b>Aujourd’hui</b> : votre journée, vos tâches et votre journal.</li>'
    +'<li><b>Idées</b> : déposez vos envies, Claude les transforme en projets.</li>'
    +'<li><b>Veilles</b> : l’information qui vous intéresse, triée chaque jour.</li>'
    +'<li>Tout s’enregistre seul ; <b>Données</b> regroupe sauvegardes, synchronisation et réglages.</li></ul>'
    +'<div class="note-aide">L’aide reste disponible à tout moment : bouton <b>Aide</b> en haut, ou touche F1.</div>',
    [{txt:"Plus tard",classe:"creux",fn:function(){ vu(); fermerModale() }},
     {txt:"Découvrir l’application",droite:true,fn:function(){ vu(); fermerModale(); if(window.ouvrirAide) window.ouvrirAide("prise-en-main") }}]);
}
api("health").then(function(h){
  if(h.ok){ Sync.version=h.body.version; Sync.schema=h.body.schema; APP_VERSION=h.body.version; SyncDist.mode=h.body.mode||"";
    if(h.body.firstRun) setTimeout(premierAcces,1200) }
  return api("docs/"+DOC);
}).then(function(r){
  var tampon=lireLocal0Safe(),attente=lireSync();
  if(r.status===404){
    /* base vide : on reprend le tampon local s'il existe (première migration), sinon données vierges */
    demarrer(tampon,0,"ok");
    envoyer("manual");
    return;
  }
  if(!r.ok) throw new Error("HTTP "+r.status);
  var doc=r.body;
  if(attente && tampon){
    if(attente.base===doc.rev){            /* modifs locales faites hors ligne, serveur inchangé */
      demarrer(tampon,doc.rev,"ok"); sale=true; envoyer("manual");
      setTimeout(function(){ toast("Modifications faites hors ligne envoyées au serveur") },600);
      return;
    }
    demarrer(doc.data,doc.rev,"ok"); Sync.dernier=new Date(doc.updated_at);
    var copie=JSON.stringify(tampon,null,2);
    setTimeout(function(){
      ouvrirModale("Modifications hors ligne en concurrence",
        '<p style="margin:0 0 10px;font-size:14px">Des modifications faites dans ce navigateur sans connexion n\'ont pas pu être envoyées, '
        +'et le serveur a reçu d\'autres changements entre-temps. La version du serveur est affichée.</p>'
        +'<div class="note-aide">Téléchargez votre version locale pour la comparer ou la réimporter (Données, Importer et fusionner).</div>',
        [{txt:"Ignorer ma version locale",classe:"creux",fn:function(){ poserSync(null); fermerModale() }},
         {txt:"Télécharger ma version locale",classe:"",droite:true,fn:function(){
           telecharger("my-pilot-personal-edition-hors-ligne.json",copie); poserSync(null); fermerModale() }}]);
    },700);
    return;
  }
  demarrer(doc.data,doc.rev,"ok"); Sync.dernier=new Date(doc.updated_at);
}).catch(function(e){
  var tampon=lireLocal0Safe();
  demarrer(tampon,(lireSync()||{}).base||0,"horsligne");
  Sync.erreur=e.message||"";
  majEtat();
  setTimeout(function(){ toast("Serveur injoignable : vous travaillez sur la copie de ce navigateur, elle sera envoyée au retour de la connexion",true) },900);
});
function lireLocal0Safe(){ try{ return lireLocal() }catch(e){ return null } }

/* nouvelles tentatives tant que le serveur est injoignable (toutes les 30 s, et au retour sur l'onglet) */
function reessayer(){
  if(Sync.etat==="horsligne" && !Sync.envoi){
    api("docs/"+DOC).then(function(r){
      if(r.status===404 || (r.ok && r.body.rev===Sync.rev)){ Sync.etat="ok"; if(sale||lireSync()) envoyer("manual"); else majEtat() }
      else if(r.ok){ Sync.etat="conflit"; conflit({rev:r.body.rev,updated_at:r.body.updated_at}) }
    }).catch(function(){});
  }
}
setInterval(reessayer,30000);
window.addEventListener("online",reessayer);
window.addEventListener("focus",reessayer);

/* ===== en-tête sur fenêtre étroite (écran en portrait) =====
   Sur une fenêtre étroite, la zone d'état passait à la ligne et « flottait » : alignée à droite
   sous la date, avec des boutons qui changeaient de ligne selon la longueur du texte d'état.
   Ici : une ligne fixe pour la marque et la date, une ligne fixe pour l'état et les boutons,
   et des largeurs réservées pour que le texte qui change ne déplace rien. */
(function(){
  var st=document.createElement("style"); st.id="ppEntete";
  st.textContent=''
  +'.etat-txt{white-space:nowrap;display:inline-block;min-width:19ch;font-variant-numeric:tabular-nums}'
  +'.cd-pause{white-space:nowrap;display:inline-block;min-width:16ch;font-variant-numeric:tabular-nums}'
  +'#etat .b{flex:none}'
  +'nav{scrollbar-width:thin;scrollbar-color:#4A514C transparent}'
  +'nav::-webkit-scrollbar{height:4px}nav::-webkit-scrollbar-thumb{background:#4A514C}'
  +'@media (max-width:1180px){'
  +  '.bandeau{row-gap:6px;padding:8px 14px}'
  +  '.jour{margin-left:auto}'
  +  '.etat{flex:1 0 100%;margin-left:0;justify-content:flex-start;flex-wrap:nowrap;gap:10px;border-top:1px solid #2E3430;padding-top:6px}'
  +  '#btnAide{margin-left:auto}'
  +'}'
  +'@media (max-width:640px){'
  +  '.marque{font-size:15px;letter-spacing:.08em;white-space:normal}'
  +  '.version{display:none}'
  +  '.jour{flex-basis:100%;margin-left:0;font-size:12px}'
  +  '.etat{flex-wrap:wrap;row-gap:6px}'
  +  '.etat-txt{min-width:0}.cd-pause{min-width:0}'
  +  'nav button{padding:8px 10px;font-size:12.5px}'
  +'}';
  document.head.appendChild(st);
})();

/* ===== saisie d'une valeur (remplace window.prompt, absent de l'application de bureau) ===== */
window.persoSaisir=function(question,defaut){
  return new Promise(function(fin){
    var d=document.createElement("dialog"), fait=false;
    d.className="perso-saisie";
    d.innerHTML='<div class="mod-tete"><h3>'+esc(question)+'</h3><button class="mod-fermer" data-s="non" title="Annuler">✕</button></div>'
      +'<div class="mod-corps"><input type="text" style="width:100%" maxlength="200"></div>'
      +'<div class="mod-pied"><button class="b creux" data-s="non">Annuler</button><div class="droite"><button class="b" data-s="oui">Ajouter</button></div></div>';
    document.body.appendChild(d);
    var e=d.querySelector("input"); e.value=defaut||"";
    function clore(v){ if(fait) return; fait=true; try{ d.close() }catch(x){} d.remove(); fin(v) }
    d.addEventListener("click",function(ev){ var b=ev.target.closest("[data-s]"); if(b){ ev.preventDefault(); clore(b.dataset.s==="oui"?e.value:null) } });
    e.addEventListener("keydown",function(ev){ if(ev.key==="Enter"){ ev.preventDefault(); ev.stopPropagation(); clore(e.value) } });
    d.addEventListener("cancel",function(ev){ ev.preventDefault(); clore(null) });
    d.showModal(); e.focus(); e.select();
  });
};

/* ===== listes déroulantes : libellés longs raccourcis =====
   La liste native s'ouvre à la largeur de son option la plus longue : avec des activités aux
   libellés longs, elle débordait de la fenêtre (jusque sur l'écran voisin). Le texte complet
   reste en info-bulle ; la valeur enregistrée ne change pas. */
var OPT_MAX=52;
function raccourcirOptions(racine){
  if(!racine || !racine.querySelectorAll) return;
  var l=racine.tagName==="OPTION"?[racine]:racine.querySelectorAll("option");
  for(var i=0;i<l.length;i++){
    var o=l[i], t=o.textContent;
    if(o.dataset.plein!==undefined || t.length<=OPT_MAX) continue;
    o.dataset.plein=t; o.title=t;
    o.textContent=t.slice(0,OPT_MAX-1).replace(/\s+\S*$/,"")+" …";
  }
}
new MutationObserver(function(ms){
  ms.forEach(function(m){ for(var i=0;i<m.addedNodes.length;i++) if(m.addedNodes[i].nodeType===1) raccourcirOptions(m.addedNodes[i]) });
}).observe(document.body,{childList:true,subtree:true});
raccourcirOptions(document.body);

})();

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
  return api("docs/"+DOC,{method:"PUT",body:{data:D,baseRev:Sync.rev,reason:raison}})
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
  D=normaliser(data); M=D.carte;
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
  D=normaliser(doc.data); M=D.carte;
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
var journalTexte=null;
function chargerJournal(){
  fetch(API+"changelog",{credentials:"same-origin"}).then(function(r){ return r.ok?r.text():"" })
    .then(function(t){ journalTexte=t||""; if(vueActive==="donnees") rendreDonneesSiCalme() })
    .catch(function(){ journalTexte="" });
}
window.persoJournal=function(){
  if(journalTexte===null){ chargerJournal(); journalTexte="" }
  var h="",courant=null;
  journalTexte.split("\n").forEach(function(l){
    var m=/^## \[([^\]]+)\](?: - (\S+))?/.exec(l);
    if(m){
      if(m[1]==="Non publié"){ courant=null; return }
      if(courant!==null) h+='</div>';
      courant=m[1];
      h+='<div style="display:block;padding:6px 0"><b style="float:none;margin:0;color:var(--encre)">v'+esc(m[1])+'</b>'
        +(m[2]?' <span class="mono" style="font-size:12px;color:var(--encre-3)">'+esc(m[2])+'</span>':"");
      return;
    }
    if(courant===null) return;
    if(/^### /.test(l)) h+='<div class="puce-lbl" style="margin-top:6px">'+esc(l.slice(4))+'</div>';
    else if(/^- /.test(l)) h+='<div style="font-family:var(--corps);font-size:13px;color:var(--encre-2);margin-top:2px">'+esc(l.slice(2))+'</div>';
  });
  if(courant!==null) h+='</div>';
  return '<div class="bloc" style="margin-top:18px"><div class="bloc-tete"><h2>Journal des versions</h2>'
    +'<span class="compte">v'+esc(Sync.version||"")+'</span></div><div class="bloc-corps diag">'
    +(h||'<div class="note-aide">Journal indisponible.</div>')
    +'<div class="note-aide">My Pilot Personal Edition dérive de PST·PILOT v'+esc(BASE_PST)+'.</div></div></div>';
};
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
        +'la version gardée est la plus récente. La version écartée peut être remise en place pour les activités, notes et contacts.</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:13.5px">'
        +'<tr><th style="text-align:left">Quand</th><th style="text-align:left">Fiche</th><th style="text-align:left">Gardée</th><th style="text-align:left">Écartée</th><th></th></tr>'
        +l.map(function(c,i){
          var remettable=c.doc==="pilot" && c.coll!=="_" && c.lost;
          return '<tr style="border-top:1px solid #ddd'+(c.seen?'':';background:#FFF7E0')+'"><td style="padding:6px 4px">'+esc(new Date(c.at).toLocaleString("fr-FR"))+'</td>'
            +'<td>'+esc(COLL_LIB[c.coll]||c.coll)+'</td><td>'+resumeFiche(c.kept,c.coll,c.rid)+'</td><td>'+resumeFiche(c.lost,c.coll,c.rid)+'</td>'
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
  if(k>=0) liste[k]=c.lost; else liste.push(c.lost);
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
        +'<span class="note-aide" style="margin:0">'+(e.role==="proprietaire"?"propriétaire":"membre")+' · hébergé par <span class="mono">'+esc(e.host.replace(/^https?:\/\//,""))+'</span></span></div>'
      +'<div class="diag" style="margin:6px 0">'
        +'<div>État<b class="'+se[0]+'">'+esc(se[1])+'</b></div>'
        +(e.last_error?'<div>Alerte<b class="ko">'+esc(e.last_error)+'</b></div>':"")
        +'<div>Fiches partagées<b>'+e.fiches+(e.pending?' · '+e.pending+' à envoyer':"")+'</b></div>'
        +(e.last_ok?'<div>Dernier échange<b>'+esc(new Date(e.last_ok).toLocaleString("fr-FR"))+'</b></div>':"")
      +'</div>'
      +'<div style="font-size:13.5px;margin:8px 0 4px">Membres</div>'
      +e.membres.map(function(m){
        return '<div style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:13.5px'+(m.status==="retire"?';opacity:.55':"")+'">'
          +'<span style="width:10px;height:10px;border-radius:50%;flex:none;background:'+esc(m.couleur||"var(--trait)")+'"></span>'
          +'<span>'+esc(m.nom||"(nom pas encore reçu)")+(m.moi?" (cet appareil)":"")+(m.appareil&&!m.moi?' <span class="note-aide" style="margin:0">'+esc(m.appareil)+'</span>':"")
          +' <span class="note-aide" style="margin:0">'+(m.role==="proprietaire"?"propriétaire":"membre")+(STATUT_MEMBRE[m.status]||"")+'</span></span>'
          +'<span class="mono" style="margin-left:auto;font-size:12px">'+esc(m.empreinte||"")+'</span>'
          +(prop && !m.moi && m.status!=="retire"?'<button class="b mini creux" data-pt="retirer" data-e="'+esc(e.id)+'" data-m="'+esc(m.member)+'" data-n="'+esc(m.nom||"ce membre")+'">Retirer</button>':"")
          +'</div>';
      }).join("")
      +'<div class="ligne" style="margin-top:8px">'
        +(prop?'<button class="b" data-pt="inviter" data-e="'+esc(e.id)+'" data-r="membre">Inviter une personne</button>'
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
  return titre+h+'</div></div>';
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
    var autre=role==="proprietaire";
    ouvrirModale(autre?"Lien pour votre autre appareil":"Lien d'invitation",
      '<textarea id="ptLien" readonly style="width:100%;height:96px;font-family:var(--data);font-size:12.5px;word-break:break-all">'+esc(r.lien)+'</textarea>'
      +'<div class="ligne" style="margin-top:8px"><button class="b" data-pt="copier-lien">Copier le lien</button><span id="ptRes" class="note-aide" role="status" style="margin:0"></span></div>'
      +'<div class="note-aide">'
        +(autre?'Sur votre autre appareil : Données → Partage → « Rejoindre un espace », puis collez ce lien. Il deviendra propriétaire de l\'espace comme celui-ci.'
          :'Envoyez ce lien à la personne par un canal que vous jugez sûr (messagerie chiffrée, de vive voix…). '
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
    "Retirer <b>"+esc(d.n)+"</b> de l'espace ? Son accès est coupé immédiatement. Ce qu'il ou elle a déjà reçu reste sur son appareil.",
    "Retirer",function(){ return appelPartage("espaces/"+encodeURIComponent(d.e)+"/membres/"+encodeURIComponent(d.m)+"/retirer") });
  else if(a==="quitter") confirmerPartage("Quitter l'espace",
    "Quitter <b>"+esc(d.n)+"</b> ? La copie de l'espace est effacée de cet appareil ; les autres membres gardent la leur.",
    "Quitter",function(){ return appelPartage("espaces/"+encodeURIComponent(d.e)+"/quitter",{forcer:true}) });
});

/* ===== nouveautés des espaces partagés : pastille sur l'onglet Idées et notification du système ===== */
var Recues={n:0,dernier:null,pret:false};
function pastilleIdees(){
  var b=document.querySelector('#nav [data-vue="idees"]'); if(!b) return;
  var p=b.querySelector(".pp-pastille");
  if(!Recues.n){ if(p) p.remove(); b.removeAttribute("title"); return }
  if(!p){ p=document.createElement("span"); p.className="pp-pastille";
    p.style.cssText="display:inline-block;min-width:18px;padding:0 5px;margin-left:6px;border-radius:9px;background:var(--rouge,#D8232A);color:#fff;font-size:11px;line-height:18px;text-align:center;letter-spacing:0;font-weight:600";
    b.appendChild(p) }
  p.textContent=Recues.n>99?"99+":String(Recues.n);
  b.title=Recues.n+" nouveauté(s) dans vos espaces partagés";
}
var LIB_RECUE={partage:"a partagé une idée",modifie:"a modifié",cristallise:"a cristallisé",activite:"en a fait une activité",retire:"a retiré du partage"};
function surveillerRecues(){
  if(Partage.indispo) return;
  api("partage/recues?limit=20").then(function(r){
    if(r.status===404){ Partage.indispo=true; return }
    if(!r.ok) return;
    var b=r.body, max=b.entrees.reduce(function(m,e){ return Math.max(m,e.id) },0);
    var neuves=Recues.pret?b.entrees.filter(function(e){ return !e.vue && e.id>(Recues.dernier||0) }):[];
    Recues.n=b.nonVues; Recues.dernier=Math.max(Recues.dernier||0,max); Recues.pret=true;
    pastilleIdees();
    if(!neuves.length) return;
    var e=neuves[0], titre=neuves.length>1?neuves.length+" nouveautés dans vos espaces partagés":e.auteur+" "+(LIB_RECUE[e.kind]||"")+" : « "+e.titre+" »";
    var corps=neuves.length>1?neuves.slice(0,3).map(function(x){ return x.auteur+" : "+x.titre }).join("\n"):"Espace « "+e.espaceNom+" »";
    var dehors=document.hidden || !document.hasFocus();
    if(dehors && Partage.st && Partage.st.notifications && Partage.st.notifications.systeme!==false && window.Notification){
      var go=function(){
        try{ var n=new Notification(titre,{body:corps,tag:"mppe-recues",silent:false});
          n.onclick=function(){ window.focus(); vueActive="idees"; rendre(); n.close() } }catch(x){}
      };
      if(Notification.permission==="granted") go();
      else if(Notification.permission!=="denied") Notification.requestPermission().then(function(p){ if(p==="granted") go() });
    } else toast(titre);
  }).catch(function(){});
}
setTimeout(function(){ majPartage(false).then(surveillerRecues) },3000);
setInterval(surveillerRecues,20000);

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
    Recues.n=+m.n||0; pastilleIdees();
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

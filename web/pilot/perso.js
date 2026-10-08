/* Pilot Perso — couche personnelle posée sur PST·PILOT (non modifié, voir scripts/build_pilot.py).
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
var CLE_SYNC = "pilot-perso-sync";        /* { base: rev du serveur au moment de la modif locale } */

/* ================= 1. profil personnel ================= */
CLE = "pilot-perso-v1";
nomFichier = "pilot-perso-data.json";                   /* tampon distinct de celui de PST·PILOT */
NOM_DEFAUT = "Pilot Perso";
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
  return v;
};
var serialise0=serialise;
serialise=function(format){
  var t=serialise0(format);
  D.meta.app="Pilot Perso"; D.meta.base="PST Pilot";
  return t;
};

/* ================= 2. persistance serveur ================= */
var Sync={rev:0,etat:"init",envoi:false,encore:false,dernier:null,erreur:"",version:""};
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
  D.meta.modifie_le=D.meta.modifie_le||new Date().toISOString();
  D.meta.app="Pilot Perso"; D.meta.app_version=Sync.version; D.meta.version=VERSION;
  return api("docs/"+DOC,{method:"PUT",body:{data:D,baseRev:Sync.rev,reason:raison}})
  .then(function(r){
    if(r.status===409){ Sync.etat="conflit"; conflit(r.body); return false }
    if(!r.ok) throw new Error((r.body&&r.body.message)||("HTTP "+r.status));
    Sync.rev=r.body.rev; Sync.etat="ok"; Sync.erreur=""; Sync.dernier=new Date();
    sale=false; dernierEnr="à "+hNow(); poserSync(null);
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
  else txt="Synchronisé"+(dernierEnr?" "+dernierEnr:"");
  e.classList.toggle("sale",alerte); p.classList.toggle("sale",alerte);
  t.textContent=txt;
  t.title=Sync.erreur||"";
};

/* bloc de la vue Données */
window.persoBlocDonnees=function(){
  var etat={ok:"synchronisées",horsligne:"hors ligne (gardées dans ce navigateur)",conflit:"en conflit",init:"en cours de chargement"}[Sync.etat]||"";
  return '<div class="ligne">'
      +'<button class="b" data-act="enr">Enregistrer maintenant</button>'
      +'<button class="b creux" data-pp="historique">Historique des versions</button>'
      +'<button class="b creux" data-pp="instantane">Instantané de la base</button>'
    +'</div>'
    +'<div class="ligne" style="margin-top:10px">'
      +'<button class="b creux" data-act="ouvrir">Importer un fichier (remplacer)</button>'
      +'<button class="b creux" data-act="fusion">Importer et fusionner</button>'
    +'</div>'
    +'<div class="ligne" style="margin-top:10px"><label style="font-size:13.5px;display:flex;gap:6px;align-items:center">'
      +'<input type="checkbox" id="autoEnr" '+(D.parametres.auto!==false?"checked":"")+'>'
      +'Enregistrer automatiquement sur le serveur à chaque modification</label></div>'
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
function instantane(){
  api("backup",{method:"POST"}).then(function(r){
    if(!r.ok) throw new Error();
    toast("Instantané créé : "+r.body.file);
  }).catch(function(){ toast("Instantané impossible : serveur injoignable",true) });
}
document.addEventListener("click",function(e){
  var el=e.target.closest&&e.target.closest("[data-pp]");
  if(!el) return;
  var a=el.dataset.pp;
  if(a==="historique") historique();
  else if(a==="instantane") instantane();
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
    Array.prototype.forEach.call($("#nav").children,function(x){
      x.disabled=!fichierCharge && x.dataset.vue!=="donnees";
      x.setAttribute("aria-current",x.dataset.vue==="idees"?"true":"false");
    });
    majEtat(); ajuster();
    return;
  }
  b.style.display="none"; v.style.display="";
  rendre0();
};

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
    libelle:String(p.titre||"Projet").slice(0,200),reference:"",date:p.date||auj(),heure:"",duree:0,
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
  if(m.type==="creer-activite"){
    try{
      var c=creerActivite(m.payload||{});
      rep({type:"activite-creee",id:c.id,libelle:c.libelle,categorie:catParCle(c.categorie).lib});
      toast("Activité créée : "+c.libelle);
    }catch(err){ rep({type:"erreur",message:err.message}) }
  }else if(m.type==="ouvrir-activite"){
    if(!chantierPar(m.id)){ toast("Cette activité n'existe plus",true); return }
    vueActive="chantiers"; rendre(); editerChantier(m.id);
  }else if(m.type==="categories"){
    rep({type:"categories",liste:categories().map(function(K){ return {cle:K.cle,lib:K.lib,couleur:K.couleur} })});
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
  if(h.ok){ Sync.version=h.body.version; APP_VERSION=h.body.version }
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
           telecharger("pilot-perso-hors-ligne.json",copie); poserSync(null); fermerModale() }}]);
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

})();

package eu.ellast.mypilot;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.text.InputType;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.OutputStream;

/**
 * My Pilot Personal Edition pour Android.
 *
 * L'application affiche l'interface web de VOTRE serveur (page de connexion, puis pilotage)
 * dans une vue web : une icône, le plein écran, la session gardée 30 jours. Les données
 * restent sur le serveur, comme depuis un navigateur.
 *
 * Ce que la vue web ne sait pas faire seule, et qui est donc géré ici :
 *  - les exports (JSON, CSV) que la page fabrique en mémoire : la page les passe à Android,
 *    qui demande où les enregistrer ;
 *  - les imports : sélecteur de fichiers du système ;
 *  - le bouton Retour : ferme d'abord la fenêtre ouverte dans la page, puis revient en arrière ;
 *  - les liens vers d'autres sites : ouverts dans le navigateur, jamais dans l'application.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "mypilot";
    private static final String CLE_SERVEUR = "serveur";
    private static final int DEMANDE_FICHIER = 1;
    private static final int DEMANDE_ENREGISTRER = 2;

    private WebView vue;
    private String serveur;               // https://domaine, sans « / » final
    private volatile String hoteServeur = "";
    private volatile String hotePage = "";  // hôte de la page affichée (lu par le pont JavaScript)
    private ValueCallback<Uri[]> rappelFichier;
    private byte[] aEnregistrer;
    private boolean erreurAffichee = false;

    @Override
    protected void onCreate(Bundle etat) {
        super.onCreate(etat);
        vue = new WebView(this);
        FrameLayout cadre = new FrameLayout(this);
        cadre.addView(vue, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(cadre);
        configurer();

        serveur = getSharedPreferences(PREFS, MODE_PRIVATE).getString(CLE_SERVEUR, null);
        if (etat != null) {
            vue.restoreState(etat);
            if (serveur != null) hoteServeur = Uri.parse(serveur).getHost();
        } else if (serveur == null) {
            demanderServeur(getString(R.string.serveur_defaut), true);
        } else {
            ouvrir(serveur);
        }
    }

    private void configurer() {
        WebSettings r = vue.getSettings();
        r.setJavaScriptEnabled(true);
        r.setDomStorageEnabled(true);
        r.setDatabaseEnabled(true);
        r.setMediaPlaybackRequiresUserGesture(true);
        r.setSupportMultipleWindows(false);
        r.setAllowFileAccess(false);
        r.setAllowContentAccess(false);
        r.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        r.setUserAgentString(r.getUserAgentString() + " MyPilotAndroid/" + versionApp());
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(vue, false);

        vue.addJavascriptInterface(new Pont(), "MyPilotAndroid");

        vue.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                Uri u = Uri.parse(url);
                if (estDuServeur(u)) return false;
                ouvrirAilleurs(u);                    // autre site, mail, téléphone : hors de l'application
                return true;
            }

            @Override
            public void onPageStarted(WebView v, String url, Bitmap icone) {
                hotePage = hoteDe(url);
                erreurAffichee = false;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                hotePage = hoteDe(url);
                if (estDuServeur(Uri.parse(url))) v.evaluateJavascript(SCRIPT_TELECHARGEMENTS, null);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest demande, WebResourceError erreur) {
                if (demande.isForMainFrame()) erreurChargement(String.valueOf(erreur.getDescription()));
            }
        });

        vue.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> rappel, FileChooserParams params) {
                if (rappelFichier != null) rappelFichier.onReceiveValue(null);
                rappelFichier = rappel;
                Intent choix = new Intent(Intent.ACTION_GET_CONTENT);
                choix.addCategory(Intent.CATEGORY_OPENABLE);
                choix.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(choix, "Choisir un fichier"), DEMANDE_FICHIER);
                } catch (ActivityNotFoundException e) {
                    rappelFichier = null;
                    Toast.makeText(MainActivity.this, "Aucune application pour choisir un fichier", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        // fichiers servis par le serveur (instantanés…) : gestionnaire de téléchargements, avec la session
        vue.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String agent, String disposition, String type, long taille) {
                if (!url.startsWith("https://")) return;
                DownloadManager.Request d = new DownloadManager.Request(Uri.parse(url));
                d.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
                d.addRequestHeader("User-Agent", agent);
                String nom = URLUtil.guessFileName(url, disposition, type);
                d.setTitle(nom);
                d.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                d.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, nom);
                ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(d);
                Toast.makeText(MainActivity.this, "Téléchargement : " + nom, Toast.LENGTH_SHORT).show();
            }
        });
    }

    /* ---------- adresse du serveur ---------- */

    private void demanderServeur(String propose, final boolean premierLancement) {
        final EditText champ = new EditText(this);
        champ.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        champ.setText(propose);
        champ.setSelectAllOnFocus(false);
        champ.setSingleLine(true);
        FrameLayout marge = new FrameLayout(this);
        int p = (int) (20 * getResources().getDisplayMetrics().density);
        marge.setPadding(p, p / 2, p, 0);
        marge.addView(champ);
        final AlertDialog d = new AlertDialog.Builder(this)
            .setTitle("Adresse de votre serveur")
            .setMessage("La racine du serveur My Pilot Personal Edition, en https.")
            .setView(marge)
            .setCancelable(!premierLancement)
            .setPositiveButton("Ouvrir", null)
            .setNegativeButton(premierLancement ? "Quitter" : "Annuler", new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dlg, int w) { if (premierLancement) finish(); }
            })
            .create();
        d.setOnShowListener(new DialogInterface.OnShowListener() {
            public void onShow(DialogInterface x) {
                d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(new View.OnClickListener() {
                    public void onClick(View b) {
                        String s = normaliser(champ.getText().toString());
                        if (s == null) { champ.setError("Adresse en https://… attendue"); return; }
                        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(CLE_SERVEUR, s).apply();
                        serveur = s;
                        d.dismiss();
                        ouvrir(s);
                    }
                });
            }
        });
        d.show();
    }

    /** https://domaine[/chemin] sans « /pilot », « / » final ni paramètres ; null si invalide ou pas en https. */
    static String normaliser(String s) {
        s = s.trim();
        if (!s.contains("://")) s = "https://" + s;
        Uri u = Uri.parse(s);
        if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null || u.getHost().isEmpty()) return null;
        String chemin = u.getPath() == null ? "" : u.getPath().replaceAll("/+$", "")
            .replaceAll("(?i)/(pilot|cristallisoir|connexion|rejoindre|api)(/.*)?$", "");
        return "https://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "") + chemin;
    }

    private void ouvrir(String racine) {
        hoteServeur = Uri.parse(racine).getHost();
        vue.loadUrl(racine + "/pilot/");
    }

    private void erreurChargement(String motif) {
        if (erreurAffichee || isFinishing()) return;
        erreurAffichee = true;
        new AlertDialog.Builder(this)
            .setTitle("Serveur injoignable")
            .setMessage(serveur + "\n\n" + motif + "\n\nVérifiez la connexion réseau, ou l'adresse du serveur.")
            .setCancelable(false)
            .setPositiveButton("Réessayer", new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface d, int w) { erreurAffichee = false; vue.reload(); }
            })
            .setNeutralButton("Changer l'adresse", new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface d, int w) { erreurAffichee = false; demanderServeur(serveur, false); }
            })
            .setNegativeButton("Quitter", new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface d, int w) { finish(); }
            })
            .show();
    }

    /* ---------- liens ---------- */

    private boolean estDuServeur(Uri u) {
        return "https".equalsIgnoreCase(u.getScheme()) && hoteServeur.equalsIgnoreCase(String.valueOf(u.getHost()));
    }

    private static String hoteDe(String url) {
        String h = Uri.parse(url).getHost();
        return h == null ? "" : h;
    }

    private void ouvrirAilleurs(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Aucune application pour ouvrir ce lien", Toast.LENGTH_SHORT).show();
        }
    }

    /* ---------- exports fabriqués par la page ---------- */

    /** Pont appelé par SCRIPT_TELECHARGEMENTS, seulement depuis une page du serveur configuré. */
    private class Pont {
        @JavascriptInterface
        public void enregistrer(final String nom, final String type, final String base64) {
            if (hoteServeur.isEmpty() || !hoteServeur.equalsIgnoreCase(hotePage)) return;
            final byte[] octets;
            try { octets = Base64.decode(base64, Base64.DEFAULT); } catch (IllegalArgumentException e) { return; }
            runOnUiThread(new Runnable() { public void run() {
                aEnregistrer = octets;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(type == null || type.isEmpty() ? "application/octet-stream" : type);
                i.putExtra(Intent.EXTRA_TITLE, nom == null || nom.isEmpty() ? "export" : nom);
                try {
                    startActivityForResult(i, DEMANDE_ENREGISTRER);
                } catch (ActivityNotFoundException e) {
                    aEnregistrer = null;
                    Toast.makeText(MainActivity.this, "Impossible d'enregistrer le fichier sur cet appareil", Toast.LENGTH_LONG).show();
                }
            }});
        }
    }

    /**
     * Injecté dans chaque page du serveur (et ses cadres, dont le Cristallisoir) : retient les Blob passés à
     * URL.createObjectURL, puis intercepte les clics sur les liens de téléchargement qui les désignent.
     */
    private static final String SCRIPT_TELECHARGEMENTS =
        "(function(){\n" +
        "  if(!window.MyPilotAndroid) return;\n" +
        "  function envoyer(blob,nom){\n" +
        "    var f=new FileReader();\n" +
        "    f.onload=function(){ var s=String(f.result); window.MyPilotAndroid.enregistrer(nom||'export',blob.type||'',s.slice(s.indexOf(',')+1)); };\n" +
        "    f.readAsDataURL(blob);\n" +
        "  }\n" +
        "  function equiper(w){\n" +
        "    try{ if(!w||w.__mppeAndroid) return; w.__mppeAndroid=true; }catch(e){ return; }\n" +
        "    var blobs={}, creer=w.URL.createObjectURL.bind(w.URL);\n" +
        "    w.URL.createObjectURL=function(o){ var u=creer(o); try{ if(o instanceof w.Blob) blobs[u]=o; }catch(e){} return u; };\n" +
        "    function prendre(a){\n" +
        "      if(!a||!a.hasAttribute||!a.hasAttribute('download')) return false;\n" +
        "      var h=a.href||'';\n" +
        "      if(blobs[h]){ envoyer(blobs[h],a.getAttribute('download')); return true; }\n" +
        "      if(h.indexOf('data:')===0){ w.fetch(h).then(function(r){return r.blob()}).then(function(b){ envoyer(b,a.getAttribute('download')); }); return true; }\n" +
        "      return false;\n" +
        "    }\n" +
        "    var clic=w.HTMLAnchorElement.prototype.click;\n" +
        "    w.HTMLAnchorElement.prototype.click=function(){ if(prendre(this)) return; return clic.apply(this,arguments); };\n" +
        "    w.document.addEventListener('click',function(e){ var a=e.target&&e.target.closest?e.target.closest('a[download]'):null; if(a&&prendre(a)) e.preventDefault(); },true);\n" +
        "  }\n" +
        "  equiper(window);\n" +
        "  setInterval(function(){ var c=document.querySelectorAll('iframe'); for(var i=0;i<c.length;i++){ try{ equiper(c[i].contentWindow); }catch(e){} } },1000);\n" +
        "})();";

    @Override
    protected void onActivityResult(int demande, int resultat, Intent donnees) {
        if (demande == DEMANDE_FICHIER) {
            if (rappelFichier != null) {
                rappelFichier.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultat, donnees));
                rappelFichier = null;
            }
        } else if (demande == DEMANDE_ENREGISTRER) {
            byte[] octets = aEnregistrer;
            aEnregistrer = null;
            if (resultat == RESULT_OK && donnees != null && donnees.getData() != null && octets != null) {
                try (OutputStream o = getContentResolver().openOutputStream(donnees.getData())) {
                    o.write(octets);
                    Toast.makeText(this, "Fichier enregistré", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(this, "Échec de l'enregistrement : " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
        } else {
            super.onActivityResult(demande, resultat, donnees);
        }
    }

    /* ---------- Retour ---------- */

    /** Retour : ferme la fenêtre ouverte dans la page (comme Échap), sinon page précédente, sinon quitte. */
    @Override
    public boolean onKeyDown(int code, KeyEvent evenement) {
        if (code != KeyEvent.KEYCODE_BACK) return super.onKeyDown(code, evenement);
        vue.evaluateJavascript(
            "(function(){var d=document.querySelectorAll('dialog[open]');if(!d.length)return '';" +
            "var cible=document.activeElement||document.body;" +
            "cible.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,bubbles:true,cancelable:true}));" +
            "var e=document.querySelectorAll('dialog[open]');if(e.length===d.length){try{e[e.length-1].close()}catch(x){}}return 'ferme';})()",
            new ValueCallback<String>() {
                public void onReceiveValue(String resultat) {
                    if (resultat != null && resultat.contains("ferme")) return;
                    if (vue.canGoBack()) vue.goBack(); else finish();
                }
            });
        return true;
    }

    /* ---------- cycle de vie ---------- */

    @Override
    protected void onSaveInstanceState(Bundle etat) {
        super.onSaveInstanceState(etat);
        vue.saveState(etat);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        vue.destroy();
        super.onDestroy();
    }

    private String versionApp() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception e) { return "?"; }
    }
}

// My Pilot Personal Edition — application de bureau.
//
// Le serveur Node du projet tourne dans l'application, avec sa base SQLite dans le dossier
// de données de l'utilisateur. La fenêtre affiche les pages servies localement (127.0.0.1,
// port choisi au démarrage, jeton propre à la session) : rien n'est exposé sur le réseau.
// La synchronisation vers le serveur distant se règle dans l'onglet Données.
'use strict';
const { app, BrowserWindow, shell, session, dialog, Menu } = require('electron');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const NOM = 'My Pilot Personal Edition';
const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const ICON = app.isPackaged ? path.join(RES, 'icon.png') : path.join(__dirname, 'build', 'icon.png');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setName(NOM);

/* Claude Code installé par l'utilisateur : une application lancée depuis le menu n'hérite pas
   toujours du PATH du terminal, on ajoute les emplacements d'installation habituels. */
const home = os.homedir();
const extraPath = process.platform === 'win32'
  ? [path.join(home, '.local', 'bin'), path.join(process.env.APPDATA || '', 'npm')]
  : [path.join(home, '.local', 'bin'), path.join(home, '.claude', 'local'), path.join(home, '.npm-global', 'bin'), '/usr/local/bin'];
process.env.PATH = [...extraPath, process.env.PATH || ''].join(path.delimiter);

let win = null, srv = null;

async function demarrer() {
  const { createApp } = await import(pathToFileURL(path.join(RES, 'server', 'src', 'server.js')).href);
  const token = crypto.randomBytes(24).toString('hex');
  const dataDir = path.join(app.getPath('userData'), 'data');
  srv = createApp({ dataDir, webDir: path.join(RES, 'web'), localToken: token, mode: 'application' });
  await new Promise((ok, ko) => { srv.server.once('error', ko); srv.server.listen(0, '127.0.0.1', ok); });
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  await session.defaultSession.cookies.set({ url: base, name: 'mppe_local', value: token, httpOnly: true, sameSite: 'strict' });

  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: NOM, icon: ICON, backgroundColor: '#E6E7E3', autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  win.once('ready-to-show', () => win.show());

  // Liens vers l'extérieur (claude.ai pour le copier-coller, documentation…) : navigateur habituel.
  const interne = u => u === base || u.startsWith(base + '/');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!interne(url) && /^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!interne(url)) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  // La page signale des modifications pas encore enregistrées : on demande avant de fermer.
  win.webContents.on('will-prevent-unload', e => {
    const r = dialog.showMessageBoxSync(win, {
      type: 'question', buttons: ['Attendre l\'enregistrement', 'Quitter quand même'], defaultId: 0, cancelId: 0,
      title: NOM, message: 'Des modifications sont en cours d\'enregistrement.',
      detail: 'Elles sont enregistrées en une ou deux secondes. Quitter maintenant peut perdre la dernière saisie.',
    });
    if (r === 1) e.preventDefault();
  });
  win.on('closed', () => { win = null; });
  await win.loadURL(base + '/pilot/');
}

function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Fichier', submenu: [
      { label: 'Ouvrir le dossier des données', click: () => shell.openPath(path.join(app.getPath('userData'), 'data')) },
      { type: 'separator' }, { role: 'quit', label: 'Quitter' }] },
    { label: 'Édition', submenu: [
      { role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Rétablir' }, { type: 'separator' },
      { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' }, { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout sélectionner' }] },
    { label: 'Affichage', submenu: [
      { role: 'reload', label: 'Recharger' }, { role: 'toggleDevTools', label: 'Outils de développement' }, { type: 'separator' },
      { role: 'resetZoom', label: 'Taille normale' }, { role: 'zoomIn', label: 'Agrandir' }, { role: 'zoomOut', label: 'Réduire' },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Plein écran' }] },
    { label: 'Aide', submenu: [
      { label: `À propos (${NOM} ${app.getVersion()})`, click: () => dialog.showMessageBox(win, {
        type: 'info', title: NOM, message: `${NOM} ${app.getVersion()}`,
        detail: `Pilotage personnel, dérivé de PST·PILOT.\nDonnées : ${path.join(app.getPath('userData'), 'data')}`,
      }) }] },
  ]));
}

app.whenReady().then(() => { menu(); return demarrer(); }).catch(e => {
  dialog.showErrorBox(NOM + ' ne peut pas démarrer', String(e && e.stack || e));
  app.quit();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  if (!srv) return;
  try { srv.server.close(); } catch {}
  try { srv.store.close(); } catch {}
});

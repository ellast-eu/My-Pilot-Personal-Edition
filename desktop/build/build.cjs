// Construit les paquets de l'application de bureau : .deb (Linux) et installateur .exe (Windows).
// Usage : npm run dist            (les deux)
//         npm run dist -- deb     (un seul)
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const desk = path.join(__dirname, '..');
const version = fs.readFileSync(path.join(desk, '..', 'VERSION'), 'utf8').trim();
const pkg = JSON.parse(fs.readFileSync(path.join(desk, 'package.json'), 'utf8'));
if (pkg.version !== version) {
  console.error(`Version incohérente : VERSION=${version}, desktop/package.json=${pkg.version}. Lancer scripts/release.sh.`);
  process.exit(1);
}
const voulu = process.argv.slice(2);
const cibles = voulu.length ? voulu : ['deb', 'exe'];
const env = { ...process.env };
const args = ['electron-builder', '--x64', '--publish', 'never'];
if (cibles.includes('deb')) args.push('--linux', 'deb');
if (cibles.includes('exe')) {
  args.push('--win', 'nsis');
  if (process.platform !== 'win32') {
    env.PATH = path.join(__dirname, 'wine-shim') + path.delimiter + env.PATH;
    env.USE_SYSTEM_WINE = 'true';
  }
}
const r = spawnSync('npx', args, { cwd: desk, env, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) process.exit(r.status || 1);
const out = path.join(desk, '..', 'dist', 'desktop');
for (const f of fs.readdirSync(out)) if (/\.(deb|exe)$/.test(f)) console.log('→ dist/desktop/' + f);

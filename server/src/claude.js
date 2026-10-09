// Pont vers Claude Code (CLI `claude`), connecté à un compte claude.ai (Pro/Max).
// L'usage est décompté de l'abonnement, pas d'un compte API.
import { spawn } from 'node:child_process';

const bin = () => process.env.CLAUDE_BIN || 'claude';
const TIMEOUT = (+process.env.CLAUDE_TIMEOUT || 180) * 1000;
const MODELS = new Set(['haiku', 'sonnet', 'opus']);

let queue = Promise.resolve();
let versionCache = null;

/** Environnement de l'enfant : sans ANTHROPIC_API_KEY, pour ne jamais basculer sur la facturation API. */
let oauthToken = null;               // jeton saisi dans les réglages (null : celui de l'environnement)
export function setToken(t) { oauthToken = t; versionCache = null; }

function childEnv() {
  const env = { ...process.env };
  if (oauthToken !== null) {
    if (oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken; else delete env.CLAUDE_CODE_OAUTH_TOKEN;
  }
  if (process.env.CLAUDE_ALLOW_API_KEY !== '1') delete env.ANTHROPIC_API_KEY;
  return env;
}

/* Sous Windows, Claude Code peut être un .exe (installateur officiel) ou un .cmd (installation npm) :
   un .cmd ne se lance qu'à travers cmd.exe, avec des arguments correctement entourés de guillemets. */
let winCmd = false;
function launch(args, opts) {
  if (process.platform === 'win32' && winCmd) {
    const q = a => '"' + String(a).replace(/"/g, '""') + '"';
    const line = [bin() + '.cmd', ...args].map(q).join(' ');
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', '"' + line + '"'], { ...opts, windowsVerbatimArguments: true, windowsHide: true });
  }
  return spawn(bin(), args, { ...opts, windowsHide: true });
}

function run(args, input, timeout = TIMEOUT, retried = false) {
  return new Promise((resolve, reject) => {
    let out = '', err = '', done = false;
    let child;
    try {
      child = launch(args, { env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      return reject(Object.assign(new Error('Claude Code introuvable'), { code: 'not_installed' }));
    }
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill('SIGTERM');
      reject(Object.assign(new Error('Claude Code n\'a pas répondu à temps'), { code: 'timeout' }));
    }, timeout);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (e.code === 'ENOENT' && process.platform === 'win32' && !winCmd && !retried) {
        winCmd = true;
        return run(args, input, timeout, true).then(resolve, err => { winCmd = false; reject(err); });
      }
      reject(Object.assign(new Error('Claude Code introuvable'), { code: e.code === 'ENOENT' ? 'not_installed' : 'spawn_error' }));
    });
    child.on('close', code => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ code, out, err });
    });
    if (input) child.stdin.end(input); else child.stdin.end();
  });
}

export async function status() {
  if (process.env.CLAUDE_BRIDGE === 'off') return { available: false, reason: 'disabled' };
  if (!versionCache) {
    try {
      const r = await run(['--version'], '', 15000);
      versionCache = r.code === 0 ? { available: true, version: r.out.trim() } : { available: false, reason: 'error' };
    } catch (e) {
      versionCache = { available: false, reason: e.code || 'error' };
    }
    // On réessaie au prochain appel si l'outil n'était pas là (installation en cours, etc.).
    if (!versionCache.available) setTimeout(() => { versionCache = null; }, 30000).unref?.();
  }
  return { ...versionCache, apiKeyIgnored: !!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_ALLOW_API_KEY !== '1' };
}

export function extractJson(text) {
  const t = String(text || '').replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw Object.assign(new Error('Réponse sans JSON'), { code: 'bad_json' });
  try { return JSON.parse(t.slice(a, b + 1)); }
  catch { throw Object.assign(new Error('JSON illisible dans la réponse'), { code: 'bad_json' }); }
}

/**
 * Envoie une demande à Claude Code (une à la fois) et renvoie le texte, ou l'objet JSON si json=true.
 */
export function ask({ prompt, json = true, model = 'sonnet' }) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return Promise.reject(Object.assign(new Error('Demande vide'), { code: 'bad_request' }));
  }
  if (prompt.length > 60000) {
    return Promise.reject(Object.assign(new Error('Demande trop longue'), { code: 'bad_request' }));
  }
  const m = MODELS.has(model) ? model : 'sonnet';
  const job = queue.then(async () => {
    const args = ['-p', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--model', m];
    const r = await run(args, prompt);
    let res;
    try { res = JSON.parse(r.out); } catch { res = null; }
    if (!res) {
      const msg = (r.err || r.out || '').trim().slice(0, 400);
      const code = /log ?in|auth|credential|token/i.test(msg) ? 'not_logged_in' : 'cli_error';
      throw Object.assign(new Error(msg || 'Réponse illisible de Claude Code'), { code });
    }
    if (res.is_error) {
      const msg = String(res.result || res.error || 'Erreur Claude Code');
      const code = /limit|quota|usage/i.test(msg) ? 'rate_limited' : /log ?in|auth/i.test(msg) ? 'not_logged_in' : 'cli_error';
      throw Object.assign(new Error(msg.slice(0, 400)), { code });
    }
    const text = String(res.result ?? '');
    return json ? { json: extractJson(text) } : { text };
  });
  queue = job.catch(() => {});
  return job;
}

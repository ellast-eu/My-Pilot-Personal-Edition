import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Faux binaire `claude` : renvoie la sortie JSON du mode --print.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-'));
const fake = path.join(tmp, 'claude');
fs.writeFileSync(fake, `#!/bin/sh
if [ "$1" = "--version" ]; then echo "9.9.9 (Claude Code)"; exit 0; fi
input=$(cat)
if [ -n "$ANTHROPIC_API_KEY" ]; then echo '{"type":"result","is_error":true,"result":"cle API transmise"}'; exit 0; fi
printf '%s' '{"type":"result","is_error":false,"result":"Voici :\\n\`\`\`json\\n{\\"titre\\":\\"Jardin\\"}\\n\`\`\`"}'
`, { mode: 0o755 });
process.env.CLAUDE_BIN = fake;
process.env.ANTHROPIC_API_KEY = 'sk-ne-doit-pas-passer';
const claude = await import('../src/claude.js');

test('statut disponible', async () => {
  const s = await claude.status();
  assert.equal(s.available, true);
  assert.equal(s.apiKeyIgnored, true);
});

test('réponse JSON extraite, clé API jamais transmise', async () => {
  const r = await claude.ask({ prompt: 'test', json: true });
  assert.deepEqual(r.json, { titre: 'Jardin' });
});

test('demande vide refusée', async () => {
  await assert.rejects(claude.ask({ prompt: '  ' }), { code: 'bad_request' });
});

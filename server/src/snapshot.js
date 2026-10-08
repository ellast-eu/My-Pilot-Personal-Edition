// Instantané manuel : npm run snapshot (ou via docker compose exec app …)
import path from 'node:path';
import { Store } from './db.js';
const dataDir = process.env.DATA_DIR || path.resolve('data');
const store = new Store(path.join(dataDir, 'pilot.db'));
console.log(store.snapshot(process.env.SNAPSHOT_DIR || path.join(dataDir, 'snapshots'), +(process.env.KEEP_SNAPSHOTS ?? 30)));
store.close();

import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const directory = path.resolve(process.env.DATA_DIR || './data');
const destination = path.resolve(process.env.BACKUP_DIR || './backups');
mkdirSync(destination, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(path.join(directory, 'store.sqlite'), { readOnly: true });
try {
  const output = path.join(destination, `store-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
  await backup(db, output);
  console.log(`Backup consistente criado: ${output}`);
} finally { db.close(); }

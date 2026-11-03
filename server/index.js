import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from './http.js';
import { seedIfEmpty } from './seed.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const names = ['quoteShipping', 'createCheckout', 'stripeWebhook', 'checkoutStatus', 'cancelCheckout', 'manageOrder', 'importCatalog', 'relinkVariants'];
const handlers = Object.fromEntries(await Promise.all(names.map(async name => [name, (await import(`./functions/${name}/entry.ts`)).default])));
const app = createApplication({
  databasePath: path.join(dataDir, 'store.sqlite'),
  publicUrl: process.env.STORE_PUBLIC_URL || 'http://localhost:3000',
  handlers,
  env: process.env,
  distDir: path.join(root, 'dist'),
  uploadsDir: path.join(dataDir, 'uploads'),
});

// Seed only an empty catalog: a restart must never overwrite prices or stock.
const seedPath = path.join(root, 'server/data/catalog.json');
if (existsSync(seedPath)) await seedIfEmpty(app.store, JSON.parse(readFileSync(seedPath, 'utf8')));
if (await app.store.entities.SiteSettings.count({ key: 'main' }) === 0) {
  await app.store.entities.SiteSettings.create({ key: 'main', store_name: 'Esex Store', shipping_origin_postal_code: '32241340', shipping_provider: 'melhor_envio', shipping_configured: false, payments_configured: false, demo_mode: false });
}
const port = Number(process.env.PORT || 3000);
app.server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Esex Store listening on port ${port}`));
let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; await app.close(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

export async function seedIfEmpty(store, seed) {
  if (await store.entities.Product.count({}) > 0) return false;
  store.db.exec('BEGIN IMMEDIATE');
  try {
    for (const name of ['Category', 'Product', 'ProductVariant', 'ContentPage', 'Redirect', 'SiteSettings']) {
      for (const record of seed[name] || []) {
        if (name === 'SiteSettings' && await store.entities.SiteSettings.count({ key: record.key }) > 0) continue;
        await store.entities[name].create(record);
      }
    }
    store.db.exec('COMMIT');
    return true;
  } catch (error) { store.db.exec('ROLLBACK'); throw error; }
}

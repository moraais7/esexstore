import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';

// Only exact, unique source IDs / slugs / default SKUs are eligible. Never guess.
export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const service = base44.asServiceRole;
    const products = new Map();
    const sources = new Map();
    const skus = new Map();
    const add = (map, key, id) => { if (key) map.set(key, new Set([...(map.get(key) || []), id])); };
    let cursor;
    do {
      const page = await service.entities.Product.list({ limit: 200, cursor });
      for (const product of page.items) {
        products.set(product.id, product);
        add(sources, product.source_id, product.id); add(sources, product.slug, product.id);
        add(skus, product.sku_default, product.id);
      }
      cursor = page.next_cursor;
    } while (cursor);
    const page = await service.entities.ProductVariant.list({ limit: 100, cursor: typeof body.cursor === 'string' ? body.cursor : undefined });
    let fixed = 0; let unresolved = 0;
    const changed = new Set();
    for (const variant of page.items) {
      if (products.has(variant.product_id)) continue;
      const candidates = new Set([...(sources.get(variant.product_id) || []), ...(sources.get(variant.source_id) || [])]);
      if (!candidates.size) for (const id of skus.get(variant.sku) || []) candidates.add(id);
      if (candidates.size !== 1) { unresolved += 1; continue; }
      const [productId] = candidates;
      await service.entities.ProductVariant.update(variant.id, { product_id: productId });
      changed.add(productId); fixed += 1;
    }
    for (const id of changed) {
      let variantCursor; let stock = 0;
      do {
        const variants = await service.entities.ProductVariant.filter({ product_id: id, active: true }, { limit: 200, cursor: variantCursor });
        stock += variants.items.reduce((n, v) => n + Number(v.stock || 0), 0); variantCursor = variants.next_cursor;
      } while (variantCursor);
      await service.entities.Product.update(id, { total_stock: stock });
    }
    return Response.json({ fixed, unresolved, next_cursor: page.next_cursor || null });
  } catch (error) {
    console.error('relinkVariants', error.message);
    return Response.json({ error: 'Não foi possível verificar as variações.' }, { status: 500 });
  }
}

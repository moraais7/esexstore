import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MAX_BATCH = 60;
const MAX_ERRORS = 60;

const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const text = (value, max = 400) => String(value ?? '').slice(0, max);

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((error) => (error.status === 401 ? null : Promise.reject(error)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const drafts = Array.isArray(body.products) ? body.products : [];
    if (!drafts.length) return Response.json({ error: 'Nenhum produto recebido.' }, { status: 400 });
    if (drafts.length > MAX_BATCH) return Response.json({ error: `Envie no máximo ${MAX_BATCH} produtos por lote.` }, { status: 400 });

    const updateExisting = body.options?.updateExisting !== false;
    const service = base44.asServiceRole;
    const summary = {
      products_created: 0,
      products_updated: 0,
      variants_created: 0,
      variants_updated: 0,
      categories_created: 0,
      errors: [],
    };
    const addError = (row, code, message) => {
      if (summary.errors.length < MAX_ERRORS) summary.errors.push({ row: typeof row === 'number' ? row : 0, code, message: text(message, 220) });
    };

    const requestedCategories = new Map();
    drafts.forEach((draft) => {
      (draft?.categories || []).forEach((category) => {
        const slug = text(category?.slug, 120).trim();
        if (slug) requestedCategories.set(slug, { slug, name: text(category?.name, 120).trim() || slug, parent_slug: text(category?.parent_slug, 120).trim() });
      });
    });

    const { items: existingCategories } = await service.entities.Category.list({ limit: 400 });
    const categoryBySlug = new Map((existingCategories || []).map((category) => [category.slug, category]));
    for (const category of requestedCategories.values()) {
      if (categoryBySlug.has(category.slug)) continue;
      const created = await service.entities.Category.create({
        name: category.name,
        slug: category.slug,
        parent_slug: category.parent_slug,
        active: true,
        sort_order: 50,
      });
      categoryBySlug.set(category.slug, created);
      summary.categories_created += 1;
    }

    const sourceIds = drafts.map((draft) => text(draft?.source_id, 160).trim()).filter(Boolean);
    const slugs = drafts.map((draft) => text(draft?.slug, 160).trim()).filter(Boolean);
    const productBySource = new Map();
    const productBySlug = new Map();
    if (sourceIds.length) {
      const { items } = await service.entities.Product.filter({ source_id: { $in: sourceIds } }, { limit: MAX_BATCH * 2 });
      (items || []).forEach((product) => productBySource.set(product.source_id, product));
    }
    if (slugs.length) {
      const { items } = await service.entities.Product.filter({ slug: { $in: slugs } }, { limit: MAX_BATCH * 2 });
      (items || []).forEach((product) => productBySlug.set(product.slug, product));
    }

    const existingIds = Array.from(
      new Set([...productBySource.values(), ...productBySlug.values()].map((product) => product.id))
    );
    const variantsByProduct = new Map();
    if (existingIds.length) {
      const { items } = await service.entities.ProductVariant.filter({ product_id: { $in: existingIds } }, { limit: 600 });
      (items || []).forEach((variant) => {
        const list = variantsByProduct.get(variant.product_id) || [];
        list.push(variant);
        variantsByProduct.set(variant.product_id, list);
      });
    }

    for (const draft of drafts) {
      const name = text(draft?.name, 200).trim();
      const slug = text(draft?.slug, 160).trim();
      if (!name || !slug) {
        addError(0, 'sem_nome_ou_endereco', 'Produto sem nome ou endereço amigável — linha ignorada.');
        continue;
      }

      const existing = productBySource.get(text(draft?.source_id, 160).trim()) || productBySlug.get(slug) || null;
      if (existing && !updateExisting) {
        addError(0, 'ja_existe', `"${name}" já existe e a atualização está desativada.`);
        continue;
      }

      const categorySlugs = (draft.categories || [])
        .map((category) => text(category?.slug, 120).trim())
        .filter((categorySlug) => categoryBySlug.has(categorySlug));

      const incomingImages = (Array.isArray(draft.images) ? draft.images : [])
        .map((image, index) => ({
          url: text(image?.url, 600).trim(),
          alt: text(image?.alt, 200).trim(),
          variant_sku: text(image?.variant_sku, 120).trim(),
          sort_order: Number.isFinite(Number(image?.sort_order)) ? Number(image.sort_order) : index,
        }))
        .filter((image) => /^https?:\/\//i.test(image.url));
      const existingImages = Array.isArray(existing?.images) ? existing.images : [];
      const knownImageUrls = new Set(existingImages.map((image) => String(image?.url || '')));
      const mergedImages = [
        ...existingImages,
        ...incomingImages.filter((image) => !knownImageUrls.has(image.url)),
      ].slice(0, 40);

      const incomingVariants = Array.isArray(draft.variants) && draft.variants.length
        ? draft.variants
        : [{ sku: `${slug}-unico`, stock: 0 }];

      const listPrices = incomingVariants.map((variant) => numberOrNull(variant.price)).filter(Boolean);
      const promoPrices = incomingVariants
        .map((variant) => numberOrNull(variant.promo_price) || numberOrNull(variant.price))
        .filter(Boolean);

      const payload = {
        source_id: text(draft.source_id, 160).trim() || slug,
        name,
        slug,
        summary: text(draft.summary, 400),
        description: text(draft.description, 20000),
        categories: categorySlugs,
        brand: text(draft.brand, 120),
        tags: Array.isArray(draft.tags) ? draft.tags.slice(0, 30).map((tag) => text(tag, 60)) : [],
        seo_title: text(draft.seo_title, 200) || `${name} | Esex Store`,
        seo_description: text(draft.seo_description, 300) || text(draft.summary, 300),
        status: draft.status === 'active' ? 'active' : 'draft',
        visible: Boolean(draft.visible),
        featured: draft.featured ? true : Boolean(existing?.featured),
        needs_review: Boolean(draft.needs_review),
        review_notes: Array.isArray(draft.review_notes) ? draft.review_notes.slice(0, 8).map((note) => text(note, 200)) : [],
        physical: draft.physical !== false,
        sex: text(draft.sex, 60),
        age_range: text(draft.age_range, 60),
        mpn: text(draft.mpn, 80),
        price_from: listPrices.length ? Math.min(...listPrices) : null,
        price_from_promo: promoPrices.length ? Math.min(...promoPrices) : null,
        total_stock: incomingVariants.reduce((total, variant) => total + (Number(variant.stock) || 0), 0),
        sku_default: text(incomingVariants[0]?.sku, 120),
        images: mergedImages,
      };
      const cost = numberOrNull(draft.cost);
      if (cost) payload.cost = cost;

      let productId = existing?.id || null;
      if (existing) {
        await service.entities.Product.update(existing.id, payload);
        summary.products_updated += 1;
      } else {
        const created = await service.entities.Product.create(payload);
        productId = created.id;
        summary.products_created += 1;
      }

      const existingVariants = variantsByProduct.get(productId) || [];
      const variantBySku = new Map(existingVariants.map((variant) => [String(variant.sku || '').toUpperCase(), variant]));
      const variantsToCreate = [];
      const variantsToUpdate = [];

      for (let index = 0; index < incomingVariants.length; index += 1) {
        const variant = incomingVariants[index] || {};
        const sku = text(variant.sku, 120).trim() || `${slug}-${index + 1}`;
        const variantPayload = {
          product_id: productId,
          source_id: payload.source_id,
          sku,
          option1_name: text(variant.option1_name, 60),
          option1_value: text(variant.option1_value, 80),
          option2_name: text(variant.option2_name, 60),
          option2_value: text(variant.option2_value, 80),
          option3_name: text(variant.option3_name, 60),
          option3_value: text(variant.option3_value, 80),
          stock: Math.max(0, Math.round(Number(variant.stock) || 0)),
          barcode: text(variant.barcode, 60),
          active: true,
          position: index,
        };
        const price = numberOrNull(variant.price);
        const promo = numberOrNull(variant.promo_price);
        if (price) variantPayload.price = price;
        if (promo) variantPayload.promo_price = promo;
        ['weight_kg', 'height_cm', 'width_cm', 'length_cm'].forEach((field) => {
          const value = Number(variant[field]);
          if (Number.isFinite(value) && value > 0) variantPayload[field] = value;
        });

        const found = variantBySku.get(sku.toUpperCase());
        if (found) variantsToUpdate.push({ ...variantPayload, id: found.id });
        else variantsToCreate.push(variantPayload);
      }

      if (variantsToCreate.length) {
        await service.entities.ProductVariant.bulkCreate(variantsToCreate);
        summary.variants_created += variantsToCreate.length;
      }
      if (variantsToUpdate.length) {
        await service.entities.ProductVariant.bulkUpdate(variantsToUpdate);
        summary.variants_updated += variantsToUpdate.length;
      }
    }

    return Response.json({ summary });
  } catch (error) {
    console.error('importCatalog falhou', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
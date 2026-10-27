import { slugify, toNumber } from "@/lib/format";

export const TARGET_FIELDS = [
  { key: "ignore", label: "Ignorar coluna", group: "—" },
  { key: "source_id", label: "Identificador de origem", group: "Produto" },
  { key: "name", label: "Nome do produto", group: "Produto" },
  { key: "slug", label: "Endereço amigável (URL de origem)", group: "Produto" },
  { key: "images", label: "Fotos (endereços de imagem)", group: "Produto" },
  { key: "categories", label: "Categorias", group: "Produto" },
  { key: "description", label: "Descrição", group: "Produto" },
  { key: "tags", label: "Tags", group: "Produto" },
  { key: "seo_title", label: "Título para SEO", group: "Produto" },
  { key: "seo_description", label: "Descrição para SEO", group: "Produto" },
  { key: "brand", label: "Marca", group: "Produto" },
  { key: "mpn", label: "MPN / modelo", group: "Produto" },
  { key: "sex", label: "Sexo / público", group: "Produto" },
  { key: "age_range", label: "Faixa etária", group: "Produto" },
  { key: "cost", label: "Custo", group: "Produto" },
  { key: "physical", label: "Produto físico", group: "Produto" },
  { key: "visible", label: "Exibir na loja", group: "Produto" },
  { key: "option1_name", label: "Variação 1 — nome", group: "Variação" },
  { key: "option1_value", label: "Variação 1 — valor", group: "Variação" },
  { key: "option2_name", label: "Variação 2 — nome", group: "Variação" },
  { key: "option2_value", label: "Variação 2 — valor", group: "Variação" },
  { key: "option3_name", label: "Variação 3 — nome", group: "Variação" },
  { key: "option3_value", label: "Variação 3 — valor", group: "Variação" },
  { key: "sku", label: "SKU", group: "Variação" },
  { key: "price", label: "Preço", group: "Variação" },
  { key: "promo_price", label: "Preço promocional", group: "Variação" },
  { key: "stock", label: "Estoque", group: "Variação" },
  { key: "barcode", label: "Código de barras", group: "Variação" },
  { key: "weight_kg", label: "Peso (kg)", group: "Variação" },
  { key: "height_cm", label: "Altura (cm)", group: "Variação" },
  { key: "width_cm", label: "Largura (cm)", group: "Variação" },
  { key: "length_cm", label: "Comprimento (cm)", group: "Variação" },
];

const SYNONYMS = {
  source_id: ["identificador url", "identificador de url", "identificador", "url amigavel", "handle", "url handle"],
  name: ["nome", "nome do produto", "produto", "titulo", "nombre", "nombre del producto", "name", "product name", "title", "product"],
  slug: ["endereco url", "endereco amigavel", "slug", "url do produto", "url del producto", "friendly url"],
  images: [
    "imagens",
    "imagem",
    "fotos",
    "foto",
    "galeria",
    "imagen",
    "imagenes",
    "images",
    "image",
    "imagem url",
    "image url",
    "imagen url",
    "imagenes url",
    "url da imagem",
    "url de la imagen",
    "url das imagens",
    "urls das imagens",
    "urls de las imagenes",
    "endereco da imagem",
  ],
  categories: ["categorias", "categoria", "colecoes", "colecao", "categories", "category", "collections", "collection"],
  description: [
    "descricao",
    "descricao do produto",
    "detalhes",
    "descripcion",
    "descripcion del producto",
    "description",
    "body html",
    "product description",
  ],
  tags: ["tags", "etiquetas", "etiqueta", "tag"],
  seo_title: ["titulo para seo", "titulo seo", "seo titulo", "meta title", "seo title", "titulo de seo"],
  seo_description: [
    "descricao para seo",
    "descricao seo",
    "seo descricao",
    "meta description",
    "descripcion para seo",
    "descripcion seo",
    "seo descripcion",
    "seo description",
  ],
  brand: ["marca", "fabricante", "brand", "vendor", "proveedor"],
  mpn: ["mpn cod exclusivo modelo fabricante", "mpn", "modelo", "model", "codigo exclusivo"],
  sex: ["sexo", "genero", "sex", "gender", "target gender"],
  age_range: ["faixa etaria", "rango de edad", "age range", "age group"],
  cost: ["custo", "custo de compra", "coste", "cost", "cost price"],
  physical: ["produto fisico", "producto fisico", "physical product", "requires shipping", "requiere envio"],
  visible: ["exibir na loja", "visivel", "publicado", "mostrar en la tienda", "visible", "published"],
  option1_name: ["nome da variacao 1", "variacao 1 nome", "nombre de la variacion 1", "variation 1 name", "option 1 name"],
  option1_value: [
    "valor da variacao 1",
    "variacao 1 valor",
    "valor de la variacion 1",
    "variation 1 value",
    "option 1 value",
  ],
  option2_name: ["nome da variacao 2", "variacao 2 nome", "nombre de la variacion 2", "variation 2 name", "option 2 name"],
  option2_value: [
    "valor da variacao 2",
    "variacao 2 valor",
    "valor de la variacion 2",
    "variation 2 value",
    "option 2 value",
  ],
  option3_name: ["nome da variacao 3", "variacao 3 nome", "nombre de la variacion 3", "variation 3 name", "option 3 name"],
  option3_value: [
    "valor da variacao 3",
    "variacao 3 valor",
    "valor de la variacion 3",
    "variation 3 value",
    "option 3 value",
  ],
  sku: ["sku", "codigo sku", "codigo", "codigo del sku", "code"],
  price: ["preco", "preco de venda", "valor", "precio", "precio de venta", "price", "regular price"],
  promo_price: [
    "preco promocional",
    "preco promo",
    "valor promocional",
    "precio promocional",
    "precio de oferta",
    "promotional price",
    "sale price",
    "compare at price",
  ],
  stock: ["estoque", "quantidade em estoque", "estoque atual", "stock", "inventario", "inventory", "quantity"],
  barcode: ["codigo de barras", "ean", "gtin", "codigo de barras ean"],
  weight_kg: ["peso kg", "peso", "weight kg", "weight"],
  height_cm: ["altura cm", "altura", "height cm", "height"],
  width_cm: ["largura cm", "largura", "width cm", "width", "ancho"],
  length_cm: ["comprimento cm", "comprimento", "length cm", "length", "longitud", "profundidad"],
};

export const normalizeHeader = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const decodeCsvBuffer = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^\uFEFF/, "");
};

export const detectDelimiter = (text) => {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const counts = [
    { delimiter: ";", count: (firstLine.match(/;/g) || []).length },
    { delimiter: "\t", count: (firstLine.match(/\t/g) || []).length },
    { delimiter: ",", count: (firstLine.match(/,/g) || []).length },
  ];
  return counts.sort((a, b) => b.count - a.count)[0].delimiter;
};

export const parseDelimited = (text, delimiter) => {
  const rows = [];
  let cells = [];
  let field = "";
  let inQuotes = false;
  let rowIndex = 1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(field);
      field = "";
    } else if (char === "\n") {
      cells.push(field);
      rows.push({ index: rowIndex, cells });
      cells = [];
      field = "";
      rowIndex += 1;
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || cells.length) {
    cells.push(field);
    rows.push({ index: rowIndex, cells });
  }

  const headerIndex = rows.findIndex((row) => row.cells.filter((cell) => String(cell).trim() !== "").length >= 2);
  const start = headerIndex >= 0 ? headerIndex : 0;
  const header = rows[start];
  return {
    columns: (header?.cells || []).map((cell) => cell.replace(/^"|"$/g, "").trim()),
    rows: rows.slice(start + 1).filter((row) => row.cells.some((cell) => String(cell).trim() !== "")),
  };
};

export const autoMap = (columns) => {
  const used = new Set();
  const mapping = columns.map((column) => {
    const normalized = normalizeHeader(column);
    if (!normalized) return "ignore";
    const exact = Object.entries(SYNONYMS).find(([key, list]) => !used.has(key) && list.includes(normalized));
    if (exact) {
      used.add(exact[0]);
      return exact[0];
    }
    const partial = Object.entries(SYNONYMS).find(
      ([key, list]) => !used.has(key) && list.some((syn) => normalized.startsWith(syn) || syn.startsWith(normalized))
    );
    if (partial) {
      used.add(partial[0]);
      return partial[0];
    }
    return "ignore";
  });
  return mapping;
};

const titleCase = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const isUpper = text === text.toUpperCase();
  if (!isUpper) return text;
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
};

export const parseCategoryPaths = (raw) => {
  const entries = new Map();
  String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((path) => {
      const segments = path.split(">").map((segment) => segment.trim()).filter(Boolean);
      let parent = "";
      segments.forEach((segment, depth) => {
        const name = titleCase(segment);
        const slug = slugify(name);
        if (!slug) return;
        if (!entries.has(slug)) entries.set(slug, { slug, name, parent_slug: parent, depth });
        parent = slug;
      });
    });
  return Array.from(entries.values());
};

const parseImageUrls = (raw) =>
  String(raw || "")
    .split(/[,\s|;]+/)
    .map((part) => part.trim())
    .filter((part) => /^https?:\/\//i.test(part));

const parseBoolean = (value, fallback = true) => {
  const normalized = normalizeHeader(value);
  if (!normalized) return fallback;
  if (["sim", "s", "yes", "1", "true", "ativo"].includes(normalized)) return true;
  if (["nao", "n", "no", "0", "false", "inativo"].includes(normalized)) return false;
  return fallback;
};

const firstText = (html, max = 180) => {
  const text = String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
};

/**
 * Agrupa as linhas do CSV em produtos com suas variações, apontando duplicidades e erros.
 */
export const buildCatalog = (rows, mapping, options = {}) => {
  const products = [];
  const bySource = new Map();
  const bySku = new Map();
  const errors = [];
  const notices = [];
  let current = null;
  const { markDraft = true } = options;

  const read = (row, key) => {
    const index = mapping.indexOf(key);
    if (index < 0) return "";
    return String(row.cells[index] ?? "").trim();
  };

  rows.forEach((row) => {
    const name = read(row, "name");
    const sourceId = read(row, "source_id");
    const rawSlug = read(row, "slug");
    const sku = read(row, "sku");
    const price = toNumber(read(row, "price"));
    const promo = toNumber(read(row, "promo_price"));
    const stockRaw = read(row, "stock");
    const descriptionPart = read(row, "description");
    const hasOption = ["option1_value", "option2_value", "option3_value"].some((key) => read(row, key));

    if (name) {
      const key = sourceId || slugify(name);
      const existing = bySource.get(key);
      if (existing) {
        errors.push({
          row: row.index,
          code: "origem_duplicada",
          message: `Identificador de origem repetido (${key}) — linhas agrupadas no mesmo produto.`,
        });
        current = existing;
      } else {
        current = {
          source_id: sourceId,
          name,
          slug: rawSlug ? slugify(rawSlug) : slugify(name),
          categories: parseCategoryPaths(read(row, "categories")),
          description: "",
          tags: [],
          seo_title: read(row, "seo_title"),
          seo_description: read(row, "seo_description"),
          brand: read(row, "brand"),
          mpn: read(row, "mpn"),
          sex: read(row, "sex"),
          age_range: read(row, "age_range"),
          cost: toNumber(read(row, "cost")),
          physical: parseBoolean(read(row, "physical"), true),
          visible: parseBoolean(read(row, "visible"), true),
          variants: [],
          images: [],
          review_notes: [],
        };
        products.push(current);
        bySource.set(key, current);
      }
    } else if (!current) {
      errors.push({ row: row.index, code: "linha_sem_produto", message: "Linha de continuação sem produto identificado." });
      return;
    }

    if (descriptionPart && !current.description.includes(descriptionPart.slice(0, 120))) {
      current.description += (current.description ? "\n" : "") + descriptionPart;
    }

    parseImageUrls(read(row, "images")).forEach((url) => {
      if (current.images.some((image) => image.url === url)) return;
      current.images.push({ url, alt: "", variant_sku: "", sort_order: current.images.length });
    });

    const tags = read(row, "tags");
    if (tags) current.tags = Array.from(new Set([...current.tags, ...tags.split(",").map((t) => t.trim()).filter(Boolean)]));

    ["seo_title", "seo_description", "brand", "mpn", "sex", "age_range"].forEach((field) => {
      const value = read(row, field);
      if (value && !current[field]) current[field] = value;
    });

    const variantData = {
      sku: sku || "",
      option1_name: read(row, "option1_name") || "",
      option1_value: read(row, "option1_value") || "",
      option2_name: read(row, "option2_name") || "",
      option2_value: read(row, "option2_value") || "",
      option3_name: read(row, "option3_name") || "",
      option3_value: read(row, "option3_value") || "",
      price: price && price > 0 ? price : null,
      promo_price: promo && promo > 0 ? promo : null,
      stock: stockRaw === "" ? 0 : Math.max(0, Math.round(toNumber(stockRaw) || 0)),
      barcode: read(row, "barcode"),
      weight_kg: toNumber(read(row, "weight_kg")),
      height_cm: toNumber(read(row, "height_cm")),
      width_cm: toNumber(read(row, "width_cm")),
      length_cm: toNumber(read(row, "length_cm")),
    };

    const isVariantRow = Boolean(
      variantData.sku || variantData.price || variantData.promo_price || hasOption || stockRaw !== ""
    );
    if (!isVariantRow) return;

    const variantKey = variantData.sku || `${current.source_id || current.slug}-${current.variants.length + 1}`;
    const owner = bySku.get(variantKey);
    if (owner && owner !== current) {
      errors.push({
        row: row.index,
        code: "sku_duplicado",
        message: `SKU ${variantKey} já usado no produto "${owner.name}" — variação ignorada.`,
      });
      return;
    }
    if (current.variants.some((variant) => variant.sku && variant.sku === variantData.sku)) {
      errors.push({ row: row.index, code: "sku_repetido_no_produto", message: `SKU ${variantKey} repetido no mesmo produto.` });
      return;
    }
    variantData.sku = variantKey;
    current.variants.push(variantData);
    bySku.set(variantKey, current);
  });

  products.forEach((product) => {
    product.categories = product.categories.map((category) => ({ ...category }));
    product.featured = product.categories.some((category) => category.slug === "mais-vendidos");
    product.categories = product.categories.filter((category) => category.slug !== "mais-vendidos");
    const pricedVariants = product.variants.filter((variant) => variant.price || variant.promo_price);
    if (!product.variants.length) {
      product.variants.push({ sku: `${product.slug || product.source_id}-unico`, price: null, promo_price: null, stock: 0 });
      product.review_notes.push("Preço não informado no arquivo — revisar antes de publicar.");
    }
    if (!pricedVariants.length) product.review_notes.push("Preço não informado no arquivo — revisar antes de publicar.");
    if (!String(product.description || "").trim()) product.review_notes.push("Descrição vazia no arquivo — completar antes de publicar.");
    if (!product.images.length) product.review_notes.push("Fotos do produto ainda não associadas — usar a etapa de importação de imagens.");
    product.images = product.images.map((image) => ({ ...image, alt: image.alt || `${product.name} — foto do produto` }));
    product.summary = firstText(product.description);
    product.description = product.description.trim();
    product.status = markDraft ? "draft" : "active";
    product.visible = markDraft ? false : product.visible;
    product.needs_review = true;
  });

  return {
    products,
    errors,
    notices,
    stats: {
      rows: rows.length,
      products: products.length,
      variants: products.reduce((total, product) => total + product.variants.length, 0),
      withoutPrice: products.filter((product) => !product.variants.some((variant) => variant.price || variant.promo_price)).length,
      withImages: products.filter((product) => product.images.length > 0).length,
      duplicateRows: errors.filter((error) => error.code.startsWith("origem") || error.code.includes("duplicado")).length,
    },
  };
};
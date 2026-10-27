export const brl = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

export const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/[^\d,.-]/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const variantLabel = (variant) =>
  [variant?.option1_value, variant?.option2_value, variant?.option3_value].filter(Boolean).join(" / ");

export const variantOptionPairs = (variant) => {
  const pairs = [];
  for (let i = 1; i <= 3; i += 1) {
    const name = variant?.[`option${i}_name`];
    const value = variant?.[`option${i}_value`];
    if (value) pairs.push({ name: name || `Opção ${i}`, value });
  }
  return pairs;
};

export const hasPromo = (variant) =>
  toNumber(variant?.promo_price) > 0 && toNumber(variant?.promo_price) < toNumber(variant?.price);

export const variantPrice = (variant) => (hasPromo(variant) ? toNumber(variant.promo_price) : toNumber(variant.price));

export const variantPricePending = (variant) => !variantPrice(variant);

export const productPriceLabel = (product, variants = []) => {
  const prices = variants.map(variantPrice).filter((p) => p > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
};

export const slugify = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const newOrderNumber = () =>
  `ES-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

export const whatsappLink = (number, message) => {
  const digits = digitsOnly(number);
  if (!digits) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
};
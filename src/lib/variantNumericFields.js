// Updates are partial: explicit null clears an old price or measurement.
export function variantNumericFields(variant) {
  const payload = {};
  for (const field of ['price', 'promo_price', 'weight_kg', 'height_cm', 'width_cm', 'length_cm']) {
    const value = Number(variant[field]);
    payload[field] = Number.isFinite(value) && value > 0 ? value : null;
  }
  return payload;
}

import React from "react";
import { Link } from "react-router-dom";
import ProductMedia from "@/components/store/ProductMedia";
import { brl } from "@/lib/format";

export default function ProductCard({ product, categoryName }) {
  const image = (product.images || [])[0];
  const price = Number(product.price_from) || null;
  const promo = Number(product.price_from_promo) || null;
  const showPromo = promo && price && promo < price;
  const soldOut = Number(product.total_stock) <= 0;
  const displayPrice = showPromo ? promo : price;

  return (
    <Link to={`/produto/${product.slug}`} className="cine-card flex h-full flex-col">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <ProductMedia src={image?.url} alt={image?.alt || product.name} />
        <div className="absolute left-[10px] top-[10px] flex flex-col items-start gap-1">
          {soldOut && <span className="cine-tag">Esgotado</span>}
          {showPromo && <span className="cine-tag">{Math.round((1 - promo / price) * 100)}% off</span>}
          {product.is_demo && <span className="cine-tag">Demonstração</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col pb-1 pt-4">
        {categoryName && <p className="eyebrow text-gold">{categoryName}</p>}
        <h3 className="mb-2.5 mt-2 font-heading text-[23px] leading-[1.15]">{product.name}</h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-3 text-[18px] tracking-[0.04em] text-gold">
          {displayPrice ? (
            <>
              <span>{brl(displayPrice)}</span>
              {showPromo && <s className="text-[13px] text-muted-foreground">{brl(price)}</s>}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Preço a confirmar</span>
          )}
        </div>
      </div>
    </Link>
  );
}
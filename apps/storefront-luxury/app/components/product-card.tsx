import { formatPrice } from "../lib/format";
import { TrackClick } from "../track-click";

const CATEGORY_ICONS: Record<string, string> = {
  "Power Tools": "🔧",
  "Lawn & Garden": "🌿",
  Electrical: "⚡",
  Plumbing: "🚿",
  Lighting: "💡",
  Hardware: "🔩",
  Paint: "🎨",
  Flooring: "🪵",
};

interface ProductCardProps {
  id: string;
  title: string;
  brand: string;
  category: string;
  subcategory?: string;
  price: number;
  inStock: boolean;
  imageUrl?: string;
  query?: string;
}

function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? "📦";
}

export function ProductCard({
  id,
  title,
  brand,
  category,
  subcategory,
  price,
  inStock,
  imageUrl,
  query = "",
}: ProductCardProps) {
  return (
    <article className="store-product-card">
      <div className="store-product-card__media">
        {imageUrl ? (
          <img src={imageUrl} alt={title} loading="lazy" />
        ) : (
          <div className="store-product-card__placeholder" aria-hidden="true">
            {categoryIcon(category)}
          </div>
        )}
      </div>
      <div className="store-product-card__body">
        <p className="store-product-card__brand">{brand}</p>
        <h3 className="store-product-card__title">{title}</h3>
        <p className="store-product-card__category">
          {category}
          {subcategory ? ` · ${subcategory}` : ""}
        </p>
        <div className="store-product-card__footer">
          <span className="store-price">{formatPrice(price)}</span>
          <span
            className={`store-badge ${inStock ? "store-badge--in-stock" : "store-badge--out-of-stock"}`}
          >
            {inStock ? "In stock" : "Out of stock"}
          </span>
        </div>
        <TrackClick
          query={query}
          productId={id}
          productTitle={title}
          className="store-btn store-btn--primary store-btn--block"
        >
          Add to cart
        </TrackClick>
      </div>
    </article>
  );
}

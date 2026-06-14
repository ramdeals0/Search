import Link from "next/link";
import type {
  BrowseCategoryDto,
  DiscoveryTrendingResponseDto,
} from "@retailer-search/shared-types";
import { fetchSearchApi } from "../lib/search-api-client";

const POPULAR_SEARCHES = [
  "cordless drill",
  "mulch",
  "gfci outlet",
  "pressure washer",
  "led shop light",
  "shop vac",
];

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

interface HomeHeroProps {
  categories: BrowseCategoryDto[];
}

async function fetchTrendingSearches(): Promise<string[]> {
  try {
    const response = await fetchSearchApi("/api/v1/discovery/trending?limit=10&days=7", {
      cache: "no-store",
    });
    if (!response.ok) {
      return POPULAR_SEARCHES;
    }

    const data = (await response.json()) as DiscoveryTrendingResponseDto;
    const queries = data.queries.map((entry) => entry.query).filter(Boolean);
    return queries.length > 0 ? queries : POPULAR_SEARCHES;
  } catch {
    return POPULAR_SEARCHES;
  }
}

export async function HomeHero({ categories }: HomeHeroProps) {
  const topCategories = categories.slice(0, 8);
  const trendingSearches = await fetchTrendingSearches();

  return (
    <section className="store-hero">
      <div className="store-hero__banner">
        <p className="store-hero__eyebrow">Spring project season</p>
        <h1 className="store-hero__title">Everything for your next home upgrade</h1>
        <p className="store-hero__text">
          Shop thousands of tools, hardware, and outdoor essentials. Search by
          product, brand, or category — or browse departments below.
        </p>
        <div className="store-hero__actions">
          <Link href="/browse" className="store-btn store-btn--primary">
            Shop all products
          </Link>
          <Link href="/?query=cordless%20drill" className="store-btn store-btn--ghost">
            Top deals
          </Link>
        </div>
      </div>

      {topCategories.length > 0 ? (
        <div>
          <h2 className="store-section-title">Shop by department</h2>
          <div className="store-category-grid">
            {topCategories.map((entry) => (
              <Link
                key={entry.category}
                href={`/browse?category=${encodeURIComponent(entry.category)}`}
                className="store-category-card"
              >
                <span className="store-category-card__icon" aria-hidden="true">
                  {CATEGORY_ICONS[entry.category] ?? "📦"}
                </span>
                <span className="store-category-card__name">{entry.category}</span>
                <span className="store-category-card__count">
                  {entry.productCount} products
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="store-section-title">Trending searches</h2>
        <div className="store-chip-row">
          {trendingSearches.map((term) => (
            <Link
              key={term}
              href={`/?query=${encodeURIComponent(term)}`}
              className="store-chip"
            >
              {term}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SearchBar } from "../search-bar";

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = pathname === "/" ? (searchParams.get("query") ?? "") : "";

  return (
    <>
      <div className="store-promo-bar">
        Free delivery on orders over $49 · Same-day pickup available at your local store
      </div>
      <header className="store-header">
        <div className="store-header__inner">
          <div className="store-header__top">
            <Link href="/" className="store-logo">
              <span className="store-logo__mark" aria-hidden="true">
                B
              </span>
              BuildMart
            </Link>
            <nav className="store-nav" aria-label="Primary">
              <Link
                href="/"
                className={`store-nav__link${pathname === "/" ? " store-nav__link--active" : ""}`}
              >
                Home
              </Link>
              <Link
                href="/browse"
                className={`store-nav__link${pathname.startsWith("/browse") ? " store-nav__link--active" : ""}`}
              >
                Shop all
              </Link>
              <Link href="/browse?category=Power%20Tools" className="store-nav__link">
                Tools
              </Link>
              <Link href="/browse?category=Lawn%20%26%20Garden" className="store-nav__link">
                Outdoor
              </Link>
            </nav>
          </div>
          <SearchBar query={query} pageSize={12} activeFilters={{}} compact />
        </div>
      </header>
    </>
  );
}

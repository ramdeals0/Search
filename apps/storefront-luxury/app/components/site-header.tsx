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
        Complimentary shipping on orders over $500 · Private styling by appointment
      </div>
      <header className="store-header">
        <div className="store-header__inner">
          <div className="store-header__top">
            <Link href="/" className="store-logo">
              <span className="store-logo__mark" aria-hidden="true">
                L
              </span>
              Luxe Atelier
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
                Collections
              </Link>
              <Link href="/browse?category=Women" className="store-nav__link">
                Women
              </Link>
              <Link href="/browse?category=Men" className="store-nav__link">
                Men
              </Link>
              <Link href="/browse?category=Accessories" className="store-nav__link">
                Accessories
              </Link>
            </nav>
          </div>
          <SearchBar query={query} pageSize={12} activeFilters={{}} compact />
        </div>
      </header>
    </>
  );
}

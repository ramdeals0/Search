import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="store-footer">
      <div className="store-footer__inner">
        <div className="store-footer__grid">
          <div>
            <p className="store-footer__title">Collections</p>
            <ul className="store-footer__links">
              <li>
                <Link href="/browse">All collections</Link>
              </li>
              <li>
                <Link href="/browse?category=Women">Women</Link>
              </li>
              <li>
                <Link href="/browse?category=Men">Men</Link>
              </li>
              <li>
                <Link href="/browse?category=Accessories">Accessories</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="store-footer__title">Services</p>
            <ul className="store-footer__links">
              <li>
                <Link href="/?query=personal%20styling">Personal styling</Link>
              </li>
              <li>
                <Link href="/?query=shipping">Complimentary delivery</Link>
              </li>
              <li>
                <Link href="/?query=boutique">Boutique locations</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="store-footer__title">Popular searches</p>
            <ul className="store-footer__links">
              <li>
                <Link href="/?query=silk%20dress">Silk dress</Link>
              </li>
              <li>
                <Link href="/?query=handbag">Handbag</Link>
              </li>
              <li>
                <Link href="/?query=cashmere%20coat">Cashmere coat</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="store-footer__bottom">
          © {new Date().getFullYear()} Luxe Atelier — luxury demo storefront (catalog:
          luxury-clothing) for multi-tenant validation.
        </p>
      </div>
    </footer>
  );
}

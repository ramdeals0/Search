import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="store-footer">
      <div className="store-footer__inner">
        <div className="store-footer__grid">
          <div>
            <p className="store-footer__title">Shop</p>
            <ul className="store-footer__links">
              <li>
                <Link href="/browse">All departments</Link>
              </li>
              <li>
                <Link href="/browse?category=Power%20Tools">Power tools</Link>
              </li>
              <li>
                <Link href="/browse?category=Lawn%20%26%20Garden">Lawn &amp; garden</Link>
              </li>
              <li>
                <Link href="/browse?category=Electrical">Electrical</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="store-footer__title">Customer service</p>
            <ul className="store-footer__links">
              <li>
                <Link href="/?query=return%20policy">Help center</Link>
              </li>
              <li>
                <Link href="/?query=shipping">Shipping &amp; delivery</Link>
              </li>
              <li>
                <Link href="/?query=store%20hours">Store locator</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="store-footer__title">Popular searches</p>
            <ul className="store-footer__links">
              <li>
                <Link href="/?query=cordless%20drill">Cordless drill</Link>
              </li>
              <li>
                <Link href="/?query=mulch">Mulch</Link>
              </li>
              <li>
                <Link href="/?query=gfci%20outlet">GFCI outlet</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="store-footer__bottom">
          © {new Date().getFullYear()} BuildMart — demo storefront for the Retailer Search
          Platform.
        </p>
      </div>
    </footer>
  );
}

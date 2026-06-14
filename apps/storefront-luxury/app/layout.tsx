import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const bodyFont = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: "Luxe Atelier | Luxury Fashion",
    template: "%s | Luxe Atelier",
  },
  description:
    "Discover designer clothing, handbags, jewelry, and accessories at Luxe Atelier.",
};

function HeaderFallback() {
  return (
    <>
      <div className="store-promo-bar">Complimentary shipping on orders over $500</div>
      <header className="store-header">
        <div className="store-header__inner">
          <div className="store-header__top">
            <span className="store-logo">Luxe Atelier</span>
          </div>
        </div>
      </header>
    </>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="store-body store-theme--luxury">
        <div className="store-shell">
          <Suspense fallback={<HeaderFallback />}>
            <SiteHeader />
          </Suspense>
          <main className="store-main">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

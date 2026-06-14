import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BuildMart | Home Improvement & Tools",
    template: "%s | BuildMart",
  },
  description:
    "Shop tools, hardware, lawn & garden, and home improvement products at BuildMart.",
};

function HeaderFallback() {
  return (
    <>
      <div className="store-promo-bar">Loading store…</div>
      <header className="store-header">
        <div className="store-header__inner">
          <div className="store-header__top">
            <span className="store-logo">
              <span className="store-logo__mark">B</span>
              BuildMart
            </span>
          </div>
        </div>
      </header>
    </>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="store-body">
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

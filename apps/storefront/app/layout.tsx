import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

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
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="store-body store-theme--buildmart">
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

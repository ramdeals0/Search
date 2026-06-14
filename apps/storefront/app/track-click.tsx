"use client";

import type { ReactNode } from "react";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

interface TrackClickProps {
  query: string;
  productId: string;
  productTitle: string;
  href?: string;
  className?: string;
  children: ReactNode;
}

async function sendClickEvent(
  query: string,
  productId: string,
  productTitle: string,
): Promise<void> {
  try {
    await fetch(`${SEARCH_API_URL}/api/v1/events/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, productId, productTitle }),
    });
  } catch {
    // Analytics should not block navigation or interaction.
  }
}

export function TrackClick({
  query,
  productId,
  productTitle,
  href,
  className = "store-btn store-btn--secondary",
  children,
}: TrackClickProps) {
  const handleClick = () => {
    void sendClickEvent(query, productId, productTitle);
  };

  if (href) {
    return (
      <a href={href} onClick={handleClick} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

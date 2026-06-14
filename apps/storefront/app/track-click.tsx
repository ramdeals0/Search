"use client";

import type { ReactNode } from "react";
import { fetchSearchApi } from "./lib/search-api-client";
import { getOrCreateSessionId } from "./lib/session-id";

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
    await fetchSearchApi("/api/v1/events/click", {
      method: "POST",
      sessionId: getOrCreateSessionId(),
      body: { query, productId, productTitle },
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

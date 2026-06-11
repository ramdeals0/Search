"use client";

import type { ReactNode } from "react";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

interface TrackClickProps {
  query: string;
  productId: string;
  productTitle: string;
  href?: string;
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

const actionStyle = {
  marginTop: "0.75rem",
  display: "inline-block",
  padding: "0.45rem 0.75rem",
  fontSize: 14,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  cursor: "pointer",
  textDecoration: "none",
} as const;

export function TrackClick({
  query,
  productId,
  productTitle,
  href,
  children,
}: TrackClickProps) {
  const handleClick = () => {
    void sendClickEvent(query, productId, productTitle);
  };

  if (href) {
    return (
      <a href={href} onClick={handleClick} style={actionStyle}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={handleClick} style={actionStyle}>
      {children}
    </button>
  );
}

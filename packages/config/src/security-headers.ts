export type SecurityHeadersMode = "web" | "api";

export interface BuildSecurityHeadersOptions {
  mode?: SecurityHeadersMode;
  /** Send HSTS (default: production or ENFORCE_HTTPS=true). */
  includeHsts?: boolean;
  /** Additional CSP connect-src entries (web mode). */
  extraConnectSrc?: string[];
}

export type NextSecurityHeader = {
  key: string;
  value: string;
};

const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";

export function shouldEnableHsts(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.ENFORCE_HTTPS === "true"
  );
}

function appendApiConnectSources(sources: Set<string>): void {
  for (const envName of ["NEXT_PUBLIC_SEARCH_API_URL", "SEARCH_API_URL"] as const) {
    const raw = process.env[envName]?.trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = new URL(raw);
      sources.add(`${parsed.protocol}//${parsed.host}`);
    } catch {
      // Ignore invalid URLs in env.
    }
  }
}

function buildConnectSrc(extraConnectSrc?: string[]): string {
  const sources = new Set<string>(["'self'"]);
  appendApiConnectSources(sources);
  for (const value of extraConnectSrc ?? []) {
    const trimmed = value.trim();
    if (trimmed) {
      sources.add(trimmed);
    }
  }
  return Array.from(sources).join(" ");
}

function buildWebContentSecurityPolicy(extraConnectSrc?: string[]): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${buildConnectSrc(extraConnectSrc)}`,
    "worker-src 'self' blob:",
  ].join("; ");
}

function buildApiContentSecurityPolicy(): string {
  return [
    "default-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

export function buildSecurityHeaders(
  options: BuildSecurityHeadersOptions = {},
): Record<string, string> {
  const mode = options.mode ?? "web";
  const includeHsts = options.includeHsts ?? shouldEnableHsts();

  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Content-Security-Policy":
      mode === "api"
        ? buildApiContentSecurityPolicy()
        : buildWebContentSecurityPolicy(options.extraConnectSrc),
  };

  if (includeHsts) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

export function buildNextSecurityHeaders(
  options: Omit<BuildSecurityHeadersOptions, "mode"> = {},
): NextSecurityHeader[] {
  return Object.entries(buildSecurityHeaders({ ...options, mode: "web" })).map(
    ([key, value]) => ({ key, value }),
  );
}

export const REQUIRED_BROWSER_SECURITY_HEADER_NAMES = [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
] as const;

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AdminBrandingDto } from "@retailer-search/shared-types";
import { ForgeOpsLogo } from "./admin/admin-page-header";
import { getSearchApiUrl } from "./lib/search-api-url";

const BrandingContext = createContext<AdminBrandingDto | null>(null);

export function useBranding(): AdminBrandingDto | null {
  return useContext(BrandingContext);
}

function applyBrandingToDocument(branding: AdminBrandingDto): void {
  const root = document.documentElement;
  root.style.setProperty("--forge-primary", branding.primaryColor);
  root.style.setProperty(
    "--forge-accent",
    branding.accentColor ?? branding.primaryColor,
  );
  root.style.setProperty("--forge-sidebar", branding.sidebarColor ?? "#f8fafc");

  if (branding.logoUrl) {
    root.dataset.forgeLogoUrl = branding.logoUrl;
  } else {
    delete root.dataset.forgeLogoUrl;
  }

  if (branding.instanceName) {
    root.dataset.forgeInstanceName = branding.instanceName;
  } else {
    delete root.dataset.forgeInstanceName;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<AdminBrandingDto | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`${getSearchApiUrl()}/api/v1/branding`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as AdminBrandingDto;
        setBranding(body);
        applyBrandingToDocument(body);
      } catch {
        // Branding is optional; fall back to default CSS variables.
      }
    })();
  }, []);

  return (
    <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>
  );
}

export function BrandedSidebarBrand() {
  const branding = useBranding();

  if (branding?.logoUrl) {
    return (
      <div className="forge-sidebar__brand">
        <div className="forge-logo" aria-label={branding.instanceName}>
          <img
            src={branding.logoUrl}
            alt={branding.instanceName}
            style={{ maxHeight: 32, maxWidth: 160, objectFit: "contain" }}
          />
          <div className="forge-logo__wordmark">
            <span className="forge-logo__name">{branding.instanceName}</span>
          </div>
        </div>
      </div>
    );
  }

  if (branding?.instanceName && branding.instanceName !== "ForgeOps") {
    return (
      <div className="forge-sidebar__brand">
        <div className="forge-logo" aria-label={branding.instanceName}>
          <ForgeOpsLogo showTagline={false} />
          <div className="forge-logo__wordmark">
            <span className="forge-logo__name">{branding.instanceName}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forge-sidebar__brand">
      <ForgeOpsLogo />
    </div>
  );
}

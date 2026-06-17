"use client";

import { useEffect } from "react";
import { refreshCsrfToken } from "../lib/auth-headers";

/** Ensures a CSRF token is loaded as soon as the admin shell mounts. */
export function CsrfBootstrap() {
  useEffect(() => {
    void refreshCsrfToken();
  }, []);

  return null;
}

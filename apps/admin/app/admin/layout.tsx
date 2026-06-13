import type { ReactNode } from "react";
import "../globals.css";
import { requireAdminAuth } from "../lib/require-admin-auth";
import { AdminShell } from "./admin-shell";

export default async function AdminSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminAuth();

  return <AdminShell>{children}</AdminShell>;
}

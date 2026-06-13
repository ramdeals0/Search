import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

try {
  const productCount = await prisma.product.count();
  const brandCount = await prisma.brand.count();
  const sample = await prisma.product.findFirst({
    include: { brand: true, category: true },
  });

  let health = null;
  try {
    health = await fetch("http://localhost:4001/health").then((r) => r.json());
  } catch {
    health = { error: "search-api not reachable on :4001" };
  }

  let preview = null;
  try {
    const url = new URL("http://localhost:4001/api/v1/admin/query-preview");
    url.searchParams.set("query", "drill");
    preview = await fetch(url).then((r) => ({
      status: r.status,
      body: r.json(),
    }));
    preview.body = await preview.body;
  } catch {
    preview = { error: "query-preview failed" };
  }

  console.log(
    JSON.stringify(
      {
        database: { productCount, brandCount, sampleTitle: sample?.title ?? null },
        health,
        preview,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}

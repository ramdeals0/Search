import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const serviceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const caPath = path.join(serviceRoot, "prisma/certs/aiven-ca.pem");

const config = {
  user: process.env.PGUSER ?? "avnadmin",
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST ?? "search-ramdeals0-4462.a.aivencloud.com",
  port: Number(process.env.PGPORT ?? 11759),
  database: process.env.PGDATABASE ?? "defaultdb",
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(caPath, "utf8"),
  },
};

const client = new pg.Client(config);

try {
  await client.connect();
  const result = await client.query("SELECT version()");
  console.log("Connected successfully.");
  console.log(result.rows[0].version);
} catch (error) {
  console.error("Connection failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

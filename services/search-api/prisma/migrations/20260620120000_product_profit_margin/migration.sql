-- Product unit economics for commercial search prioritization.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "unitCost" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "profitMarginPercent" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "Product_profitMarginPercent_idx"
  ON "Product" ("profitMarginPercent");

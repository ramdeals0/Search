import { enqueueJob } from "../job-queue.js";
import { rebuildProductSearchIndex } from "../../index/product-index-manager.js";

export function enqueueCatalogReindex(): ReturnType<typeof enqueueJob> {
  return enqueueJob("catalog_reindex", async () => {
    await rebuildProductSearchIndex();
  });
}

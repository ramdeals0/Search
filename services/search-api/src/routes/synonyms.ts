import type { Express } from "express";
import { z } from "zod";
import type {
  EnvironmentKey,
  SynonymListResponseDto,
} from "@retailer-search/shared-types";
import { recordAuditLog } from "../audit-trail-store.js";
import {
  addSynonym,
  deleteSynonym,
  getSynonymAuditContext,
  listSynonymEntries,
  updateSynonym,
} from "../synonyms.js";

const environmentKeySchema = z.enum(["staging", "live"]);

const createSynonymSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

const updateSynonymSchema = z.object({
  value: z.string().min(1),
});

function parseEnvironmentQuery(
  value: unknown,
  defaultEnvironment: EnvironmentKey = "staging",
): EnvironmentKey {
  const parsed = environmentKeySchema.safeParse(value);
  return parsed.success ? parsed.data : defaultEnvironment;
}

function decodeSynonymKey(rawKey: string): string {
  try {
    return decodeURIComponent(rawKey).trim().toLowerCase();
  } catch {
    return rawKey.trim().toLowerCase();
  }
}

export function registerSynonymRoutes(app: Express): void {
  app.get("/api/v1/admin/synonyms", (req, res) => {
    const environment = parseEnvironmentQuery(req.query.environment, "staging");
    const synonyms = listSynonymEntries(environment);
    const body: SynonymListResponseDto = {
      environment,
      total: synonyms.length,
      synonyms,
    };
    res.json(body);
  });

  app.post("/api/v1/admin/synonyms", (req, res) => {
    const parsed = createSynonymSchema.safeParse(req.body);
    if (!parsed.success) {
      recordAuditLog({
        actionType: "create_synonym",
        entityType: "synonym",
        outcome: "failure",
        summary: "Failed to create synonym: invalid payload",
        metadata: { errors: parsed.error.flatten() },
      });
      res.status(400).json({
        error: "Invalid synonym payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    const environment = parseEnvironmentQuery(req.query.environment, "staging");
    const created = addSynonym(parsed.data.key, parsed.data.value, environment);
    if (!created) {
      recordAuditLog({
        actionType: "create_synonym",
        entityType: "synonym",
        entityId: parsed.data.key.trim().toLowerCase(),
        entityLabel: parsed.data.key.trim().toLowerCase(),
        outcome: "failure",
        summary: `Failed to create synonym '${parsed.data.key}': duplicate or invalid key`,
        metadata: { environment, payload: parsed.data },
      });
      res.status(409).json({ error: "Synonym already exists or invalid key/value" });
      return;
    }

    const audit = getSynonymAuditContext(created.key, created.value);
    recordAuditLog({
      actionType: "create_synonym",
      entityType: "synonym",
      entityId: audit.key,
      entityLabel: audit.key,
      outcome: "success",
      summary: `Created synonym '${audit.key}' -> '${audit.value}' in ${environment}`,
      metadata: { environment, synonym: created },
    });
    res.status(201).json(created);
  });

  app.put("/api/v1/admin/synonyms/:key", (req, res) => {
    const parsed = updateSynonymSchema.safeParse(req.body);
    if (!parsed.success) {
      recordAuditLog({
        actionType: "update_synonym",
        entityType: "synonym",
        entityId: req.params.key,
        outcome: "failure",
        summary: `Failed to update synonym '${req.params.key}': invalid payload`,
        metadata: { errors: parsed.error.flatten() },
      });
      res.status(400).json({
        error: "Invalid synonym payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    const environment = parseEnvironmentQuery(req.query.environment, "staging");
    const key = decodeSynonymKey(req.params.key);
    const updated = updateSynonym(key, parsed.data.value, environment);
    if (!updated) {
      recordAuditLog({
        actionType: "update_synonym",
        entityType: "synonym",
        entityId: key,
        entityLabel: key,
        outcome: "failure",
        summary: `Failed to update synonym '${key}': not found`,
        metadata: { environment },
      });
      res.status(404).json({ error: "Synonym not found" });
      return;
    }

    const audit = getSynonymAuditContext(updated.key, updated.value);
    recordAuditLog({
      actionType: "update_synonym",
      entityType: "synonym",
      entityId: audit.key,
      entityLabel: audit.key,
      outcome: "success",
      summary: `Updated synonym '${audit.key}' -> '${audit.value}' in ${environment}`,
      metadata: { environment, synonym: updated },
    });
    res.json(updated);
  });

  app.delete("/api/v1/admin/synonyms/:key", (req, res) => {
    const environment = parseEnvironmentQuery(req.query.environment, "staging");
    const key = decodeSynonymKey(req.params.key);
    const removed = deleteSynonym(key, environment);
    if (!removed) {
      recordAuditLog({
        actionType: "delete_synonym",
        entityType: "synonym",
        entityId: key,
        entityLabel: key,
        outcome: "failure",
        summary: `Failed to delete synonym '${key}': not found`,
        metadata: { environment },
      });
      res.status(404).json({ error: "Synonym not found" });
      return;
    }

    const audit = getSynonymAuditContext(removed.key, removed.value);
    recordAuditLog({
      actionType: "delete_synonym",
      entityType: "synonym",
      entityId: audit.key,
      entityLabel: audit.key,
      outcome: "success",
      summary: `Deleted synonym '${audit.key}' -> '${audit.value}' from ${environment}`,
      metadata: { environment, synonym: removed },
    });
    res.status(204).send();
  });
}

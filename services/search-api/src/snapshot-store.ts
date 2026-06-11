import type {
  CreateSnapshotRequestDto,
  EnvironmentKey,
  MerchandisingConfigSnapshotDto,
  MerchandisingRule,
  SnapshotDiffItemDto,
  SnapshotDiffResponseDto,
  SnapshotListResponseDto,
} from "@retailer-search/shared-types";
import { DEFAULT_AUDIT_ACTOR } from "./audit-log-store.js";

interface StoredSnapshot {
  dto: MerchandisingConfigSnapshotDto;
  rules: MerchandisingRule[];
  synonyms: Record<string, string>;
}

const snapshots: StoredSnapshot[] = [];
let snapshotIdCounter = 1;

function cloneRules(rules: MerchandisingRule[]): MerchandisingRule[] {
  return structuredClone(rules);
}

function cloneSynonyms(synonyms: Record<string, string>): Record<string, string> {
  return structuredClone(synonyms);
}

function createSnapshotId(): string {
  const id = `snap-${Date.now()}-${snapshotIdCounter}`;
  snapshotIdCounter += 1;
  return id;
}

function ruleToRecord(rule: MerchandisingRule): Record<string, unknown> {
  return structuredClone(rule) as unknown as Record<string, unknown>;
}

function rulesEqual(a: MerchandisingRule, b: MerchandisingRule): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function findStoredSnapshot(id: string): StoredSnapshot | undefined {
  return snapshots.find((snapshot) => snapshot.dto.id === id);
}

export function createConfigSnapshot(
  input: CreateSnapshotRequestDto,
  currentRules: MerchandisingRule[],
  currentSynonyms: Record<string, string>,
  actor: { actorId: string; actorLabel: string } = DEFAULT_AUDIT_ACTOR,
  sourceEnvironment?: EnvironmentKey,
): MerchandisingConfigSnapshotDto {
  const rules = cloneRules(currentRules);
  const synonyms = cloneSynonyms(currentSynonyms);
  const synonymKeys = Object.keys(synonyms).sort();

  const dto: MerchandisingConfigSnapshotDto = {
    id: createSnapshotId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    createdAt: new Date().toISOString(),
    createdBy: {
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
    },
    counts: {
      rules: rules.length,
      synonyms: synonymKeys.length,
    },
    ruleIds: rules.map((rule) => rule.id),
    synonymKeys,
    sourceEnvironment,
  };

  snapshots.push({
    dto,
    rules,
    synonyms,
  });

  return dto;
}

export function createConfigSnapshotFromEnvironment(
  environment: EnvironmentKey,
  input: CreateSnapshotRequestDto,
  getRules: () => MerchandisingRule[],
  getSynonyms: () => Record<string, string>,
  actor: { actorId: string; actorLabel: string } = DEFAULT_AUDIT_ACTOR,
): MerchandisingConfigSnapshotDto {
  return createConfigSnapshot(
    input,
    getRules(),
    getSynonyms(),
    actor,
    environment,
  );
}

export function listConfigSnapshots(): SnapshotListResponseDto {
  const ordered = [...snapshots]
    .sort(
      (a, b) =>
        new Date(b.dto.createdAt).getTime() -
        new Date(a.dto.createdAt).getTime(),
    )
    .map((snapshot) => structuredClone(snapshot.dto));

  return {
    total: ordered.length,
    snapshots: ordered,
  };
}

export function getConfigSnapshotById(
  id: string,
): MerchandisingConfigSnapshotDto | undefined {
  const snapshot = findStoredSnapshot(id);
  return snapshot ? structuredClone(snapshot.dto) : undefined;
}

export function getSnapshotConfigData(
  id: string,
): {
  dto: MerchandisingConfigSnapshotDto;
  rules: MerchandisingRule[];
  synonyms: Record<string, string>;
} | null {
  const snapshot = findStoredSnapshot(id);
  if (!snapshot) {
    return null;
  }

  return {
    dto: structuredClone(snapshot.dto),
    rules: cloneRules(snapshot.rules),
    synonyms: cloneSynonyms(snapshot.synonyms),
  };
}

export function getSnapshotSearchConfig(
  id: string,
): { rules: MerchandisingRule[]; synonyms: Record<string, string> } | null {
  const snapshot = findStoredSnapshot(id);
  if (!snapshot) {
    return null;
  }

  return {
    rules: cloneRules(snapshot.rules),
    synonyms: cloneSynonyms(snapshot.synonyms),
  };
}

export function buildSnapshotDiff(
  fromId: string,
  toId: string,
): SnapshotDiffResponseDto | null {
  const fromSnapshot = findStoredSnapshot(fromId);
  const toSnapshot = findStoredSnapshot(toId);

  if (!fromSnapshot || !toSnapshot) {
    return null;
  }

  const items: SnapshotDiffItemDto[] = [];
  const fromRules = new Map(
    fromSnapshot.rules.map((rule) => [rule.id, rule] as const),
  );
  const toRules = new Map(
    toSnapshot.rules.map((rule) => [rule.id, rule] as const),
  );

  for (const [ruleId, toRule] of toRules) {
    const fromRule = fromRules.get(ruleId);
    if (!fromRule) {
      items.push({
        type: "rule_added",
        key: ruleId,
        after: ruleToRecord(toRule),
      });
      continue;
    }

    if (!rulesEqual(fromRule, toRule)) {
      items.push({
        type: "rule_changed",
        key: ruleId,
        before: ruleToRecord(fromRule),
        after: ruleToRecord(toRule),
      });
    }
  }

  for (const [ruleId, fromRule] of fromRules) {
    if (!toRules.has(ruleId)) {
      items.push({
        type: "rule_removed",
        key: ruleId,
        before: ruleToRecord(fromRule),
      });
    }
  }

  const fromSynonyms = fromSnapshot.synonyms;
  const toSynonyms = toSnapshot.synonyms;
  const synonymKeys = new Set([
    ...Object.keys(fromSynonyms),
    ...Object.keys(toSynonyms),
  ]);

  for (const key of synonymKeys) {
    const beforeValue = fromSynonyms[key];
    const afterValue = toSynonyms[key];

    if (beforeValue === undefined && afterValue !== undefined) {
      items.push({
        type: "synonym_added",
        key,
        after: { value: afterValue },
      });
      continue;
    }

    if (beforeValue !== undefined && afterValue === undefined) {
      items.push({
        type: "synonym_removed",
        key,
        before: { value: beforeValue },
      });
      continue;
    }

    if (
      beforeValue !== undefined &&
      afterValue !== undefined &&
      beforeValue !== afterValue
    ) {
      items.push({
        type: "synonym_changed",
        key,
        before: { value: beforeValue },
        after: { value: afterValue },
      });
    }
  }

  const summary = {
    rulesAdded: items.filter((item) => item.type === "rule_added").length,
    rulesRemoved: items.filter((item) => item.type === "rule_removed").length,
    rulesChanged: items.filter((item) => item.type === "rule_changed").length,
    synonymsAdded: items.filter((item) => item.type === "synonym_added").length,
    synonymsRemoved: items.filter((item) => item.type === "synonym_removed")
      .length,
    synonymsChanged: items.filter((item) => item.type === "synonym_changed")
      .length,
  };

  return {
    fromSnapshotId: fromId,
    toSnapshotId: toId,
    generatedAt: new Date().toISOString(),
    summary,
    items,
  };
}

function applySnapshotToLive(
  snapshot: StoredSnapshot,
  setRulesFn: (rules: MerchandisingRule[]) => void,
  setSynonymsFn: (synonyms: Record<string, string>) => void,
): MerchandisingConfigSnapshotDto {
  setRulesFn(cloneRules(snapshot.rules));
  setSynonymsFn(cloneSynonyms(snapshot.synonyms));
  return structuredClone(snapshot.dto);
}

export function restoreSnapshotById(
  snapshotId: string,
  setRulesFn: (rules: MerchandisingRule[]) => void,
  setSynonymsFn: (synonyms: Record<string, string>) => void,
): MerchandisingConfigSnapshotDto | null {
  const snapshot = findStoredSnapshot(snapshotId);
  if (!snapshot) {
    return null;
  }

  return applySnapshotToLive(snapshot, setRulesFn, setSynonymsFn);
}

export function rollbackToSnapshot(
  snapshotId: string,
  setRulesFn: (rules: MerchandisingRule[]) => void,
  setSynonymsFn: (synonyms: Record<string, string>) => void,
): MerchandisingConfigSnapshotDto | null {
  return restoreSnapshotById(snapshotId, setRulesFn, setSynonymsFn);
}

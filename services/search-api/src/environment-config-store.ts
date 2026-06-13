import type {
  EnvironmentConfigurationDto,
  EnvironmentKey,
  EnvironmentListResponseDto,
  MerchandisingRule,
} from "@retailer-search/shared-types";
import { getSystemConfig } from "./bootstrap-store.js";
import {
  buildDemoMerchandisingRules,
  buildSynonymMap,
} from "./demo-search-config.js";

interface EnvironmentState {
  rules: MerchandisingRule[];
  synonyms: Record<string, string>;
  snapshotId?: string;
  snapshotName?: string;
  updatedAt: string;
}

function cloneRules(rules: MerchandisingRule[]): MerchandisingRule[] {
  return structuredClone(rules);
}

function cloneSynonyms(synonyms: Record<string, string>): Record<string, string> {
  return structuredClone(synonyms);
}

function createInitialState(): EnvironmentState {
  return {
    rules: cloneRules(buildDemoMerchandisingRules()),
    synonyms: cloneSynonyms(buildSynonymMap()),
    updatedAt: new Date().toISOString(),
  };
}

const environments: Record<EnvironmentKey, EnvironmentState> = {
  staging: createInitialState(),
  live: createInitialState(),
};

function assertEnvironmentKey(value: EnvironmentKey): EnvironmentKey {
  return value;
}

function toConfigurationDto(environment: EnvironmentKey): EnvironmentConfigurationDto {
  const state = environments[environment];
  return {
    environment,
    snapshotId: state.snapshotId,
    snapshotName: state.snapshotName,
    updatedAt: state.updatedAt,
    counts: {
      rules: state.rules.length,
      synonyms: Object.keys(state.synonyms).length,
    },
  };
}

export async function hydrateEnvironmentConfigStore(): Promise<void> {
  const [stagingRules, liveRules, stagingSynonyms, liveSynonyms] = await Promise.all([
    getSystemConfig<MerchandisingRule[]>("demo.search.rules.staging"),
    getSystemConfig<MerchandisingRule[]>("demo.search.rules.live"),
    getSystemConfig<Record<string, string>>("demo.search.synonyms.staging"),
    getSystemConfig<Record<string, string>>("demo.search.synonyms.live"),
  ]);

  if (stagingRules && stagingRules.length > 0) {
    replaceRulesForEnvironment("staging", stagingRules);
  }

  if (liveRules && liveRules.length > 0) {
    replaceRulesForEnvironment("live", liveRules);
  }

  if (stagingSynonyms && Object.keys(stagingSynonyms).length > 0) {
    replaceSynonymsForEnvironment("staging", stagingSynonyms);
  }

  if (liveSynonyms && Object.keys(liveSynonyms).length > 0) {
    replaceSynonymsForEnvironment("live", liveSynonyms);
  }
}

export function getEnvironmentConfig(
  environment: EnvironmentKey,
): EnvironmentConfigurationDto {
  return structuredClone(toConfigurationDto(assertEnvironmentKey(environment)));
}

export function listEnvironmentConfigs(): EnvironmentListResponseDto {
  return {
    environments: (["staging", "live"] as const).map((environment) =>
      getEnvironmentConfig(environment),
    ),
  };
}

export function getRulesForEnvironment(
  environment: EnvironmentKey,
): MerchandisingRule[] {
  return cloneRules(environments[environment].rules);
}

export function getSynonymsForEnvironment(
  environment: EnvironmentKey,
): Record<string, string> {
  return cloneSynonyms(environments[environment].synonyms);
}

export function replaceRulesForEnvironment(
  environment: EnvironmentKey,
  rules: MerchandisingRule[],
): void {
  environments[environment].rules = cloneRules(rules);
  environments[environment].updatedAt = new Date().toISOString();
}

export function replaceSynonymsForEnvironment(
  environment: EnvironmentKey,
  synonyms: Record<string, string>,
): void {
  environments[environment].synonyms = cloneSynonyms(synonyms);
  environments[environment].updatedAt = new Date().toISOString();
}

export function setEnvironmentConfig(
  environment: EnvironmentKey,
  nextConfig: {
    rules: MerchandisingRule[];
    synonyms: Record<string, string>;
    snapshotId?: string;
    snapshotName?: string;
  },
): EnvironmentConfigurationDto {
  environments[environment] = {
    rules: cloneRules(nextConfig.rules),
    synonyms: cloneSynonyms(nextConfig.synonyms),
    snapshotId: nextConfig.snapshotId,
    snapshotName: nextConfig.snapshotName,
    updatedAt: new Date().toISOString(),
  };

  return getEnvironmentConfig(environment);
}

export function copyEnvironmentConfig(
  fromEnvironment: EnvironmentKey,
  toEnvironment: EnvironmentKey,
  _reason?: string,
): EnvironmentConfigurationDto {
  const source = environments[fromEnvironment];

  return setEnvironmentConfig(toEnvironment, {
    rules: cloneRules(source.rules),
    synonyms: cloneSynonyms(source.synonyms),
    snapshotId: source.snapshotId,
    snapshotName: source.snapshotName,
  });
}

export function promoteEnvironmentConfig(
  fromEnvironment: EnvironmentKey,
  toEnvironment: EnvironmentKey,
  _reason?: string,
): EnvironmentConfigurationDto {
  return copyEnvironmentConfig(fromEnvironment, toEnvironment, _reason);
}

export function getMutableRulesForEnvironment(
  environment: EnvironmentKey,
): MerchandisingRule[] {
  return environments[environment].rules;
}

export function getMutableSynonymsForEnvironment(
  environment: EnvironmentKey,
): Record<string, string> {
  return environments[environment].synonyms;
}

export function touchEnvironment(environment: EnvironmentKey): void {
  environments[environment].updatedAt = new Date().toISOString();
}

export function linkEnvironmentSnapshot(
  environment: EnvironmentKey,
  snapshotId: string,
  snapshotName: string,
): void {
  environments[environment].snapshotId = snapshotId;
  environments[environment].snapshotName = snapshotName;
  environments[environment].updatedAt = new Date().toISOString();
}

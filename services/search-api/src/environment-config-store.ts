import type {
  EnvironmentConfigurationDto,
  EnvironmentKey,
  EnvironmentListResponseDto,
  MerchandisingRule,
} from "@retailer-search/shared-types";

export const DEFAULT_MERCHANDISING_RULES: MerchandisingRule[] = [
  {
    id: "rule-pin-rice",
    name: "Pin featured rice for rice searches",
    active: true,
    priority: 100,
    action: "pin",
    condition: { query: "rice" },
    productIds: ["prod-021"],
  },
  {
    id: "rule-boost-barilla-basmati",
    name: "Boost Barilla for basmati searches",
    active: true,
    priority: 90,
    action: "boost",
    condition: { query: "basmati" },
    brand: "Barilla",
    boostAmount: 40,
  },
  {
    id: "rule-boost-snacks-category",
    name: "Boost Snacks category",
    active: true,
    priority: 80,
    action: "boost",
    condition: { query: "snacks", category: "Snacks" },
    boostAmount: 35,
  },
  {
    id: "rule-hide-salsa-oos",
    name: "Hide out-of-stock habanero salsa",
    active: true,
    priority: 70,
    action: "hide",
    condition: { query: "salsa" },
    productIds: ["prod-008"],
  },
  {
    id: "rule-bury-clearance-premium",
    name: "Bury premium items on clearance searches",
    active: true,
    priority: 60,
    action: "bury",
    condition: { query: "clearance" },
    buryAmount: 30,
  },
  {
    id: "rule-default-instock-boost",
    name: "Default in-stock boost",
    active: true,
    priority: 10,
    action: "boost",
    condition: { inStock: true },
    boostAmount: 5,
  },
  {
    id: "rule-bury-oos",
    name: "Bury out-of-stock items",
    active: true,
    priority: 5,
    action: "bury",
    condition: { inStock: false },
    buryAmount: 15,
  },
];

export const DEFAULT_TOKEN_SYNONYMS: Record<string, string> = {
  atta: "flour",
  soda: "beverages",
  pop: "beverages",
  chilli: "chili",
  paneer: "cheese",
};

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
    rules: cloneRules(DEFAULT_MERCHANDISING_RULES),
    synonyms: cloneSynonyms(DEFAULT_TOKEN_SYNONYMS),
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

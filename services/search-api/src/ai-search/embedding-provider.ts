import type { EmbeddingsProviderName } from "@retailer-search/shared-types";
import { createHash } from "node:crypto";

export interface EmbeddingProviderOptions {
  provider: EmbeddingsProviderName;
  model: string;
  dimensions: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface EmbeddingProvider {
  readonly name: EmbeddingsProviderName;
  readonly model: string;
  readonly dimensions: number;
  embedTexts(texts: string[]): Promise<number[][]>;
  embedQuery(query: string): Promise<number[]>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

export function buildMockEmbedding(text: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of tokenize(text)) {
    const bucket = hashToken(token) % dimensions;
    vector[bucket] += 1;
  }
  return normalizeVector(vector);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i];
  }
  return Math.max(0, dot);
}

class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name: EmbeddingsProviderName = "mock";
  readonly model: string;
  readonly dimensions: number;

  constructor(model: string, dimensions: number) {
    this.model = model;
    this.dimensions = dimensions;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map((text) => buildMockEmbedding(text, this.dimensions));
  }

  async embedQuery(query: string): Promise<number[]> {
    return buildMockEmbedding(query, this.dimensions);
  }
}

class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly name: EmbeddingsProviderName;
  readonly model: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    name: EmbeddingsProviderName,
    model: string,
    dimensions: number,
    apiKey: string,
    baseUrl: string,
  ) {
    this.name = name;
    this.model = model;
    this.dimensions = dimensions;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Embedding API failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vectors =
      payload.data?.map((entry) => normalizeVector(entry.embedding ?? [])) ?? [];
    if (vectors.length !== texts.length) {
      throw new Error("Embedding API returned unexpected result count");
    }
    return vectors;
  }

  async embedQuery(query: string): Promise<number[]> {
    const [vector] = await this.embedTexts([query]);
    return vector ?? buildMockEmbedding(query, this.dimensions);
  }
}

export function resolveEmbeddingProviderFromEnv(
  overrides: Partial<EmbeddingProviderOptions> = {},
): EmbeddingProvider {
  const provider = (overrides.provider ??
    process.env.EMBEDDINGS_PROVIDER ??
    "mock") as EmbeddingsProviderName;
  const model =
    overrides.model ??
    process.env.EMBEDDINGS_MODEL ??
    (provider === "mock" ? "mock-hash-v1" : "text-embedding-3-small");
  const dimensions =
    overrides.dimensions ??
    (Number.parseInt(process.env.EMBEDDING_DIMENSIONS ?? "64", 10) || 64);
  const apiKey =
    overrides.apiKey ??
    process.env.EMBEDDINGS_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.OPENROUTER_API_KEY;

  if (provider === "openai" && apiKey) {
    return new OpenAiCompatibleEmbeddingProvider(
      "openai",
      model,
      dimensions,
      apiKey,
      overrides.baseUrl ?? process.env.EMBEDDINGS_BASE_URL ?? "https://api.openai.com/v1",
    );
  }

  if (provider === "openrouter" && apiKey) {
    return new OpenAiCompatibleEmbeddingProvider(
      "openrouter",
      model,
      dimensions,
      apiKey,
      overrides.baseUrl ??
        process.env.EMBEDDINGS_BASE_URL ??
        "https://openrouter.ai/api/v1",
    );
  }

  return new MockEmbeddingProvider(model, dimensions);
}

export function fingerprintProvider(provider: EmbeddingProvider): string {
  return createHash("sha256")
    .update(`${provider.name}:${provider.model}:${provider.dimensions}`)
    .digest("hex")
    .slice(0, 16);
}

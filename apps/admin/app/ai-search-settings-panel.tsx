"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AiRankingConfigDto,
  AiRankingWeightsDto,
  EmbeddingCoverageDto,
  EmbeddingJobDto,
  EmbeddingsProviderName,
  UpdateAiRankingConfigRequestDto,
} from "@retailer-search/shared-types";
import { getAuthHeaders } from "./lib/auth-headers";
import { getSearchApiUrl } from "./lib/search-api-url";

const PROVIDER_OPTIONS: EmbeddingsProviderName[] = ["mock", "openai", "openrouter"];

const DEFAULT_MODELS: Record<EmbeddingsProviderName, string> = {
  mock: "mock-hash-v1",
  openai: "text-embedding-3-small",
  openrouter: "openai/text-embedding-3-small",
};

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function jobStatusColor(status: EmbeddingJobDto["status"]): string {
  switch (status) {
    case "completed":
      return "#15803d";
    case "failed":
      return "#b91c1c";
    case "running":
      return "#2563eb";
    default:
      return "#64748b";
  }
}

export function AiSearchSettingsPanel() {
  const [config, setConfig] = useState<AiRankingConfigDto | null>(null);
  const [coverage, setCoverage] = useState<EmbeddingCoverageDto | null>(null);
  const [jobs, setJobs] = useState<EmbeddingJobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = getSearchApiUrl();
      const headers = getAuthHeaders("none");
      const [configRes, coverageRes, jobsRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/admin/ai-search/config`, { cache: "no-store", headers }),
        fetch(`${baseUrl}/api/v1/admin/ai-search/embedding-coverage`, {
          cache: "no-store",
          headers,
        }),
        fetch(`${baseUrl}/api/v1/admin/ai-search/embedding-jobs`, { cache: "no-store", headers }),
      ]);

      if (!configRes.ok) {
        throw new Error(`Failed to load AI search config: HTTP ${configRes.status}`);
      }
      if (!coverageRes.ok) {
        throw new Error(`Failed to load embedding coverage: HTTP ${coverageRes.status}`);
      }
      if (!jobsRes.ok) {
        throw new Error(`Failed to load embedding jobs: HTTP ${jobsRes.status}`);
      }

      setConfig((await configRes.json()) as AiRankingConfigDto);
      setCoverage((await coverageRes.json()) as EmbeddingCoverageDto);
      const jobsPayload = (await jobsRes.json()) as { jobs: EmbeddingJobDto[] };
      setJobs(jobsPayload.jobs.slice(0, 5));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load AI search settings",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updateField = <K extends keyof AiRankingConfigDto>(
    field: K,
    value: AiRankingConfigDto[K],
  ) => {
    setConfig((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateWeight = (field: keyof AiRankingWeightsDto, value: number) => {
    setConfig((current) =>
      current
        ? {
            ...current,
            weights: { ...current.weights, [field]: value },
          }
        : current,
    );
  };

  const onProviderChange = (provider: EmbeddingsProviderName) => {
    if (!config) {
      return;
    }

    setConfig({
      ...config,
      embeddingsProvider: provider,
      embeddingsModel: DEFAULT_MODELS[provider],
    });
  };

  const saveConfig = async () => {
    if (!config) {
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const payload: UpdateAiRankingConfigRequestDto = {
      enabled: config.enabled,
      semanticRetrievalEnabled: config.semanticRetrievalEnabled,
      personalizationEnabled: config.personalizationEnabled,
      semanticZeroResultsFallbackEnabled: config.semanticZeroResultsFallbackEnabled,
      semanticFallbackMinHits: config.semanticFallbackMinHits,
      embeddingsProvider: config.embeddingsProvider,
      embeddingsModel: config.embeddingsModel,
      embeddingDimensions: config.embeddingDimensions,
      weights: config.weights,
      personalizationLookbackDays: config.personalizationLookbackDays,
      personalizationDecayHalfLifeDays: config.personalizationDecayHalfLifeDays,
      embeddingBatchSize: config.embeddingBatchSize,
      productEmbeddingsEnabled: config.productEmbeddingsEnabled,
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/ai-search/config`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Save AI search config failed with HTTP ${response.status}`);
      }

      setConfig((await response.json()) as AiRankingConfigDto);
      setFeedback("AI search settings saved. Hybrid ranking updates apply immediately.");
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save AI search settings",
      );
    } finally {
      setSaving(false);
    }
  };

  const triggerReindex = async () => {
    setReindexing(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/ai-search/embedding-jobs`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ jobType: "reindex" }),
      });

      if (!response.ok) {
        throw new Error(`Reindex request failed with HTTP ${response.status}`);
      }

      const job = (await response.json()) as EmbeddingJobDto;
      setFeedback(`Embedding reindex job queued (${job.id}).`);
      await loadData();
    } catch (reindexError) {
      setError(
        reindexError instanceof Error ? reindexError.message : "Failed to queue reindex job",
      );
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return (
      <section className="forge-card forge-card--panel">
        <p style={{ margin: 0, color: "var(--forge-text-muted)", fontSize: 14 }}>
          Loading AI search settings...
        </p>
      </section>
    );
  }

  if (!config) {
    return (
      <section className="forge-card forge-card--panel">
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
          {error ?? "Unable to load AI search settings."}
        </p>
      </section>
    );
  }

  return (
    <section className="forge-card forge-card--panel">
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <div>
          <strong style={{ fontSize: "0.875rem" }}>AI hybrid search</strong>
          <p
            style={{
              margin: "0.35rem 0 0",
              fontSize: "0.8125rem",
              color: "var(--forge-text-muted)",
            }}
          >
            Configure embeddings provider, hybrid ranking weights, personalization, and product
            vector coverage. API keys for OpenAI and OpenRouter stay in server environment
            variables.
          </p>
        </div>

        {coverage ? (
          <div
            className="forge-grid-metrics"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
          >
            <div className="forge-callout forge-callout--info" style={{ margin: 0 }}>
              <strong>Coverage</strong>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                {coverage.embeddedProducts.toLocaleString()} /{" "}
                {coverage.totalProducts.toLocaleString()} products
              </div>
              <div style={{ marginTop: 2, fontSize: 12, color: "var(--forge-text-muted)" }}>
                {formatPercent(coverage.coveragePercent)}
              </div>
            </div>
            <div className="forge-callout forge-callout--info" style={{ margin: 0 }}>
              <strong>Active model</strong>
              <div style={{ marginTop: 4, fontSize: 13 }}>{coverage.model}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: "var(--forge-text-muted)" }}>
                {coverage.provider}
              </div>
            </div>
            <div
              className={`forge-callout ${config.enabled ? "forge-callout--info" : "forge-callout--dashed"}`}
              style={{ margin: 0 }}
            >
              <strong>Hybrid search</strong>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                {config.enabled ? "Enabled" : "Disabled"}
              </div>
            </div>
          </div>
        ) : null}

        {config.updatedAt ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--forge-text-muted)" }}>
            Last saved {new Date(config.updatedAt).toLocaleString()}
          </p>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Embeddings provider
            <select
              value={config.embeddingsProvider}
              onChange={(event) =>
                onProviderChange(event.target.value as EmbeddingsProviderName)
              }
              style={inputStyle}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Embeddings model
            <input
              value={config.embeddingsModel}
              onChange={(event) => updateField("embeddingsModel", event.target.value)}
              style={inputStyle}
              placeholder={DEFAULT_MODELS[config.embeddingsProvider]}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Embedding dimensions
            <input
              type="number"
              min={8}
              max={4096}
              value={config.embeddingDimensions}
              onChange={(event) =>
                updateField("embeddingDimensions", Number(event.target.value))
              }
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Embedding batch size
            <input
              type="number"
              min={1}
              max={256}
              value={config.embeddingBatchSize}
              onChange={(event) =>
                updateField("embeddingBatchSize", Number(event.target.value))
              }
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Semantic fallback min hits
            <input
              type="number"
              min={0}
              max={100}
              value={config.semanticFallbackMinHits}
              onChange={(event) =>
                updateField("semanticFallbackMinHits", Number(event.target.value))
              }
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Personalization lookback (days)
            <input
              type="number"
              min={1}
              max={365}
              value={config.personalizationLookbackDays}
              onChange={(event) =>
                updateField("personalizationLookbackDays", Number(event.target.value))
              }
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Personalization decay half-life (days)
            <input
              type="number"
              min={1}
              max={180}
              value={config.personalizationDecayHalfLifeDays}
              onChange={(event) =>
                updateField("personalizationDecayHalfLifeDays", Number(event.target.value))
              }
              style={inputStyle}
            />
          </label>
        </div>

        <fieldset
          style={{
            margin: 0,
            padding: "0.65rem 0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
          }}
        >
          <legend style={{ fontSize: 13, padding: "0 0.25rem" }}>Ranking weights</legend>
          <p style={{ margin: "0 0 0.5rem", fontSize: 12, color: "#64748b" }}>
            Weights are normalized on save. Adjust lexical, semantic, and personalization
            contributions to hybrid ranking.
          </p>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Lexical weight
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={config.weights.lexicalWeight}
                onChange={(event) =>
                  updateWeight("lexicalWeight", Number(event.target.value))
                }
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Semantic weight
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={config.weights.semanticWeight}
                onChange={(event) =>
                  updateWeight("semanticWeight", Number(event.target.value))
                }
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Personalization weight
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={config.weights.personalizationWeight}
                onChange={(event) =>
                  updateWeight("personalizationWeight", Number(event.target.value))
                }
                style={inputStyle}
              />
            </label>
          </div>
        </fieldset>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => updateField("enabled", event.target.checked)}
            />
            Hybrid search enabled
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={config.semanticRetrievalEnabled}
              onChange={(event) =>
                updateField("semanticRetrievalEnabled", event.target.checked)
              }
            />
            Semantic retrieval enabled
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={config.personalizationEnabled}
              onChange={(event) =>
                updateField("personalizationEnabled", event.target.checked)
              }
            />
            Personalization enabled
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={config.semanticZeroResultsFallbackEnabled}
              onChange={(event) =>
                updateField("semanticZeroResultsFallbackEnabled", event.target.checked)
              }
            />
            Semantic zero-results fallback
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={config.productEmbeddingsEnabled}
              onChange={(event) =>
                updateField("productEmbeddingsEnabled", event.target.checked)
              }
            />
            Product embeddings enabled
          </label>
        </div>

        {jobs.length > 0 ? (
          <div>
            <strong style={{ fontSize: 13 }}>Recent embedding jobs</strong>
            <ul
              style={{
                listStyle: "none",
                margin: "0.5rem 0 0",
                padding: 0,
                display: "grid",
                gap: "0.35rem",
              }}
            >
              {jobs.map((job) => (
                <li
                  key={job.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    fontSize: 12,
                    color: "var(--forge-text-muted)",
                  }}
                >
                  <span>
                    {job.jobType} · {job.processedProducts}/{job.totalProducts} products
                  </span>
                  <span style={{ color: jobStatusColor(job.status), fontWeight: 600 }}>
                    {job.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {feedback ? (
          <p style={{ margin: 0, color: "#15803d", fontSize: 13 }}>{feedback}</p>
        ) : null}
        {error ? (
          <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p>
        ) : null}

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void saveConfig()}
            disabled={saving}
            style={{
              padding: "0.55rem 0.9rem",
              border: "none",
              borderRadius: 6,
              background: "var(--forge-primary)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {saving ? "Saving..." : "Save AI search settings"}
          </button>
          <button
            type="button"
            onClick={() => void triggerReindex()}
            disabled={reindexing}
            style={{
              padding: "0.55rem 0.9rem",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {reindexing ? "Queueing..." : "Reindex embeddings"}
          </button>
        </div>
      </div>
    </section>
  );
}

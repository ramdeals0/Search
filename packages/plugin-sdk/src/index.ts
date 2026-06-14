import type { SearchRequestDto, SearchResponseDto } from "@retailer-search/shared-types";

export type PluginHookName = "preSearch" | "postRank";

export interface PluginContext {
  tenantId: string;
  catalogId?: string;
  sessionId?: string;
}

export interface PreSearchHookInput {
  context: PluginContext;
  request: SearchRequestDto;
}

export interface PreSearchHookResult {
  request: SearchRequestDto;
}

export interface PostRankHookInput {
  context: PluginContext;
  request: SearchRequestDto;
  response: SearchResponseDto;
}

export interface PostRankHookResult {
  response: SearchResponseDto;
}

export type PreSearchHook = (
  input: PreSearchHookInput,
) => PreSearchHookResult | Promise<PreSearchHookResult>;

export type PostRankHook = (
  input: PostRankHookInput,
) => PostRankHookResult | Promise<PostRankHookResult>;

export interface SearchPlugin {
  id: string;
  name: string;
  version: string;
  enabled?: boolean;
  hooks?: Partial<{
    preSearch: PreSearchHook;
    postRank: PostRankHook;
  }>;
}

export interface PluginDescriptor {
  id: string;
  name: string;
  version: string;
  hooks: PluginHookName[];
  enabled: boolean;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, SearchPlugin>();

  register(plugin: SearchPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(pluginId: string): boolean {
    return this.plugins.delete(pluginId);
  }

  setEnabled(pluginId: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }
    plugin.enabled = enabled;
    return true;
  }

  list(): PluginDescriptor[] {
    return [...this.plugins.values()].map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      hooks: Object.keys(plugin.hooks ?? {}) as PluginHookName[],
      enabled: plugin.enabled !== false,
    }));
  }

  async runPreSearch(
    input: PreSearchHookInput,
  ): Promise<SearchRequestDto> {
    let request = input.request;
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled === false || !plugin.hooks?.preSearch) {
        continue;
      }
      const result = await plugin.hooks.preSearch({ ...input, request });
      request = result.request;
    }
    return request;
  }

  async runPostRank(
    input: PostRankHookInput,
  ): Promise<SearchResponseDto> {
    let response = input.response;
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled === false || !plugin.hooks?.postRank) {
        continue;
      }
      const result = await plugin.hooks.postRank({ ...input, response });
      response = result.response;
    }
    return response;
  }
}

export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}

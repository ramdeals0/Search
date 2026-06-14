import { createPluginRegistry, type SearchPlugin } from "@retailer-search/plugin-sdk";
import type { PluginDescriptorDto } from "@retailer-search/shared-types";

const registry = createPluginRegistry();

const demoQueryBoostPlugin: SearchPlugin = {
  id: "demo-query-boost",
  name: "Demo query boost",
  version: "1.0.0",
  enabled: true,
  hooks: {
    preSearch({ request }) {
      const trimmed = request.query.trim();
      if (!trimmed) {
        return { request };
      }
      return {
        request: {
          ...request,
          query: trimmed.replace(/\s+/g, " "),
        },
      };
    },
  },
};

registry.register(demoQueryBoostPlugin);

export function getPluginRegistry() {
  return registry;
}

export function listPluginDescriptors(): PluginDescriptorDto[] {
  return registry.list();
}

export function setPluginEnabled(pluginId: string, enabled: boolean): boolean {
  return registry.setEnabled(pluginId, enabled);
}

export function registerSearchPlugin(plugin: SearchPlugin): void {
  registry.register(plugin);
}

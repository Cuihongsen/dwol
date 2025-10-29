import { createConfiguredExploreModule } from './configuredModuleFactory.js';
import { exploreModuleConfigs } from './moduleConfigs.js';

function deriveTitle(config = {}) {
  if (config.title && typeof config.title === 'string') {
    const trimmed = config.title.trim();
    if (trimmed.length) return trimmed;
  }
  const mapLabel = config.map && typeof config.map === 'object' ? config.map.label : null;
  if (typeof mapLabel === 'string' && mapLabel.trim().length) {
    return mapLabel.trim();
  }
  return config.moduleId || '';
}

function deriveEnabledKey(config = {}) {
  const storage = config.storage && typeof config.storage === 'object' ? config.storage : null;
  if (storage && typeof storage.enabledKey === 'string') {
    const trimmed = storage.enabledKey.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }
  const moduleId = config.moduleId || '';
  return moduleId ? `${moduleId}_enabled_v1` : '';
}

export function buildConfiguredExploreModules(configs = exploreModuleConfigs) {
  if (!Array.isArray(configs)) {
    return [];
  }
  return configs
    .map((config) => {
      if (!config || typeof config !== 'object' || !config.moduleId) {
        return null;
      }
      const module = createConfiguredExploreModule(config);
      const title = deriveTitle(config);
      const enabledKey = deriveEnabledKey(config);
      if (!title || !enabledKey) {
        return null;
      }
      return {
        moduleId: config.moduleId,
        title,
        enabledKey,
        module,
        config,
      };
    })
    .filter(Boolean);
}

export const configuredExploreModules = buildConfiguredExploreModules();

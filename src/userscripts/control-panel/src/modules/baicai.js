import { createMapModule } from './explore/mapModuleFactory.js';

const module = createMapModule({
  moduleId: 'bc',
  storageKeys: {
    enabled: 'bc_enabled_v1',
    stats: 'bc_stats_v1',
  },
  ui: {
    prefix: 'bc',
  },
  telemetryTag: 'BAICAI',
  navigation: {
    storageKey: 'bc_nav_state_v1',
    normalizeLabel: (label = '', text = '') => {
      const normalized = label || text || '';
      return normalized.includes('菜畦') ? '菜畦' : normalized;
    },
    classifyAnchor: ({ text = '', normalizedLabel, direction, href }) => {
      if (text.includes('攻击偷菜盗贼')) {
        return { group: 'attack', key: `attack:${href || normalizedLabel}` };
      }
      if (!text.includes('攻击') && text.includes('偷菜盗贼')) {
        return { group: 'attack', key: `attack:${href || normalizedLabel}` };
      }
      if (text.includes('攻击偷菜盗贼首领')) {
        return { group: 'attack', key: `boss:${href || normalizedLabel}` };
      }
      if (!text.includes('攻击') && text.includes('偷菜盗贼首领')) {
        return { group: 'attack', key: `boss:${href || normalizedLabel}` };
      }
      if (text.includes('灵芝')) {
        return { group: 'gather', key: `loot:${href || normalizedLabel}` };
      }
      if (text.includes('白菜')) {
        return { group: 'gather', key: `loot:${href || normalizedLabel}` };
      }
      if (normalizedLabel === '菜畦') {
        const key = direction ? `dir:${direction}` : `move:${href || normalizedLabel}`;
        return { group: 'movement', key };
      }
      if (text.includes('返回游戏')) {
        return { group: 'misc', key: `return:${href || normalizedLabel}` };
      }
      return null;
    },
  },
  locationHintKeywords: ['菜畦'],
  buildTargetingRules: (helpers) => [
    helpers.byExact('攻击偷菜盗贼'),
    helpers.byExact('攻击偷菜盗贼首领'),
    helpers.byExact('偷菜盗贼首领'),
    helpers.byExact('偷菜盗贼'),
    helpers.byContextFirst('gather'),
    helpers.byIncludes('灵芝', { label: '灵芝' }),
    helpers.byIncludes('白菜', { label: '白菜' }),
    helpers.byContextFind('misc', (item) => item.label && item.label.includes('返回')),
    helpers.byExact('返回游戏'),
    helpers.navigationFallback(),
  ],
});

export const init = module.init;
export const pause = module.pause;
export const resume = module.resume;

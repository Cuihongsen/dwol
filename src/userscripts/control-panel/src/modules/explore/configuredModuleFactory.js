import { createMapModule } from './mapModuleFactory.js';

function ensureNonEmptyArray(values, label) {
  if (!Array.isArray(values) || !values.length) {
    throw new Error(`createConfiguredExploreModule requires ${label}`);
  }
  return values.filter((value) => typeof value === 'string' && value.trim().length);
}

function buildNormalizedLabel(mapKeywords, fallbackLabel) {
  return (label = '', text = '') => {
    const candidates = [label, text];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (mapKeywords.some((keyword) => candidate.includes(keyword))) {
        return fallbackLabel;
      }
    }
    return label || text || '';
  };
}

function includesAny(text = '', keywords = []) {
  return keywords.some((keyword) => text.includes(keyword));
}

function classifyAnchorFactory({
  mapLabel,
  mapKeywords,
  monsters,
  gatherKeywords,
}) {
  return ({ text = '', normalizedLabel, direction, href }) => {
    const normalized = normalizedLabel || text || '';

    if (text.includes('返回游戏')) {
      return { group: 'misc', key: `return:${href || normalized}`, label: '返回游戏' };
    }

    for (const monster of monsters) {
      if (!monster) continue;
      if (includesAny(text, [monster])) {
        const attackLabel = text.includes('攻击') ? `攻击${monster}` : monster;
        const key = `attack:${monster}:${href || normalized}`;
        return { group: 'attack', key, label: attackLabel };
      }
    }

    for (const keyword of gatherKeywords) {
      if (!keyword) continue;
      if (includesAny(text, [keyword])) {
        const key = `gather:${keyword}:${href || normalized}`;
        return { group: 'gather', key, label: keyword };
      }
    }

    if (normalized === mapLabel || includesAny(normalized, mapKeywords) || includesAny(text, mapKeywords)) {
      const key = direction ? `dir:${direction}` : `move:${href || normalized}`;
      return { group: 'movement', key, label: mapLabel };
    }

    return null;
  };
}

function buildTargetingRulesFactory({ monsters, gatherKeywords }) {
  return (helpers) => {
    const attackRules = [];
    for (const monster of monsters) {
      if (!monster) continue;
      attackRules.push(
        helpers.byContextFind('attack', (item) => item.label === `攻击${monster}`, {
          label: `攻击${monster}`,
        })
      );
      attackRules.push(
        helpers.byContextFind('attack', (item) => item.label === monster, {
          label: monster,
        })
      );
    }

    const gatherRules = [helpers.byContextFirst('gather')];
    for (const keyword of gatherKeywords) {
      gatherRules.push(
        helpers.byContextFind('gather', (item) => item.label && item.label.includes(keyword), {
          label: keyword,
        })
      );
    }

    return [
      ...attackRules,
      ...gatherRules,
      helpers.byContextFind('misc', (item) => item.label && item.label.includes('返回'), {
        label: '返回游戏',
      }),
      helpers.byExact('返回游戏'),
      helpers.navigationFallback(),
    ];
  };
}

export function createConfiguredExploreModule(config = {}) {
  const { moduleId, map, monsters = [], medicines = [], storage = {}, telemetryTag, ui = {} } = config;

  if (!moduleId) {
    throw new Error('createConfiguredExploreModule requires moduleId');
  }

  if (!map || typeof map !== 'object') {
    throw new Error('createConfiguredExploreModule requires map configuration');
  }

  const mapKeywords = ensureNonEmptyArray(map.keywords, 'map.keywords');
  const mapLabel = typeof map.label === 'string' && map.label.trim().length ? map.label.trim() : mapKeywords[0];

  const monsterList = monsters.filter((monster) => typeof monster === 'string' && monster.trim().length);
  const gatherKeywords = medicines.filter((keyword) => typeof keyword === 'string' && keyword.trim().length);

  if (!monsterList.length) {
    throw new Error('createConfiguredExploreModule requires at least one monster');
  }

  const storageKeys = {
    enabled: storage.enabledKey || `${moduleId}_enabled_v1`,
    stats: storage.statsKey || `${moduleId}_stats_v1`,
  };

  if (Array.isArray(storage.legacyKeys) && storage.legacyKeys.length) {
    storageKeys.legacy = storage.legacyKeys;
  }

  return createMapModule({
    moduleId,
    storageKeys,
    ui: { prefix: ui.prefix || moduleId },
    telemetryTag: telemetryTag || moduleId.toUpperCase(),
    navigation: {
      storageKey: storage.navigationKey || `${moduleId}_nav_state_v1`,
      normalizeLabel: buildNormalizedLabel(mapKeywords, mapLabel),
      classifyAnchor: classifyAnchorFactory({
        mapLabel,
        mapKeywords,
        monsters: monsterList,
        gatherKeywords,
      }),
    },
    locationHintKeywords: mapKeywords,
    buildTargetingRules: buildTargetingRulesFactory({
      monsters: monsterList,
      gatherKeywords,
    }),
  });
}


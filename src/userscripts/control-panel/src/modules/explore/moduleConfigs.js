export const exploreModuleConfigs = [
  {
    moduleId: 'jyg',
    title: '景阳岗',
    map: {
      keywords: ['景阳岗', '树林'],
      label: '树林',
    },
    monsters: ['景阳岗小大虫', '景阳岗大虫'],
    medicines: ['灵芝'],
    storage: {
      enabledKey: 'jyg_enabled_v1',
      statsKey: 'jyg_stats_v3',
      legacyKeys: ['jyg_stats_v2'],
    },
  },
  {
    moduleId: 'bc',
    title: '刷白菜',
    map: {
      keywords: ['菜畦'],
      label: '菜畦',
    },
    monsters: ['偷菜盗贼首领', '偷菜盗贼'],
    medicines: ['灵芝', '白菜'],
    storage: {
      enabledKey: 'bc_enabled_v1',
      statsKey: 'bc_stats_v1',
    },
  },
];

export const exploreModuleConfigMap = exploreModuleConfigs.reduce((acc, config) => {
  if (config && config.moduleId) {
    acc[config.moduleId] = config;
  }
  return acc;
}, {});


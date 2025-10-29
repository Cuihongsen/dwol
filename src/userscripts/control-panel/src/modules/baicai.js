import { createConfiguredExploreModule } from './explore/configuredModuleFactory.js';
import { exploreModuleConfigs } from './explore/moduleConfigs.js';

const module = createConfiguredExploreModule(exploreModuleConfigs.bc);

export const init = module.init;
export const pause = module.pause;
export const resume = module.resume;

export const MODULE_STATE_EVENT = 'um:module-state';

export function emitModuleState(detail) {
  window.dispatchEvent(new CustomEvent(MODULE_STATE_EVENT, { detail }));
}

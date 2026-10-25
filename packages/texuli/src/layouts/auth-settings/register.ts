import type { LayoutId } from '../host/contract.ts';
import { registerLayout, unregisterLayout } from '../host/registry.ts';

const AUTH_SETTINGS_LAYOUTS = ['auth-split', 'wizard'] as const satisfies readonly LayoutId[];

const loadAuthSplit = () => import('./AuthSplitHostLayout.svelte');
const loadWizard = () => import('./WizardHostLayout.svelte');

/**
 * Registers lazy auth-split and wizard entries on the layout host registry.
 * Safe to call more than once (last registration wins). Stable loader
 * identities keep the loadLayout cache across re-registers.
 */
export function registerAuthSettingsLayouts(): void {
  registerLayout('auth-split', { load: loadAuthSplit, owner: 'auth-settings' });
  registerLayout('wizard', { load: loadWizard, owner: 'auth-settings' });
}

/** Removes the auth-settings host entries (tests). */
export function unregisterAuthSettingsLayouts(): void {
  for (const id of AUTH_SETTINGS_LAYOUTS) unregisterLayout(id);
}

export { AUTH_SETTINGS_LAYOUTS };

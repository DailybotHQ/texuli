/**
 * Authentication, onboarding wizard and settings layouts
 * (`texuli/layouts/auth-settings`). Each layout is its own lazy chunk when
 * loaded through `registerAuthSettingsLayouts` / LayoutHost.
 */

export { default as AuthSplitHostLayout } from './AuthSplitHostLayout.svelte';
export { default as AuthSplitLayout } from './AuthSplitLayout.svelte';
export {
  AUTH_SETTINGS_LAYOUTS,
  registerAuthSettingsLayouts,
  unregisterAuthSettingsLayouts,
} from './register.ts';
export { default as SettingsLayout } from './SettingsLayout.svelte';
export type { SettingsNavItem } from './types.ts';
export { default as WizardHostLayout } from './WizardHostLayout.svelte';
export { default as WizardLayout } from './WizardLayout.svelte';

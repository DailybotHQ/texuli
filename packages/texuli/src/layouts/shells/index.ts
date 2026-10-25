/**
 * `texuli/layouts/shells`: generic app shells (app frame, command bar slot,
 * notification center slot). Device and browser frames are not part of
 * Texuli; a prototyping tool draws them around these shells.
 */
export { default as AppShell } from './AppShell.svelte';
export {
  type AppShellContext,
  getAppShellContext,
  isInDrawer,
  markInDrawer,
  setAppShellContext,
} from './context.ts';
export { default as DrawerScope } from './DrawerScope.svelte';

import { getContext, setContext } from 'svelte';

/** What an enclosing AppShell offers its header (menu button) and sidebar (drawer behavior). */
export interface AppShellContext {
  readonly sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

const SHELL_KEY = Symbol('texuli.app-shell');
const DRAWER_KEY = Symbol('texuli.app-shell.drawer');

export function setAppShellContext(context: AppShellContext): void {
  setContext(SHELL_KEY, context);
}

/** The enclosing AppShell, or `undefined` outside one (a header can then hide its menu button). */
export function getAppShellContext(): AppShellContext | undefined {
  return getContext<AppShellContext | undefined>(SHELL_KEY);
}

/** Marks the subtree as rendered inside the narrow-screen drawer. */
export function markInDrawer(): void {
  setContext(DRAWER_KEY, true);
}

/** Whether this component renders inside the drawer copy of the sidebar. */
export function isInDrawer(): boolean {
  return getContext<boolean | undefined>(DRAWER_KEY) === true;
}

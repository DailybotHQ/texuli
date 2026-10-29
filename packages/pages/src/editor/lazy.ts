/**
 * The slash menu (the combobox primitive and its overlay) loads the first
 * time a menu opens, so a page that is only read or typed into never pays
 * for it.
 */
import type { Component } from 'svelte';
import type { PagesSlashRequest } from './state.svelte.ts';

type SlashMenuComponent = Component<{ request: PagesSlashRequest }>;

let pending: Promise<SlashMenuComponent> | null = null;

export function loadSlashMenu(): Promise<SlashMenuComponent> {
  pending ??= import('./SlashMenu.svelte').then(
    (module) => module.default,
    (error: unknown) => {
      pending = null;
      throw error;
    }
  );
  return pending;
}

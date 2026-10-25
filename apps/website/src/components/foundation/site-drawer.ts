/**
 * Lazy entry for the phone navigation drawer: imported by the menu button on
 * its first press, so pages that never open it load no drawer code.
 */
import { mount } from 'svelte';
import SiteDrawer from './SiteDrawer.svelte';

export interface SiteDrawerHandle {
  show(): void;
}

export function createSiteDrawer(opener: HTMLButtonElement): SiteDrawerHandle {
  const target = document.createElement('div');
  target.dataset.siteDrawerRoot = '';
  document.body.append(target);
  return mount(SiteDrawer, {
    target,
    props: { opener },
  }) as unknown as SiteDrawerHandle;
}

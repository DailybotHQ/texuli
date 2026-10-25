/**
 * Light registration entry for marketing layout (`texuli/layouts/marketing/register`).
 * Dynamic import only — no static MarketingLayout / Landing / Pricing.
 */
import type { LayoutId } from '../host/contract.ts';
import { registerLayout, unregisterLayout } from '../host/registry.ts';

const MARKETING_LAYOUT_IDS = ['marketing'] as const satisfies readonly LayoutId[];

const loadMarketing = () => import('./MarketingLayout.svelte');

/** Registers marketing on the layout host. Safe to call again. */
export function registerMarketingLayouts(): void {
  registerLayout('marketing', { load: loadMarketing, owner: 'marketing' });
}

/** Removes the marketing host entry (tests). */
export function unregisterMarketingLayouts(): void {
  for (const id of MARKETING_LAYOUT_IDS) unregisterLayout(id);
}

export { loadMarketing, MARKETING_LAYOUT_IDS };

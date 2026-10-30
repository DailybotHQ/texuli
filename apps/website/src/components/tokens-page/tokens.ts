/**
 * The /tokens/ and /tokens/components/ page model (PLAN_011 T-site-090):
 * the token contract v2 reference (ADR-020), read at build time from the
 * registries the components themselves read (`@texuli/tokens/system`,
 * `@texuli/tokens/components`, the hooks in `@texuli/tokens/contract` and
 * the defaults vocabulary in `texuli/defaults`). Nothing is copied by hand,
 * so the pages cannot drift from the packages; `tests/e2e/site-tokens.spec.ts`
 * compares the rendered rows with the registry counts.
 */

import {
  COMPONENT_TOKEN_FAMILIES,
  COMPONENT_TOKENS,
  componentVar,
} from '@texuli/tokens/components';
import {
  BUTTON_HOOK_VALUES,
  CARD_HOOK_VALUES,
  FOCUS_RING_HOOK_VALUES,
  INPUT_HOOK_VALUES,
} from '@texuli/tokens/contract';
import {
  BASE_SYSTEM_TOKENS,
  SYSTEM_TOKEN_FAMILIES,
  SYSTEM_TOKENS,
  TOKEN_SCOPE_SELECTOR,
} from '@texuli/tokens/system';
import { DESIGN_DEFAULTS_VOCABULARY } from 'texuli/defaults';
import { COMPONENT_PAGES } from '../component-pages/load-manifests.ts';

export { COMPONENT_TOKEN_FAMILIES, SYSTEM_TOKEN_FAMILIES, TOKEN_SCOPE_SELECTOR };

export const TOKENS_PATH = '/tokens/';
export const COMPONENT_TOKENS_PATH = '/tokens/components/';

/** The counts both pages state and their spec compares with the registry. */
export const TOKEN_COUNTS = {
  systemFamilies: SYSTEM_TOKEN_FAMILIES.length,
  system: SYSTEM_TOKENS.length,
  base: BASE_SYSTEM_TOKENS.length,
  theme: SYSTEM_TOKENS.length - BASE_SYSTEM_TOKENS.length,
  components: COMPONENT_TOKEN_FAMILIES.length,
  component: COMPONENT_TOKENS.length,
  defaults: Object.keys(DESIGN_DEFAULTS_VOCABULARY).length,
} as const;

/** The anchor of one system family on /tokens/. */
export const familyAnchor = (id: string) => `family-${id}`;

/** The anchor of one component on /tokens/components/. */
export const componentAnchor = (id: string) => `component-${id}`;

/** One worked read, from the same helper component CSS uses. */
export const EXAMPLE_READ = componentVar('button', 'radius');

const PAGE_IDS = new Set(COMPONENT_PAGES.map((entry) => entry.id));

/** The component page for a token family, when the site has one. */
export function componentPageFor(component: string): string | undefined {
  return PAGE_IDS.has(component) ? `/component-pages/${component}/` : undefined;
}

/** `texuli` + `alert` → `texuli/alert`; `@texuli/chat` + `.` → `@texuli/chat`. */
export function exportOf(family: { package: string; subpath: string }): string {
  return family.subpath === '.' ? family.package : `${family.package}/${family.subpath}`;
}

/** The component families grouped by package, in registry order. */
export function familiesByPackage(): { name: string; families: typeof COMPONENT_TOKEN_FAMILIES }[] {
  const groups = new Map<string, (typeof COMPONENT_TOKEN_FAMILIES)[number][]>();
  for (const family of COMPONENT_TOKEN_FAMILIES) {
    const list = groups.get(family.package) ?? [];
    list.push(family);
    groups.set(family.package, list);
  }
  return [...groups].map(([name, families]) => ({ name, families }));
}

/** The tier-3 hooks: attribute, values and what they set. */
export const HOOKS = [
  {
    attribute: 'data-tx-button-style',
    values: BUTTON_HOOK_VALUES,
    effect: '--tx-button-radius',
  },
  {
    attribute: 'data-tx-card-style',
    values: CARD_HOOK_VALUES,
    effect: '--tx-card-elevation and --tx-card-background',
  },
  {
    attribute: 'data-tx-input-style',
    values: INPUT_HOOK_VALUES,
    effect: '--tx-input-height and --tx-input-padding-inline',
  },
  {
    attribute: 'data-tx-focus-ring-style',
    values: FOCUS_RING_HOOK_VALUES,
    effect: '--tx-focus-ring-offset on the focused element',
  },
] as const;

/** The defaults vocabulary as rows: component, variants, sizes. */
export const DEFAULTS_ROWS = Object.entries(DESIGN_DEFAULTS_VOCABULARY).map(
  ([component, props]) => {
    const record = props as { variant?: readonly string[]; size?: readonly string[] };
    return { component, variant: record.variant ?? [], size: record.size ?? [] };
  }
);

export const SCOPE_EXAMPLE = `[data-tx-scope="acme"] {
  --tx-button-radius: 9999px;
  --tx-card-padding-inline: 1.5rem;
  --tx-dialog-z-index: 80;
}`;

export const DEFAULTS_EXAMPLE = `<script lang="ts">
  import { setDesignDefaults } from 'texuli/defaults';

  setDesignDefaults({ button: { variant: 'outline', size: 'sm' }, card: { variant: 'flat' } });
</script>`;

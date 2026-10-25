/**
 * Resolve static evidence for a catalog component id.
 */
import type { CatalogManifest } from '@texuli/catalog';
import { behaviorCheckCount, guessBehaviorScenario } from './behavior-map.ts';
import { resolveGzipBudget } from './budgets.ts';
import { type ComponentEvidence, DEFAULT_BROWSER_PROJECTS, EVIDENCE_AS_OF } from './types.ts';

/** Known measured gzip (bytes) from docs/quality/perf-primitives.md (2026-10-23). */
const MEASURED_GZIP: Record<string, number> = {
  '@texuli/primitives/dialog': 11589,
  '@texuli/primitives/tooltip': 11533,
  '@texuli/primitives/menu': 15868,
  '@texuli/primitives/popover': 14800,
  '@texuli/primitives/hover-card': 7685,
  '@texuli/primitives/select': 13764,
  '@texuli/primitives/navigation-menu': 8510,
  '@texuli/primitives/combobox': 13246,
  '@texuli/primitives/toast': 6175,
};

/** Axe suites documented under docs/quality and tests/e2e. */
const AXE_SUITES_DEFAULT = [
  'tests/e2e/site-component-pages.spec.ts',
  'docs/quality (a11y-*)',
] as const;

const PRIMITIVE_IDS = new Set([
  'dialog',
  'alert-dialog',
  'tooltip',
  'popover',
  'hover-card',
  'menu',
  'menubar',
  'dropdown-menu',
  'context-menu',
  'select',
  'combobox',
  'checkbox',
  'switch',
  'radio',
  'radio-group',
  'label',
  'sheet',
  'drawer',
  'toast',
  'toaster',
  'accordion',
  'collapsible',
  'avatar',
  'calendar',
  'date-picker',
  'date-field',
  'command',
  'command-palette',
  'listbox',
  'navigation-menu',
  'color-picker',
  'file-drop',
]);

/**
 * Map a catalog component to its primary `pnpm size` entry id.
 */
export function sizeEntryForComponent(id: string, pkg: string): string {
  const asPrimitive =
    pkg === '@texuli/primitives' || pkg.includes('primitives') || PRIMITIVE_IDS.has(id);

  if (asPrimitive) {
    const base = id
      .replace(/-trigger$/, '')
      .replace(/-content$/, '')
      .replace(/-item$/, '')
      .replace(/-portal$/, '')
      .replace(/-viewport$/, '')
      .replace(/-value$/, '')
      .replace(/-group$/, '')
      .replace(/-label$/, '')
      .replace(/-separator$/, '');
    if (base === 'toaster') return '@texuli/primitives/toast';
    if (base === 'command-palette') return '@texuli/primitives/command';
    return `@texuli/primitives/${base}`;
  }
  if (pkg === 'texuli' || pkg.startsWith('texuli')) {
    return `texuli/${id}`;
  }
  if (pkg.startsWith('@texuli/')) {
    return `${pkg}/${id}`;
  }
  return `${pkg}/${id}`;
}

/**
 * Build evidence for one component from package + id (manifest fields).
 */
export function evidenceForComponent(id: string, pkg: string): ComponentEvidence {
  const scenario = guessBehaviorScenario(id);
  const sizeEntry = sizeEntryForComponent(id, pkg);
  const gzipBudget = resolveGzipBudget(sizeEntry);
  const gzipMeasured = MEASURED_GZIP[sizeEntry];

  const behavior = scenario
    ? {
        scenario,
        status: 'checked' as const,
        checks: behaviorCheckCount(scenario),
        note: `Rows in tests/behavior/scenarios/${scenario}.spec.ts, held to the WAI-ARIA APG pattern, run on Chromium, WebKit and the Pixel 7.`,
      }
    : {
        status: 'n/a' as const,
        note: 'No dedicated behavior scenario for this catalog id (a styled or display surface, covered by its unit and axe tests).',
      };

  return {
    id,
    behavior,
    size: {
      entry: sizeEntry,
      ...(gzipBudget !== undefined ? { gzipBudget } : {}),
      ...(gzipMeasured !== undefined ? { gzipMeasured } : {}),
      note:
        gzipMeasured !== undefined
          ? 'Measured gzip from docs/quality/perf-primitives.md (2026-10-23).'
          : 'Budget from texuli.budgets.json; re-measure with `pnpm size --filter <entry>`.',
    },
    axe: {
      status: 'documented',
      suites: [...AXE_SUITES_DEFAULT],
      note: 'Site component pages axe gate; package-level a11y docs under docs/quality when present.',
    },
    browsers: {
      projects: [...DEFAULT_BROWSER_PROJECTS],
      note: 'Playwright projects: Desktop Chrome, Desktop Safari, Pixel 7. Firefox is a known gap on this host.',
    },
    asOf: EVIDENCE_AS_OF,
  };
}

export function evidenceFromManifest(
  manifest: Pick<CatalogManifest, 'id' | 'package'>
): ComponentEvidence {
  return evidenceForComponent(manifest.id, manifest.package);
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes >= 10_240 ? 1 : 2)} KiB`;
}

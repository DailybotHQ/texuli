/**
 * Build-time catalog of component manifests for static component pages.
 * Imports the catalog's public manifest subpaths.
 */
import type { CatalogExample, CatalogManifest, CatalogPropSchema } from '@texuli/catalog';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { DISPLAY_MANIFESTS } from '@texuli/catalog/manifests/display';
import { FORMS_MANIFESTS } from '@texuli/catalog/manifests/forms';
import { LAYOUTS_MANIFESTS } from '@texuli/catalog/manifests/layouts';
import { OVERLAYS_MANIFESTS } from '@texuli/catalog/manifests/overlays';

export type { CatalogExample, CatalogManifest, CatalogPropSchema };

export type ComponentPageEntry = CatalogManifest & {
  /** Manifest group folder name. */
  group: string;
};

/**
 * The manifest groups that have a `/component-pages/<id>/` page (and so a
 * Markdown twin). The other catalog groups (canvas, chat, data, sheets …)
 * are documented for agents by `/llms/components/<id>.md` and their family
 * pages; `scripts/check-llms-parity.ts` names them and fails on any group
 * that is in neither list.
 */
export const COMPONENT_PAGE_GROUPS = [
  'content',
  'display',
  'forms',
  'layouts',
  'overlays',
] as const;

const GROUPS: {
  name: (typeof COMPONENT_PAGE_GROUPS)[number];
  manifests: readonly CatalogManifest[];
}[] = [
  { name: 'content', manifests: CONTENT_MANIFESTS },
  { name: 'display', manifests: DISPLAY_MANIFESTS },
  { name: 'forms', manifests: FORMS_MANIFESTS },
  { name: 'layouts', manifests: LAYOUTS_MANIFESTS },
  { name: 'overlays', manifests: OVERLAYS_MANIFESTS },
];

function loadAll(): readonly ComponentPageEntry[] {
  const byId = new Map<string, ComponentPageEntry>();
  for (const group of GROUPS) {
    for (const manifest of group.manifests) {
      if (byId.has(manifest.id)) continue;
      byId.set(manifest.id, { ...manifest, group: group.name });
    }
  }
  return Object.freeze([...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')));
}

/** Closed list of every catalog component page, sorted by id. */
export const COMPONENT_PAGES: readonly ComponentPageEntry[] = loadAll();

export function getComponentPage(id: string): ComponentPageEntry | undefined {
  return COMPONENT_PAGES.find((entry) => entry.id === id);
}

export function componentPagePath(id: string): string {
  return `/component-pages/${id}/`;
}

/** Adjacent pages for pager (wrap not applied). */
export function componentPager(id: string): {
  prev?: ComponentPageEntry;
  next?: ComponentPageEntry;
} {
  const index = COMPONENT_PAGES.findIndex((entry) => entry.id === id);
  if (index < 0) return {};
  return {
    prev: index > 0 ? COMPONENT_PAGES[index - 1] : undefined,
    next: index < COMPONENT_PAGES.length - 1 ? COMPONENT_PAGES[index + 1] : undefined,
  };
}

/** Pretty JSON for code samples (plain text only). */
export function formatExampleProps(props: Readonly<Record<string, unknown>>): string {
  try {
    return JSON.stringify(props, null, 2);
  } catch {
    return '{}';
  }
}

export function a11yLines(a11y: CatalogManifest['a11y']): string[] {
  if (typeof a11y === 'string') return a11y.trim() ? [a11y.trim()] : [];
  return [...a11y].map((line) => line.trim()).filter(Boolean);
}

/**
 * Best-effort keyboard rows from a11y copy (manifests do not ship a structured
 * keyboard table). Falls back to a single row pointing at a11y notes.
 */
export function keyboardRows(a11y: CatalogManifest['a11y']): { key: string; action: string }[] {
  const lines = a11yLines(a11y);
  const rows: { key: string; action: string }[] = [];
  const keyPattern =
    /\b(Tab|Shift\+Tab|Enter|Space|Escape|Esc|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|[A-Z]|⌘\w|Ctrl\+\w|Alt\+\w)\b/gi;
  for (const line of lines) {
    const keys = [...line.matchAll(keyPattern)].map((m) => m[1] ?? m[0]);
    if (keys.length > 0) {
      rows.push({ key: [...new Set(keys)].join(', '), action: line });
    }
  }
  if (rows.length === 0) {
    rows.push({
      key: '—',
      action: 'See accessibility notes for keyboard behavior.',
    });
  }
  return rows;
}

/** Group pages for the index (mutable lists). */
export function componentPagesByGroup(): Map<string, ComponentPageEntry[]> {
  const byGroup = new Map<string, ComponentPageEntry[]>();
  for (const page of COMPONENT_PAGES) {
    const list = byGroup.get(page.group) ?? [];
    list.push(page);
    byGroup.set(page.group, list);
  }
  return byGroup;
}

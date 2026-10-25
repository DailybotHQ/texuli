// @vitest-environment node

import type { CatalogManifest } from '@texuli/catalog';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  cardLayoutManifest,
  deckLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import { describe, expect, it } from 'vitest';
import {
  createPaletteEntries,
  groupPalette,
  moveActive,
  paletteCountText,
  searchPalette,
} from '../../apps/website/src/components/builder/palette/model.ts';

// A fictional Tier U manifest with no painter, shaped like the chat display ids.
const chatLike: CatalogManifest = {
  ...cardLayoutManifest,
  id: 'chat-thread',
  package: '@texuli/chat',
  label: 'Chat thread',
  summary: 'A read-only fictional conversation.',
  useWhen: ['Show a finished exchange between a person and an agent.'],
  agentEmittable: true,
};
const appOnly: CatalogManifest = {
  ...cardLayoutManifest,
  id: 'layout-app-shell',
  agentEmittable: false,
};

const manifests = [
  ...CONTENT_MANIFESTS,
  pageLayoutManifest,
  deckLayoutManifest,
  cardLayoutManifest,
  chatLike,
  appOnly,
];
const builderIds = new Set([...CONTENT_MANIFESTS.map((m) => m.id), 'layout-page', 'layout-card']);
const entries = createPaletteEntries(manifests, {
  paintable: (id) => id !== 'chat-thread',
  insertable: (id) => builderIds.has(id),
});

describe('builder palette entries', () => {
  it('lists Tier U (agent-emittable) manifests only, once each', () => {
    expect(entries.some((entry) => entry.id === 'layout-app-shell')).toBe(false);
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(entries.every((entry) => entry.tier === 'content' || entry.tier === 'app')).toBe(true);
  });

  it('marks Tier U growth the host cannot insert, with the reason', () => {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    expect(byId.get('blocks-text')?.availability).toBe('insertable');
    expect(byId.get('layout-deck')?.availability).toBe('not-in-host');
    expect(byId.get('chat-thread')?.availability).toBe('no-painter');
    expect(byId.get('chat-thread')?.group).toBe('Chat display');
  });

  it('counts the props each manifest marks required', () => {
    const cartesian = entries.find((entry) => entry.id === 'charts-cartesian');
    const manifest = CONTENT_MANIFESTS.find((m) => m.id === 'charts-cartesian');
    expect(cartesian && manifest).toBeTruthy();
    if (!cartesian || !manifest) return;
    expect(cartesian.requiredProps).toBe(manifest.props.filter((prop) => prop.required).length);
    expect(cartesian.requiredProps).toBeGreaterThan(0);
  });

  it('orders by group, then label, and groups in that order', () => {
    const groups = groupPalette(entries);
    expect(groups.map((section) => section.group)).toEqual([
      'Layouts',
      'Content blocks',
      'Charts',
      'Media',
      'Chat display',
    ]);
    const labels = (groups.find((section) => section.group === 'Charts')?.entries ?? []).map(
      (entry) => entry.label
    );
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('builder palette search', () => {
  it('matches label, id, summary and useWhen hints, case-insensitively', () => {
    expect(searchPalette(entries, 'CHAT THREAD').some((entry) => entry.id === 'chat-thread')).toBe(
      true
    );
    expect(searchPalette(entries, 'chat-thread').some((entry) => entry.id === 'chat-thread')).toBe(
      true
    );
    // Only in the useWhen hint, not in the label, id or summary.
    expect(searchPalette(entries, 'finished exchange').map((entry) => entry.id)).toEqual([
      'chat-thread',
    ]);
  });

  it('requires every term and keeps everything for an empty query', () => {
    expect(searchPalette(entries, '   ')).toHaveLength(entries.length);
    expect(searchPalette(entries, 'chat zzzz-no-match')).toEqual([]);
  });

  it('describes the result count for the live region', () => {
    expect(paletteCountText(entries.length, entries.length)).toBe(`${entries.length} components`);
    expect(paletteCountText(3, 40)).toBe('3 of 40 components');
    expect(paletteCountText(0, 40)).toBe('No components match. 40 available.');
  });

  it('moves the active option with wrapping, and reports an empty list', () => {
    expect(moveActive(-1, 5, 1)).toBe(0);
    expect(moveActive(-1, 5, -1)).toBe(4);
    expect(moveActive(4, 5, 1)).toBe(0);
    expect(moveActive(0, 5, -1)).toBe(4);
    expect(moveActive(2, 0, 1)).toBe(-1);
  });
});

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
  fieldFamily,
  unsupportedReason,
} from '../../apps/website/src/components/builder/inspector/coverage.ts';
import {
  BUILDER_MANIFEST_BY_ID,
  BUILDER_MANIFESTS,
} from '../../apps/website/src/components/builder/manifest.ts';
import { inspectorFields } from '../../apps/website/src/components/builder/model.ts';
import {
  AVAILABILITY_NOTES,
  createPaletteEntries,
  groupPalette,
  moveActive,
  paletteCountText,
  searchPalette,
} from '../../apps/website/src/components/builder/palette/model.ts';
import {
  PALETTE_MANIFESTS,
  playerPaints,
  unavailableReason,
} from '../../apps/website/src/components/builder/palette/sources.ts';

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

/** The palette the builder really shows: the real sources, as BuilderApp builds it. */
const real = createPaletteEntries(PALETTE_MANIFESTS, {
  paintable: playerPaints,
  insertable: (id) => BUILDER_MANIFEST_BY_ID.has(id),
  reason: unavailableReason,
});
const realById = new Map(real.map((entry) => [entry.id, entry]));

describe('the builder palette (PLAN_005 task 5)', () => {
  it('lists every Tier U manifest the player catalog holds, with nothing silently missing', () => {
    // Every id the player can paint is in the palette, insertable or explained.
    for (const manifest of PALETTE_MANIFESTS.filter((m) => m.agentEmittable === true)) {
      expect(realById.has(manifest.id), manifest.id).toBe(true);
    }
    for (const entry of real) {
      if (entry.availability === 'insertable') expect(entry.note, entry.id).toBeNull();
      else expect(entry.note?.length ?? 0, entry.id).toBeGreaterThan(20);
    }
  });

  it('inserts the G20 layouts and the host region, which paint and need no envelope declarations', () => {
    for (const id of ['layout-stack', 'layout-row', 'layout-split', 'layout-tile', 'host-region']) {
      expect(realById.get(id)?.availability, id).toBe('insertable');
      expect(playerPaints(id), id).toBe(true);
    }
    expect(realById.get('layout-tile')?.group).toBe('Layouts');
    expect(realById.get('host-region')?.group).toBe('Interaction');
  });

  it('explains each painted id it cannot insert, specifically', () => {
    const note = (id: string) => realById.get(id)?.note ?? '';
    expect(realById.get('layout-deck')?.availability).toBe('not-in-host');
    expect(note('layout-deck')).toContain('Decks need slide, master and settings editing');
    expect(note('deck-slide')).toBe(note('layout-deck'));
    for (const id of ['control-toggle', 'control-choice', 'control-slider', 'control-filter']) {
      expect(realById.get(id)?.availability, id).toBe('not-in-host');
      expect(note(id), id).toContain('state variable declared in the blueprint envelope');
    }
    for (const id of ['flow-view', 'flow-action']) expect(note(id), id).toContain('flow');
    for (const id of ['action-form', 'form-field', 'form-submit']) {
      expect(note(id), id).toContain('action declared in the blueprint envelope');
    }
    expect(realById.get('chat-thread')?.availability).toBe('no-painter');
    expect(note('chat-thread')).toContain('no painter for chat display ids');
    // No unavailable entry falls back to the generic note: every one has its own reason.
    const generic = new Set(Object.values(AVAILABILITY_NOTES));
    for (const entry of real.filter((candidate) => candidate.availability !== 'insertable')) {
      expect(generic.has(entry.note ?? ''), entry.id).toBe(false);
    }
  });

  it('groups the real palette, with the interaction ids in their own group', () => {
    expect(groupPalette(real).map((section) => section.group)).toEqual([
      'Layouts',
      'Content blocks',
      'Charts',
      'Media',
      'Interaction',
      'Chat display',
    ]);
    const interaction = groupPalette(real).find((section) => section.group === 'Interaction');
    expect(interaction?.entries.map((entry) => entry.id).sort()).toEqual([
      'action-form',
      'control-choice',
      'control-filter',
      'control-slider',
      'control-toggle',
      'flow-action',
      'flow-view',
      'form-field',
      'form-submit',
      'host-region',
    ]);
  });

  it('searches labels, ids and group names case-insensitively', () => {
    // "Grid tile" is the tile's label; the grid layout's summary mentions tiles too.
    expect(searchPalette(real, 'GRID TILE').map((entry) => entry.id)).toEqual([
      'layout-grid',
      'layout-tile',
    ]);
    expect(searchPalette(real, 'LAYOUT-TILE').map((entry) => entry.id)).toEqual(['layout-tile']);
    expect(searchPalette(real, 'layout-split').map((entry) => entry.id)).toEqual(['layout-split']);
    expect(searchPalette(real, 'interaction').map((entry) => entry.id)).toHaveLength(10);
    // A search can surface unavailable entries too; they keep their reason.
    const toggle = searchPalette(real, 'control-toggle')[0];
    expect(toggle?.availability).toBe('not-in-host');
    expect(toggle?.note).toBeTruthy();
  });

  it('every insertable entry is a builder manifest, and every prop it offers has a working field', () => {
    const insertable = real.filter((entry) => entry.availability === 'insertable');
    expect(insertable.map((entry) => entry.id).sort()).toEqual(
      BUILDER_MANIFESTS.map((manifest) => manifest.id).sort()
    );
    const families: Record<string, number> = {};
    for (const manifest of BUILDER_MANIFESTS) {
      for (const prop of inspectorFields(manifest.props)) {
        const family = fieldFamily(manifest.id, prop);
        families[family] = (families[family] ?? 0) + 1;
        // A field is never a plain text box for a value the component reads as another kind.
        if (family === 'unsupported') expect(unsupportedReason(manifest.id, prop)).toBeTruthy();
        if (family === 'string') expect(prop.kind, `${manifest.id}.${prop.name}`).toBe('string');
        if (family === 'json') {
          expect(['object', 'array', 'unknown'], `${manifest.id}.${prop.name}`).toContain(
            prop.kind
          );
        }
      }
    }
    for (const family of [
      'text-block',
      'media-block',
      'url',
      'alt',
      'choice',
      'number',
      'struct',
      'string',
      'json',
      'unsupported',
    ]) {
      expect(families[family] ?? 0, family).toBeGreaterThan(0);
    }
  });
});

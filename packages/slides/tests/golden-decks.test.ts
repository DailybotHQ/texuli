// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { type DeckDraftResult, toDeckRenderTree, validateDeckDraft } from '../src/grammar/index.ts';

const DIR = 'packages/slides/tests/golden';
const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

interface GoldenDeck {
  golden: string;
  tree: unknown;
}
interface HostileCase {
  name: string;
  tree: unknown;
}

const load = <T>(name: string): T => JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8')) as T;
const codes = (result: DeckDraftResult) =>
  result.diagnostics.map((d) => `${d.severity}:${d.check}:${d.code}@${d.path}`);
const resolved = (result: DeckDraftResult) =>
  result.slides.map((slide) => ({
    slideId: slide.slideId,
    master: slide.master.id,
    transition: slide.transition,
    theme:
      slide.themeRef?.kind === 'catalog'
        ? `${slide.themeRef.id}:${slide.themeRef.mode ?? '-'}`
        : null,
    steps: slide.stepCount,
  }));

describe('golden decks', () => {
  it('holds exactly the pinned golden files', () => {
    expect(readdirSync(DIR).sort()).toEqual([
      'deck-hostile.json',
      'deck-legacy-cards.json',
      'deck-notes-and-steps.json',
      'deck-theme-and-masters.json',
    ]);
  });

  it('deck-notes-and-steps: validates at the untrusted tier and keeps notes and steps', () => {
    const golden = load<GoldenDeck>('deck-notes-and-steps');
    const result = validateDeckDraft(golden.tree, { catalog });
    expect(codes(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('valid');
    expect(result.draft.checks).toMatchObject({
      render: 'pass',
      blocks: 'pass',
      grammar: 'pass',
      root: 'pass',
      sinks: 'pass',
    });
    expect(result.deck?.slides[0]?.notes).toBe(
      'Open with the two goals.\nPause before the third bullet.'
    );
    expect(resolved(result)).toEqual([
      { slideId: 'goals', master: 'content', transition: 'fade', theme: null, steps: 2 },
      { slideId: 'demo', master: 'content', transition: 'fade', theme: null, steps: 1 },
      { slideId: 'next', master: 'content', transition: 'fade', theme: null, steps: 0 },
    ]);
    // Re-encoding the validated deck (with normalized defaults) validates to the same deck.
    const again = validateDeckDraft(
      toDeckRenderTree(result.deck as NonNullable<typeof result.deck>),
      {
        catalog,
      }
    );
    expect(again.deck).toEqual(result.deck);
  });

  it('deck-theme-and-masters: resolves masters, transitions and slide-over-deck themes', () => {
    const golden = load<GoldenDeck>('deck-theme-and-masters');
    const result = validateDeckDraft(golden.tree, { catalog });
    expect(codes(result)).toEqual([]);
    expect(resolved(result)).toEqual([
      { slideId: 'cover', master: 'title', transition: 'none', theme: 'graphite:system', steps: 0 },
      {
        slideId: 'compare',
        master: 'two-column',
        transition: 'fade-up',
        theme: 'graphite:system',
        steps: 0,
      },
      { slideId: 'voice', master: 'quote', transition: 'fade', theme: 'ocean:dark', steps: 0 },
      {
        slideId: 'close',
        master: 'closing',
        transition: 'fade-up',
        theme: 'sepia-print:-',
        steps: 0,
      },
    ]);
    expect(result.slides[1]?.master.slots).toEqual([
      'title',
      'contentStart',
      'contentEnd',
      'footer',
    ]);

    const reduced = validateDeckDraft(golden.tree, { catalog, reducedMotion: true });
    expect(reduced.slides.map((slide) => slide.transition)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ]);
  });

  it('deck-legacy-cards: still projects the card shape, with a warning', () => {
    const result = validateDeckDraft(load<GoldenDeck>('deck-legacy-cards').tree, { catalog });
    expect(result.ok).toBe(true);
    expect(codes(result)).toEqual(['warning:deck:deck-legacy-cards@children']);
    expect(
      result.deck?.slides.map((slide) => [slide.id, slide.title, slide.blocks[0]?.type])
    ).toEqual([
      ['slide-1', 'Agenda', 'list'],
      ['slide-2', 'Burn-down', 'chart'],
    ]);
  });

  it('accepts a golden deck as JSON text, the way an agent returns it', () => {
    const text = JSON.stringify(load<GoldenDeck>('deck-notes-and-steps').tree);
    expect(validateDeckDraft(text, { catalog }).ok).toBe(true);
    const broken = validateDeckDraft(`${text.slice(0, -2)}`, { catalog });
    expect(broken.ok).toBe(false);
    expect(broken.status).toBe('parse');
    expect(broken.deck).toBeNull();
  });
});

describe('hostile golden decks fail closed', () => {
  const EXPECTED: Record<string, readonly string[]> = {
    'bad-slide-id': ['error:deck:deck-schema@children[0].props.slideId'],
    'duplicate-slide-id': ['error:deck:deck-schema@children[1].props.slideId'],
    'missing-slide-id': [
      'error:render:missing-required@0.children.0',
      'error:render:schema-failure@0.children.0',
      'error:deck:deck-schema@children[0].props.slideId',
    ],
    'unknown-master': [
      'error:render:schema-failure@0.children.0',
      'error:render:schema-failure@0.children.0',
      'error:deck:deck-schema@children[0].props.master',
    ],
    'undeclared-master': ['error:deck:deck-schema@children[0].props.master'],
    'unknown-transition': [
      'error:render:schema-failure@0.children.0',
      'error:render:schema-failure@0.children.0',
      'error:deck:deck-schema@children[0].props.transition',
    ],
    'bad-theme-ref': ['error:deck:deck-schema@props.themeRef.kind'],
    'foreign-child': ['error:deck:deck-schema@children[1]'],
    'malformed-block': [
      'error:blocks:block-schema@0.children.0.children.0',
      'error:deck:deck-schema@children[0].children[0].props.block',
    ],
    'family-mismatch': [
      'error:render:block-family-mismatch@0.children.0.children.0',
      'error:render:schema-failure@0.children.0.children.0',
      'error:deck:deck-schema@children[0].children[0].id',
    ],
    'script-url-image': [
      'error:sinks:sink@tree.children[0].children[0].props.block.src',
      'error:sinks:sink@tree.children[0].children[0].props.block.src',
      'error:blocks:block-schema@0.children.0.children.0',
      'error:deck:deck-schema@children[0].children[0].props.block',
    ],
    'html-in-notes': [
      'error:sinks:sink@tree.children[0].props.notes',
      'error:render:html-string@0.children.0',
      'error:render:schema-failure@0.children.0',
    ],
    'style-and-class-props': [
      'error:sinks:sink@tree.children[0].props.class',
      'error:sinks:sink@tree.children[0].props.style',
      'error:render:forbidden-prop@0.children.0',
      'error:render:forbidden-prop@0.children.0',
    ],
    'slides-and-children': ['error:deck:deck-schema@props.slides'],
    'not-a-deck-root': ['error:root:frame-root@0'],
    'empty-deck': ['error:deck:deck-schema@children'],
  };
  const cases = load<{ cases: HostileCase[] }>('deck-hostile').cases;

  it('pins one expectation per hostile case', () => {
    expect(cases.map((c) => c.name).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s', (name, hostile) => {
    const result = validateDeckDraft(hostile.tree, { catalog });
    expect(result.ok).toBe(false);
    expect(result.status).not.toBe('valid');
    expect(result.deck).toBeNull();
    expect(result.slides).toEqual([]);
    expect(codes(result)).toEqual(EXPECTED[name]);
  });

  it('refuses oversized notes and an untitled deck', () => {
    const notes = validateDeckDraft(
      {
        id: 'layout-deck',
        props: { title: 'Long notes' },
        children: [{ id: 'deck-slide', props: { slideId: 'one', notes: 'n'.repeat(6_001) } }],
      },
      { catalog }
    );
    expect(notes.ok).toBe(false);
    expect(codes(notes)).toContain('error:deck:deck-schema@children[0].props.notes');

    const untitled = validateDeckDraft(
      { id: 'layout-deck', props: {}, children: [{ id: 'deck-slide', props: { slideId: 'one' } }] },
      { catalog }
    );
    expect(untitled.ok).toBe(false);
    expect(codes(untitled)).toContain('error:deck:deck-schema@props.title');
  });
});

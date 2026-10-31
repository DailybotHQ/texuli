// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDeckMarkdown, writeDeckMarkdown } from '../src/markdown/index.ts';
import {
  DECK_CODES,
  DECK_DESIGN_SYSTEM_REF_PATTERN,
  type Deck,
  deckJsonSchema,
  migrateDeck,
  parseDeck,
} from '../src/model/index.ts';

/**
 * ADR-024: a standalone deck (model v2) names the design system it follows
 * with a top-level `designSystem`, the same shape as a blueprint envelope's
 * and a document's: exactly one of `ref` and `inline`.
 */
const SPEC = join(import.meta.dirname, '../../spec');
const harbor = (
  JSON.parse(readFileSync(join(SPEC, 'fixtures/golden/brand-deck.json'), 'utf8')) as {
    designSystem: { inline: Record<string, unknown> };
  }
).designSystem.inline;

const deck = (designSystem?: unknown): Record<string, unknown> => ({
  formatVersion: 2,
  meta: { title: 'Harbor review' },
  slides: [{ id: 'one', layout: 'free', title: 'One', blocks: [] }],
  ...(designSystem === undefined ? {} : { designSystem }),
});

describe('deck designSystem', () => {
  it('accepts a ref, a library theme and an inline document', () => {
    for (const designSystem of [
      { ref: 'acme@2.1.0' },
      { ref: 'acme-brand@0.1.0-rc.1' },
      { ref: 'texuli:ocean' },
      { inline: harbor },
    ]) {
      const result = parseDeck(deck(designSystem));
      expect(result.issues, JSON.stringify(designSystem).slice(0, 40)).toEqual([]);
      expect(result.deck?.designSystem).toEqual(designSystem);
    }
    expect(parseDeck(deck()).deck?.designSystem).toBeUndefined();
  });

  it('refuses ranges, URLs, paths, both or neither key, unknown keys and a non-object inline', () => {
    const cases: [unknown, string][] = [
      [{ ref: 'acme@^2' }, 'pattern'],
      [{ ref: 'acme' }, 'pattern'],
      [{ ref: 'https://example.com/acme.json' }, 'pattern'],
      [{ ref: '../acme.json' }, 'pattern'],
      [{ ref: 'acme@2.1.0', inline: harbor }, 'design-system'],
      [{}, 'design-system'],
      [{ ref: 'acme@2.1.0', href: 'x' }, 'unknown-key'],
      [{ inline: [1, 2] }, 'design-system'],
      [{ inline: 'acme' }, 'design-system'],
      ['acme@2.1.0', 'invalid-type'],
    ];
    for (const [designSystem, code] of cases) {
      const result = parseDeck(deck(designSystem));
      expect(result.ok, JSON.stringify(designSystem)).toBe(false);
      const issue = result.issues.find((entry) => entry.path[0] === 'designSystem');
      expect(issue?.code, JSON.stringify(designSystem)).toBe(code);
    }
    expect(DECK_CODES['design-system'].group).toBe('style');
  });

  it('uses the blueprint grammar for ref, and the JSON Schema carries the field', () => {
    const blueprint = JSON.parse(
      readFileSync(join(SPEC, 'schemas/blueprint.schema.json'), 'utf8')
    ) as { $defs: { designSystemReference: { properties: { ref: { pattern: string } } } } };
    expect(DECK_DESIGN_SYSTEM_REF_PATTERN).toBe(
      blueprint.$defs.designSystemReference.properties.ref.pattern
    );
    const schema = deckJsonSchema() as { properties: Record<string, unknown> };
    expect(schema.properties.designSystem).toBeDefined();
  });

  it('carries a design system through migration from every earlier shape', () => {
    const designSystem = { ref: 'acme@2.1.0' };
    const inputs = [
      { meta: { title: 'v1' }, slides: [{ id: 'a', blocks: [] }], designSystem },
      {
        id: 'layout-deck',
        props: { title: 'Grammar' },
        children: [{ id: 'deck-slide', props: { slideId: 'a', title: 'A' }, children: [] }],
        designSystem,
      },
      {
        style: {},
        slides: [{ id: 'a', layout: 'title-hero', props: { title: 'A' } }],
        designSystem,
      },
    ];
    for (const input of inputs) {
      const migrated = migrateDeck(input);
      expect(migrated.from).not.toBe('unknown');
      expect((migrated.deck as Deck).designSystem).toEqual(designSystem);
      expect(parseDeck(migrated.deck).deck?.designSystem).toEqual(designSystem);
    }
  });

  it('round-trips a ref through Markdown frontmatter, and reports an inline one as unrepresentable', () => {
    const parsed = parseDeck(deck({ ref: 'acme@2.1.0' }));
    if (!parsed.deck) throw new Error('valid deck');
    const written = writeDeckMarkdown(parsed.deck);
    expect(written.markdown).toContain('designSystem: acme@2.1.0');
    expect(written.issues).toEqual([]);
    const back = parseDeckMarkdown(written.markdown);
    expect(back.ok).toBe(true);
    expect(back.deck?.designSystem).toEqual({ ref: 'acme@2.1.0' });

    const kebab = parseDeckMarkdown('---\ntitle: T\ndesign-system: texuli:ocean\n---\n\n# One\n');
    expect(kebab.deck?.designSystem).toEqual({ ref: 'texuli:ocean' });
    const refused = parseDeckMarkdown('---\ntitle: T\ndesignSystem: acme@^2\n---\n\n# One\n');
    expect(refused.ok).toBe(false);
    expect(refused.issues.some((issue) => issue.path[0] === 'designSystem')).toBe(true);

    const inline = parseDeck(deck({ inline: harbor }));
    if (!inline.deck) throw new Error('valid deck');
    const lossy = writeDeckMarkdown(inline.deck);
    expect(lossy.issues.map((issue) => [issue.code, issue.path.join('.')])).toEqual([
      ['md-unrepresentable', 'designSystem.inline'],
    ]);
  });
});

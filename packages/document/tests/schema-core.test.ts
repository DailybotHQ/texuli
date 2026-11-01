// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TexuliDocument } from '../src/model/types.ts';
import * as core from '../src/schema/core.ts';
import { checkDeckPayload, validateDocument } from '../src/schema/index.ts';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/** A two-slide deck (deck model v2, fictional). */
const DECK = {
  formatVersion: 2,
  meta: { title: 'Launch plan' },
  slides: [
    { id: 's1', layout: 'title-hero', props: { title: 'Launch plan' } },
    { id: 's2', layout: 'title-hero', props: { title: 'Questions' } },
  ],
};

const withEmbed = (embed: Record<string, unknown>): TexuliDocument =>
  ({
    format: 'texuli-document',
    formatVersion: 1,
    meta: { title: 'Embeds' },
    blocks: [{ id: 'e', type: 'embed', kind: 'deck', ...embed }],
  }) as unknown as TexuliDocument;

const codes = (result: { issues: readonly { code: string }[] }) => result.issues.map((i) => i.code);

/** Every module reachable from an entry through static relative and package imports. */
function reachable(entry: string): string[] {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)';/gms)) {
      const spec = match[1] as string;
      if (/^import\s+type\s/.test(match[0]) || /^export\s+type\s/.test(match[0])) continue;
      if (spec.startsWith('.')) stack.push(resolve(dirname(file), spec));
      else packages.add(spec);
    }
  }
  return [...packages];
}

describe('@texuli/document/schema-core (G133)', () => {
  it('never reaches the deck model, while the full entry does', () => {
    expect(reachable(resolve(srcDir, 'schema/core.ts'))).not.toContain('@texuli/deck/model');
    expect(reachable(resolve(srcDir, 'schema/index.ts'))).toContain('@texuli/deck/model');
  });

  it('refuses an inline deck without validateDeck, and accepts a deck by ref', () => {
    const inline = core.validateDocument(withEmbed({ inline: DECK }));
    expect(inline.ok).toBe(false);
    expect(codes(inline)).toEqual(['invalid-deck']);
    expect(core.validateDocument(withEmbed({ ref: 'decks/launch' })).ok).toBe(true);
    expect(core.isDocument(withEmbed({ inline: DECK }))).toBe(false);
  });

  it('checks inline decks with an injected validator, as the full entry does', () => {
    const doc = withEmbed({ inline: DECK });
    expect(core.validateDocument(doc, { validateDeck: checkDeckPayload }).ok).toBe(true);
    expect(validateDocument(doc).ok).toBe(true);
    const bad = withEmbed({ inline: { formatVersion: 2, slides: 'no' } });
    expect(codes(core.validateDocument(bad, { validateDeck: checkDeckPayload }))).toContain(
      'invalid-deck'
    );
    expect(codes(validateDocument(bad))).toContain('invalid-deck');
    // A host may refuse inline decks on the full entry too.
    expect(codes(validateDocument(doc, { validateDeck: null }))).toEqual(['invalid-deck']);
  });

  it('reports a throwing validator as an issue, never a throw', () => {
    const result = core.validateDocument(withEmbed({ inline: DECK }), {
      validateDeck: () => {
        throw new Error('host bug');
      },
    });
    expect(codes(result)).toEqual(['invalid-deck']);
  });
});

describe('@texuli/document/ops-core (G136)', () => {
  it('never reaches the deck model, while the full ops entry does', () => {
    expect(reachable(resolve(srcDir, 'ops/core.ts'))).not.toContain('@texuli/deck/model');
    expect(reachable(resolve(srcDir, 'ops/index.ts'))).toContain('@texuli/deck/model');
  });

  it('refuses an inline deck result unless validateDeck is passed, as the full entry checks it', async () => {
    const opsCore = await import('../src/ops/core.ts');
    const ops = await import('../src/ops/index.ts');
    const base = withEmbed({ ref: 'decks/launch' });
    const swap = [{ op: 'set-attrs', id: 'e', attrs: { ref: null, inline: DECK } }] as never;
    expect(ops.applyOperations(base, swap).ok).toBe(true);
    expect(opsCore.applyOperations(base, swap).ok).toBe(false);
    expect(opsCore.applyOperations(base, swap, { validateDeck: checkDeckPayload }).ok).toBe(true);
    const history = opsCore.createDocumentHistory(base, { validateDeck: checkDeckPayload });
    expect(history.apply(swap).ok).toBe(true);
    expect(opsCore.createDocumentHistory(base).apply(swap).ok).toBe(false);
  });
});

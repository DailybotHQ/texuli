/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { hardCodedLabels } from '../../primitives/tests/support/i18n-coverage.ts';
import { DEFAULT_CODE_FIELD_LABELS } from '../src/code/code-field.ts';
import { DEFAULT_CODE_BLOCK_LABELS } from '../src/code/labels.ts';
import { DEFAULT_DATA_BLOCK_LABELS } from '../src/data/labels.ts';
import { DEFAULT_DIAGRAM_BLOCK_LABELS } from '../src/diagram/labels.ts';
import { DEFAULT_EMBED_BLOCK_LABELS } from '../src/embed/engine.ts';
import { BLOCKS_LABELS_ES } from '../src/i18n/es.ts';
import { BLOCKS_MESSAGES_EN } from '../src/i18n/index.ts';
import { DEFAULT_INTERACTIVE_BLOCK_LABELS } from '../src/interactive/labels.ts';
import { DEFAULT_MAP_BLOCK_LABELS } from '../src/map/labels.ts';
import { DEFAULT_MEDIA_BLOCK_LABELS } from '../src/media/labels.ts';
import { DEFAULT_STRUCTURE_BLOCK_LABELS } from '../src/structure/labels.ts';
import { DEFAULT_TEXT_BLOCK_LABELS } from '../src/text/labels.ts';

const kebab = (key: string) => key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/** The `{name}` placeholders of a message, sorted (repeats kept). */
const placeholders = (text: string) => (text.match(/\{[A-Za-z0-9_.-]{1,64}\}/g) ?? []).sort();

function flatten(prefix: string, labels: object, out: Record<string, string>) {
  for (const [key, value] of Object.entries(labels)) {
    const id = `${prefix}.${kebab(key)}`;
    if (typeof value === 'string') out[id] = value;
    else if (value && typeof value === 'object') flatten(id, value, out);
  }
  return out;
}

describe('@texuli/blocks labels resolve through the dictionary in context (ADR-026)', () => {
  it('hard-codes no English label, and BLOCKS_MESSAGES_EN equals every family default', () => {
    expect(hardCodedLabels('packages/blocks/src')).toEqual([]);
    const expected: Record<string, string> = {};
    for (const [prefix, labels] of [
      ['blocks.text', DEFAULT_TEXT_BLOCK_LABELS],
      ['blocks.code', DEFAULT_CODE_BLOCK_LABELS],
      ['blocks.code-field', DEFAULT_CODE_FIELD_LABELS],
      ['blocks.map', DEFAULT_MAP_BLOCK_LABELS],
      ['blocks.interactive', DEFAULT_INTERACTIVE_BLOCK_LABELS],
      ['blocks.data', DEFAULT_DATA_BLOCK_LABELS],
      ['blocks.structure', DEFAULT_STRUCTURE_BLOCK_LABELS],
      ['blocks.media', DEFAULT_MEDIA_BLOCK_LABELS],
      ['blocks.embed', DEFAULT_EMBED_BLOCK_LABELS],
      ['blocks.diagram', DEFAULT_DIAGRAM_BLOCK_LABELS],
    ] as const) {
      flatten(prefix, labels, expected);
    }
    expect(Object.keys(expected).length).toBeGreaterThan(80);
    expect({ ...BLOCKS_MESSAGES_EN.messages }).toEqual(expected);
  });

  it('BLOCKS_LABELS_ES (@texuli/blocks/i18n/es) has every id, the same placeholders, and no blank label', () => {
    const english = BLOCKS_MESSAGES_EN.messages as Readonly<Record<string, string>>;
    expect(Object.keys(BLOCKS_LABELS_ES).sort()).toEqual(Object.keys(english).sort());
    expect(Object.isFrozen(BLOCKS_LABELS_ES)).toBe(true);
    const drift = Object.entries(BLOCKS_LABELS_ES).filter(
      ([id, spanish]) =>
        placeholders(spanish).join() !== placeholders(english[id] ?? '').join() ||
        (spanish.trim() === '') !== ((english[id] ?? '').trim() === '')
    );
    expect(drift).toEqual([]);
  });
});

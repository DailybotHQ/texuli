// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { fieldFamily } from '../../apps/website/src/components/builder/inspector/coverage.ts';
import {
  GRID_GAP,
  isLocaleTag,
  isStringProp,
  REGION_NAME,
  readString,
  type StringProp,
  stringInput,
  stringIssues,
  stringRule,
} from '../../apps/website/src/components/builder/inspector/string/model.ts';
import {
  BLOCK_CONTENT_LIMITS,
  editableBlock,
  editItems,
  itemTexts,
  linkVerdicts,
  primaryText,
  remaining,
  setField,
  switchType,
  TEXT_FIELDS,
  TEXT_PRESETS,
  TEXT_TYPES,
  type TextBlockValue,
  TONES,
  validateTextBlock,
} from '../../apps/website/src/components/builder/inspector/text/model.ts';
import { BUILDER_MANIFESTS } from '../../apps/website/src/components/builder/manifest.ts';
import { inspectorFields } from '../../apps/website/src/components/builder/model.ts';
import { HOST_REGION_NAME } from '../../packages/player/src/region-manifests.ts';

// validateTextBlock runs the text family parser (`safeParseBlock`) itself.
const parses = (block: TextBlockValue) => validateTextBlock(block).length === 0;
const chars = (count: number, char = 'a') => char.repeat(count);
const fieldsOf = (issues: ReturnType<typeof validateTextBlock>) =>
  issues.map((issue) => issue.field);

describe('text inspector fields mirror the text family parser', () => {
  it('starts every type from a preset the parser accepts', () => {
    for (const type of TEXT_TYPES) {
      expect(parses(TEXT_PRESETS[type]), type).toBe(true);
      expect(validateTextBlock(TEXT_PRESETS[type])).toEqual([]);
    }
  });

  it('accepts every text field at its limit and refuses one character more, on that field', () => {
    let checked = 0;
    for (const type of TEXT_TYPES) {
      for (const field of TEXT_FIELDS[type]) {
        if (field.kind !== 'plain' && field.kind !== 'markdown') continue;
        const atLimit = setField(TEXT_PRESETS[type], field.name, chars(field.max));
        expect(validateTextBlock(atLimit), `${type}.${field.name} at limit`).toEqual([]);
        const over = { ...TEXT_PRESETS[type], [field.name]: chars(field.max + 1) };
        expect(fieldsOf(validateTextBlock(over)), `${type}.${field.name} over`).toContain(
          field.name
        );
        expect(remaining(chars(field.max), field.max)).toBe(0);
        checked += 1;
      }
    }
    expect(checked).toBe(8);
  });

  it('keeps plain fields single-line and markdown fields multi-line', () => {
    for (const type of TEXT_TYPES) {
      for (const field of TEXT_FIELDS[type]) {
        if (field.kind !== 'plain' && field.kind !== 'markdown') continue;
        const twoLines = { ...TEXT_PRESETS[type], [field.name]: 'first line\nsecond line' };
        const issues = fieldsOf(validateTextBlock(twoLines));
        if (field.kind === 'plain') expect(issues, `${type}.${field.name}`).toContain(field.name);
        else expect(issues, `${type}.${field.name}`).toEqual([]);
      }
    }
  });

  it('removes empty optional fields and flags empty required ones', () => {
    for (const type of TEXT_TYPES) {
      for (const field of TEXT_FIELDS[type]) {
        if (field.kind !== 'plain' && field.kind !== 'markdown') continue;
        const cleared = setField({ ...TEXT_PRESETS[type], [field.name]: 'x' }, field.name, '');
        if (field.required) {
          expect(fieldsOf(validateTextBlock(cleared)), `${type}.${field.name}`).toContain(
            field.name
          );
        } else {
          expect(field.name in cleared, `${type}.${field.name}`).toBe(false);
          expect(validateTextBlock(cleared)).toEqual([]);
        }
      }
    }
  });

  it('accepts heading levels 1 to 4 only', () => {
    for (const level of [1, 2, 3, 4]) {
      expect(validateTextBlock(setField(TEXT_PRESETS.heading, 'level', level))).toEqual([]);
    }
    for (const level of [0, 5, 2.5]) {
      expect(fieldsOf(validateTextBlock({ ...TEXT_PRESETS.heading, level }))).toContain('level');
    }
  });

  it('accepts every block tone, and no tone at all', () => {
    for (const type of TEXT_TYPES) {
      for (const tone of TONES) {
        expect(
          validateTextBlock(setField(TEXT_PRESETS[type], 'tone', tone)),
          `${type} ${tone}`
        ).toEqual([]);
      }
      expect('tone' in setField({ ...TEXT_PRESETS[type], tone: 'info' }, 'tone', '')).toBe(false);
      expect(fieldsOf(validateTextBlock({ ...TEXT_PRESETS[type], tone: 'loud' }))).toContain(
        'tone'
      );
    }
  });

  it('treats an unchecked numbered-list box as no field', () => {
    const on = setField(TEXT_PRESETS.list, 'ordered', true);
    expect(on.ordered).toBe(true);
    expect(validateTextBlock(on)).toEqual([]);
    expect('ordered' in setField(on, 'ordered', false)).toBe(false);
  });

  it('ignores fields the type does not have', () => {
    const block = setField(TEXT_PRESETS.text, 'level', 3);
    expect(block).toBe(TEXT_PRESETS.text);
  });
});

describe('list items', () => {
  const list = (count: number): TextBlockValue => ({
    type: 'list',
    items: Array.from({ length: count }, (_, index) => ({ text: `Item ${index + 1}` })),
  });

  it('parses 1 to listItems items and refuses 0 or one more', () => {
    for (let count = 1; count <= BLOCK_CONTENT_LIMITS.listItems; count += 1) {
      expect(validateTextBlock(list(count)), `${count}`).toEqual([]);
    }
    expect(fieldsOf(validateTextBlock(list(0)))).toContain('items');
    expect(fieldsOf(validateTextBlock(list(BLOCK_CONTENT_LIMITS.listItems + 1)))).toContain(
      'items'
    );
  });

  it('reports an over-long item on that item', () => {
    const block = editItems(list(3), {
      action: 'set',
      index: 1,
      text: chars(BLOCK_CONTENT_LIMITS.shortMarkdown + 1),
    });
    expect(fieldsOf(validateTextBlock(block))).toEqual(['items.1']);
  });

  it('keeps every add, remove and move inside 1..listItems and refuses the rest', () => {
    let block = list(1);
    for (let count = 2; count <= BLOCK_CONTENT_LIMITS.listItems; count += 1) {
      block = editItems(block, { action: 'add', after: count - 2 });
      expect(itemTexts(block)).toHaveLength(count);
    }
    expect(editItems(block, { action: 'add', after: 0 })).toBe(block);
    for (let count = BLOCK_CONTENT_LIMITS.listItems - 1; count >= 1; count -= 1) {
      block = editItems(block, { action: 'remove', index: 0 });
      expect(itemTexts(block)).toHaveLength(count);
    }
    expect(editItems(block, { action: 'remove', index: 0 })).toBe(block);

    const three = list(3);
    expect(itemTexts(editItems(three, { action: 'move', index: 0, step: 1 }))).toEqual([
      'Item 2',
      'Item 1',
      'Item 3',
    ]);
    expect(itemTexts(editItems(three, { action: 'move', index: 2, step: -1 }))).toEqual([
      'Item 1',
      'Item 3',
      'Item 2',
    ]);
    expect(editItems(three, { action: 'move', index: 0, step: -1 })).toBe(three);
    expect(editItems(three, { action: 'move', index: 2, step: 1 })).toBe(three);
    expect(editItems(three, { action: 'set', index: 7, text: 'x' })).toBe(three);
    // A new item is inserted after the given one, and starts empty.
    expect(itemTexts(editItems(three, { action: 'add', after: 0 }))).toEqual([
      'Item 1',
      '',
      'Item 2',
      'Item 3',
    ]);
  });
});

describe('switching block types', () => {
  const samples: TextBlockValue[] = [
    ...TEXT_TYPES.map((type) => TEXT_PRESETS[type]),
    { type: 'text', markdown: 'Line one\nLine two\n\nLine three', tone: 'warning' },
    { type: 'heading', level: 3, text: 'Only heading', tone: 'info' },
    { type: 'list', items: Array.from({ length: 12 }, (_, i) => ({ text: `Point ${i}` })) },
    { type: 'text', markdown: chars(BLOCK_CONTENT_LIMITS.markdown) },
    { type: 'callout', body: 'x', title: 'Kept title is not carried' },
    { type: 'quote', quote: '   ' },
  ];

  it('always yields a block the parser accepts, keeping the tone, from and to every type', () => {
    let pairs = 0;
    for (const sample of samples) {
      for (const type of TEXT_TYPES) {
        const next = switchType(sample, type);
        expect(next.type).toBe(type);
        expect(validateTextBlock(next), `${sample.type} → ${type}`).toEqual([]);
        if (sample.type !== type) expect(next.tone).toBe(sample.tone);
        pairs += 1;
      }
    }
    expect(pairs).toBe(samples.length * TEXT_TYPES.length);
  });

  it('carries the main text: first line into a heading, one item per line into a list', () => {
    const text: TextBlockValue = { type: 'text', markdown: 'Alpha\nBeta\nGamma' };
    expect(switchType(text, 'heading').text).toBe('Alpha');
    expect(itemTexts(switchType(text, 'list'))).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(switchType(text, 'quote').quote).toBe('Alpha\nBeta\nGamma');
    expect(primaryText(switchType(switchType(text, 'list'), 'callout'))).toBe('Alpha\nBeta\nGamma');
    expect(switchType(text, 'text')).toBe(text);
  });

  it('edits other block shapes as a fresh text block', () => {
    expect(editableBlock({ type: 'table', columns: [] })).toEqual(TEXT_PRESETS.text);
    expect(editableBlock(null)).toEqual(TEXT_PRESETS.text);
    expect(editableBlock(TEXT_PRESETS.quote)).toEqual(TEXT_PRESETS.quote);
  });
});

describe('link verdicts', () => {
  it('reports each link with the URL-policy verdict the paint applies', () => {
    const markdown = [
      'See [the guide](https://example.com/guide) and [notes](/notes).',
      'Never [this](javascript:alert(1)) or [that](data:text/html,x).',
      '- A [listed link](https://example.com/list)',
      '> A [quoted link](mailto:team@example.com)',
      'Auto <https://example.com/auto>.',
    ].join('\n\n');
    expect(linkVerdicts(markdown)).toEqual([
      { text: 'the guide', href: 'https://example.com/guide', kept: true },
      // The untrusted tier refuses relative links too; the widget surfaces that before paint.
      { text: 'notes', href: undefined, kept: false },
      { text: 'this', href: undefined, kept: false },
      { text: 'that', href: undefined, kept: false },
      { text: 'listed link', href: 'https://example.com/list', kept: true },
      { text: 'quoted link', href: 'mailto:team@example.com', kept: true },
      { text: 'https://example.com/auto', href: 'https://example.com/auto', kept: true },
    ]);
  });

  it('finds no links in plain prose or code', () => {
    expect(linkVerdicts('Just words, and `[not](https://example.com)` code.')).toEqual([]);
  });
});

/** Every text prop the inspector edits as a text box, from the real manifests. */
const STRING_PROPS: { id: string; prop: StringProp }[] = BUILDER_MANIFESTS.flatMap((manifest) =>
  inspectorFields(manifest.props)
    .filter((prop) => fieldFamily(manifest.id, prop) === 'string')
    .filter(isStringProp)
    .map((prop) => ({ id: manifest.id, prop }))
);
const propOf = (id: string, name: string): StringProp => {
  const entry = STRING_PROPS.find(
    (candidate) => candidate.id === id && candidate.prop.name === name
  );
  if (!entry) throw new Error(`${id}.${name} missing`);
  return entry.prop;
};

describe('text box props (PLAN_005 task 5)', () => {
  it('reads every value as the renderer will: text is kept, anything else is refused', () => {
    expect(STRING_PROPS.length).toBeGreaterThan(50);
    // The renderer forbids className like class, so the inspector never offers it.
    expect(STRING_PROPS.some(({ prop }) => prop.name === 'className')).toBe(false);
    for (const { id, prop } of STRING_PROPS) {
      expect(readString(prop, undefined).state, `${id}.${prop.name}`).toBe('unset');
      expect(readString(prop, 'Harbor notes').state, `${id}.${prop.name}`).toBe('set');
      for (const hostile of [1, true, null, {}, ['a']]) {
        const issues = stringIssues(prop, hostile);
        expect(issues, `${id}.${prop.name}`).toHaveLength(1);
        expect(issues[0]?.severity).toBe('error');
        expect(issues[0]?.message).toContain('refused at paint');
      }
    }
  });

  it('flags a missing required text, and an empty box clears the prop', () => {
    expect(stringIssues(propOf('host-region', 'label'), undefined)).toEqual([
      { severity: 'error', message: 'Required: enter text.' },
    ]);
    expect(stringIssues(propOf('layout-page', 'title'), undefined)).toEqual([]);
    expect(stringInput('')).toBeUndefined();
    expect(stringInput(' a ')).toBe(' a ');
  });

  it('checks the grid gap against the player’s own length rule', () => {
    const rule = stringRule('layout-grid', 'gap');
    expect(rule?.source).toBe('player grid layout');
    const gap = propOf('layout-grid', 'gap');
    for (const ok of ['0', '1rem', '0.5em', '1.25rem', '12px', '999px']) {
      expect(stringIssues(gap, ok, rule), ok).toEqual([]);
    }
    for (const ignored of ['1 rem', '100rem', '1000px', 'calc(1rem)', '1rem; color: red', 'red']) {
      expect(stringIssues(gap, ignored, rule)[0]?.severity, ignored).toBe('warning');
    }
    expect(GRID_GAP.test('2.5rem')).toBe(true);
  });

  it('checks a host region name with the player’s rule, and a map locale with Intl', () => {
    expect(REGION_NAME).toBe(HOST_REGION_NAME);
    const name = propOf('host-region', 'name');
    const region = stringRule('host-region', 'name');
    expect(stringIssues(name, 'payment', region)).toEqual([]);
    expect(stringIssues(name, 'Payment', region)[0]?.message).toContain(
      'No host can claim this name'
    );
    const locale = propOf('blocks-map', 'locale');
    const localeRule = stringRule('blocks-map', 'locale');
    expect(stringIssues(locale, 'pt-BR', localeRule)).toEqual([]);
    expect(stringIssues(locale, 'not a tag', localeRule)[0]).toMatchObject({ severity: 'error' });
    expect(isLocaleTag('en-GB')).toBe(true);
    expect(isLocaleTag('')).toBe(false);
  });

  it('applies the chart schemas’ non-empty rule to chart titles and nothing invented elsewhere', () => {
    const title = propOf('charts-line', 'title');
    const rule = stringRule('charts-line', 'title');
    expect(rule?.source).toBe('LineChart chart schema');
    expect(stringIssues(title, '   ', rule)[0]?.severity).toBe('error');
    expect(stringIssues(title, 'Weekly activity', rule)).toEqual([]);
    // Props with no published rule get the renderer's verdict only.
    expect(stringRule('layout-page', 'title')).toBeUndefined();
    expect(stringRule('charts-sparkline', 'period')).toBeUndefined();
  });
});

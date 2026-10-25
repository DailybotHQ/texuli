import { describe, expect, it } from 'vitest';
import {
  type ChoiceProp,
  choiceIssues,
  defaultText,
  enumControl,
  enumInput,
  isChoiceProp,
  readChoice,
  showRaw,
  switchChecked,
} from '../../apps/website/src/components/builder/inspector/choice/model.ts';
import { BUILDER_MANIFESTS } from '../../apps/website/src/components/builder/manifest.ts';

/** Every enum and boolean prop the builder can edit, from the real manifests. */
const CHOICE_PROPS: { id: string; prop: ChoiceProp }[] = BUILDER_MANIFESTS.flatMap((manifest) =>
  manifest.props.filter(isChoiceProp).map((prop) => ({ id: manifest.id, prop }))
);

/** Values a hostile or stale payload might carry. */
const HOSTILE: unknown[] = [
  'evil',
  '',
  ' ',
  0,
  1,
  -1,
  Number.NaN,
  null,
  {},
  [],
  ['light'],
  { value: 'light' },
  'true',
  'false',
  '<b>x</b>',
  '<img src=x onerror=alert(1)>',
  '\u202Edark',
  '__proto__',
  'constructor',
  'x'.repeat(10_000),
];

/** The rule the renderer applies, written out independently of it. */
function oracle(prop: ChoiceProp, value: unknown): 'unset' | 'set' | 'invalid' {
  if (value === undefined) return 'unset';
  if (prop.kind === 'boolean') return typeof value === 'boolean' ? 'set' : 'invalid';
  return typeof value === 'string' && (prop.enumValues ?? []).includes(value) ? 'set' : 'invalid';
}

describe('choice props in the builder manifests', () => {
  it('covers every enum and boolean prop the builder edits', () => {
    // PLAN_005 task 5 adds the G20 layouts: row align and wrap, stack, row and split gaps, split ratio.
    expect(CHOICE_PROPS.length).toBe(39);
    expect(CHOICE_PROPS.filter((entry) => entry.prop.kind === 'boolean')).toHaveLength(7);
    const ids = new Set(CHOICE_PROPS.map((entry) => `${entry.id}.${entry.prop.name}`));
    for (const name of [
      'layout-stack.gap',
      'layout-row.align',
      'layout-row.wrap',
      'layout-split.ratio',
    ]) {
      expect(ids.has(name), name).toBe(true);
    }
  });

  it('reads every value exactly as the renderer will: unset, accepted or refused', () => {
    let checked = 0;
    for (const { id, prop } of CHOICE_PROPS) {
      const values: unknown[] = [
        undefined,
        true,
        false,
        ...(prop.enumValues ?? []),
        ...(prop.enumValues ?? []).flatMap((value) => [
          value.toUpperCase(),
          ` ${value}`,
          `${value} `,
        ]),
        ...HOSTILE,
      ];
      for (const value of values) {
        const expected = oracle(prop, value);
        const reading = readChoice(prop, value);
        expect(reading.state, `${id}.${prop.name} = ${showRaw(value)}`).toBe(expected);
        if (reading.state === 'invalid') {
          expect(reading.message.length).toBeGreaterThan(0);
          expect(choiceIssues(prop, value).some((issue) => issue.severity === 'error')).toBe(true);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('accepts every closed-set value as input and refuses anything else', () => {
    for (const { id, prop } of CHOICE_PROPS) {
      if (prop.kind !== 'enum') continue;
      for (const value of prop.enumValues ?? []) {
        expect(enumInput(prop, value), `${id}.${prop.name}`).toEqual({ ok: true, value });
      }
      for (const outsider of [
        'evil',
        (prop.enumValues?.[0] ?? '').toUpperCase(),
        ' x',
        '__proto__',
      ].filter((candidate) => !prop.enumValues?.includes(candidate))) {
        expect(enumInput(prop, outsider), `${id}.${prop.name} ${outsider}`).toEqual({ ok: false });
      }
      // "Not set" exists only for optional props.
      expect(enumInput(prop, '')).toEqual(
        prop.required === true ? { ok: false } : { ok: true, value: undefined }
      );
    }
  });

  it('uses radios for up to four values and a select above that', () => {
    for (const { prop } of CHOICE_PROPS) {
      if (prop.kind !== 'enum') continue;
      expect(enumControl(prop)).toBe((prop.enumValues?.length ?? 0) <= 4 ? 'radio' : 'select');
    }
    const fit = CHOICE_PROPS.find(
      (entry) => entry.id === 'media-image' && entry.prop.name === 'fit'
    );
    expect(fit && enumControl(fit.prop)).toBe('select');
  });
});

describe('choice issues', () => {
  const find = (id: string, name: string) => {
    const entry = CHOICE_PROPS.find(
      (candidate) => candidate.id === id && candidate.prop.name === name
    );
    if (!entry) throw new Error(`${id}.${name} not found`);
    return entry.prop;
  };

  it('asks for a value when a required prop is unset, and only then', () => {
    const kind = find('charts-cartesian', 'kind');
    expect(choiceIssues(kind, undefined)).toEqual([
      { severity: 'error', message: 'Required: choose a value.' },
    ]);
    expect(choiceIssues(kind, 'line')).toEqual([]);
    expect(choiceIssues(find('charts-line', 'mode'), undefined)).toEqual([]);
  });

  it('warns when a pinned prop is set to anything but the pinned value', () => {
    const trust = find('media-image', 'trust');
    expect(choiceIssues(trust, 'developer', 'untrusted')).toEqual([
      {
        severity: 'warning',
        message: 'The player always paints this as “untrusted”; a blueprint cannot change it.',
      },
    ]);
    expect(choiceIssues(trust, 'untrusted', 'untrusted')).toEqual([]);
    expect(choiceIssues(trust, undefined, 'untrusted')).toEqual([]);
  });

  it('explains a refused value with the renderer reason and the value as text', () => {
    const [issue] = choiceIssues(find('charts-line', 'mode'), '<b>dark</b>');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('"<b>dark</b>"');
    expect(issue?.message).toContain('will be refused at paint');
  });
});

describe('switches, defaults and raw values', () => {
  it('shows a boolean value, else its default, else off', () => {
    const toc = CHOICE_PROPS.find(
      (entry) => entry.id === 'layout-doc' && entry.prop.name === 'toc'
    );
    if (!toc) throw new Error('layout-doc.toc not found');
    expect(switchChecked(toc.prop, undefined)).toBe(true);
    expect(switchChecked(toc.prop, false)).toBe(false);
    expect(switchChecked(toc.prop, 'yes')).toBe(true);
    expect(defaultText(toc.prop)).toBe('Default: on. A default is not saved.');
    for (const { prop } of CHOICE_PROPS) {
      if (prop.kind === 'boolean' && prop.default === undefined) {
        expect(switchChecked(prop, undefined)).toBe(false);
        expect(defaultText(prop)).toBeUndefined();
      }
    }
  });

  it('shows refused values as short JSON text', () => {
    expect(showRaw('evil')).toBe('"evil"');
    expect(showRaw({ a: 1 })).toBe('{"a":1}');
    expect(showRaw(null)).toBe('null');
    expect(showRaw(Number.NaN)).toBe('null');
    const long = showRaw('x'.repeat(10_000));
    expect([...long].length).toBe(61);
    expect(long.endsWith('…')).toBe(true);
  });
});

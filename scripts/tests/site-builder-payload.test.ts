// @vitest-environment node

import { blueprintDigest, canonicalBlueprintJson } from '@texuli/catalog/edit';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import {
  createBuilderHistory,
  duplicateJsonKeys,
  validateBuilderTree,
} from '../../apps/website/src/components/builder/model.ts';
import {
  builderTreeIssues,
  checkPayloadText,
  describeIssue,
  locateJson,
  parseErrorPosition,
  positionAt,
  positionIndex,
  prettyBlueprintJson,
} from '../../apps/website/src/components/builder/payload/model.ts';

/**
 * The builder's payload panel (builder design §6, Task 71): blueprint text and
 * structured edits round-trip, and refused text is never applied in part.
 */

const text = (markdown: string): CatalogTreeInput => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});
const report: CatalogTreeInput = {
  id: 'layout-page',
  props: { title: 'Fictional weekly report' },
  children: [
    { id: 'layout-card', props: { title: 'Summary' }, children: [text('Closed **38** items.')] },
    {
      id: 'blocks-text',
      props: { block: { type: 'heading', level: 2, text: 'Next week' } },
    },
  ],
};

describe('round trip', () => {
  it('shows canonical JSON with a 2-space indent, and reads back to the same tree', () => {
    const pretty = prettyBlueprintJson(report);
    expect(pretty.split('\n').length).toBeGreaterThan(10);
    expect(pretty).toBe(JSON.stringify(JSON.parse(canonicalBlueprintJson(report)), null, 2));
    const back = checkPayloadText(pretty);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(canonicalBlueprintJson(back.tree)).toBe(canonicalBlueprintJson(report));
  });

  it('is idempotent after the first normalization, whatever the input formatting', () => {
    const messy =
      '{ "children": [ ], "props" : {"title":"A\\u0020B","toc":true}, "id":"layout-doc" }';
    const first = checkPayloadText(messy);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const once = prettyBlueprintJson(first.tree);
    const again = checkPayloadText(once);
    expect(again.ok && prettyBlueprintJson(again.tree)).toBe(once);
    expect(once).toContain('"title": "A B"');
  });

  it('keeps the digest the player computes over canonical JSON', async () => {
    const back = checkPayloadText(prettyBlueprintJson(report));
    if (!back.ok) throw new Error('refused');
    expect(await blueprintDigest(back.tree)).toBe(await blueprintDigest(report));
  });

  it('reflects an inspector write, and a committed text is one replaceAll entry', () => {
    const history = createBuilderHistory(report);
    const write = history.apply({ op: 'setProp', path: [0], name: 'title', value: 'Highlights' });
    expect(write.ok).toBe(true);
    expect(prettyBlueprintJson(history.tree)).toContain('"title": "Highlights"');

    const edited = prettyBlueprintJson(history.tree).replace('Highlights', 'Edited in JSON');
    const checked = checkPayloadText(edited);
    if (!checked.ok) throw new Error('refused');
    expect(history.apply({ op: 'replaceAll', tree: checked.tree }).ok).toBe(true);
    expect(prettyBlueprintJson(history.tree)).toBe(edited);
    expect(history.undo()).toBe(true);
    expect(prettyBlueprintJson(history.tree)).toContain('"title": "Highlights"');
  });
});

describe('refused text is line-precise and never applied in part', () => {
  const lines = (...rows: string[]) => rows.join('\n');

  it('places a parse error, even when the engine names no position', () => {
    const broken = lines(
      '{',
      '  "id": "layout-page",',
      '  "props": {',
      '    "title": ',
      '  }',
      '}'
    );
    const result = checkPayloadText(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/^JSON parse failed/);
    expect(result.issues[0]?.at).toMatchObject({ line: 5, column: 3 });
    expect(locateJson(broken).stoppedAt).toBe(broken.indexOf('}'));
  });

  it.each([
    ['position', 'Unexpected token at position 5', { line: 2, column: 4 }],
    ['line and column', 'Bad thing (line 2 column 3)', { line: 2, column: 3 }],
    ['the end of input', 'Unexpected end of JSON input', { line: 3, column: 3 }],
  ])('reads a parse error %s from the engine message', (_label, message, at) => {
    expect(parseErrorPosition('{\n "a"\n }', message)).toMatchObject(at);
  });

  it('points at the second key of a duplicate, which JSON.parse would keep silently', () => {
    const doubled = lines(
      '{',
      '  "id": "layout-page",',
      '  "props": {',
      '    "title": "first",',
      '    "title": "second"',
      '  }',
      '}'
    );
    const result = checkPayloadText(doubled);
    if (result.ok) throw new Error('accepted');
    expect(result.issues).toEqual([
      expect.objectContaining({
        path: ['props', 'title'],
        at: expect.objectContaining({ line: 5, column: 5 }),
      }),
    ]);
    expect(result.issues[0]?.message).toContain('Duplicate JSON keys');
    expect(duplicateJsonKeys(doubled)).toEqual(['props.title']);
  });

  it('points at each refused id, prop and field', () => {
    const hostile = prettyBlueprintJson({
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [
        { id: 'layout-card', props: { title: 'A', colour: 'red' } },
        { id: 'dialog', props: { title: 'Delete?' } },
      ],
    }).replace('"title": "A"', '"title": "A",\n          "onclick": "alert(1)"');
    const result = checkPayloadText(hostile);
    if (result.ok) throw new Error('accepted');
    const placed = result.issues.map((issue) => [issue.path?.join('.'), issue.at?.line]);
    const lineOf = (needle: string) =>
      hostile.split('\n').findIndex((row) => row.includes(needle)) + 1;
    expect(placed).toEqual([
      ['children.0.props.colour', lineOf('"colour"')],
      ['children.0.props.onclick', lineOf('"onclick"')],
      ['children.1.id', lineOf('"dialog"')],
    ]);
    expect(describeIssue(result.issues[2] as never)).toMatch(
      /^Line \d+, column \d+: "dialog" is not a component/
    );
  });

  it('refuses exactly what the builder history refuses, so text and inspector share one closed rule', () => {
    const cases: unknown[] = [
      report,
      { id: 'layout-page', props: { class: 'x' } },
      { id: 'layout-page', props: { onClick: 'x' } },
      { id: 'layout-page', props: { nope: 1 } },
      { id: 'dialog' },
      { id: 'layout-page', children: {} },
      { id: 'layout-page', props: [] },
      [report],
      'layout-page',
    ];
    for (const value of cases) {
      expect(builderTreeIssues(value).length === 0, JSON.stringify(value)).toBe(
        validateBuilderTree(value)
      );
    }
  });

  it('leaves the draft untouched when any part of the text is refused', () => {
    const history = createBuilderHistory(report);
    const before = history.tree;
    const partlyGood = prettyBlueprintJson(report).replace('"Summary"', '"Summary", "nope": 1');
    const result = checkPayloadText(partlyGood);
    expect(result.ok).toBe(false);
    // The panel applies only an accepted check, so nothing reached the history.
    expect(history.tree).toBe(before);
    expect(history.canUndo).toBe(false);
  });

  it('refuses text over the byte cap before parsing it', () => {
    const huge = `{"id":"layout-page","props":{"title":"${'x'.repeat(300_000)}"}}`;
    const result = checkPayloadText(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.message).toMatch(/byte limit/);
  });

  it('refuses 200-deep trees and dangerous prop names in both panel and direct history commits', () => {
    let deep: unknown = { id: 'blocks-text' };
    for (let index = 0; index < 200; index += 1) {
      deep = { id: 'layout-card', children: [deep] };
    }

    const hostile = [
      JSON.stringify(deep),
      '{"id":"layout-page","props":{"__proto__":{"polluted":true}}}',
      '{"id":"layout-page","props":{"onClick":"alert(1)"}}',
      '{"id":"layout-page","props":{"class":"hostile"}}',
      '{"id":"layout-page","props":{"style":{"position":"fixed"}}}',
    ];

    for (const source of hostile) {
      const panel = checkPayloadText(source);
      expect(panel.ok, source.slice(0, 80)).toBe(false);

      const history = createBuilderHistory(report);
      const before = history.tree;
      const direct = history.apply({
        op: 'replaceAll',
        tree: JSON.parse(source) as CatalogTreeInput,
      });
      expect(direct.ok, source.slice(0, 80)).toBe(false);
      expect(history.tree).toBe(before);
      expect(history.canUndo).toBe(false);
    }

    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('counts lines and columns from 1', () => {
    expect(positionAt('ab\ncd', 4)).toEqual({ offset: 4, line: 2, column: 2 });
  });

  it('places many issues through one line index, with the same positions as a rescan', () => {
    for (const text of [
      '',
      'a',
      '\n',
      'ab\ncd',
      '\n\nx\n',
      '{\n  "a": 1,\n\n  "b": [\n    2\n  ]\n}\n',
    ]) {
      const at = positionIndex(text);
      for (let offset = -2; offset <= text.length + 2; offset += 1) {
        expect(at(offset), `${JSON.stringify(text)} @ ${offset}`).toEqual(positionAt(text, offset));
      }
    }
  });
});

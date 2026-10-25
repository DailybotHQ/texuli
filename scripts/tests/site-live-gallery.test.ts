// @vitest-environment node
/**
 * Unit tests for the living component gallery: every catalog id has a real
 * stage, the props panel offers only props its stage applies, the preview
 * protocol drops anything but plain values, and the code sample prints the
 * exact import.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPONENT_PAGES } from '../../apps/website/src/components/component-pages/load-manifests.ts';
import { buildGalleryComponentCards } from '../../apps/website/src/components/gallery-components/index.ts';
import {
  PREVIEW_PATH,
  previewUrl,
  sanitizePreviewState,
  sanitizePreviewValues,
} from '../../apps/website/src/components/live/preview.ts';
import { formatStageCode } from '../../apps/website/src/components/live/props-state.ts';
import { STAGE_CONTROLS } from '../../apps/website/src/components/live/stage-controls.ts';
import { STAGE_MAP, stageFor } from '../../apps/website/src/components/live/stage-map.ts';

const STAGES = resolve('apps/website/src/components/live/stages');
const FAMILY_FILES: Record<string, string> = {
  badge: 'BadgeStage',
  blocks: 'BlocksStage',
  button: 'ButtonStage',
  chart: 'ChartStage',
  choice: 'ChoiceStage',
  combobox: 'ComboboxStage',
  command: 'CommandStage',
  data: 'DataStage',
  dialog: 'DialogStage',
  feedback: 'FeedbackStage',
  field: 'FieldStage',
  layout: 'LayoutStage',
  media: 'MediaStage',
  menu: 'MenuStage',
  nav: 'NavStage',
  'page-layout': 'PageLayoutStage',
  popover: 'PopoverStage',
  select: 'SelectStage',
  sheet: 'SheetStage',
  table: 'TableStage',
  toast: 'ToastStage',
};
const EDITABLE = new Set(['string', 'number', 'boolean', 'enum']);

describe('living gallery stage map', () => {
  const ids = COMPONENT_PAGES.map((entry) => entry.id);

  it('gives every catalog id a stage, and nothing else', () => {
    // Every catalog id, whatever the catalog holds (no literal count).
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(STAGE_MAP).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(stageFor(id), id).toBeDefined();
    expect(stageFor('toString')).toBeUndefined();
  });

  it('maps every family to a stage file that exists', () => {
    for (const entry of Object.values(STAGE_MAP)) {
      const file = FAMILY_FILES[entry.family];
      expect(file, entry.family).toBeDefined();
      expect(existsSync(join(STAGES, `${file}.svelte`)), file).toBe(true);
    }
  });

  it('names a public import for every id', () => {
    for (const [id, entry] of Object.entries(STAGE_MAP)) {
      expect(entry.from, id).toMatch(/^(texuli|@texuli\/[a-z-]+)(\/[a-z-]+)*$/);
      expect(entry.name, id).toMatch(/^[A-Za-z]+$/);
    }
  });
});

describe('living gallery props panel', () => {
  it('offers only editable manifest props that the stage reads', () => {
    for (const entry of COMPONENT_PAGES) {
      const controls = STAGE_CONTROLS[entry.id];
      expect(controls, entry.id).toBeDefined();
      const family = STAGE_MAP[entry.id]?.family ?? '';
      const source = readFileSync(join(STAGES, `${FAMILY_FILES[family]}.svelte`), 'utf8');
      for (const name of controls ?? []) {
        const prop = entry.props.find((p) => p.name === name);
        expect(prop, `${entry.id}.${name} in the manifest`).toBeDefined();
        expect(EDITABLE.has(prop?.kind ?? ''), `${entry.id}.${name} editable`).toBe(true);
        expect(source, `${entry.id}.${name} read by ${family}`).toMatch(
          new RegExp(`(?:str|num|bool|pick)\\('${name}'`)
        );
      }
    }
  });

  it('builds cards with those controls and plain starting values', () => {
    const cards = buildGalleryComponentCards();
    expect(cards).toHaveLength(COMPONENT_PAGES.length);
    for (const card of cards) {
      expect(card.controls.map((c) => c.name)).toEqual(
        COMPONENT_PAGES.find((e) => e.id === card.id)
          ?.props.map((p) => p.name)
          .filter((name) => STAGE_CONTROLS[card.id]?.includes(name))
      );
      for (const value of Object.values(card.initial)) {
        expect(['string', 'number', 'boolean']).toContain(typeof value);
      }
    }
    const button = cards.find((c) => c.id === 'button');
    expect(button?.controls.map((c) => c.name)).toContain('variant');
    expect(button?.initial.variant).toBe('default');
  });
});

describe('living gallery preview protocol', () => {
  it('keeps plain values and drops URLs, handlers, markup hooks and objects', () => {
    expect(
      sanitizePreviewValues({
        title: 'Hello',
        count: 3,
        open: true,
        href: 'javascript:alert(1)',
        src: 'https://example.com/x.png',
        onclick: 'alert(1)',
        class: 'x',
        style: 'color:red',
        series: [1, 2],
        nested: { a: 1 },
        nan: Number.NaN,
        'bad-key': 'x',
      })
    ).toEqual({ title: 'Hello', count: 3, open: true });
    expect(sanitizePreviewValues('nope')).toEqual({});
    expect(sanitizePreviewValues(null)).toEqual({});
    expect(sanitizePreviewValues({ text: 'x'.repeat(500) }).text).toHaveLength(200);
  });

  it('defaults mode and direction to light and left to right', () => {
    expect(sanitizePreviewState({ values: { a: 1 }, mode: 'neon', dir: 'up' })).toEqual({
      values: { a: 1 },
      mode: 'light',
      dir: 'ltr',
    });
    expect(sanitizePreviewState({ mode: 'dark', dir: 'rtl' })).toEqual({
      values: {},
      mode: 'dark',
      dir: 'rtl',
    });
    expect(sanitizePreviewState(7)).toBeNull();
  });

  it('builds the preview URL under the site base', () => {
    expect(PREVIEW_PATH).toBe('/gallery-components/preview/');
    expect(previewUrl('select-item', 'dark', 'rtl')).toBe(
      '/gallery-components/preview/?id=select-item&mode=dark&dir=rtl'
    );
  });
});

describe('living gallery code sample', () => {
  it('prints the exact import and only non-default props', () => {
    const code = formatStageCode(
      STAGE_MAP.button as NonNullable<(typeof STAGE_MAP)['button']>,
      { variant: 'outline', size: 'md', disabled: true, label: '', series: [1] },
      [
        { name: 'variant', kind: 'enum', default: 'default' },
        { name: 'size', kind: 'enum', default: 'md' },
        { name: 'disabled', kind: 'boolean', default: false },
      ]
    );
    expect(code).toBe(
      'import { Button } from \'texuli/button\';\n\n<Button variant="outline" disabled>\n  Save note\n</Button>'
    );
  });

  it('prints compound parts, loaders and quoted values', () => {
    const item = formatStageCode(STAGE_MAP['select-item'] as never, { label: 'Pro "plus"' });
    expect(item).toContain("import { Select } from 'texuli/select';");
    expect(item).toContain('<Select.Item label={"Pro \\"plus\\""} />');
    const docs = formatStageCode(STAGE_MAP['layout-docs'] as never, {});
    expect(docs).toContain("import { loadDocsLayout } from 'texuli/layouts/content/docs';");
    expect(docs).toContain('const { default: DocsLayout } = await loadDocsLayout();');
    const many = formatStageCode(STAGE_MAP.alert as never, {
      tone: 'warning',
      title: 'T',
      text: 'X',
    });
    expect(many).toContain('<Alert\n  tone="warning"\n  title="T"\n  text="X"\n/>');
  });
});

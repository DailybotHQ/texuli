/// <reference types="node" />
/**
 * Component defaults (ADR-020, T-adopt-core): `setDesignDefaults` gives every
 * styled component with a `variant` or `size` prop its default, used only when
 * the prop is undefined; the vocabulary is closed and equals each family's
 * exported constants; untrusted input is filtered with JSON paths.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { AVATAR_SIZES } from '../src/components/avatar/index.ts';
import { BADGE_VARIANTS } from '../src/components/badge/index.ts';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '../src/components/button/index.ts';
import { CARD_VARIANTS } from '../src/components/card/index.ts';
import { CHOICE_SIZES, RADIO_VARIANTS } from '../src/components/choice/index.ts';
import { COMBOBOX_SIZES, COMBOBOX_VARIANTS } from '../src/components/combobox/index.ts';
import { COMMAND_SIZES, COMMAND_VARIANTS } from '../src/components/command/index.ts';
import { DATE_SIZES } from '../src/components/date/index.ts';
import { DIALOG_SIZES } from '../src/components/dialog/index.ts';
import { FEEDBACK_SIZES } from '../src/components/feedback/index.ts';
import { FILE_UPLOAD_VARIANTS } from '../src/components/file-upload/index.ts';
import { ICON_SIZES } from '../src/components/icons/icon-variants.ts';
import { CODE_VARIANTS, COPY_BUTTON_SIZES } from '../src/components/kbd-code/index.ts';
import { MENU_SIZES, MENU_VARIANTS } from '../src/components/menus/index.ts';
import { NAV_SIZES, PAGINATION_VARIANTS } from '../src/components/navigation/index.ts';
import { NUMBER_PIN_SIZES } from '../src/components/number-pin/index.ts';
import { POPOVER_SIZES, POPOVER_VARIANTS } from '../src/components/popover/index.ts';
import { RATING_SIZES } from '../src/components/rating/index.ts';
import { RESIZABLE_HANDLE_SIZES, RESIZABLE_VARIANTS } from '../src/components/resizable/index.ts';
import { SCROLL_AREA_SIZES } from '../src/components/scroll-area/index.ts';
import { SELECT_SIZES, SELECT_VARIANTS } from '../src/components/select/index.ts';
import { SEPARATOR_VARIANTS } from '../src/components/separator-aspect/index.ts';
import { SHEET_SIZES } from '../src/components/sheet/index.ts';
import { SIDEBAR_VARIANTS } from '../src/components/sidebar/index.ts';
import { SLIDER_SIZES } from '../src/components/slider/index.ts';
import { TABLE_VARIANTS } from '../src/components/table/index.ts';
import { ACCORDION_VARIANTS, TABS_VARIANTS } from '../src/components/tabs-accordion/index.ts';
import { TOGGLE_SIZES, TOGGLE_VARIANTS } from '../src/components/toggle/index.ts';
import { TOOLBAR_SIZES, TOOLBAR_VARIANTS } from '../src/components/toolbar/index.ts';
import { TREE_VARIANTS } from '../src/components/tree/index.ts';
import {
  DESIGN_DEFAULTS_COMPONENTS,
  DESIGN_DEFAULTS_VOCABULARY,
  type DesignDefaults,
  getDesignDefaults,
  isDesignDefaultsComponent,
  mergeDesignDefaults,
  validateDesignDefaults,
} from '../src/defaults/index.ts';
import * as root from '../src/index.ts';
import ComboboxHarness from './fixtures/ComboboxHarness.svelte';
import Harness from './fixtures/DesignDefaultsHarness.svelte';
import Parts from './fixtures/DesignDefaultsParts.svelte';
import Reactive from './fixtures/DesignDefaultsReactive.svelte';
import MenusHarness from './fixtures/MenusHarness.svelte';
import ResizableHarness from './fixtures/ResizableHarness.svelte';

afterEach(cleanup);

const SRC = join(__dirname, '../src/components');
type Vocab = Record<string, Record<string, readonly string[]>>;
const VOCAB = DESIGN_DEFAULTS_VOCABULARY as unknown as Vocab;

/** Every component that wires `designDefaults(id)`: file → id, props and built-in fallbacks. */
function wiredComponents(): { file: string; id: string; fallbacks: Record<string, string> }[] {
  const out: { file: string; id: string; fallbacks: Record<string, string> }[] = [];
  for (const dir of readdirSync(SRC)) {
    for (const name of readdirSync(join(SRC, dir))) {
      if (!name.endsWith('.svelte')) continue;
      const source = readFileSync(join(SRC, dir, name), 'utf8');
      const id = /designDefaults\('([a-z-]+)'\)/.exec(source)?.[1];
      if (!id) continue;
      const fallbacks: Record<string, string> = {};
      for (const match of source.matchAll(
        /const (variant|size) = \$derived\(withDefault\(\1Prop, txDefaults\(\)\.\1, '([^']+)'\)\);/g
      )) {
        fallbacks[match[1] as string] = match[2] as string;
      }
      out.push({ file: `${dir}/${name}`, id, fallbacks });
    }
  }
  return out;
}

/** True when some element carries `<block>--<value>` or `data-<prop>="<value>"`. */
function shows(prop: string, value: string): boolean {
  const pattern = new RegExp(`(^|\\s)[a-z0-9_-]+--${value}(\\s|$)`);
  for (const element of document.body.querySelectorAll('*')) {
    if (element.getAttribute(`data-${prop}`) === value) return true;
    if (pattern.test(element.getAttribute('class') ?? '')) return true;
  }
  return false;
}

describe('design defaults: the closed vocabulary', () => {
  it('equals every family’s exported variant and size lists', () => {
    const expected: Record<string, Record<string, readonly string[]>> = {
      accordion: { variant: ACCORDION_VARIANTS },
      avatar: { size: AVATAR_SIZES },
      badge: { variant: BADGE_VARIANTS },
      breadcrumb: { size: NAV_SIZES },
      button: { variant: BUTTON_VARIANTS, size: BUTTON_SIZES },
      card: { variant: CARD_VARIANTS },
      chip: { variant: BADGE_VARIANTS },
      choice: { size: CHOICE_SIZES },
      code: { variant: CODE_VARIANTS },
      combobox: { variant: COMBOBOX_VARIANTS, size: COMBOBOX_SIZES },
      command: { variant: COMMAND_VARIANTS, size: COMMAND_SIZES },
      'copy-button': { size: COPY_BUTTON_SIZES },
      date: { size: DATE_SIZES },
      dialog: { size: DIALOG_SIZES },
      empty: { size: ['sm', 'md'] },
      'file-upload': { variant: FILE_UPLOAD_VARIANTS },
      icon: { size: Object.keys(ICON_SIZES) },
      'icon-button': { variant: BUTTON_VARIANTS, size: BUTTON_SIZES },
      label: { size: ['sm', 'md'] },
      menu: { variant: MENU_VARIANTS, size: MENU_SIZES },
      navigation: { size: NAV_SIZES },
      'number-field': { size: NUMBER_PIN_SIZES },
      pagination: { variant: PAGINATION_VARIANTS, size: NAV_SIZES },
      'pin-input': { size: NUMBER_PIN_SIZES },
      popover: { variant: POPOVER_VARIANTS, size: POPOVER_SIZES },
      progress: { size: FEEDBACK_SIZES },
      'radio-group': { variant: RADIO_VARIANTS, size: CHOICE_SIZES },
      rating: { size: RATING_SIZES },
      resizable: { variant: RESIZABLE_VARIANTS },
      'resizable-handle': { size: RESIZABLE_HANDLE_SIZES },
      'scroll-area': { size: SCROLL_AREA_SIZES },
      select: { variant: SELECT_VARIANTS, size: SELECT_SIZES },
      separator: { variant: SEPARATOR_VARIANTS },
      sheet: { size: SHEET_SIZES },
      sidebar: { variant: SIDEBAR_VARIANTS },
      skeleton: { size: FEEDBACK_SIZES },
      slider: { size: SLIDER_SIZES },
      spinner: { size: FEEDBACK_SIZES },
      stat: { variant: CARD_VARIANTS },
      table: { variant: TABLE_VARIANTS },
      tabs: { variant: TABS_VARIANTS },
      tag: { variant: BADGE_VARIANTS },
      toggle: { variant: TOGGLE_VARIANTS, size: TOGGLE_SIZES },
      'toggle-group': { variant: TOGGLE_VARIANTS, size: TOGGLE_SIZES },
      toolbar: { variant: TOOLBAR_VARIANTS, size: TOOLBAR_SIZES },
      tree: { variant: TREE_VARIANTS },
    };
    expect(JSON.parse(JSON.stringify(VOCAB))).toEqual(JSON.parse(JSON.stringify(expected)));
    expect([...DESIGN_DEFAULTS_COMPONENTS]).toEqual(Object.keys(expected));
    expect(isDesignDefaultsComponent('button')).toBe(true);
    expect(isDesignDefaultsComponent('nope')).toBe(false);
    for (const name of ['setDesignDefaults', 'getDesignDefaults', 'validateDesignDefaults']) {
      expect(typeof (root as Record<string, unknown>)[name], name).toBe('function');
    }
  });

  it('every component with a variant or size prop reads its defaults, with the prop’s old fallback', () => {
    const wired = wiredComponents();
    expect(wired.length).toBe(71);
    for (const { file, id, fallbacks } of wired) {
      const props = Object.keys(fallbacks);
      expect(props.length, file).toBeGreaterThan(0);
      expect(Object.keys(VOCAB[id] ?? {}).sort(), file).toEqual(expect.arrayContaining(props));
      for (const [prop, fallback] of Object.entries(fallbacks)) {
        expect(VOCAB[id]?.[prop], `${file} ${prop}`).toContain(fallback);
      }
    }
    // Every vocabulary entry has at least one component that reads it.
    expect(new Set(wired.map((entry) => entry.id))).toEqual(new Set(DESIGN_DEFAULTS_COMPONENTS));
    // No styled component keeps a literal variant or size default in its props.
    for (const dir of readdirSync(SRC)) {
      for (const name of readdirSync(join(SRC, dir)).filter((n) => n.endsWith('.svelte'))) {
        const source = readFileSync(join(SRC, dir, name), 'utf8');
        const props = source.slice(source.lastIndexOf('let {', source.indexOf('$props()')));
        expect(props.slice(0, props.indexOf('$props()')), `${dir}/${name}`).not.toMatch(
          /\b(variant|size) = '/
        );
      }
    }
  });
});

describe('design defaults: untrusted input', () => {
  it('keeps only known components, props and values, and reports the rest with paths', () => {
    const cases: [unknown, DesignDefaults, string[]][] = [
      [null, {}, ['']],
      [[], {}, ['']],
      ['button', {}, ['']],
      [{ button: { variant: 'outline' } }, { button: { variant: 'outline' } }, []],
      [{ button: { variant: 'neon' } }, {}, ['button.variant']],
      [{ button: { variant: 3 } }, {}, ['button.variant']],
      [{ button: { tone: 'info' } }, {}, ['button.tone']],
      [{ buton: { size: 'sm' } }, {}, ['buton']],
      [{ card: 'flat' }, {}, ['card']],
      [{ card: { size: 'sm' } }, {}, ['card.size']],
      [{ __proto__: { size: 'sm' } }, {}, []],
      [JSON.parse('{"__proto__": {"variant": "outline"}}'), {}, ['__proto__']],
      [{ constructor: { variant: 'outline' } }, {}, ['constructor']],
      [{ button: { variant: undefined, size: 'sm' } }, { button: { size: 'sm' } }, []],
      [
        { select: { size: 'lg', variant: '<img src=x>' }, toolbar: { variant: 'ghost' } },
        { select: { size: 'lg' }, toolbar: { variant: 'ghost' } },
        ['select.variant'],
      ],
    ];
    for (const [input, defaults, paths] of cases) {
      const result = validateDesignDefaults(input);
      expect(result.defaults, JSON.stringify(input)).toEqual(defaults);
      expect(
        result.issues.map((issue) => issue.path),
        JSON.stringify(input)
      ).toEqual(paths);
      for (const issue of result.issues) expect(issue.message.length).toBeGreaterThan(5);
    }
    expect(Object.getPrototypeOf({})).toEqual(Object.prototype);
    expect(
      mergeDesignDefaults(
        { button: { variant: 'outline', size: 'sm' }, card: { variant: 'flat' } },
        { button: { size: 'lg' } }
      )
    ).toEqual({ button: { variant: 'outline', size: 'lg' }, card: { variant: 'flat' } });
    // Outside a component there is no context to read.
    expect(() => getDesignDefaults()).toThrow();
  });
});

// biome-ignore lint/suspicious/noExplicitAny: any styled component
type AnyComponent = Component<any>;
const load = async (file: string) =>
  ((await import(`../src/components/${file}`)) as { default: AnyComponent }).default;

/** How to render a component so its own variant or size shows. */
const RENDER: Record<string, { component?: AnyComponent; props?: Record<string, unknown> }> = {
  'avatar/Avatar.svelte': { props: { name: 'Ada Lovelace' } },
  'choice/RadioGroup.svelte': {
    props: { 'aria-label': 'Plan', items: [{ value: 'a', label: 'A' }] },
  },
  'avatar/AvatarGroup.svelte': { props: { items: [{ name: 'Ada Lovelace' }] } },
  'combobox/ComboboxField.svelte': { component: ComboboxHarness },
  'combobox/ComboboxInput.svelte': { component: ComboboxHarness },
  'combobox/ComboboxContent.svelte': { component: ComboboxHarness, props: { open: true } },
  'select/SelectContent.svelte': { component: Parts, props: { mode: 'select' } },
  'dialog/Dialog.svelte': { props: { open: true, title: 'Rename' } },
  'icons/Icon.svelte': { props: { icon: 'info' } },
  'icons/LucideIcon.svelte': { props: { icon: 'info' } },
  'menus/DropdownMenuTrigger.svelte': { component: MenusHarness, props: { open: true } },
  'menus/MenuContent.svelte': { component: MenusHarness, props: { open: true } },
  'menus/ContextMenuContent.svelte': {
    component: MenusHarness,
    props: { mode: 'context', open: true },
  },
  'menus/MenubarTrigger.svelte': { component: MenusHarness, props: { mode: 'menubar' } },
  'navigation/Breadcrumb.svelte': { props: { items: [{ label: 'Home', href: '/' }] } },
  'popover/PopoverContent.svelte': { component: Parts, props: { mode: 'popover' } },
  'popover/HoverCardContent.svelte': { component: Parts, props: { mode: 'hover-card' } },
  'resizable/ResizableHandle.svelte': { component: ResizableHarness },
  'select/SelectTrigger.svelte': { component: Parts, props: { mode: 'select' } },
  'sheet/SheetContent.svelte': { component: Parts, props: { mode: 'sheet' } },
  'sheet/DrawerContent.svelte': { component: Parts, props: { mode: 'drawer' } },
  'sheet/DetailPanelContent.svelte': { component: Parts, props: { mode: 'detail-panel' } },
  'sheet/ResponsiveModalContent.svelte': {
    component: Parts,
    props: { mode: 'responsive-modal' },
  },
  'tabs-accordion/Tabs.svelte': { props: { items: [{ value: 'a', label: 'A' }] } },
  'toggle/ToggleGroup.svelte': { component: Parts, props: { mode: 'toggle-group' } },
  'tree/TreeView.svelte': { props: { items: [{ id: 'a', label: 'A' }] } },
};

/** Parts whose default only shows through a parent that passes it on, or only when open. */
const RENDER_SKIP = new Set([
  'choice/Radio.svelte', // rendered by RadioGroup, which passes its own size
  'command/CommandPalette.svelte', // closed until opened by its shortcut
  'menus/MenuSubContent.svelte', // the open dropdown covers the menu id
  'menus/MenubarContent.svelte', // the menubar trigger covers the menu id
]);

describe('design defaults: components', () => {
  it('a component uses its design default only when the prop is undefined (every family)', async () => {
    let checked = 0;
    const families = new Set<string>();
    for (const { file, id, fallbacks } of wiredComponents()) {
      if (RENDER_SKIP.has(file)) continue;
      const how = RENDER[file] ?? {};
      const own = !how.component;
      const component = how.component ?? (await load(file));
      for (const [prop, fallback] of Object.entries(fallbacks)) {
        const values = VOCAB[id]?.[prop] ?? [];
        const designed = [...values].reverse().find((value) => value !== fallback) as string;
        const label = `${file} ${prop}=${designed}`;

        // No provider: the built-in default, never the designed value.
        render(Harness, { props: { component, props: how.props } });
        expect(shows(prop, designed), `${label} (no provider)`).toBe(false);
        cleanup();

        // A provider sets the default.
        render(Harness, {
          props: { component, props: how.props, defaults: { [id]: { [prop]: designed } } },
        });
        expect(shows(prop, designed), `${label} (provider)`).toBe(true);
        cleanup();

        // A nested provider wins over the outer one.
        render(Harness, {
          props: {
            component,
            props: how.props,
            defaults: { [id]: { [prop]: fallback } },
            inner: { [id]: { [prop]: designed } },
          },
        });
        expect(shows(prop, designed), `${label} (nested)`).toBe(true);
        cleanup();

        // An explicit prop always wins.
        if (own) {
          render(Harness, {
            props: {
              component,
              props: { ...how.props, [prop]: fallback },
              defaults: { [id]: { [prop]: designed } },
            },
          });
          expect(shows(prop, designed), `${label} (explicit prop)`).toBe(false);
          cleanup();
        }
        checked += 1;
        families.add(file.split('/')[0] as string);
      }
    }
    expect(checked).toBeGreaterThan(80);
    expect(families.size).toBe(33);
    // About 350 mounts: generous under a loaded machine (about 0.5 s alone).
  }, 60_000);

  it('a reactive provider updates mounted components', async () => {
    render(Reactive);
    const target = screen.getByTestId('target');
    expect(target.getAttribute('data-size')).toBe('sm');
    await fireEvent.click(screen.getByRole('button', { name: 'Toggle size' }));
    expect(target.getAttribute('data-size')).toBe('lg');
  });
});

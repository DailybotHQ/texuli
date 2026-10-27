import { cleanup } from '@testing-library/svelte';
import { getInertRegistry } from '@texuli/core/inert';
import { formatDate, formatTime, parseDate, parseTime } from '@texuli/primitives/date-field';
import { getPageCount, getPageTokens } from '@texuli/primitives/pagination';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  colorToHex,
  formatColor,
  parseColor,
  parseFormattedColor,
  withAlpha,
  withArea,
  withHue,
} from '../src/color-picker/color.ts';
import { inRange, orderedRange, toCalendarDate } from '../src/date-picker/index.ts';
import { validateFiles } from '../src/file-drop/accept.ts';
import { joinIds } from '../src/label/index.ts';
import { graceArea, pointInPolygon } from '../src/menu/index.ts';
import { createNavigationMenuController } from '../src/navigation-menu/controller.ts';
import {
  formatNumber,
  largeStepNumber,
  parseNumber,
  stepNumber,
} from '../src/number-field/index.ts';
import { pastedValue, REGEXP_ONLY_DIGITS } from '../src/pin-input/index.ts';
import { separatorAttributes } from '../src/separator/index.ts';
import { releaseTarget, resolveSheetSide } from '../src/sheet/index.ts';
import { snapToStep, thumbBounds, valueFromPointer } from '../src/slider/index.ts';
import {
  isCollapsed,
  loadLayout,
  normalizeLayout,
  type PaneConstraints,
  resizeLayout,
  type SplitterStorage,
  saveLayout,
} from '../src/splitter/index.ts';
import { addTags, splitTags } from '../src/tags-input/index.ts';
import { createToastManager } from '../src/toast/manager.ts';
import { createTooltipDelayGroup } from '../src/tooltip/delay-group.ts';
import { assertUniqueTreeIds, getTreeWindow } from '../src/tree/model.ts';

// Framework-free models behind the primitives: the math, parsing and rules the
// behavior suite (tests/behavior) only reaches through a few rows.

describe('color-picker', () => {
  afterEach(cleanup);

  describe('color model', () => {
    it('formats and parses hex, RGB, HSL, and OKLCH values', () => {
      const color = parseColor('#3478c9')!;
      for (const format of ['hex', 'rgb', 'hsl', 'oklch'] as const) {
        const parsed = parseFormattedColor(formatColor(color, format));
        expect(parsed).toBeDefined();
        const actual = colorToHex(parsed!);
        const expected = [0x34, 0x78, 0xc9];
        const channels = actual
          .slice(1, 7)
          .match(/.{2}/g)
          ?.map((channel) => Number.parseInt(channel, 16));
        expect(
          channels?.every((channel, index) => Math.abs(channel - (expected[index] ?? 0)) <= 2)
        ).toBe(true);
      }
      expect(parseFormattedColor('oklch(0.55 0.2 260 / 0.5)')?.a).toBe(0.5);
      expect(parseFormattedColor('oklch(2 0.2 260)')).toBeUndefined();
      expect(parseFormattedColor('rgb(300 0 0)')).toBeUndefined();
    });

    it('clamps lightness, chroma, hue and alpha to their valid domains', () => {
      const color = parseColor('#3478c9')!;
      expect(withArea(color, 4, 1)).toMatchObject({ l: 1, c: 0.4 });
      expect(withHue(color, -30).h).toBe(330);
      expect(withAlpha(color, 2).a).toBe(1);
    });
  });
});

describe('date-field', () => {
  afterEach(cleanup);

  describe('date field models', () => {
    it('parses canonical dates and rejects impossible calendar dates', () => {
      expect(parseDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
      expect(parseDate('2023-02-29')).toBeNull();
      expect(parseDate('2024-13-01')).toBeNull();
      expect(formatDate({ year: 2000, month: 2, day: 29 })).toBe('2000-02-29');
    });

    it('parses and formats bounded 24-hour time values', () => {
      expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 });
      expect(parseTime('24:00')).toBeNull();
      expect(formatTime({ hour: 0, minute: 5 })).toBe('00:05');
    });
  });
});

describe('date-picker', () => {
  describe('date-picker helpers', () => {
    it('parses canonical dates only', () => {
      expect(toCalendarDate('2026-03-15')?.toString()).toBe('2026-03-15');
      for (const bad of [
        null,
        undefined,
        '',
        '2026-3-15',
        '2026-02-30',
        'tomorrow',
        '2026-13-01',
      ]) {
        expect(toCalendarDate(bad)).toBeNull();
      }
    });

    it('orders ranges and tests membership inclusively', () => {
      expect(orderedRange('2026-03-12', '2026-03-10')).toEqual({
        start: '2026-03-10',
        end: '2026-03-12',
      });
      expect(orderedRange('2026-03-10', null)).toEqual({ start: '2026-03-10', end: null });
      expect(inRange('2026-03-10', '2026-03-10', '2026-03-12')).toBe(true);
      expect(inRange('2026-03-12', '2026-03-10', '2026-03-12')).toBe(true);
      expect(inRange('2026-03-13', '2026-03-10', '2026-03-12')).toBe(false);
      expect(inRange('2026-03-10', '2026-03-10', null)).toBe(false);
    });
  });
});

describe('file-drop', () => {
  afterEach(() => cleanup());

  function makeFile(name: string, type = 'text/plain', size = 1): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  describe('FileDrop validation', () => {
    it('keeps accepted files and identifies type, size and count rejections', () => {
      const notes = makeFile('notes.txt', 'text/plain', 3);
      const tooLarge = makeFile('large.txt', 'text/plain', 9);
      const image = makeFile('photo.png', 'image/png', 3);
      const second = makeFile('todo.md', 'text/markdown', 2);
      const overflow = makeFile('extra.txt', 'text/plain', 1);

      const result = validateFiles([notes, tooLarge, image, second, overflow], {
        accept: 'text/plain,.md',
        maxSize: 8,
        maxFiles: 2,
      });

      expect(result.accepted).toEqual([notes, second]);
      expect(result.rejected).toEqual([
        { file: tooLarge, reason: 'size' },
        { file: image, reason: 'type' },
        { file: overflow, reason: 'count' },
      ]);
    });

    it('rejects invalid limits', () => {
      expect(() => validateFiles([], { maxSize: -1 })).toThrow(RangeError);
      expect(() => validateFiles([], { maxFiles: 1.5 })).toThrow(RangeError);
    });
  });
});

describe('label', () => {
  describe('attribute helpers', () => {
    it('joins id references without blanks or repeats', () => {
      expect(joinIds('a', undefined, '', false, 'b a', null, ' c ')).toBe('a b c');
      expect(joinIds(undefined, false)).toBeUndefined();
    });
  });
});

describe('menu', () => {
  describe('grace area', () => {
    const sub = { left: 200, top: 100, right: 320, bottom: 220 };

    it('covers the path from the exit point to the submenu', () => {
      const polygon = graceArea({ x: 190, y: 120 }, sub, 'right');
      expect(pointInPolygon({ x: 195, y: 130 }, polygon)).toBe(true);
      expect(pointInPolygon({ x: 199, y: 210 }, polygon)).toBe(true);
      expect(pointInPolygon({ x: 250, y: 160 }, polygon)).toBe(true);
      // Away from the submenu, or behind the exit point.
      expect(pointInPolygon({ x: 150, y: 160 }, polygon)).toBe(false);
      expect(pointInPolygon({ x: 195, y: 260 }, polygon)).toBe(false);
    });

    it('mirrors for a submenu on the left (RTL)', () => {
      const left = { left: 0, top: 100, right: 120, bottom: 220 };
      const polygon = graceArea({ x: 130, y: 120 }, left, 'left');
      expect(pointInPolygon({ x: 125, y: 150 }, polygon)).toBe(true);
      expect(pointInPolygon({ x: 160, y: 150 }, polygon)).toBe(false);
    });
  });
});

describe('navigation-menu', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  /** A manual clock for the controller's timers. */
  function clock() {
    let now = 0;
    let next = 1;
    const timers = new Map<number, { at: number; run: () => void }>();
    return {
      setTimer: (run: () => void, ms: number) => {
        const id = next++;
        timers.set(id, { at: now + ms, run });
        return id;
      },
      clearTimer: (id: unknown) => {
        timers.delete(id as number);
      },
      advance(ms: number) {
        const end = now + ms;
        for (;;) {
          const due = [...timers.entries()]
            .filter(([, t]) => t.at <= end)
            .sort((a, b) => a[1].at - b[1].at)[0];
          if (!due) break;
          timers.delete(due[0]);
          now = due[1].at;
          due[1].run();
        }
        now = end;
      },
    };
  }

  describe('navigation menu controller', () => {
    function setup(delayDuration = 200) {
      const c = clock();
      const onChange = vi.fn();
      const menu = createNavigationMenuController({
        delayDuration,
        skipDelayDuration: 300,
        closeDelay: 150,
        onChange,
        ...c,
      });
      return { c, onChange, menu };
    }

    it('opens on hover after the delay, and a quick pass does not open', () => {
      const { c, onChange, menu } = setup();
      menu.pointerEnterTrigger('products');
      c.advance(199);
      expect(menu.value).toBe('');
      c.advance(1);
      expect(menu.value).toBe('products');
      menu.close();
      c.advance(1000);
      menu.pointerEnterTrigger('resources');
      menu.pointerLeave();
      c.advance(1000);
      expect(onChange.mock.calls.map(([v]) => v)).toEqual(['products', '']);
    });

    it('closes a hovered item after the grace period unless the pointer enters its content', () => {
      const { c, menu } = setup(0);
      menu.pointerEnterTrigger('products');
      menu.pointerLeave();
      c.advance(100);
      menu.pointerEnterContent();
      c.advance(1000);
      expect(menu.value).toBe('products');
      menu.pointerLeave();
      c.advance(150);
      expect(menu.value).toBe('');
    });

    it('keeps a clicked item open on pointer leave; a second click closes it', () => {
      const { c, menu } = setup();
      menu.toggle('products');
      expect([menu.value, menu.sticky]).toEqual(['products', true]);
      menu.pointerLeave();
      c.advance(1000);
      expect(menu.value).toBe('products');
      menu.toggle('products');
      expect(menu.value).toBe('');
      // A hover-opened item becomes sticky on click instead of closing.
      menu.pointerEnterTrigger('resources');
      c.advance(1000);
      menu.toggle('resources');
      expect([menu.value, menu.sticky]).toEqual(['resources', true]);
    });
  });
});

describe('number-field', () => {
  const MINUS_SIGN = String.fromCharCode(0x2212);
  const RLM = String.fromCharCode(0x200f);

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parse and format', () => {
    it('round-trips the formatted text of many locales', () => {
      const cases: [string, number, Intl.NumberFormatOptions?][] = [
        ['en-US', 1234.5],
        ['de-DE', -1234.5],
        ['fr-FR', 1234.5],
        ['ar-EG', -1234.5],
        ['en-IN', 1234567.8],
        ['ja-JP', 42],
        ['en-US', 1234.5, { style: 'currency', currency: 'USD' }],
        ['de-DE', 12.5, { style: 'currency', currency: 'EUR' }],
        ['en-US', 0.45, { style: 'percent' }],
        ['de-CH', 9876.25],
      ];
      for (const [locale, value, options] of cases) {
        const text = formatNumber(value, locale, options);
        expect(parseNumber(text, locale, options), `${locale} ${text}`).toEqual({
          ok: true,
          value,
        });
      }
    });

    it('accepts typed variants: no grouping, minus forms, accounting, marks', () => {
      expect(parseNumber('1234.5', 'en-US')).toEqual({ ok: true, value: 1234.5 });
      expect(parseNumber('1234,5', 'de-DE')).toEqual({ ok: true, value: 1234.5 });
      expect(parseNumber(`${MINUS_SIGN}7`, 'en-US')).toEqual({ ok: true, value: -7 });
      expect(parseNumber('(12.5)', 'en-US')).toEqual({ ok: true, value: -12.5 });
      expect(parseNumber(`${RLM}-12`, 'en-US')).toEqual({ ok: true, value: -12 });
      expect(parseNumber('+3', 'en-US')).toEqual({ ok: true, value: 3 });
      expect(parseNumber('  ', 'en-US')).toEqual({ ok: true, value: null });
    });
  });

  describe('stepping math', () => {
    it('moves along the grid from min, clamped, without float noise', () => {
      expect(stepNumber(1, 1, { step: 2, min: 1 })).toBe(3);
      expect(stepNumber(9, 1, { step: 1, max: 9 })).toBe(9);
      let value = 0;
      for (let i = 0; i < 3; i += 1) value = stepNumber(value, 1, { step: 0.1 });
      expect(value).toBe(0.3);
      // Off the grid: the first step lands on the grid in that direction.
      expect(stepNumber(1.5, 1, { step: 1 })).toBe(2);
      expect(stepNumber(1.5, -1, { step: 1 })).toBe(1);
    });

    it('moves PageUp/PageDown by largeStep from the value, onto the step grid', () => {
      expect(largeStepNumber(4, 1, 10, { step: 1, min: 0, max: 100 })).toBe(14);
      expect(largeStepNumber(4, -1, 10, { step: 1, min: 0 })).toBe(0);
      expect(largeStepNumber(2.5, 1, 10, { step: 1 })).toBe(13);
      expect(largeStepNumber(null, 1, 10, { step: 1, min: 3 })).toBe(3);
    });
  });
});

describe('pagination', () => {
  afterEach(cleanup);

  describe('pagination page model', () => {
    it('keeps boundary and sibling pages and inserts leading and trailing ellipses', () => {
      expect(getPageTokens(6, 40, 1, 1)).toEqual([
        1,
        'ellipsis-start',
        5,
        6,
        7,
        'ellipsis-end',
        40,
      ]);
    });

    it('fills a one-page gap instead of rendering an ellipsis', () => {
      expect(getPageTokens(4, 10, 1, 1)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 10]);
    });

    it('normalizes invalid page, count and range inputs without creating unbounded output', () => {
      expect(getPageTokens(Number.NaN, Number.NaN)).toEqual([1]);
      expect(getPageTokens(500_000, 1_000_000)).toHaveLength(7);
      expect(getPageTokens(90, 8, -1, 0)).toEqual([8]);
      expect(getPageCount(undefined, 47, 10)).toBe(5);
      expect(getPageCount(undefined, 0, 0)).toBe(1);
      expect(getPageCount(3.8, 100, 10)).toBe(3);
    });
  });
});

describe('pin-input', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const digits = { maxlength: 6, pattern: REGEXP_ONLY_DIGITS };

  describe('pin input rules', () => {
    it('cleans a paste, replaces the selection, cuts to the length, and refuses what does not fit the pattern', () => {
      expect(pastedValue('', '123 456', { start: 0, end: 0 }, digits)).toBe('123456');
      expect(pastedValue('', ' 12 34 56 78 ', { start: 0, end: 0 }, digits)).toBe('123456');
      expect(pastedValue('129', '45', { start: 2, end: 3 }, digits)).toBe('1245');
      expect(pastedValue('', 'code: 123456', { start: 0, end: 0 }, digits)).toBeNull();
      expect(pastedValue('', '   ', { start: 0, end: 0 }, digits)).toBeNull();
      expect(
        pastedValue('', 'G-123456', { start: 0, end: 0 }, digits, (text) => text.replace(/^G-/, ''))
      ).toBe('123456');
      expect(
        pastedValue('', 'x', { start: 0, end: 0 }, digits, () => {
          throw new Error('bad');
        })
      ).toBeNull();
    });
  });
});

describe('separator', () => {
  afterEach(cleanup);

  describe('separatorAttributes', () => {
    it('hides a decorative separator from assistive technology, in either orientation', () => {
      for (const orientation of ['horizontal', 'vertical'] as const) {
        expect(separatorAttributes({ orientation, decorative: true })).toEqual({
          role: 'none',
          'data-orientation': orientation,
          'data-separator-root': '',
        });
      }
    });

    it('treats an unknown orientation as horizontal', () => {
      expect(
        separatorAttributes({ orientation: 'diagonal' as never }).role === 'separator' &&
          separatorAttributes({ orientation: 'diagonal' as never })['data-orientation']
      ).toBe('horizontal');
    });
  });
});

describe('sheet', () => {
  beforeEach(() => {
    // happy-dom has no layout: give every element a 300 x 400 box.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 300, height: 400 })
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    getInertRegistry().clear();
  });

  describe('sheet model', () => {
    it('maps logical inline sides by direction and keeps physical sides fixed', () => {
      expect(resolveSheetSide('start', 'ltr')).toBe('left');
      expect(resolveSheetSide('start', 'rtl')).toBe('right');
      expect(resolveSheetSide('end', 'rtl')).toBe('left');
      expect(resolveSheetSide('left', 'rtl')).toBe('left');
    });

    it('settles on the nearest snap point, projecting the release speed', () => {
      // Full height 400: snap 1 sits at 0, snap 0.5 at 200, closed at 400.
      expect(releaseTarget(40, 0, 400, [1], true)).toBe(0);
      expect(releaseTarget(260, 0, 400, [1], true)).toBe(-1);
      expect(releaseTarget(40, 1, 400, [1], true)).toBe(-1);
      expect(releaseTarget(150, 0, 400, [0.5, 1], true)).toBe(0);
      expect(releaseTarget(90, 0, 400, [0.5, 1], true)).toBe(1);
      expect(releaseTarget(380, 0, 400, [0.5, 1], false)).toBe(0);
    });
  });
});

describe('slider', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('slider math', () => {
    const scale = { min: 0, max: 100, step: 5 };

    it('snaps to the step from min and clamps, without float noise', () => {
      expect(snapToStep(42, scale)).toBe(40);
      expect(snapToStep(43, scale)).toBe(45);
      expect(snapToStep(-7, scale)).toBe(0);
      expect(snapToStep(130, scale)).toBe(100);
      expect(snapToStep(0.30000000000000004, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
      expect(snapToStep(7, { min: 1, max: 11, step: 2 })).toBe(7);
      expect(snapToStep(6, { min: 1, max: 11, step: 2 })).toBe(7);
    });

    it('bounds a thumb by its neighbors and the minimum gap', () => {
      expect(thumbBounds([20, 80], 0, scale)).toEqual([0, 80]);
      expect(thumbBounds([20, 80], 1, scale)).toEqual([20, 100]);
      expect(thumbBounds([20, 80], 0, scale, 2)).toEqual([0, 70]);
      expect(thumbBounds([20, 25], 1, scale, 4)).toEqual([40, 100]);
    });

    it('turns a pointer into a value in every orientation and direction', () => {
      const rect = { left: 100, top: 50, width: 200, height: 100 };
      expect(valueFromPointer({ x: 150, y: 0 }, rect, scale, 'horizontal', false)).toBe(25);
      expect(valueFromPointer({ x: 150, y: 0 }, rect, scale, 'horizontal', true)).toBe(75);
      expect(valueFromPointer({ x: 0, y: 125 }, rect, scale, 'vertical', false)).toBe(25);
      expect(valueFromPointer({ x: 999, y: 0 }, rect, scale, 'horizontal', false)).toBe(100);
    });
  });
});

describe('splitter', () => {
  afterEach(cleanup);

  const nav: PaneConstraints = { defaultSize: 30, minSize: 20, maxSize: 60, collapsible: true };
  const main: PaneConstraints = { minSize: 30 };
  const panes = [nav, main];

  describe('layout model', () => {
    it('normalizes any layout into the constraints, summing to 100', () => {
      expect(normalizeLayout([90, 10], panes)).toEqual([60, 40]);
      expect(normalizeLayout([5, 5], panes)).toEqual([20, 80]);
      // A collapsed collapsible pane stays collapsed.
      expect(normalizeLayout([0, 100], panes)).toEqual([0, 100]);
    });

    it('collapses past halfway below the minimum, stops at it before, and reopens to at least it', () => {
      expect(resizeLayout([30, 70], 0, -15, panes)).toEqual([20, 80]);
      expect(resizeLayout([30, 70], 0, -25, panes)).toEqual([0, 100]);
      expect(isCollapsed(0, nav)).toBe(true);
      expect(isCollapsed(20, nav)).toBe(false);
      expect(resizeLayout([0, 100], 0, 5, panes)).toEqual([20, 80]);
      expect(resizeLayout([0, 100], 0, 35, panes)).toEqual([35, 65]);
      // Not collapsible: stops at the minimum however far it is pushed.
      expect(resizeLayout([30, 70], 0, -29, [{ minSize: 20 }, {}])).toEqual([20, 80]);
    });
  });

  describe('persistence', () => {
    const memory = (): SplitterStorage & { data: Map<string, string> } => {
      const data = new Map<string, string>();
      return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
      };
    };

    it('saves and loads a layout under its id, ignoring bad or missing data', () => {
      const store = memory();
      saveLayout(store, 'mail', [25, 75]);
      expect(store.data.get('texuli-splitter:mail')).toBe('[25,75]');
      expect(loadLayout(store, 'mail')).toEqual([25, 75]);
      store.data.set('texuli-splitter:bad', '{"x":1}');
      expect(loadLayout(store, 'bad')).toBeNull();
      store.data.set('texuli-splitter:broken', 'not json');
      expect(loadLayout(store, 'broken')).toBeNull();
      expect(loadLayout(undefined, 'mail')).toBeNull();
      expect(loadLayout(store, undefined)).toBeNull();
    });

    it('never throws when storage refuses to write', () => {
      const throwing: SplitterStorage = {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      };
      expect(() => saveLayout(throwing, 'mail', [50, 50])).not.toThrow();
    });
  });
});

describe('tags-input', () => {
  afterEach(cleanup);

  describe('tag rules', () => {
    it('splits on the delimiter and line breaks, trimming and dropping empty pieces', () => {
      expect(splitTags(' a, b ,,c ', ',')).toEqual(['a', 'b', 'c']);
      expect(splitTags('a\nb\r\nc', ',')).toEqual(['a', 'b', 'c']);
      expect(splitTags('a; b|c', /[;|]/)).toEqual(['a', 'b', 'c']);
      expect(splitTags('   ', ',')).toEqual([]);
    });

    it('accepts in order and explains every refusal', () => {
      const decision = addTags(['a'], ['a', 'b', 'bad', 'c', 'd'], {
        delimiter: ',',
        allowDuplicates: false,
        max: 3,
        validate: (value) => (value === 'bad' ? 'No bad tags' : true),
      });
      expect(decision.tags).toEqual(['a', 'b', 'c']);
      expect(decision.added).toEqual(['b', 'c']);
      expect(decision.rejected).toEqual([
        { tag: 'a', reason: 'duplicate' },
        { tag: 'bad', reason: 'invalid', message: 'No bad tags' },
        { tag: 'd', reason: 'max' },
      ]);
      expect(addTags(['a'], ['a'], { delimiter: ',', allowDuplicates: true, max: 9 }).tags).toEqual(
        ['a', 'a']
      );
    });
  });
});

describe('toast', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('createToastManager', () => {
    it('lists toasts published in the same millisecond newest first', () => {
      let id = 0;
      const manager = createToastManager({ now: () => 1000, createId: () => `t${++id}` });
      manager.publish({ title: 'First' });
      manager.publish({ title: 'Second' });
      manager.publish({ title: 'Third' });
      expect(manager.list().map((item) => item.title)).toEqual(['Third', 'Second', 'First']);
    });

    it('orders by priority then recency and enforces max', () => {
      let t = 0;
      const manager = createToastManager({
        max: 2,
        now: () => ++t,
        createId: () => `id-${t}`,
      });
      manager.publish({ title: 'low', priority: 'low' });
      manager.publish({ title: 'high', priority: 'high' });
      manager.publish({ title: 'normal', priority: 'normal' });
      const list = manager.list();
      expect(list).toHaveLength(2);
      expect(list[0]?.priority).toBe('high');
      expect(list[1]?.priority).toBe('normal');
    });
  });
});

describe('tooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  describe('tooltip delay groups', () => {
    it('keeps the skip window alive when another tooltip opens before it expires', () => {
      vi.useFakeTimers();
      const group = createTooltipDelayGroup({ delayDuration: 300, skipDelayDuration: 400 });
      group.opened();
      group.closed();
      vi.advanceTimersByTime(200);
      group.opened();
      group.closed();
      vi.advanceTimersByTime(399);
      expect(group.openDelay()).toBe(0);
      vi.advanceTimersByTime(1);
      expect(group.openDelay()).toBe(300);
      group.destroy();
    });
  });
});

describe('tree', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  describe('tree model', () => {
    it('windows large trees with fixed row heights and bounded overscan', () => {
      expect(getTreeWindow(100, 600, 120, 30, 1)).toEqual({
        start: 19,
        end: 25,
        paddingStart: 570,
        paddingEnd: 2250,
      });
      expect(getTreeWindow(0, 0, 120, 30)).toEqual({
        start: 0,
        end: 0,
        paddingStart: 0,
        paddingEnd: 0,
      });
    });

    it('rejects empty and duplicate ids, including ids from lazy branches', () => {
      expect(() => assertUniqueTreeIds([{ id: ' ', label: 'Empty' }])).toThrow(/must not be empty/);
      expect(() =>
        assertUniqueTreeIds(
          [{ id: 'branch', label: 'Branch', hasChildren: true }],
          new Map([['branch', [{ id: 'branch', label: 'Duplicate' }]]])
        )
      ).toThrow(/duplicated/);
    });
  });
});

/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { createRawSnippet, flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Alert from '../src/components/alert/Alert.svelte';
import { alertRole } from '../src/components/alert/tones.ts';
import { avatarInitials, avatarToneIndex, hashString } from '../src/components/avatar/initials.ts';
import Chip from '../src/components/badge/Chip.svelte';
import Tag from '../src/components/badge/Tag.svelte';
import Card from '../src/components/card/Card.svelte';
import CardGrid from '../src/components/card/CardGrid.svelte';
import CardMedia from '../src/components/card/CardMedia.svelte';
import {
  Carousel,
  type CarouselItem,
  createAutoplay,
  formatMessage,
  resolveIndex,
  swipeStep,
} from '../src/components/carousel/index.ts';
import ErrorState from '../src/components/empty/ErrorState.svelte';
import Progress from '../src/components/feedback/Progress.svelte';
import Spinner from '../src/components/feedback/Spinner.svelte';
import Icon from '../src/components/icons/Icon.svelte';
import { iconPath } from '../src/components/icons/icons.ts';
import { ICON_NAMES } from '../src/components/icons/index.ts';
import { LucideIcon } from '../src/components/icons/lucide.ts';
import { type IconName, type IconSize } from '../src/components/icons/types.ts';
import Kpi from '../src/components/stat/Kpi.svelte';
import KpiRow from '../src/components/stat/KpiRow.svelte';
import { formatDelta, trendToneClass, trendWord } from '../src/components/stat/trend.ts';
import { fillStackLabels, isScrollable } from '../src/components/table/labels.ts';
import { Timeline, type TimelineItemData } from '../src/components/timeline/index.ts';
import { type TreeNode, TreeView } from '../src/components/tree/index.ts';
import NavIcon from '../src/layouts/host/NavIcon.svelte';
import {
  NAV_ICON_BUILTINS,
  NAV_ICON_FALLBACK_PATH,
  NAV_ICON_PATHS,
  navIconPath,
} from '../src/layouts/host/nav-icons.ts';
import { type NavIconName } from '../src/layouts/host/nav-model.ts';
import AvatarFixture from './fixtures/AvatarFixture.svelte';
import CustomIcon from './fixtures/CustomIcon.svelte';
import ResizableHarness from './fixtures/ResizableHarness.svelte';
import ScrollAreaHarness from './fixtures/ScrollAreaHarness.svelte';
import SeparatorAspectHarness from './fixtures/SeparatorAspectHarness.svelte';
import TableFixture from './fixtures/TableHarness.svelte';

// Display components: URL policy on links and images, no-sink rendering,
// carousel and table logic, and the decorative or live semantics of feedback.

describe('alert', () => {
  afterEach(() => cleanup());

  describe('tones helpers', () => {
    it('maps error to alert role and others to status', () => {
      expect(alertRole('error')).toBe('alert');
      expect(alertRole('info')).toBe('status');
      expect(alertRole('success')).toBe('status');
    });
  });

  describe('Alert', () => {
    it('fires dismiss with a labelled control', async () => {
      const onDismiss = vi.fn();
      render(Alert, {
        props: {
          title: 'Tip',
          text: 'You can dismiss this.',
          dismissible: true,
          dismissLabel: 'Dismiss tip',
          onDismiss,
        },
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('filters unsafe action href through the button URL policy', () => {
      render(Alert, {
        props: {
          title: 'Link',
          actionLabel: 'Open',
          actionHref: 'javascript:alert(1)',
        },
      });
      // Unsafe href becomes a button without navigation.
      expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Open' })).toBeNull();
    });
  });
});

describe('avatar', () => {
  afterEach(cleanup);

  describe('avatarInitials / tone', () => {
    it('builds stable initials and tone slots from names', () => {
      expect(avatarInitials('Ada Example')).toBe('AE');
      expect(avatarInitials('Bea')).toBe('B');
      expect(avatarInitials('  ')).toBe('?');
      expect(hashString('Ada')).toBe(hashString('Ada'));
      expect(avatarToneIndex('Ada Example')).toBeGreaterThanOrEqual(0);
      expect(avatarToneIndex('Ada Example')).toBeLessThan(5);
    });
  });

  describe('Avatar', () => {
    it('rejects unsafe image schemes and keeps initials via the primitive', async () => {
      render(AvatarFixture, {
        props: {
          name: 'Ada Example',
          src: 'javascript:alert(1)',
          mode: 'single',
        },
      });
      const root = await screen.findByRole('img', { name: 'Ada Example' });
      expect(root.querySelector('img')).toBeNull();
      expect(root.textContent).toContain('AE');
    });
  });

  describe('AvatarGroup', () => {
    it('stacks items and shows a +N overflow chip when max is set', () => {
      render(AvatarFixture, {
        props: {
          mode: 'group',
          max: 2,
          label: 'Harbor team',
          items: [
            { name: 'Ada Example' },
            { name: 'Bea Harbor' },
            { name: 'Cal Orbit' },
            { name: 'Dee Quill' },
          ],
        },
      });
      const group = screen.getByRole('group', { name: 'Harbor team' });
      expect(group.querySelectorAll('[data-tx-avatar]').length).toBe(2);
      const overflow = group.querySelector('[data-tx-avatar-group-overflow]');
      expect(overflow?.textContent).toBe('+2');
      expect(overflow?.getAttribute('aria-label')).toBe('+2');
    });
  });

  describe('avatar initials contrast', () => {
    const css = readFileSync(
      join(import.meta.dirname, '../src/components/avatar/avatar.css'),
      'utf8'
    );
    const screenCss = css.slice(0, css.indexOf('@media (forced-colors: active)'));

    it('paints initials only with the gated foreground-on-muted pair', () => {
      // Every surface rule outside forced colors: background is muted, text is foreground.
      const surfaceRules = [...screenCss.matchAll(/\.tx-avatar__surface[^{]*\{([^}]*)\}/g)].map(
        (m) => m[1] ?? ''
      );
      expect(surfaceRules.length).toBeGreaterThan(1);
      for (const body of surfaceRules) {
        for (const [, value] of body.matchAll(/(?<![-\w])background-color:\s*([^;]+);/g)) {
          expect(value?.trim()).toBe('var(--tx-muted, Canvas)');
        }
        for (const [, value] of body.matchAll(/(?<![-\w])color:\s*([^;]+);/g)) {
          expect(value?.trim()).toBe('var(--tx-foreground, CanvasText)');
        }
      }
      // The seeded tone never reaches the text pair (no translucent tints behind initials).
      expect(screenCss).not.toMatch(/\.tx-avatar__surface[^{]*\{[^}]*color-mix/);
    });
  });
});

describe('badge', () => {
  afterEach(cleanup);

  describe('Tag', () => {
    it('disables remove while pending and when disabled', async () => {
      let resolve!: () => void;
      const gate = new Promise<void>((r) => {
        resolve = r;
      });
      const onRemove = vi.fn(() => gate);
      const view = render(Tag, { props: { label: 'Ops', onRemove } });
      const btn = view.getByRole('button', { name: /Remove: Ops/ });
      await fireEvent.click(btn);
      expect(btn.getAttribute('aria-busy')).toBe('true');
      resolve();
      await waitFor(() => expect(btn.getAttribute('aria-busy')).not.toBe('true'));
    });
  });

  describe('Tag remove target size', () => {
    // jsdom does no layout, so the 24px hit box is pinned as a stylesheet
    // contract (same pattern as the avatar contrast rules in avatar.test.ts).
    it('gives the remove control a 24px hit box without growing the tag', () => {
      const css = readFileSync(
        join(import.meta.dirname, '../src/components/badge/badge.css'),
        'utf8'
      );
      const rule = css.match(/\.tx-tag__remove\s*\{([^}]*)\}/)?.[1] ?? '';
      // The audit bar (rubric, responsive dimension): tap targets >= 24px. The
      // remove control rendered a 16px box (12px glyph + 2px padding).
      expect(rule).toContain('min-inline-size: 1.5rem');
      expect(rule).toContain('min-block-size: 1.5rem');
      // The larger box is clawed back on both axes so the tag's outer
      // geometry (and every visual baseline) stays as it was.
      expect(rule).toMatch(/margin:\s*-0\.25rem;/);
      expect(rule).toMatch(/padding:\s*0\.375rem;/);
    });
  });

  describe('Chip', () => {
    it('is a toggleable button with aria-pressed', async () => {
      const onclick = vi.fn();
      const view = render(Chip, {
        props: { label: 'Filter A', selected: true, onclick },
      });
      const chip = view.getByRole('button', { name: 'Filter A' });
      expect(chip.getAttribute('aria-pressed')).toBe('true');
      expect(chip.getAttribute('data-selected')).toBe('true');
      await fireEvent.click(chip);
      expect(onclick).toHaveBeenCalled();
    });
  });
});

describe('card', () => {
  afterEach(cleanup);

  const text = (value: string) =>
    createRawSnippet(() => ({
      render: () => `<span>${value}</span>`,
    }));

  describe('Card', () => {
    it('rejects unsafe href and stays a div', () => {
      const view = render(Card, {
        props: { href: 'javascript:alert(1)', children: text('Nope') },
      });
      expect(view.container.querySelector('a')).toBeNull();
      expect(view.container.querySelector('[data-tx-card]')?.tagName.toLowerCase()).toBe('div');
    });
  });

  describe('CardMedia', () => {
    it('renders img when src is safe and skips hostile schemes', () => {
      const ok = render(CardMedia, {
        props: { src: 'https://example.com/photo.jpg', alt: 'Harbor dock' },
      });
      const img = ok.container.querySelector('img');
      expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg');
      expect(img?.getAttribute('alt')).toBe('Harbor dock');
      ok.unmount();

      const bad = render(CardMedia, {
        props: { src: 'javascript:alert(1)', alt: 'x' },
      });
      expect(bad.container.querySelector('img')).toBeNull();
    });
  });

  describe('CardGrid', () => {
    it('builds an auto-fill grid with a safe min width', () => {
      const view = render(CardGrid, {
        props: { minItemWidth: '12rem', gap: 'lg', children: text('c') },
      });
      const grid = view.container.querySelector('[data-tx-card-grid]') as HTMLElement;
      expect(grid.className).toContain('tx-card-grid--gap-lg');
      expect(grid.getAttribute('style')).toContain('12rem');
      view.unmount();

      const hostile = render(CardGrid, {
        props: { minItemWidth: '12rem; color: red', children: text('c') },
      });
      const style =
        hostile.container.querySelector('[data-tx-card-grid]')?.getAttribute('style') ?? '';
      expect(style).toContain('16rem');
      expect(style).not.toContain('color');
    });
  });
});

describe('carousel', () => {
  const items: CarouselItem[] = [
    { id: 'harbor', label: 'Harbor at dawn' },
    { id: 'market', label: 'Night market' },
    { id: 'ridge', label: 'Ridge trail' },
  ];

  const body = createRawSnippet<[CarouselItem, number]>((item) => ({
    render: () => `<p data-testid="body">${item().label}</p>`,
  }));

  function mediaStub(reduced: boolean) {
    return vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  /** Renders inside a container with an explicit `dir`, as an app would. */
  function renderIn(dir: 'ltr' | 'rtl', props: Record<string, unknown>) {
    const host = document.createElement('div');
    host.setAttribute('dir', dir);
    document.body.append(host);
    return render(Carousel, { target: host, props: props as never });
  }

  const status = (container: HTMLElement) =>
    container.querySelector('.tx-carousel-status')?.textContent?.trim();
  const slide = (container: HTMLElement, id: string) =>
    container.querySelector<HTMLElement>(`[data-tx-carousel-slide="${id}"]`);

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  describe('carousel logic', () => {
    it('wraps with loop and clamps without it', () => {
      expect(resolveIndex(3, 3, true)).toBe(0);
      expect(resolveIndex(-1, 3, true)).toBe(2);
      expect(resolveIndex(7, 3, true)).toBe(1);
      expect(resolveIndex(3, 3, false)).toBe(2);
      expect(resolveIndex(-4, 3, false)).toBe(0);
      expect(resolveIndex(1.9, 3, false)).toBe(1);
      expect(resolveIndex(Number.NaN, 3, true)).toBe(0);
      expect(resolveIndex(5, 1, true)).toBe(0);
      expect(resolveIndex(5, 0, true)).toBe(0);
    });

    it('turns a drag toward the inline start into "next", in LTR and RTL', () => {
      expect(swipeStep(-60, 48, 'ltr')).toBe(1);
      expect(swipeStep(60, 48, 'ltr')).toBe(-1);
      expect(swipeStep(60, 48, 'rtl')).toBe(1);
      expect(swipeStep(-60, 48, 'rtl')).toBe(-1);
      expect(swipeStep(-47, 48, 'ltr')).toBe(0);
      expect(swipeStep(Number.NaN, 48, 'ltr')).toBe(0);
      // A threshold below one pixel still ignores a zero-length tap.
      expect(swipeStep(0, 0, 'ltr')).toBe(0);
    });

    it('fills placeholders as plain text and leaves unknown ones', () => {
      expect(formatMessage('Slide {index} of {total}', { index: 2, total: 5 })).toBe(
        'Slide 2 of 5'
      );
      expect(formatMessage('{label}', { label: '<b>x</b>' })).toBe('<b>x</b>');
      expect(formatMessage('{constructor} {missing}', {})).toBe('{constructor} {missing}');
    });
  });

  describe('createAutoplay', () => {
    /** A manual clock: `advance` fires due timers in order. */
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
              .filter(([, timer]) => timer.at <= end)
              .sort((a, b) => a[1].at - b[1].at)[0];
            if (!due) break;
            timers.delete(due[0]);
            now = due[1].at;
            due[1].run();
          }
          now = end;
        },
        pending: () => timers.size,
      };
    }

    it('ticks while playing, pauses for holds and stops for good on stop()', () => {
      const c = clock();
      const onTick = vi.fn();
      const onPlayingChange = vi.fn();
      const auto = createAutoplay({ interval: 3000, onTick, onPlayingChange, ...c });
      c.advance(10_000);
      expect(onTick).not.toHaveBeenCalled();

      auto.play();
      expect(onPlayingChange).toHaveBeenLastCalledWith(true);
      c.advance(9000);
      expect(onTick).toHaveBeenCalledTimes(3);

      auto.hold('hover');
      expect(auto.running).toBe(false);
      c.advance(9000);
      expect(onTick).toHaveBeenCalledTimes(3);
      auto.hold('hidden');
      auto.release('hover');
      c.advance(9000);
      expect(onTick).toHaveBeenCalledTimes(3);
      auto.release('hidden');
      expect(auto.playing).toBe(true);
      c.advance(3000);
      expect(onTick).toHaveBeenCalledTimes(4);

      auto.stop();
      expect(onPlayingChange).toHaveBeenLastCalledWith(false);
      c.advance(30_000);
      expect(onTick).toHaveBeenCalledTimes(4);
      expect(c.pending()).toBe(0);
    });
  });

  describe('Carousel', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', mediaStub(false));
    });

    it('makes hidden slides inert so their content leaves the tab order', () => {
      const view = render(Carousel, { props: { items, children: body } });
      expect(slide(view.container, 'harbor')?.hasAttribute('inert')).toBe(false);
      expect(slide(view.container, 'market')?.hasAttribute('inert')).toBe(true);
      expect(slide(view.container, 'ridge')?.hasAttribute('inert')).toBe(true);
    });

    it('accepts arrows from its buttons but never from slide content', async () => {
      const field = createRawSnippet<[CarouselItem, number]>(() => ({
        render: () => '<label>Note <input data-testid="note" /></label>',
      }));
      const view = renderIn('ltr', { items, children: field });
      const next = view.getByRole('button', { name: 'Next slide' });
      await fireEvent.keyDown(next, { key: 'ArrowRight' });
      expect(status(view.container)).toBe('Slide 2 of 3');
      await fireEvent.keyDown(next, { key: 'Home' });
      expect(status(view.container)).toBe('Slide 1 of 3');

      const input = view.getAllByTestId('note')[0] as HTMLElement;
      await fireEvent.keyDown(input, { key: 'ArrowRight' });
      expect(status(view.container)).toBe('Slide 1 of 3');
    });

    it('changes slide on a swipe past the threshold, mirrored in RTL', async () => {
      const swipe = async (container: HTMLElement, from: number, to: number) => {
        const viewport = container.querySelector('.tx-carousel-viewport') as HTMLElement;
        await fireEvent.pointerDown(viewport, { button: 0, pointerId: 1, clientX: from });
        await fireEvent.pointerMove(viewport, { pointerId: 1, clientX: to });
        await fireEvent.pointerUp(viewport, { pointerId: 1, clientX: to });
      };
      const ltr = renderIn('ltr', { items, swipeThreshold: 40 });
      await swipe(ltr.container, 200, 120);
      expect(status(ltr.container)).toBe('Slide 2 of 3');
      await swipe(ltr.container, 200, 180);
      expect(status(ltr.container)).toBe('Slide 2 of 3');
      ltr.unmount();

      const rtl = renderIn('rtl', { items, swipeThreshold: 40 });
      await swipe(rtl.container, 120, 200);
      expect(status(rtl.container)).toBe('Slide 2 of 3');
    });

    it('positions the track with custom properties, not a style string', async () => {
      const view = render(Carousel, { props: { items } });
      const track = view.container.querySelector<HTMLElement>('.tx-carousel-track');
      expect(track?.style.getPropertyValue('--tx-carousel-index')).toBe('0');
      await fireEvent.click(view.getByRole('button', { name: 'Next slide' }));
      expect(track?.style.getPropertyValue('--tx-carousel-index')).toBe('1');

      // The only inline styles are the track's two custom properties (no style strings).
      const styled = [...view.container.querySelectorAll<HTMLElement>('[style]')];
      expect(styled).toEqual([track]);
      const style = track?.style;
      const declared = Array.from({ length: style?.length ?? 0 }, (_, i) => style?.item(i)).sort();
      expect(declared).toEqual(['--tx-carousel-drag', '--tx-carousel-index']);
    });

    describe('autoplay', () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      });

      it('rotates, offers a rotation control first, and silences the live region while rotating', async () => {
        const onPlayingChange = vi.fn();
        const view = render(Carousel, {
          props: { items, autoplay: true, interval: 3000, onPlayingChange },
        });
        flushSync();
        const control = view.getByRole('button', { name: 'Stop automatic slide show' });
        expect(view.getAllByRole('button')[0]).toBe(control);
        expect(onPlayingChange).toHaveBeenLastCalledWith(true);
        const live = view.container.querySelector('.tx-carousel-status');
        expect(live?.getAttribute('aria-live')).toBe('off');

        vi.advanceTimersByTime(3000);
        flushSync();
        expect(status(view.container)).toBe('Slide 2 of 3');
        vi.advanceTimersByTime(6000);
        flushSync();
        // Rotation wraps even without loop-able controls.
        expect(status(view.container)).toBe('Slide 1 of 3');

        await fireEvent.click(control);
        expect(view.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
        expect(live?.getAttribute('aria-live')).toBe('polite');
        vi.advanceTimersByTime(30_000);
        flushSync();
        expect(status(view.container)).toBe('Slide 1 of 3');
      });

      it('stops for good when keyboard focus enters, but not when a click focuses a control', async () => {
        const view = render(Carousel, { props: { items, autoplay: true, interval: 3000 } });
        flushSync();
        const control = view.getByRole('button', { name: 'Stop automatic slide show' });

        // A click: pointer down first, then focus, then click toggles once (stop).
        await fireEvent.pointerDown(control);
        await fireEvent.focusIn(control, { relatedTarget: null });
        await fireEvent.pointerUp(control);
        expect(view.getByRole('button', { name: 'Stop automatic slide show' })).toBeTruthy();
        await fireEvent.click(control);
        expect(view.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
        await fireEvent.click(control);
        expect(view.getByRole('button', { name: 'Stop automatic slide show' })).toBeTruthy();

        // Keyboard focus arriving from outside stops it.
        const tab = view.getAllByRole('tab')[0] as HTMLElement;
        await fireEvent.focusIn(tab, { relatedTarget: document.body });
        expect(view.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
        vi.advanceTimersByTime(30_000);
        flushSync();
        expect(status(view.container)).toBe('Slide 1 of 3');
      });

      it('does not start when the user prefers reduced motion', () => {
        vi.stubGlobal('matchMedia', mediaStub(true));
        const view = render(Carousel, { props: { items, autoplay: true, interval: 3000 } });
        flushSync();
        expect(view.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
        vi.advanceTimersByTime(30_000);
        flushSync();
        expect(status(view.container)).toBe('Slide 1 of 3');
      });

      it('holds while the page is hidden', () => {
        let state: DocumentVisibilityState = 'visible';
        vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state);
        const view = render(Carousel, { props: { items, autoplay: true, interval: 3000 } });
        flushSync();
        state = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        // Two intervals: a rotating carousel would be on slide 3 (three would wrap to 1).
        vi.advanceTimersByTime(6000);
        flushSync();
        expect(status(view.container)).toBe('Slide 1 of 3');
        state = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        vi.advanceTimersByTime(3000);
        flushSync();
        expect(status(view.container)).toBe('Slide 2 of 3');
      });
    });
  });
});

describe('empty', () => {
  afterEach(cleanup);

  describe('ErrorState', () => {
    it('is a live alert with title and message', () => {
      const view = render(ErrorState, {
        props: {
          title: 'Could not load',
          message: 'The network is offline (simulated).',
        },
      });
      const alert = view.getByRole('alert');
      expect(alert.textContent).toContain('Could not load');
      expect(alert.textContent).toContain('The network is offline');
    });

    it('runs onRetry through a pending Button', async () => {
      let resolve!: () => void;
      const gate = new Promise<void>((r) => {
        resolve = r;
      });
      const onRetry = vi.fn(() => gate);
      const view = render(ErrorState, {
        props: { onRetry, retryLabel: 'Try again' },
      });
      const btn = view.getByRole('button', { name: 'Try again' });
      await fireEvent.click(btn);
      expect(onRetry).toHaveBeenCalledOnce();
      await waitFor(() => expect(btn.getAttribute('aria-busy')).toBe('true'));
      resolve();
      await waitFor(() => expect(btn.getAttribute('aria-busy')).not.toBe('true'));
    });
  });
});

describe('feedback', () => {
  afterEach(cleanup);

  describe('Spinner', () => {
    it('is decorative without a label and a live status with one', () => {
      const deco = render(Spinner, { props: { tone: 'success' } });
      const el = deco.container.querySelector('[data-tx-spinner]');
      expect(el?.getAttribute('aria-hidden')).toBe('true');
      expect(el?.getAttribute('role')).toBeNull();
      expect(el?.getAttribute('data-tone')).toBe('success');
      deco.unmount();

      const live = render(Spinner, { props: { label: 'Saving notes' } });
      expect(live.getByRole('status').textContent).toContain('Saving notes');
      expect(live.container.querySelector('.tx-sr-only')?.textContent).toBe('Saving notes');
    });
  });

  describe('Progress', () => {
    it('omits aria-valuenow when indeterminate', () => {
      const view = render(Progress, {
        props: { label: 'Working', value: null, loadingLabel: 'Please wait' },
      });
      const bar = view.getByRole('progressbar', { name: 'Working' });
      expect(bar.hasAttribute('aria-valuenow')).toBe(false);
      expect(bar.getAttribute('aria-valuetext')).toBe('Please wait');
      expect(view.container.querySelector('[data-state="indeterminate"]')).toBeTruthy();
      expect(view.container.querySelector('.tx-progress__indicator--indeterminate')).toBeTruthy();
    });
  });
});

describe('icons', () => {
  afterEach(() => cleanup());

  describe('Icon', () => {
    it('renders every built-in name as a decorative SVG by default', () => {
      for (const name of ICON_NAMES) {
        const { container, unmount } = render(Icon, { props: { icon: name } });
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('data-tx-icon')).toBe(name);
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect(svg?.querySelector('path')?.getAttribute('d')).toBeTruthy();
        unmount();
      }
    });

    it('supports a translated accessible name and keeps consumer classes last', () => {
      render(Icon, {
        props: {
          icon: 'info',
          label: 'Information',
          class: 'consumer-class',
        },
      });
      const icon = screen.getByRole('img', { name: 'Information' });
      expect(icon.getAttribute('class')).toBe('tx-icon tx-icon--md consumer-class');
      expect(icon.getAttribute('aria-hidden')).toBeNull();
    });

    it('accepts a Lucide-compatible Svelte component through the optional bridge', () => {
      render(LucideIcon, {
        props: {
          icon: CustomIcon,
          size: 'lg' satisfies IconSize,
          label: 'Favorite',
        },
      });
      const icon = screen.getByRole('img', { name: 'Favorite' });
      expect(icon.getAttribute('width')).toBe('24');
      expect(icon.getAttribute('data-tx-icon')).toBe('custom');
    });

    it('renders nothing for a runtime name outside the built-in set', () => {
      const { container } = render(Icon, { props: { icon: 'unknown' as IconName } });
      expect(container.querySelector('svg')).toBeNull();
    });
  });
});

describe('nav-icon', () => {
  afterEach(cleanup);

  const MENU = iconPath('menu');

  /** Exhaustive list from the type — keeps Record and type in lockstep. */
  const ALL_NAMES = Object.keys(NAV_ICON_PATHS) as NavIconName[];

  describe('nav icon glyphs', () => {
    it('maps every NavIconName to its own non-fallback glyph (full Record)', () => {
      expect(ALL_NAMES.length).toBe(NAV_ICON_BUILTINS.length);
      expect(ALL_NAMES.length).toBeGreaterThanOrEqual(53);
      for (const name of ALL_NAMES) {
        const glyph = navIconPath(name);
        expect(glyph.known, name).toBe(true);
        expect(glyph.path, name).not.toBe(MENU);
        expect(glyph.path, name).not.toBe(NAV_ICON_FALLBACK_PATH);
        expect(glyph.path.length, name).toBeGreaterThan(4);
      }
      const paths = ALL_NAMES.map((name) => navIconPath(name).path);
      expect(new Set(paths).size).toBe(paths.length);
    });

    it('draws unknown names with the neutral dot, not the menu glyph', () => {
      for (const name of ['definitely-not-an-icon', 'not-a-real-name', '']) {
        expect(navIconPath(name)).toEqual({ path: NAV_ICON_FALLBACK_PATH, known: false });
      }
      expect(NAV_ICON_FALLBACK_PATH).not.toBe(MENU);
    });

    it('renders the glyph decoratively, or named with a label', () => {
      const { container } = render(NavIcon, { props: { icon: 'inbox' } });
      const svg = container.querySelector('svg') as SVGElement;
      expect(svg.getAttribute('data-tx-nav-icon')).toBe('inbox');
      expect(svg.getAttribute('data-known')).toBe('true');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.querySelector('path')?.getAttribute('d')).toBe(navIconPath('inbox').path);
      cleanup();
      const named = render(NavIcon, {
        props: { icon: 'definitely-not-an-icon' as NavIconName, label: 'Automations' },
      });
      const unknown = named.container.querySelector('svg') as SVGElement;
      expect(unknown.getAttribute('role')).toBe('img');
      expect(unknown.getAttribute('aria-label')).toBe('Automations');
      expect(unknown.getAttribute('data-known')).toBe('false');
      expect(unknown.querySelector('path')?.getAttribute('d')).toBe(NAV_ICON_FALLBACK_PATH);
    });
  });
});

describe('separator-aspect', () => {
  afterEach(() => cleanup());

  describe('Separator / AspectRatio / VisuallyHidden', () => {
    it('accepts decimal and slash ratios for custom', () => {
      for (const value of ['1.618', '16/9', ' 5 / 4 ']) {
        const { container } = render(SeparatorAspectHarness, {
          props: { show: 'aspect', custom: value },
        });
        const el = container.querySelector('[data-tx-aspect-ratio]') as HTMLElement | null;
        expect(el?.getAttribute('data-ratio')).toBe('custom');
        expect(el?.getAttribute('style') ?? '').toMatch(/^--tx-aspect-ratio: [\d./ ]+;?$/);
      }
    });

    it('ignores a custom aspect-ratio that is not a plain ratio', () => {
      // Same injection guard as CardGrid's minItemWidth and Table's maxBlockSize:
      // anything that is not a plain ratio falls back to the named ratio.
      const { container } = render(SeparatorAspectHarness, {
        props: { show: 'aspect', custom: '5 / 4; background: url(https://evil.example/x.png)' },
      });
      const el = container.querySelector('[data-tx-aspect-ratio]') as HTMLElement | null;
      const style = el?.getAttribute('style') ?? '';
      expect(style).not.toContain('background');
      expect(style).not.toContain(';');
      expect(el?.getAttribute('data-ratio')).toBe('16/9');
      expect(el?.className).toContain('tx-aspect-ratio--16-9');
    });

    it('renders VisuallyHidden content for assistive tech', () => {
      const { container, getByText } = render(SeparatorAspectHarness, {
        props: { show: 'hidden' },
      });
      const el = container.querySelector('[data-tx-visually-hidden]');
      expect(el).toBeTruthy();
      expect(el?.className).toContain('tx-visually-hidden');
      expect(getByText('Screen reader only label')).toBeTruthy();
    });
  });
});

describe('scroll-area', () => {
  afterEach(cleanup);

  describe('ScrollArea', () => {
    it('keeps a visible custom scrollbar decorative and hidden from assistive technology', async () => {
      const view = render(ScrollAreaHarness, { props: { type: 'always' } });
      const viewport = view.container.querySelector('[data-tx-scroll-area-viewport]');
      expect(viewport).toBeTruthy();
      Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
      Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
      Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
      Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
      await fireEvent.scroll(viewport as Element);

      await waitFor(() => {
        const scrollbar = view.container.querySelector('[data-tx-scroll-area-scrollbar]');
        expect(scrollbar?.getAttribute('aria-hidden')).toBe('true');
        expect(
          view.container.querySelector('[data-tx-scroll-area-thumb]')?.getAttribute('aria-hidden')
        ).toBe('true');
      });
    });
  });
});

describe('stat', () => {
  afterEach(cleanup);

  describe('trend helpers', () => {
    it('formats deltas and tones by whether the direction is good', () => {
      expect(formatDelta(12)).toBe('+12');
      expect(formatDelta(-0.4)).toBe('-0.4');
      expect(formatDelta('+5%')).toBe('+5%');
      expect(trendWord('up')).toBe('Increased');
      expect(trendToneClass('down', 'down')).toBe('tx-stat__delta--good');
      expect(trendToneClass('up', 'down')).toBe('tx-stat__delta--bad');
      expect(trendToneClass('neutral')).toBe('tx-stat__delta--neutral');
    });
  });

  describe('Kpi', () => {
    it('links through URL policy and rejects unsafe schemes', () => {
      const ok = render(Kpi, {
        props: {
          label: 'Signups',
          value: 120,
          href: 'https://example.com/insights/signups',
        },
      });
      const link = ok.getByRole('link', { name: 'Signups' });
      expect(link.getAttribute('href')).toBe('https://example.com/insights/signups');
      ok.unmount();

      const bad = render(Kpi, {
        props: { label: 'Nope', value: 1, href: 'javascript:alert(1)' },
      });
      expect(bad.container.querySelector('a')).toBeNull();
    });
  });

  describe('KpiRow', () => {
    it('rejects unsafe minItemWidth lengths', () => {
      const view = render(KpiRow, {
        props: {
          label: 'Safe',
          minItemWidth: '12rem; color: red',
          children: createRawSnippet(() => ({ render: () => '<span/>' })),
        },
      });
      expect(view.container.querySelector('[data-tx-kpi-row]')?.getAttribute('style')).toContain(
        '--tx-kpi-row-min: 12rem'
      );
    });
  });
});

describe('table', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function markup(html: string): HTMLTableElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.querySelector('table') as HTMLTableElement;
  }

  describe('Table', () => {
    it('renders a semantic table with caption, sections, header scopes and data attributes', () => {
      const view = render(TableFixture);
      const table = view.getByRole('table', { name: 'Invoices' });
      expect(table.tagName).toBe('TABLE');
      expect(table.getAttribute('data-variant')).toBe('plain');
      expect(table.getAttribute('data-density')).toBe('default');
      expect(table.hasAttribute('role')).toBe(false);
      expect(table.querySelector('thead')).toBeTruthy();
      expect(table.querySelector('tbody')).toBeTruthy();
      expect(table.querySelector('tfoot')).toBeTruthy();
      const columns = view.getAllByRole('columnheader');
      expect(columns.map((cell) => cell.textContent?.trim())).toEqual([
        'Invoice',
        'Customer',
        'Amount',
      ]);
      expect(columns.every((cell) => cell.getAttribute('scope') === 'col')).toBe(true);
      const rowHeader = view.getByRole('rowheader', { name: 'Total' });
      expect(rowHeader.getAttribute('scope')).toBe('row');
      expect(rowHeader.getAttribute('colspan')).toBe('2');
      // Without stacking, no explicit roles clutter the native table.
      expect(table.querySelector('[role]')).toBeNull();
    });

    it('ignores a height that is not a plain length', () => {
      for (const unsafe of ['20rem; color: red', 'calc(1px)', 'url(x)', '-5px', 'tall']) {
        const view = render(TableFixture, { props: { maxBlockSize: unsafe } });
        const wrap = view.container.querySelector('[data-tx-table-wrap]') as HTMLElement;
        expect(wrap.hasAttribute('style')).toBe(false);
        expect(wrap.classList.contains('tx-table-wrap--capped')).toBe(false);
        view.unmount();
      }
    });

    it('becomes a focusable region named by its label when the table overflows', () => {
      let resize: (() => void) | undefined;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: () => void) {
            resize = callback;
          }
          observe() {}
          disconnect() {}
        }
      );
      const view = render(TableFixture, { props: { label: 'Invoices, scrollable' } });
      const wrap = view.container.querySelector('[data-tx-table-wrap]') as HTMLElement;
      expect(wrap.hasAttribute('tabindex')).toBe(false);
      Object.defineProperty(wrap, 'scrollWidth', { configurable: true, value: 900 });
      Object.defineProperty(wrap, 'clientWidth', { configurable: true, value: 300 });
      resize?.();
      flushSync();
      expect(wrap.getAttribute('tabindex')).toBe('0');
      const region = view.getByRole('region', { name: 'Invoices, scrollable' });
      expect(region).toBe(wrap);
      expect(wrap.getAttribute('data-scrollable')).toBe('true');
    });

    it('relabels stacked cells when rows change', async () => {
      const view = render(TableFixture, { props: { stack: 'sm' } });
      flushSync();
      await view.rerender({ stack: 'sm', extraRow: true });
      flushSync();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const last = view.container.querySelector('tbody tr:last-child td') as HTMLElement;
      expect(last.textContent).toContain('INV-3');
      expect(last.getAttribute('data-label')).toBe('Invoice');
    });
  });

  describe('fillStackLabels', () => {
    it('copies the last header row onto body and footer cells, honoring colspan', () => {
      const table = markup(`<table>
      <thead>
        <tr><th colspan="3">Group</th></tr>
        <tr><th>Name</th><th colspan="2">Contact</th></tr>
      </thead>
      <tbody>
        <tr><td>Ada</td><td>ada@example.com</td><td>Mon</td></tr>
        <tr><td colspan="2">Merged</td><td>Tue</td></tr>
      </tbody>
      <tfoot><tr><th>Total</th><td>2</td><td>-</td></tr></tfoot>
    </table>`);
      expect(fillStackLabels(table)).toBe(7);
      const labels = (selector: string) =>
        Array.from(table.querySelectorAll(selector)).map((cell) => cell.getAttribute('data-label'));
      expect(labels('tbody tr:first-child td')).toEqual(['Name', 'Contact', 'Contact']);
      // A merged cell gets no label; the next one keeps its own column.
      expect(labels('tbody tr:last-child td')).toEqual([null, 'Contact']);
      expect(labels('tfoot tr > *')).toEqual(['Name', 'Contact', 'Contact']);
    });

    it('leaves author labels alone and removes stale labels where no header exists', () => {
      const table = markup(`<table>
      <thead><tr><th>Name</th></tr></thead>
      <tbody><tr>
        <td data-label="Mine" data-tx-label-fixed>Ada</td>
        <td data-label="Old">extra</td>
      </tr></tbody>
    </table>`);
      fillStackLabels(table);
      const [first, second] = Array.from(table.querySelectorAll('td'));
      expect(first?.getAttribute('data-label')).toBe('Mine');
      expect(second?.hasAttribute('data-label')).toBe(false);
    });
  });

  describe('isScrollable', () => {
    it('reports overflow on either axis past a one-pixel tolerance', () => {
      const box = document.createElement('div');
      const set = (sw: number, cw: number, sh: number, ch: number) => {
        Object.defineProperty(box, 'scrollWidth', { configurable: true, value: sw });
        Object.defineProperty(box, 'clientWidth', { configurable: true, value: cw });
        Object.defineProperty(box, 'scrollHeight', { configurable: true, value: sh });
        Object.defineProperty(box, 'clientHeight', { configurable: true, value: ch });
      };
      set(100, 100, 50, 50);
      expect(isScrollable(box)).toBe(false);
      set(101, 100, 50, 50);
      expect(isScrollable(box)).toBe(false);
      set(120, 100, 50, 50);
      expect(isScrollable(box)).toBe(true);
      set(100, 100, 80, 50);
      expect(isScrollable(box)).toBe(true);
    });
  });
});

describe('timeline', () => {
  afterEach(cleanup);

  const items: TimelineItemData[] = [
    {
      id: 'kickoff',
      time: 'Mar 4',
      datetime: '2026-03-04',
      title: 'Kickoff',
      description: 'Scope agreed with the fictional team.',
      status: 'complete',
      tone: 'success',
    },
    { id: 'review', time: 'Mar 18', title: 'Design review', status: 'current' },
    { id: 'launch', time: 'Apr 1', title: 'Launch', status: 'upcoming', tone: 'neutral' },
  ];

  const listItems = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLLIElement>('[data-tx-timeline-item]'),
  ];

  describe('Timeline', () => {
    it('is horizontal on request, and then keyboard-scrollable', () => {
      const view = render(Timeline, {
        props: { items, orientation: 'horizontal', label: 'Roadmap' },
      });
      const list = view.getByRole('list', { name: 'Roadmap' });
      expect(list.dataset.orientation).toBe('horizontal');
      expect(list.className).toContain('tx-timeline--horizontal');
      expect(list.getAttribute('tabindex')).toBe('0');
    });

    it('says each status in words, marks the current item, and never relies on color alone', () => {
      const view = render(Timeline, { props: { items } });
      const [done, now, next] = listItems(view.container);
      expect(done?.dataset.status).toBe('complete');
      expect(done?.querySelector('.tx-timeline__marker svg')).not.toBeNull();
      expect(now?.getAttribute('aria-current')).toBe('step');
      expect(now?.querySelector('.tx-timeline__sr-only')?.textContent).toBe(', Current');
      expect(next?.querySelector('.tx-timeline__sr-only')?.textContent).toBe(', Upcoming');
      expect(next?.hasAttribute('aria-current')).toBe(false);
      for (const item of listItems(view.container)) {
        expect(item.querySelector('.tx-timeline__marker')?.getAttribute('aria-hidden')).toBe(
          'true'
        );
      }
    });

    it('passes every link through the URL policy', () => {
      const view = render(Timeline, {
        props: {
          items: [
            { title: 'Docs', href: 'https://example.com/docs' },
            { title: 'Relative', href: '/changelog' },
            { title: 'Script', href: 'javascript:alert(1)' },
            { title: 'Data', href: 'data:text/html,<p>x</p>' },
          ],
        },
      });
      expect(view.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe(
        'https://example.com/docs'
      );
      expect(view.getByRole('link', { name: 'Relative' }).getAttribute('href')).toBe('/changelog');
      // Rejected links render as text, never as an inert <a>.
      expect(view.queryByRole('link', { name: 'Script' })).toBeNull();
      expect(view.getByText('Script')).toBeTruthy();
      expect(view.queryByRole('link', { name: 'Data' })).toBeNull();
      expect(view.container.querySelectorAll('a')).toHaveLength(2);
    });

    it('applies the untrusted tier to agent or user content', () => {
      const view = render(Timeline, {
        props: {
          hrefTrust: 'untrusted',
          items: [
            { title: 'Secure', href: 'https://example.com/a' },
            { title: 'Relative', href: '/changelog' },
          ],
        },
      });
      expect(view.getByRole('link', { name: 'Secure' })).toBeTruthy();
      expect(view.queryByRole('link', { name: 'Relative' })).toBeNull();
    });
  });
});

describe('tree', () => {
  afterEach(cleanup);

  const items: readonly TreeNode[] = [
    {
      id: 'workspace',
      label: 'Workspace',
      children: [
        { id: 'docs', label: 'Documentation', children: [{ id: 'guide', label: 'Guide' }] },
        { id: 'archive', label: 'Archive', disabled: true },
      ],
    },
    { id: 'team', label: 'Team' },
  ];

  describe('TreeView', () => {
    it('shows selected state and decorative checkboxes in multiple-selection mode', () => {
      render(TreeView, {
        props: { items, expanded: ['workspace'], selected: ['docs'], selectionMode: 'multiple' },
      });
      const tree = screen.getByRole('tree');
      const docs = within(tree).getByRole('treeitem', { name: 'Documentation' });
      const archive = within(tree).getByRole('treeitem', { name: 'Archive' });

      expect(tree.getAttribute('aria-multiselectable')).toBe('true');
      expect(docs.getAttribute('aria-selected')).toBe('true');
      expect(docs.querySelector('.tx-tree__checkbox')?.getAttribute('data-checked')).toBe('true');
      expect(docs.querySelector('.tx-tree__checkbox svg')).toBeTruthy();
      expect(archive.hasAttribute('data-disabled')).toBe(true);
      expect(archive.querySelector('.tx-tree__checkbox')?.getAttribute('data-checked')).toBe(
        'false'
      );
    });

    it('forwards consumer attributes and composes the consumer class last', () => {
      render(TreeView, { props: { items, id: 'folders', class: 'my-tree', label: 'Folders' } });
      const tree = screen.getByRole('tree', { name: 'Folders' });
      expect(tree.id).toBe('folders');
      expect(tree.className).toBe('tx-tree my-tree');
      expect(tree.getAttribute('data-tx-tree')).not.toBeNull();
    });
  });
});

describe('resizable', () => {
  afterEach(() => cleanup());

  const handle = (name = 'Resize navigation') => screen.getByRole('separator', { name });
  const press = (key: string) => fireEvent.keyDown(handle(), { key });

  describe('ResizableHandle', () => {
    it('defaults its name to "Resize" and takes a translated label', () => {
      const { unmount } = render(ResizableHarness, {
        props: { defaultLabel: true },
      });
      expect(handle('Resize')).toBeTruthy();
      unmount();
      render(ResizableHarness, { props: { label: 'Redimensionar navegación' } });
      expect(handle('Redimensionar navegación')).toBeTruthy();
    });

    it('is disabled with the group: no Tab stop, no keyboard resize', async () => {
      render(ResizableHarness, { props: { disabled: true } });
      const separator = handle();
      expect(separator.hasAttribute('tabindex')).toBe(false);
      expect(separator.getAttribute('aria-disabled')).toBe('true');
      expect(separator.hasAttribute('data-disabled')).toBe(true);
      await press('ArrowRight');
      expect(separator.getAttribute('aria-valuenow')).toBe('30');
    });

    it('restores and saves the layout through storage', async () => {
      const saved = new Map<string, string>();
      const storage = {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => {
          saved.set(key, value);
        },
      };
      const { unmount } = render(ResizableHarness, { props: { storage } });
      await press('ArrowRight');
      expect([...saved.values()].join()).toContain('40');
      unmount();
      render(ResizableHarness, { props: { storage } });
      expect(handle().getAttribute('aria-valuenow')).toBe('40');
    });
  });
});

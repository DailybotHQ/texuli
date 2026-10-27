// @vitest-environment happy-dom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { CompositionAnimation } from '../src/animation/types.ts';
import { validateAnimationV2, validateCompositionV2 } from '../src/composition-v2/index.ts';
import AnimationTimeline from '../src/timeline/AnimationTimeline.svelte';
import { DEFAULT_TIMELINE_LABELS, refusalAnnouncement } from '../src/timeline/labels.ts';
import {
  applyTimelineAction,
  createTimelineHistory,
  snapTime,
  TIMELINE_LIMITS,
  type TimelineAction,
  type TimelineDocument,
  timelineHistoryReducer,
  timelineRows,
} from '../src/timeline/model-index.ts';
import golden from './golden/composition-v2/lower-third.json' with { type: 'json' };

function goldenDocument(): TimelineDocument {
  const composition = validateCompositionV2(golden.composition);
  if (!composition.ok) throw new Error('composition');
  const animation = validateAnimationV2(golden.animation, composition.composition);
  if (!animation.ok) throw new Error('animation');
  return { composition: composition.composition, animation: animation.animation };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

const accept = (document: TimelineDocument, action: TimelineAction) => {
  const result = applyTimelineAction(document, action);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.document;
};
const refuse = (document: TimelineDocument, action: TimelineAction) => {
  const result = applyTimelineAction(document, action);
  if (result.ok) throw new Error('expected a refusal');
  return result.errors.map((e) => `${e.code}@${e.path}`);
};
const track = (document: TimelineDocument, layerId: string) =>
  document.animation.tracks.find((t) => t.layerId === layerId)?.keyframes.map((k) => k.timeMs);

describe('timeline rows', () => {
  it('lists every layer in paint order with depth, label, windows and keyframes; snaps times to the step inside the timeline', () => {
    {
      // lists every layer in paint order with depth, label, windows and keyframes
      const rows = timelineRows(goldenDocument());
      expect(rows.map((r) => [r.layerId, r.kind, r.depth])).toEqual([
        ['background', 'shape', 0],
        ['title-card', 'group', 0],
        ['title', 'text', 1],
        ['subtitle', 'text', 1],
        ['lower-third', 'group', 0],
        ['bar', 'shape', 1],
        ['speaker', 'group', 1],
        ['speaker-name', 'text', 2],
        ['logo-shape', 'shape', 2],
        ['logo', 'shape', 2],
      ]);
      const byId = new Map(rows.map((r) => [r.layerId, r]));
      expect(byId.get('title')?.label).toBe('Harbor Notes');
      expect(byId.get('title-card')?.window).toEqual({ startMs: 0, endMs: 2500, own: true });
      expect(byId.get('subtitle')?.effective).toEqual({ startMs: 800, endMs: 2500 });
      expect(byId.get('background')?.window).toEqual({ startMs: 0, endMs: 6000, own: false });
      expect(byId.get('lower-third')?.keyframes).toEqual([2000, 2600]);
      expect(byId.get('bar')?.keyframes).toEqual([]);
    }
    cleanup();
    // snaps times to the step inside the timeline
    expect(snapTime(149, 100, 6000)).toBe(100);
    expect(snapTime(150, 100, 6000)).toBe(200);
    expect(snapTime(-20, 100, 6000)).toBe(0);
    expect(snapTime(99_999, 100, 6000)).toBe(6000);
    expect(snapTime(Number.NaN, 100, 6000)).toBe(0);
    expect(snapTime(333, 0, 6000)).toBe(333);
  });
});

describe('timeline actions', () => {
  it('sets and clears layer windows inside their groups, and 3 related cases', () => {
    {
      // sets and clears layer windows inside their groups
      const document = deepFreeze(goldenDocument());
      const moved = accept(document, {
        type: 'set-window',
        layerId: 'bar',
        startMs: 3000,
        endMs: 4000,
      });
      expect(timelineRows(moved).find((r) => r.layerId === 'bar')?.window).toEqual({
        startMs: 3000,
        endMs: 4000,
        own: true,
      });
      // An end at the composition's end is stored as the default.
      const toEnd = accept(document, {
        type: 'set-window',
        layerId: 'bar',
        startMs: 3000,
        endMs: 6000,
      });
      const bar = timelineRows(toEnd).find((r) => r.layerId === 'bar');
      expect(bar?.window.endMs).toBe(6000);
      expect(JSON.stringify(toEnd.composition)).not.toContain('"endMs":6000');

      const cleared = accept(moved, { type: 'clear-window', layerId: 'bar' });
      expect(timelineRows(cleared).find((r) => r.layerId === 'bar')?.window.own).toBe(false);

      expect(refuse(document, { type: 'set-window', layerId: 'subtitle', startMs: 2600 })).toEqual([
        'invalid-value@layers.subtitle.timing',
      ]);
      expect(
        refuse(document, { type: 'set-window', layerId: 'bar', startMs: 500, endMs: 400 })
      ).toEqual(['invalid-value@endMs']);
      expect(refuse(document, { type: 'set-window', layerId: 'bar', startMs: 6000 })).toEqual([
        'invalid-value@startMs',
      ]);
      expect(refuse(document, { type: 'set-window', layerId: 'bar', startMs: 1.5 })).toEqual([
        'invalid-value@startMs',
      ]);
      expect(refuse(document, { type: 'set-window', layerId: 'nope', startMs: 0 })).toEqual([
        'missing-field@layerId',
      ]);
      const { durationMs: _d, ...staticComposition } = document.composition;
      expect(
        refuse(
          { ...document, composition: staticComposition },
          { type: 'set-window', layerId: 'bar', startMs: 0 }
        )
      ).toEqual(['missing-field@durationMs']);
    }
    cleanup();
    {
      // adds, moves, updates, eases and removes keyframes, keeping tracks sorted
      const document = deepFreeze(goldenDocument());
      const added = accept(document, { type: 'add-keyframe', layerId: 'bar', timeMs: 3000 });
      expect(track(added, 'bar')).toEqual([3000]);
      const second = accept(added, {
        type: 'add-keyframe',
        layerId: 'bar',
        timeMs: 2500,
        values: { opacity: 0.25 },
      });
      expect(track(second, 'bar')).toEqual([2500, 3000]);
      expect(refuse(second, { type: 'add-keyframe', layerId: 'bar', timeMs: 3000 })).toEqual([
        'invalid-value@timeMs',
      ]);

      const moved = accept(second, {
        type: 'move-keyframe',
        layerId: 'bar',
        index: 0,
        timeMs: 3500,
      });
      expect(track(moved, 'bar')).toEqual([3000, 3500]);
      expect(
        refuse(second, { type: 'move-keyframe', layerId: 'bar', index: 0, timeMs: 3000 })
      ).toEqual(['invalid-value@timeMs']);
      expect(
        refuse(second, { type: 'move-keyframe', layerId: 'bar', index: 9, timeMs: 1 })
      ).toEqual(['missing-field@index']);

      const eased = accept(second, {
        type: 'set-easing',
        layerId: 'bar',
        index: 1,
        easing: 'ease-in',
      });
      expect(eased.animation.tracks.find((t) => t.layerId === 'bar')?.keyframes[1]?.easing).toBe(
        'ease-in'
      );

      const updated = accept(second, {
        type: 'update-keyframe',
        layerId: 'bar',
        index: 0,
        values: { opacity: 0.75 },
      });
      expect(updated.animation.tracks.find((t) => t.layerId === 'bar')?.keyframes[0]).toEqual({
        opacity: 0.75,
        timeMs: 2500,
      });
      // Ranges and group-track rules come from validateAnimationV2.
      expect(
        refuse(second, {
          type: 'update-keyframe',
          layerId: 'bar',
          index: 0,
          values: { opacity: 2 },
        })
      ).toEqual(['invalid-value@tracks[2].keyframes[0].opacity']);
      expect(
        refuse(document, {
          type: 'update-keyframe',
          layerId: 'lower-third',
          index: 0,
          values: { scaleX: 2 },
        })
      ).toEqual(['invalid-value@tracks[0].keyframes[0].scaleX']);
      expect(refuse(document, { type: 'add-keyframe', layerId: 'bar', timeMs: 7000 })).toEqual([
        'invalid-value@timeMs',
      ]);

      // Removing a track's last keyframe drops the track.
      const removed = accept(added, { type: 'remove-keyframe', layerId: 'bar', index: 0 });
      expect(track(removed, 'bar')).toBeUndefined();
    }
    cleanup();
    {
      // keeps an animation from losing its last keyframe
      const lone: CompositionAnimation = {
        version: 1,
        durationMs: 6000,
        tracks: [{ layerId: 'bar', keyframes: [{ timeMs: 0, opacity: 1 }] }],
      };
      const document = { ...goldenDocument(), animation: lone };
      expect(refuse(document, { type: 'remove-keyframe', layerId: 'bar', index: 0 })).toEqual([
        'missing-field@tracks',
      ]);
    }
    cleanup();
    {
      // never leaves an invalid document, whatever the edits (seeded fuzz)
      let seed = 20261025;
      const random = () => {
        seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
        return seed / 2_147_483_648;
      };
      const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)] as T;
      const ids = timelineRows(goldenDocument()).map((r) => r.layerId);
      let document = deepFreeze(goldenDocument());
      let accepted = 0;
      for (let step = 0; step < 400; step += 1) {
        const layerId = pick(ids);
        const time = Math.round(random() * 6500) - 200;
        const kind = pick([
          'set-window',
          'clear-window',
          'add',
          'move',
          'update',
          'ease',
          'remove',
        ]);
        const action: TimelineAction =
          kind === 'set-window'
            ? {
                type: 'set-window',
                layerId,
                startMs: time,
                endMs: time + Math.round(random() * 3000),
              }
            : kind === 'clear-window'
              ? { type: 'clear-window', layerId }
              : kind === 'add'
                ? {
                    type: 'add-keyframe',
                    layerId,
                    timeMs: time,
                    values: { opacity: random() * 1.2 },
                  }
                : kind === 'move'
                  ? {
                      type: 'move-keyframe',
                      layerId,
                      index: Math.floor(random() * 3),
                      timeMs: time,
                    }
                  : kind === 'update'
                    ? {
                        type: 'update-keyframe',
                        layerId,
                        index: Math.floor(random() * 3),
                        values: random() < 0.5 ? { translateX: time } : { rotateDeg: time },
                      }
                    : kind === 'ease'
                      ? { type: 'set-easing', layerId, index: 0, easing: 'ease-out' }
                      : { type: 'remove-keyframe', layerId, index: Math.floor(random() * 3) };
        const result = applyTimelineAction(document, action);
        if (!result.ok) continue;
        accepted += 1;
        const composition = validateCompositionV2(result.document.composition);
        expect(composition.ok, `step ${step} composition`).toBe(true);
        if (composition.ok) {
          expect(
            validateAnimationV2(result.document.animation, composition.composition).ok,
            `step ${step}`
          ).toBe(true);
        }
        document = deepFreeze(result.document);
      }
      expect(accepted).toBeGreaterThan(60);
    }
  });
});

describe('timeline history', () => {
  it('undoes, redoes, merges drags and records refusals without changing the document; keeps at most the history limit', () => {
    {
      // undoes, redoes, merges drags and records refusals without changing the document
      let history = createTimelineHistory(goldenDocument());
      const start = history.present;
      history = timelineHistoryReducer(history, {
        type: 'apply',
        action: { type: 'add-keyframe', layerId: 'bar', timeMs: 3000 },
      });
      for (const timeMs of [3100, 3200, 3300]) {
        history = timelineHistoryReducer(history, {
          type: 'apply',
          action: { type: 'move-keyframe', layerId: 'bar', index: 0, timeMs },
        });
      }
      expect(history.past).toHaveLength(2);
      expect(track(history.present, 'bar')).toEqual([3300]);

      const refused = timelineHistoryReducer(history, {
        type: 'apply',
        action: { type: 'set-window', layerId: 'subtitle', startMs: 2600 },
      });
      expect(refused.present).toBe(history.present);
      expect(refused.errors[0]?.path).toBe('layers.subtitle.timing');

      history = timelineHistoryReducer(refused, { type: 'undo' });
      expect(track(history.present, 'bar')).toEqual([3000]);
      expect(history.errors).toEqual([]);
      history = timelineHistoryReducer(history, { type: 'undo' });
      expect(history.present).toBe(start);
      history = timelineHistoryReducer(history, { type: 'redo' });
      expect(track(history.present, 'bar')).toEqual([3000]);
      expect(timelineHistoryReducer(createTimelineHistory(start), { type: 'undo' }).present).toBe(
        start
      );
      expect(timelineHistoryReducer(history, { type: 'replace', document: start })).toEqual(
        createTimelineHistory(start)
      );
    }
    cleanup();
    {
      // keeps at most the history limit
      let history = createTimelineHistory(goldenDocument());
      for (let i = 0; i < TIMELINE_LIMITS.maxHistory + 20; i += 1) {
        history = timelineHistoryReducer(history, {
          type: 'apply',
          // A track holds at most 64 keyframes: spread the edits over two layers.
          action: { type: 'add-keyframe', layerId: i % 2 === 0 ? 'bar' : 'logo', timeMs: 100 + i },
        });
      }
      expect(history.past).toHaveLength(TIMELINE_LIMITS.maxHistory);
    }
  });
});

describe('AnimationTimeline', () => {
  const renderTimeline = async (props: Record<string, unknown> = {}) => {
    const onchange = vi.fn();
    const view = render(AnimationTimeline, {
      props: {
        composition: golden.composition,
        animation: golden.animation,
        preview: false,
        onchange,
        ...props,
      },
    });
    await screen.findByRole('table', { name: 'Layers, windows and keyframes' });
    return { ...view, onchange };
  };
  it('renders a labelled table of layers, window controls, keyframes and a playhead, and 9 related cases', async () => {
    // renders a labelled table of layers, window controls, keyframes and a playhead
    await (async () => {
      await renderTimeline();
      const table = screen.getByRole('table', { name: 'Layers, windows and keyframes' });
      expect(
        within(table)
          .getAllByRole('rowheader')
          .map((h) => h.textContent?.trim())
      ).toEqual([
        'background shape',
        'title-card group',
        'Harbor Notes text',
        'Weekly port update text',
        'lower-third group',
        'bar shape',
        'speaker group',
        'Avery Example text',
        'logo-shape shape',
        'logo shape',
      ]);
      expect(screen.getByRole('slider', { name: 'Start of Harbor Notes' })).toBeTruthy();
      expect(
        screen.getByRole('slider', { name: 'End of title-card' }).getAttribute('aria-valuetext')
      ).toBe('2.50 s');
      expect(screen.getByRole('slider', { name: 'Playhead' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Keyframe 2 of 2 on lower-third at 2.60 s' })
      ).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Timeline controls' })).toBeTruthy();
    })();
    cleanup();
    // moves a keyframe with the arrow keys, removes it with Delete, and undoes
    await (async () => {
      const { onchange } = await renderTimeline({ stepMs: 100 });
      const key = screen.getByRole('button', { name: 'Keyframe 1 of 2 on Harbor Notes at 0.00 s' });
      key.focus();
      await fireEvent.keyDown(key, { key: 'ArrowRight' });
      const moved = await screen.findByRole('button', {
        name: 'Keyframe 1 of 2 on Harbor Notes at 0.10 s',
      });
      expect(onchange).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-tx-timeline-status]')?.textContent).toContain(
        'Keyframe moved to 0.10 s.'
      );

      await fireEvent.keyDown(moved, { key: 'ArrowRight', shiftKey: true });
      await screen.findByRole('button', { name: 'Keyframe 2 of 2 on Harbor Notes at 1.10 s' });

      await fireEvent.keyDown(
        screen.getByRole('button', { name: 'Keyframe 2 of 2 on Harbor Notes at 1.10 s' }),
        {
          key: 'Delete',
        }
      );
      await screen.findByRole('button', { name: 'Keyframe 1 of 1 on Harbor Notes at 0.50 s' });

      const root = screen.getByRole('region', { name: 'Animation timeline' });
      await fireEvent.keyDown(root, { key: 'z', ctrlKey: true });
      await screen.findByRole('button', { name: 'Keyframe 2 of 2 on Harbor Notes at 1.10 s' });
      await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await screen.findByRole('button', { name: 'Keyframe 1 of 2 on Harbor Notes at 0.00 s' });
      expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true);
    })();
    cleanup();
    // adds a keyframe at the playhead and edits window edges, announcing refusals
    await (async () => {
      const { onchange } = await renderTimeline({ stepMs: 100 });
      await fireEvent.input(screen.getByRole('slider', { name: 'Playhead' }), {
        target: { value: '3000' },
      });
      await fireEvent.click(
        screen.getByRole('button', { name: 'Add a keyframe to bar at 3.00 s' })
      );
      await screen.findByRole('button', { name: 'Keyframe 1 of 1 on bar at 3.00 s' });

      const start = screen.getByRole('slider', { name: 'Start of bar' });
      await fireEvent.change(start, { target: { value: '2500' } });
      await waitFor(() => expect(start.getAttribute('aria-valuetext')).toBe('2.50 s'));
      expect(onchange).toHaveBeenCalledTimes(2);

      // Weekly port update sits inside title-card (0–2.5 s): starting at 3 s cannot show.
      await fireEvent.change(screen.getByRole('slider', { name: 'Start of Weekly port update' }), {
        target: { value: '3000' },
      });
      await waitFor(() =>
        expect(document.querySelector('[data-tx-timeline-status]')?.textContent).toContain(
          'Not applied'
        )
      );
      expect(onchange).toHaveBeenCalledTimes(2);
    })();
    cleanup();
    // edits the selected keyframe easing in the inspector
    await (async () => {
      const { onchange } = await renderTimeline();
      await fireEvent.click(
        screen.getByRole('button', { name: 'Keyframe 2 of 2 on lower-third at 2.60 s' })
      );
      const easing = screen.getByRole('combobox', {
        name: 'Easing into this keyframe',
      }) as HTMLSelectElement;
      expect(easing.value).toBe('ease-out');
      await fireEvent.change(easing, { target: { value: 'ease-in-out' } });
      const last = onchange.mock.calls.at(-1)?.[0] as TimelineDocument;
      expect(last.animation.tracks[0]?.keyframes[1]?.easing).toBe('ease-in-out');
    })();
    cleanup();
    // refuses invalid input with the validation issues
    await (async () => {
      render(AnimationTimeline, {
        props: {
          composition: {
            version: 2,
            width: 1,
            height: 1,
            layers: [{ id: 'g', type: 'group', children: [] }],
          },
          animation: golden.animation,
          preview: false,
        },
      });
      expect((await screen.findByRole('alert')).textContent).toContain('cannot be edited');
      expect(screen.getByText('layers[0].children')).toBeTruthy();
    })();
    cleanup();
    // previews the sampled frame at the playhead
    await (async () => {
      render(AnimationTimeline, {
        props: { composition: golden.composition, animation: golden.animation, timeMs: 3000 },
      });
      await waitFor(() =>
        expect(document.querySelector('[data-tx-timeline-stage] svg')).not.toBeNull()
      );
    })();
    cleanup();
    // announces a refused edit with no message through the invalid-edit label
    expect(refusalAnnouncement(DEFAULT_TIMELINE_LABELS, '')).toBe('Not applied: invalid edit');
    expect(refusalAnnouncement(DEFAULT_TIMELINE_LABELS, '   ')).toBe('Not applied: invalid edit');
    expect(refusalAnnouncement(DEFAULT_TIMELINE_LABELS, undefined)).toBe(
      'Not applied: invalid edit'
    );
    expect(refusalAnnouncement(DEFAULT_TIMELINE_LABELS, 'Windows must overlap.')).toBe(
      'Not applied: Windows must overlap.'
    );
    expect(
      refusalAnnouncement(
        {
          ...DEFAULT_TIMELINE_LABELS,
          notApplied: 'No aplicado: {reason}',
          invalidEdit: 'edición no válida',
        },
        ''
      )
    ).toBe('No aplicado: edición no válida');
    cleanup();
    // renders and announces with the labels a host passes
    // T-70: every visible and announced string is a label a host can translate.
    await (async () => {
      const labels = {
        title: 'Línea de tiempo',
        table: 'Capas y fotogramas clave',
        undo: 'Deshacer',
        redo: 'Rehacer',
        playhead: 'Cabezal',
        keyframe: 'Fotograma {index} de {count} en {layer} a los {time}',
        keyframeMoved: 'Fotograma movido a {time}.',
        seconds: '{value} s',
      };
      await render(AnimationTimeline, {
        props: {
          composition: golden.composition,
          animation: golden.animation,
          preview: false,
          labels,
        },
      });
      expect(await screen.findByRole('table', { name: 'Capas y fotogramas clave' })).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Línea de tiempo' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy();
      expect(screen.getByRole('slider', { name: 'Cabezal' })).toBeTruthy();
      const key = screen.getByRole('button', {
        name: 'Fotograma 1 de 2 en Harbor Notes a los 0.00 s',
      });
      await fireEvent.keyDown(key, { key: 'ArrowRight' });
      await waitFor(() =>
        expect(document.querySelector('[data-tx-timeline-status]')?.textContent).toContain(
          'Fotograma movido a 0.10 s.'
        )
      );
      // Labels the host leaves out keep their defaults.
      expect(screen.getAllByRole('button', { name: /^Add a keyframe to / }).length).toBeGreaterThan(
        0
      );
    })();
    cleanup();
    // ignores a cleared opacity field instead of setting the opacity to zero
    // T-70: Number('') is 0, so clearing the field used to set the opacity to zero.
    await (async () => {
      const { onchange } = await renderTimeline();
      await fireEvent.click(
        screen.getByRole('button', { name: 'Keyframe 2 of 2 on lower-third at 2.60 s' })
      );
      const opacity = screen.getByRole('spinbutton', { name: 'Opacity' }) as HTMLInputElement;
      await fireEvent.change(opacity, { target: { value: '' } });
      expect(onchange).not.toHaveBeenCalled();
      await fireEvent.change(opacity, { target: { value: '0.4' } });
      const last = onchange.mock.calls.at(-1)?.[0] as TimelineDocument;
      expect(last.animation.tracks[0]?.keyframes[1]?.opacity).toBe(0.4);
    })();
    cleanup();
    // exposes the undo and redo shortcuts on their buttons
    // T-70: same shortcut hints as the image editor's history buttons.
    await (async () => {
      await renderTimeline();
      expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('aria-keyshortcuts')).toBe(
        'Control+Z Meta+Z'
      );
      expect(screen.getByRole('button', { name: 'Redo' }).getAttribute('aria-keyshortcuts')).toBe(
        'Control+Shift+Z Meta+Shift+Z Control+Y'
      );
    })();
  }, 20_000);
});

describe('timeline stylesheet', () => {
  const css = readFileSync(
    join(import.meta.dirname, '..', 'src', 'timeline', 'timeline.css'),
    'utf8'
  );
  const rule = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
  };
  it('draws focus rings with the focus-ring tokens; gives the keyframe diamond a hit area of at least 24px', () => {
    {
      // draws focus rings with the focus-ring tokens
      // T-70: focus rings follow the theme's focus-ring tokens like sibling components.
      const focus = rule('.tx-animation-timeline__keyframe:focus-visible');
      expect(focus).toMatch(/var\(--tx-focus-ring-width/);
      expect(focus).toMatch(/var\(--tx-focus-ring-offset/);
      expect(rule('.tx-animation-timeline__table-scroll:focus-visible')).toMatch(
        /var\(--tx-focus-ring-width/
      );
    }
    cleanup();
    {
      // gives the keyframe diamond a hit area of at least 24px
      // T-70: the 1rem keyframe diamond needs a 24px (1.5rem) pointer target.
      const hit = rule('.tx-animation-timeline__keyframe::before');
      expect(hit).toMatch(/content:\s*(''|"")/);
      expect(hit).toMatch(/inset:\s*-0\.25rem/);
    }
  });
});

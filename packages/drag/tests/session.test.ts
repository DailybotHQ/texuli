// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createDragSession,
  DRAG_INTENTS,
  type DragLifecycleEvent,
  REFUSAL_REASONS,
  refuse,
} from '../src/index.ts';

type Event = DragLifecycleEvent<string, string>;

function setup(options: Parameters<typeof createDragSession<string, string>>[0] = {}) {
  const events: Event[] = [];
  const session = createDragSession<string, string>({ ...options, onEvent: (e) => events.push(e) });
  return { session, events, types: () => events.map((e) => e.type) };
}

describe('drag session state machine', () => {
  it('walks idle → pressed → dragging → dropping → idle', () => {
    const { session, types } = setup();
    expect(session.state.phase).toBe('idle');
    expect(session.press('card', { x: 10, y: 10 })).toBe(true);
    expect(session.state.phase).toBe('pressed');
    session.move({ x: 12, y: 11 });
    expect(session.state.phase).toBe('pressed');
    session.move({ x: 14, y: 10 });
    expect(session.state.phase).toBe('dragging');
    expect(session.state.delta).toEqual({ x: 4, y: 0 });
    expect(session.over('slot-1')).toEqual({ ok: true });
    expect(session.over('slot-1')).toEqual({ ok: true });
    expect(session.drop()).toEqual({ kind: 'drop', target: 'slot-1' });
    expect(session.state.phase).toBe('dropping');
    session.settle();
    expect(session.state.phase).toBe('idle');
    expect(types()).toEqual(['start', 'move', 'over', 'drop']);
  });

  it('treats a release before the threshold as a click', () => {
    const { session, types } = setup({ threshold: 10 });
    session.press('card', { x: 0, y: 0 });
    session.move({ x: 9, y: 0 });
    expect(session.drop()).toEqual({ kind: 'click' });
    expect(session.state.phase).toBe('idle');
    expect(types()).toEqual([]);
  });

  it('cancels a drop without a target or with a refused target', () => {
    const { session, events } = setup({
      canDrop: (_, t) => (t === 'locked' ? refuse('locked') : { ok: true }),
    });
    session.start('card');
    expect(session.drop()).toEqual({ kind: 'cancel', reason: 'no-target' });
    expect(events.at(-1)).toMatchObject({ type: 'cancel', reason: 'no-target' });
    session.start('card');
    expect(session.over('locked')).toEqual({ ok: false, reason: 'locked' });
    expect(session.drop()).toEqual({ kind: 'cancel', reason: 'locked' });
    expect(events.at(-1)).toMatchObject({ type: 'cancel', reason: 'locked', target: 'locked' });
    expect(session.state.phase).toBe('idle');
  });

  it('cancels from any phase and only reports running drags', () => {
    const { session, types } = setup();
    expect(session.cancel()).toBe(false);
    session.press('card', { x: 0, y: 0 });
    expect(session.cancel()).toBe(true);
    expect(types()).toEqual([]);
    session.start('card', { x: 0, y: 0 });
    session.cancel();
    expect(types()).toEqual(['start', 'cancel']);
  });

  it('starts keyboard drags at once and refuses a second press', () => {
    const { session } = setup();
    expect(session.start('card')).toBe(true);
    expect(session.state.input).toBe('keyboard');
    expect(session.press('other', { x: 0, y: 0 })).toBe(false);
    expect(session.start('other')).toBe(false);
  });

  it('rewrites deltas through transform and ignores non-finite points', () => {
    const { session } = setup({ transform: (d) => ({ x: d.x, y: 0 }) });
    expect(session.press('card', { x: Number.NaN, y: 0 })).toBe(false);
    session.press('card', { x: 0, y: 0 });
    session.move({ x: 30, y: 40 });
    session.move({ x: Number.POSITIVE_INFINITY, y: 0 });
    expect(session.state.delta).toEqual({ x: 30, y: 0 });
  });

  it('re-judges at drop time', () => {
    let allowed = true;
    const { session } = setup({ canDrop: () => (allowed ? { ok: true } : refuse('full')) });
    session.start('card');
    session.over('slot');
    allowed = false;
    expect(session.drop()).toEqual({ kind: 'cancel', reason: 'full' });
  });

  it('exposes the intent and refusal vocabularies', () => {
    expect(DRAG_INTENTS).toEqual([
      'pickUp',
      'movePrev',
      'moveNext',
      'moveInto',
      'moveOut',
      'drop',
      'cancel',
    ]);
    expect(REFUSAL_REASONS).toContain('cycle');
  });
});

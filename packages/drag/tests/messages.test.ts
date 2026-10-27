// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DRAG_MESSAGES,
  formatDragMessage,
  formatRefusal,
  resolveDragMessages,
} from '../src/messages.ts';
import { REFUSAL_REASONS } from '../src/session.ts';

const values = {
  item: 'Card 1',
  position: 2,
  total: 5,
  container: 'Backlog',
  from: 'Doing',
  count: 3,
};

describe('drag messages', () => {
  it('fills position, total and container in every announcement template', () => {
    for (const key of [
      'pickedUp',
      'moved',
      'movedContainer',
      'dropped',
      'droppedContainer',
      'cancelled',
    ] as const) {
      const text = formatDragMessage(DEFAULT_DRAG_MESSAGES[key], values);
      expect(text).toContain('2');
      expect(text).toContain('5');
      expect(text).not.toMatch(/\{\w+\}/);
    }
    expect(formatDragMessage(DEFAULT_DRAG_MESSAGES.pickedUp, values)).toBe(
      'Card 1 picked up. Position 2 of 5 in Backlog.'
    );
    expect(formatDragMessage(DEFAULT_DRAG_MESSAGES.pickedUpMany, values)).toBe(
      '3 items picked up. Position 2 of 5 in Backlog.'
    );
  });

  it('has a text for every built-in refusal reason', () => {
    for (const reason of REFUSAL_REASONS) {
      expect(formatRefusal(DEFAULT_DRAG_MESSAGES, reason, values)).toMatch(
        /^Cannot move Card 1 there: .+\.$/
      );
    }
    expect(formatRefusal(DEFAULT_DRAG_MESSAGES, 'put', values)).toBe(
      'Cannot move Card 1 there: Backlog does not accept it.'
    );
    expect(formatRefusal(DEFAULT_DRAG_MESSAGES, 'host-quota', values)).toBe(
      'Cannot move Card 1 there: the move is not allowed.'
    );
    expect(formatRefusal(DEFAULT_DRAG_MESSAGES, 'toString', values)).toBe(
      'Cannot move Card 1 there: the move is not allowed.'
    );
  });

  it('merges overrides, including reasons key by key', () => {
    const es = resolveDragMessages({
      moved: '{item} movido a la posición {position} de {total}.',
      reasons: { locked: 'está bloqueado' },
    });
    expect(formatDragMessage(es.moved, values)).toBe('Card 1 movido a la posición 2 de 5.');
    expect(formatRefusal(es, 'locked', values)).toBe('Cannot move Card 1 there: está bloqueado.');
    expect(es.reasons.cycle).toBe(DEFAULT_DRAG_MESSAGES.reasons.cycle);
    expect(Object.isFrozen(es)).toBe(true);
  });

  it('accepts function messages and a number formatter', () => {
    expect(formatDragMessage((v) => `${v.item}!`, values)).toBe('Card 1!');
    expect(formatDragMessage('{position}/{total}', values, { formatNumber: (n) => `٫${n}` })).toBe(
      '٫2/٫5'
    );
  });

  it('keeps output plain text: values are inserted verbatim, unknown braces stay', () => {
    const hostile = { ...values, item: '<img src=x onerror=alert(1)>{total}' };
    expect(formatDragMessage('{item} {nope}', hostile)).toBe(
      '<img src=x onerror=alert(1)>{total} {nope}'
    );
    expect(formatDragMessage('{item}', {})).toBe('');
  });
});

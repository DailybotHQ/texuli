import { describe, expect, it, vi } from 'vitest';
import * as primitives from '../../primitives/src/index.ts';
import * as cxEntry from '../src/internal/index.ts';
import * as root from '../src/index.ts';

// G95: the handler composers behind the "caller first" rule
// (docs/STANDARDS.md) are public, so a host building its own parts follows
// the same order.

type Composer = (consumer: unknown, own: (event: Event) => unknown) => (event: Event) => void;

const entries: [string, Record<string, unknown>][] = [
  ['texuli', root as Record<string, unknown>],
  ['texuli/cx', cxEntry as Record<string, unknown>],
  ['@texuli/primitives', primitives as Record<string, unknown>],
];

describe('public handler composers (G95)', () => {
  it('compose runs the caller first and skips own on preventDefault; chain always runs own', () => {
    for (const [name, entry] of entries) {
      for (const kind of ['composeHandlers', 'chainHandlers'] as const) {
        const make = entry[kind] as Composer | undefined;
        expect(typeof make, `${name} ${kind}`).toBe('function');
        if (!make) continue;
        const order: string[] = [];
        const handler = make(
          (event: Event) => {
            order.push('caller');
            if (event.type === 'prevent') event.preventDefault();
          },
          () => order.push('own')
        );
        handler(new Event('click', { cancelable: true }));
        expect(order, `${name} ${kind} click`).toEqual(['caller', 'own']);
        order.length = 0;
        handler(new Event('prevent', { cancelable: true }));
        const expected = kind === 'composeHandlers' ? ['caller'] : ['caller', 'own'];
        expect(order, `${name} ${kind} prevented`).toEqual(expected);
        const own = vi.fn();
        make(undefined, own)(new Event('click'));
        expect(own).toHaveBeenCalledTimes(1);
      }
    }
  });
});

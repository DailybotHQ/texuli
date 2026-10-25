import { describe, expect, it, vi } from 'vitest';
import {
  compareLocale,
  createCollator,
  DEFAULT_MESSAGES,
  directionOf,
  inlineSideToPhysical,
  resolveMessages,
} from '../src/index.ts';

describe('directionOf', () => {
  it('uses the nearest valid dir attribute and inherits invalid values', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const outer = document.createElement('section');
    outer.setAttribute('dir', 'invalid');
    const inner = document.createElement('button');
    outer.append(inner);
    document.body.append(outer);

    expect(directionOf(inner)).toBe('rtl');

    outer.setAttribute('dir', 'LTR');
    expect(directionOf(inner)).toBe('ltr');
    expect(directionOf(document)).toBe('rtl');
  });

  it('uses an explicit fallback when no direction is present', () => {
    document.documentElement.removeAttribute('dir');
    const element = document.createElement('div');
    document.body.append(element);

    expect(directionOf(element)).toBe('ltr');
    expect(directionOf(element, 'rtl')).toBe('rtl');
  });

  it('uses computed direction for dir=auto when the browser resolves it', () => {
    const element = document.createElement('div');
    element.setAttribute('dir', 'auto');
    document.body.append(element);
    const view = element.ownerDocument.defaultView;
    expect(view).not.toBeNull();
    if (view) {
      vi.spyOn(view, 'getComputedStyle').mockReturnValue({
        direction: 'rtl',
      } as CSSStyleDeclaration);
    }

    expect(directionOf(element, 'ltr')).toBe('rtl');
  });
});

describe('inlineSideToPhysical', () => {
  it('maps inline sides for both directions', () => {
    expect(inlineSideToPhysical('start', 'ltr')).toBe('left');
    expect(inlineSideToPhysical('end', 'ltr')).toBe('right');
    expect(inlineSideToPhysical('start', 'rtl')).toBe('right');
    expect(inlineSideToPhysical('end', 'rtl')).toBe('left');
  });
});

describe('locale comparison', () => {
  it('uses numeric, case- and accent-insensitive defaults', () => {
    expect(compareLocale('file 2', 'FILE 10', 'en')).toBeLessThan(0);
    expect(compareLocale('resume', 'résumé', 'en')).toBe(0);
    expect(createCollator('en').compare('A', 'a')).toBe(0);
  });

  it('uses the requested locale rather than a machine-default ordering', () => {
    expect(compareLocale('ä', 'z', 'en')).toBeLessThan(0);
    expect(compareLocale('ä', 'z', 'sv')).toBeGreaterThan(0);
  });

  it('respects caller options and rejects invalid locales according to Intl', () => {
    expect(compareLocale('a', 'A', 'en', { sensitivity: 'variant' })).not.toBe(0);
    expect(() => createCollator('not_a_locale')).toThrow(RangeError);
  });
});

describe('messages', () => {
  it('provides a complete English set and fills partial translations', () => {
    const messages = resolveMessages({ close: 'Cerrar', next: 'Siguiente' });

    expect(messages.close).toBe('Cerrar');
    expect(messages.next).toBe('Siguiente');
    expect(messages.loading).toBe('Loading…');
    expect(Object.keys(messages)).toEqual(Object.keys(DEFAULT_MESSAGES));
  });

  it('uses English for undefined or non-string runtime overrides and preserves empty strings', () => {
    const malformed = { close: 12, loading: undefined, next: '' } as unknown as {
      close: string;
      loading: string | undefined;
      next: string;
    };
    const messages = resolveMessages(malformed);

    expect(messages.close).toBe('Close');
    expect(messages.loading).toBe('Loading…');
    expect(messages.next).toBe('');
  });
});

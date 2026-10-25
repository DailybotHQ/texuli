import { describe, expect, it } from 'vitest';
import { type ClassValue, cx } from '../src/internal/cx.ts';
import { variants } from '../src/internal/variants.ts';

describe('cx', () => {
  it('joins strings and numbers, skipping empty and whitespace-only parts', () => {
    expect(cx('a', 1, '  b  ', ' ')).toBe('a 1 b');
    expect(cx()).toBe('');
  });

  it('skips falsy expression leftovers (null, undefined, false, 0, empty string, true)', () => {
    expect(cx('a', null, undefined, false, true, 0, '', 'b')).toBe('a b');
  });

  it('flattens nested arrays (Svelte class={[a, [b, cond && c]]} shape)', () => {
    const full = true;
    const hidden = false;
    expect(cx(['base', full && 'w-full', hidden && 'hidden', ['deep', ['nested']]])).toBe(
      'base w-full deep nested'
    );
  });

  it('takes object maps whose values are truthy (Svelte class={{ a: true, b: false }})', () => {
    expect(cx({ a: true, b: false, c: 1, d: null, 'e-f': 'yes' })).toBe('a c e-f');
  });

  it('merges mixed shapes in order so consumer classes stay last', () => {
    const consumer: ClassValue = ['mine', { extra: true }, false && 'nope'];
    expect(cx('tx-base', { 'tx-on': true }, consumer)).toBe('tx-base tx-on mine extra');
  });
});

describe('variants', () => {
  const button = variants({
    base: 'tx-button',
    variants: {
      tone: { primary: 'tx-button--primary', neutral: 'tx-button--neutral' },
      size: { sm: 'tx-button--sm', md: 'tx-button--md' },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  });

  it('applies defaults, chosen variants and the consumer class last', () => {
    expect(button()).toBe('tx-button tx-button--neutral tx-button--md');
    expect(button({ tone: 'primary', class: 'mine' })).toBe(
      'tx-button tx-button--primary tx-button--md mine'
    );
  });

  it('accepts ClassValue arrays and objects on class', () => {
    expect(button({ class: ['a', false && 'x', { b: true }] })).toBe(
      'tx-button tx-button--neutral tx-button--md a b'
    );
  });

  it('ignores a value that is not a declared variant', () => {
    expect(button({ size: 'xl' as 'sm' })).toBe('tx-button tx-button--neutral');
  });
});

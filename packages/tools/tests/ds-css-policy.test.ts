import { describe, expect, it } from 'vitest';
import {
  checkLockedClassList,
  checkLockedCssDeclarations,
  checkLockedCssSource,
  LOCKED_CSS_CODES,
  LOCKED_LAYOUT_UTILITY_RULES,
} from '../src/ds-check/css-policy.ts';

describe('locked CSS policy', () => {
  it('keeps a data-driven layout utility allowlist and accepts every listed utility', () => {
    const utilities = Object.values(LOCKED_LAYOUT_UTILITY_RULES).flat();
    expect(utilities.length).toBeGreaterThan(100);
    for (const utility of utilities) expect(checkLockedClassList(utility).ok, utility).toBe(true);
    expect(LOCKED_CSS_CODES).toContain('css-utility-not-allowed');
  });

  it.each([
    'text-red-500',
    'bg-red-500',
    'border',
    'shadow-md',
    'rounded-lg',
    'font-bold',
    'opacity-50',
    'hover:flex',
    'w-[37px]',
  ])('rejects non-layout or arbitrary utility %s', (utility) => {
    const result = checkLockedClassList(utility);
    expect(result.ok).toBe(false);
    expect(result.codes).toContain(
      utility.includes('[') ? 'css-arbitrary-value' : 'css-utility-not-allowed'
    );
  });

  it('accepts layout declarations using approved tokens and named values', () => {
    expect(
      checkLockedCssDeclarations(
        '.stack{display:flex;gap:var(--tx-space-4);padding-inline:var(--tx-space-2);position:relative;z-index:var(--tx-z-sticky)}'
      ).ok
    ).toBe(true);
  });

  it.each([
    ['color: red', 'css-property-not-allowed'],
    ['background-color: var(--tx-color-text)', 'css-property-not-allowed'],
    ['border: 1px solid currentColor', 'css-property-not-allowed'],
    ['border-radius: var(--tx-shape-radius-md)', 'css-property-not-allowed'],
    ['box-shadow: none', 'css-property-not-allowed'],
    ['outline: 1px solid currentColor', 'css-property-not-allowed'],
    ['font-family: var(--tx-font-body)', 'css-property-not-allowed'],
    ['font-size: 12px', 'css-property-not-allowed'],
    ['font-weight: 700', 'css-property-not-allowed'],
    ['line-height: 1.5', 'css-property-not-allowed'],
    ['letter-spacing: 0.1em', 'css-property-not-allowed'],
    ['opacity: 0.5', 'css-property-not-allowed'],
    ['filter: blur(2px)', 'css-property-not-allowed'],
    ['transform: scale(2)', 'css-property-not-allowed'],
    ['transition: all 1s', 'css-property-not-allowed'],
    ['width: #fff', 'css-literal-color'],
  ])('rejects visual declaration %s', (declaration, code) => {
    const result = checkLockedCssDeclarations(`.x{${declaration}}`);
    expect(result.ok).toBe(false);
    expect(result.codes).toContain(code as string);
  });

  it.each([
    'width: 37px',
    'gap: 1rem',
    'padding: calc(2rem + 1px)',
    'width: var(--brand-width)',
    'width: [17px]',
  ])('rejects arbitrary declaration value %s', (declaration) => {
    const result = checkLockedCssDeclarations(`.x{${declaration}}`);
    expect(result.ok).toBe(false);
    expect(result.codes).toContain('css-arbitrary-value');
  });

  it('scans Svelte styles, classes and inline style attributes', () => {
    const result = checkLockedCssSource(
      `<div class="flex gap-4 text-red-500" style="color:red"></div><style>.x{display:grid;color:red}</style>`,
      'Page.svelte'
    );
    expect(result.ok).toBe(false);
    expect(result.codes).toEqual(
      expect.arrayContaining([
        'css-utility-not-allowed',
        'css-inline-style',
        'css-property-not-allowed',
      ])
    );
  });

  it('rejects dynamic class values because their utility set cannot be proven', () => {
    expect(checkLockedCssSource('<div class={classes} />').codes).toContain('css-dynamic-class');
  });

  it('checks global CSS and Svelte class directives', () => {
    expect(checkLockedCssSource('.page{color:red}', 'global.css').codes).toContain(
      'css-property-not-allowed'
    );
    expect(checkLockedCssSource('<div class:font-bold={active} />').codes).toContain(
      'css-utility-not-allowed'
    );
  });
});

/// <reference types="node" />
/**
 * Button tone as an axis independent of variant (T-button-tone, ADR-032):
 * outline + destructive exists, the destructive variant still paints a filled
 * destructive button, catalog axes list tone, and the allow set governs it.
 */
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { buttonManifest } from '../../catalog/src/manifests/forms/index.ts';
import { checkDesignSystemAllow } from '../../spec/src/design-system/allow.ts';
import { BUTTON_TONES, Button } from '../src/components/button/index.ts';

afterEach(() => cleanup());

const catalog = {
  components: [
    {
      id: 'button',
      axes: {
        variant: {
          values: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
        },
        size: { values: ['sm', 'md', 'lg', 'icon'] },
        tone: { values: [...BUTTON_TONES] },
      },
    },
  ],
};

describe('Button tone axis', () => {
  it('renders outline + destructive from catalog axes', () => {
    render(Button, { props: { variant: 'outline', tone: 'destructive', label: 'Delete' } });
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.getAttribute('data-tx-component')).toBe('button');
    expect(button.getAttribute('data-tx-variant')).toBe('outline');
    expect(button.getAttribute('data-tx-tone')).toBe('destructive');
    expect(button.className).toContain('tx-button--outline');
    expect(button.className).not.toContain('tx-button--destructive');
    expect(buttonManifest.axes?.tone).toBe('tone');
    expect(buttonManifest.props.find((prop) => prop.name === 'tone')?.enumValues).toEqual([
      ...BUTTON_TONES,
    ]);
  });

  it('keeps the existing destructive variant as a filled destructive button', () => {
    render(Button, { props: { variant: 'destructive', label: 'Delete' } });
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.getAttribute('data-tx-variant')).toBe('destructive');
    expect(button.getAttribute('data-tx-tone')).toBe('default');
    expect(button.className).toContain('tx-button--destructive');
    expect(button.className).not.toContain('tx-button--outline');
  });

  it('lets the allow set enable outline destructive and refuse an unknown tone', () => {
    const doc = {
      format: 'texuli/design-system',
      formatVersion: 1,
      id: 'harborline',
      version: '1.0.0',
      name: 'Harborline',
      allow: { button: { variants: ['outline', 'destructive'], tones: ['destructive'] } },
    };
    expect(checkDesignSystemAllow(doc, catalog).ok).toBe(true);
    expect(
      checkDesignSystemAllow(
        {
          ...doc,
          allow: { button: { variants: ['outline'], tones: ['rainbow'] } },
        },
        catalog
      ).errors.map((issue) => issue.code)
    ).toContain('unknown-tone');
  });
});

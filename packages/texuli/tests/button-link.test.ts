import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Button } from '../src/components/button/index.ts';

const buttonStyles = readFileSync(
  join(process.cwd(), 'packages/texuli/src/components/button/button.css'),
  'utf8'
);

let styleElement: HTMLStyleElement;

beforeEach(() => {
  styleElement = document.createElement('style');
  styleElement.textContent = buttonStyles
    .replace(/^[\s\S]*?@layer tx\.components\s*\{/, '')
    .replace(/\n\}\s*$/, '');
  document.head.append(styleElement);
});

afterEach(() => {
  cleanup();
  styleElement.remove();
});

describe('Button link variant sizing', () => {
  it.each(['sm', 'md', 'lg'] as const)(
    'sizes a %s link to its text without control padding',
    (size) => {
      render(Button, { props: { href: '/guide', label: 'Read guide', size, variant: 'link' } });
      const link = screen.getByRole('link', { name: 'Read guide' });
      const style = window.getComputedStyle(link);

      expect(style.blockSize).toBe('auto');
      expect(style.minBlockSize).toBe('0');
      expect(style.getPropertyValue('padding-inline')).toBe('0');
      expect(style.getPropertyValue('padding-block')).toBe('0');
    }
  );
});

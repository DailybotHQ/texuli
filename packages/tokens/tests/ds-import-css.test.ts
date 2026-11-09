import { describe, expect, it } from 'vitest';
import { importSiteCss as importFromSubpath } from '../src/design-system/import.ts';
import { importSiteCss } from '../src/design-system/import-css.ts';
import type { DesignSystemImportLoss } from '../src/design-system/token-formats.ts';
import { validateDesignSystem } from '../src/design-system/validate.ts';
import * as root from '../src/index.ts';

function assertLossShape(losses: DesignSystemImportLoss[]) {
  for (const loss of losses) {
    expect(Object.keys(loss).sort()).toEqual(
      loss.value === undefined ? ['path', 'reason'] : ['path', 'reason', 'value']
    );
    expect(loss.path.startsWith('$')).toBe(true);
    expect(loss.reason.length).toBeGreaterThan(0);
  }
}

describe('site CSS importer', () => {
  it('is exported from the import subpath, never from the package root (size budget)', () => {
    expect(importFromSubpath).toBe(importSiteCss);
    expect('importSiteCss' in root).toBe(false);
  });

  it('imports colors, type, fonts, radius, spacing and motion from fictional site CSS', () => {
    const css = `
      :root {
        --tx-primary: #0f766e;
        --tx-background: #fafcff;
        --tx-font-sans: Inter, Arial, sans-serif;
        --tx-font-size-body: 16px;
        --tx-font-weight-body: 400;
        --tx-radius-md: 12px;
        --tx-space-1: 4px;
        --tx-space-density: 0.9;
        --tx-motion-duration-fast: 120ms;
        --tx-motion-duration-slow: 300ms;
        --site-shadow: 0 2px 4px #000000;
      }
      @font-face {
        font-family: Inter;
        font-style: normal;
        font-weight: 400 700;
        src: url("./fonts/harbor-sans.woff2") format("woff2");
      }
    `;
    const result = importSiteCss(css);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateDesignSystem(result.document).ok).toBe(true);
    expect(result.document).toMatchObject({
      color: { roles: { light: { primary: '#0f766e', background: '#fafcff' } } },
      typography: {
        families: {
          sans: {
            stack: ['Inter', 'Arial', 'sans-serif'],
            files: [{ src: './fonts/harbor-sans.woff2', weight: '400 700' }],
          },
        },
        roles: { body: { size: 16, weight: 400 } },
      },
      shape: { radius: 12 },
      space: { base: 4, density: 0.9 },
      motion: { durations: { fast: 120, slow: 300 } },
    });
    expect(result.losses).toContainEqual({
      path: '$.rules[":root"].--site-shadow',
      reason: 'No design-system field takes this custom property.',
      value: '0 2px 4px #000000',
    });
    assertLossShape(result.losses);
  });

  it('imports an @font-face family and weight without fetching a remote source', () => {
    const result = importSiteCss(`
      @font-face {
        font-family: "Remote Sans";
        font-weight: 600;
        src: url("https://fonts.example.test/remote.woff2");
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.typography?.families?.sans?.stack).toContain('Remote Sans');
    expect(result.document.typography?.families?.sans?.files ?? []).toEqual([]);
    expect(result.document.typography?.roles?.body?.weight).toBe(600);
    expect(result.losses).toContainEqual({
      path: '$.rules["@font-face"].src',
      reason: 'Font source is not a safe local relative path; it was not loaded.',
      value: 'url("https://fonts.example.test/remote.woff2")',
    });
    assertLossShape(result.losses);
  });

  it('maps transition shorthand timings into fast and slow motion slots', () => {
    const result = importSiteCss('body { transition: opacity 100ms ease, transform 250ms ease; }');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.motion?.durations).toMatchObject({ fast: 100, slow: 250 });
  });

  it('refuses hostile and oversized CSS with stable importer error codes', () => {
    const importedDirective = importSiteCss('@import url("https://evil.example.test/x.css");');
    expect(importedDirective.ok).toBe(false);
    if (!importedDirective.ok) expect(importedDirective.errors[0]?.code).toBe('invalid-input');

    const executableValue = importSiteCss(':root { --tx-primary: url(javascript:alert(1)); }');
    expect(executableValue.ok).toBe(false);
    if (!executableValue.ok) expect(executableValue.errors[0]?.code).toBe('invalid-input');

    const oversized = importSiteCss(':root {}', { maxBytes: 4 });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.errors[0]?.code).toBe('input-limit');
  });
});

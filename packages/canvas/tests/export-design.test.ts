// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  type CanvasExportDesign,
  canvasToSvg,
  EXPORT_DESIGN_ROLES,
  exportPalette,
} from '../src/export/index.ts';
import { EXPORT_PALETTE, PALETTE_TOKENS } from '../src/model/index.ts';
import { everyShape } from './fixtures.ts';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const resolveImage = (ref: string) =>
  ref === 'assets/logo-1' ? 'https://example.com/logo.png' : null;

/** `canvasToSvg(everyShape())` before design values existed (recorded at 7e5211f7). */
const DEFAULT_SVG_SHA = 'ccc79e7ce7796636eb638ab5ceb465372c6223d300403881e05646673bd8aa12';
const DEFAULT_SVG_NO_IMAGES_SHA =
  '27b98dd0c6e2656300a16fef2d52b2ac71f69bfc8ec091f714ae22b8e1ba3805';

/** Plain design values, as `designValues(compiled, 'light')` builds them. */
const ACME: CanvasExportDesign = {
  colors: {
    background: '#f9fafb',
    foreground: '#111827',
    mutedForeground: '#4b5563',
    muted: '#f3f4f6',
    border: '#e5e7eb',
    destructive: '#d92d20',
    warning: '#916600',
    success: '#079455',
    info: '#0871c1',
    chart2: '#0ea5e9',
    chart4: '#10b981',
    chart5: '#ef4444',
    chart6: '#8b5cf6',
  },
  fonts: { sans: '"Acme Sans", system-ui, sans-serif' },
};

describe('canvas export: design values', () => {
  it('keeps the default SVG byte for byte without a design (and with an empty or hostile one)', () => {
    expect(sha(canvasToSvg(everyShape(), { resolveImage }))).toBe(DEFAULT_SVG_SHA);
    expect(sha(canvasToSvg(everyShape()))).toBe(DEFAULT_SVG_NO_IMAGES_SHA);
    const hostile: CanvasExportDesign = {
      colors: { foreground: 'red', background: 'url(#x)', info: '#12345g' },
      fonts: { sans: '"><script>alert(1)</script>' },
    };
    for (const design of [null, {}, hostile])
      expect(sha(canvasToSvg(everyShape(), { resolveImage, design }))).toBe(DEFAULT_SVG_SHA);
    expect(exportPalette()).toBe(EXPORT_PALETTE);
  });

  it('maps every palette name through the role its screen token reads', () => {
    for (const [name, role] of Object.entries(EXPORT_DESIGN_ROLES)) {
      const token = PALETTE_TOKENS[name as keyof typeof PALETTE_TOKENS];
      const kebab = role.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();
      expect(token, name).toContain(`--tx-${kebab},`);
    }
  });

  it('paints strokes, tints, text, the background and the image placeholder from the design', () => {
    const svg = canvasToSvg(everyShape(), { design: ACME });
    const palette = exportPalette(ACME);
    expect(palette.default).toBe('#111827');
    expect(palette.yellow).toBe('#10b981');
    expect(svg).toContain('stroke="#111827"');
    expect(svg).toContain('fill="#111827"');
    expect(svg).toContain(`fill="${palette.yellow}33"`);
    expect(svg).toContain('fill="#f9fafb"');
    expect(svg).toContain('fill="#f3f4f6" stroke="#e5e7eb"');
    expect(svg).toContain('font-family="Acme Sans, system-ui, sans-serif"');
    for (const fixed of Object.values(EXPORT_PALETTE)) expect(svg).not.toContain(`"${fixed}"`);
  });
});

import { describe, expect, it } from 'vitest';
import { optimizeSvg, sanitizeSvg, validateSvg } from '../../../scripts/emojis/art-svg.ts';
import { emojiAssetManifest, getTexuliEmojiAsset } from '../src/manifest.ts';

const SAFE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#f4c94f" /></svg>';

describe('emoji SVG boundary', () => {
  it('validates and deterministically optimizes the allowed vector subset', () => {
    expect(validateSvg(SAFE)).toMatchObject({ nodeCount: 2, viewBox: '0 0 64 64' });
    expect(optimizeSvg(SAFE)).toBe(optimizeSvg(SAFE));
    expect(sanitizeSvg(SAFE)).toContain('<circle cx="32" cy="32" fill="#f4c94f" r="20" />');
  });

  it.each([
    ['script element', '<script>alert(1)</script>'],
    ['foreign object', '<foreignObject />'],
    ['event handler', '<circle onload="run" />'],
    ['external href', '<image href="https://example.com/x.svg" />'],
    ['CSS URL', '<g style="fill:url(https://example.com/x)" />'],
    ['embedded raster', '<image href="data:image/png;base64,AA==" />'],
    ['opaque root background', ''],
    ['declaration', '<!DOCTYPE svg>'],
    ['unbalanced markup', '</svg>'],
  ])('rejects %s', (_label, hostile) => {
    const svg =
      hostile === ''
        ? SAFE.replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" fill="#000"')
        : SAFE.replace('</svg>', `${hostile}</svg>`);
    expect(() => sanitizeSvg(svg)).toThrow();
  });

  it('enforces file, path, node and depth caps', () => {
    expect(() => validateSvg(SAFE.replace('0 0 64 64', '0 0 128 128'))).toThrow();
    expect(() =>
      validateSvg(`${SAFE.slice(0, -6)}${'<g>'.repeat(25)}${'</g>'.repeat(25)}</svg>`)
    ).toThrow();
    const manyNodes = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${'<circle cx="1" cy="1" r="1" />'.repeat(257)}</svg>`;
    expect(() => validateSvg(manyNodes)).toThrow(/node limit/);
    expect(() => validateSvg(SAFE.replace('</svg>', `${' '.repeat(33_000)}</svg>`))).toThrow(
      /32 KiB/
    );
  });

  it('keeps every manifest candidate explicit and unavailable until approved', () => {
    expect(emojiAssetManifest).toHaveLength(72);
    expect(emojiAssetManifest.every((asset) => asset.status === 'reviewed-candidate')).toBe(true);
    expect(getTexuliEmojiAsset('1f680')).toBeUndefined();
    expect(getTexuliEmojiAsset('../1f680')).toBeUndefined();
  });
});

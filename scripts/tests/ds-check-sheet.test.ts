// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DS_CHECK_SHEET_PATH } from '../../packages/tools/src/ds-check/render.ts';
import {
  checkBuiltSheet,
  DS_CHECK_SHEET_DIST,
  DS_CHECK_SHEET_NOTICES,
  DS_CHECK_SHEET_PAGE,
} from '../ds-check-sheet.ts';
import { PACKAGE_ASSETS } from '../packages.ts';

describe('the built-in ds-check sheet (D-G-013)', () => {
  it('packs into @texuli/tools beside render.js as one self-contained page with its license notices; a broken page is refused', async () => {
    expect(DS_CHECK_SHEET_PAGE).toBe(DS_CHECK_SHEET_PATH);
    expect(DS_CHECK_SHEET_DIST).toBe(join('ds-check', 'sheet'));
    expect(Object.keys(PACKAGE_ASSETS)).toEqual(['tools']);
    const dist = mkdtempSync(join(tmpdir(), 'texuli-ds-sheet-'));
    try {
      expect(await PACKAGE_ASSETS.tools?.(dist, process.cwd())).toEqual([]);
      const sheet = join(dist, DS_CHECK_SHEET_DIST);
      const html = readFileSync(join(sheet, DS_CHECK_SHEET_PAGE), 'utf8');
      // Relative references only, and no dev-server entry left behind.
      expect(html).toMatch(/<script type="module"[^>]*src="\.\/assets\/[^"]+\.js"/u);
      expect(html).not.toContain('/src/');
      // One script and one stylesheet: no lazy chunk to fetch.
      expect(
        readdirSync(join(sheet, 'assets'))
          .map((f) => extname(f))
          .sort()
      ).toEqual(['.css', '.js']);
      // The bundled dependencies' license notices sit beside the page.
      const notices = readFileSync(join(sheet, DS_CHECK_SHEET_NOTICES), 'utf8');
      expect(notices).toMatch(/^## svelte - [\d.]+ \(MIT\)$/mu);
      writeFileSync(join(sheet, DS_CHECK_SHEET_NOTICES), '# Licenses\n');
      expect(checkBuiltSheet(sheet)).toEqual([
        `ds-check sheet: ${DS_CHECK_SHEET_NOTICES} is missing or lists no svelte (MIT) notice`,
      ]);
      writeFileSync(join(sheet, DS_CHECK_SHEET_NOTICES), notices);
      const script = readdirSync(join(sheet, 'assets')).find((f) => f.endsWith('.js')) as string;
      rmSync(join(sheet, 'assets', script));
      expect(checkBuiltSheet(sheet)).toEqual([`ds-check sheet: ./assets/${script} is missing`]);
      writeFileSync(join(sheet, DS_CHECK_SHEET_PAGE), '<script src="/src/page.ts"></script>');
      expect(checkBuiltSheet(sheet)).toEqual([
        'ds-check sheet: ds-conformance.html references no script',
      ]);
      rmSync(join(sheet, DS_CHECK_SHEET_PAGE));
      expect(checkBuiltSheet(sheet)).toEqual(['ds-check sheet: ds-conformance.html was not built']);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  }, 120_000);
});

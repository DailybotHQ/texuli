import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PARITY_ROWS,
  type ParityStatus,
  PLANNED_MARKER,
  STATUS_LABELS,
  STATUS_LEGEND,
} from '../src/components/sections/architecture/parity-data.ts';

/**
 * T-50 unit gate for the web/native parity table. The section is static
 * Astro, so this suite pins everything it can only get wrong at build time:
 *
 *  - every cited surface exists in the checkout (a row cannot survive a
 *    rename or invent a file);
 *  - statuses are exactly the three honest kinds, with the visible labels
 *    and the site's planned marker convention (data-status="planned" plus
 *    the visible word, consistent with the committed native evidence
 *    section);
 *  - the table keeps real table semantics (caption, col headers, one row
 *    header per capability) inside a keyboard-scrollable named region;
 *  - the copy stays honest: the npm preview is the real one, planned means
 *    planned, and no banned claim or promise date appears anywhere;
 *  - CSS themes through --tx-* tokens with logical properties only.
 */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`repository root not found from ${process.cwd()}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const SECTION_PATH = 'apps/website/src/components/sections/architecture/ParityTable.astro';
const EVIDENCE_PATH = 'apps/website/src/components/sections/native/NativeEvidenceRoadmap.astro';

const template = readFileSync(resolve(REPO_ROOT, SECTION_PATH), 'utf8');
const evidence = readFileSync(resolve(REPO_ROOT, EVIDENCE_PATH), 'utf8');

const allCopy = [
  STATUS_LEGEND,
  ...PARITY_ROWS.map((row) => `${row.capability} ${row.web.detail} ${row.native.detail}`),
].join('\n');

const cells = PARITY_ROWS.flatMap((row) => [
  { capability: row.capability, side: 'web' as const, ...row.web },
  { capability: row.capability, side: 'native' as const, ...row.native },
]);

describe('parity cells cite surfaces that exist', () => {
  it('has rows (an empty table would be a silent section)', () => {
    expect(PARITY_ROWS.length).toBeGreaterThanOrEqual(8);
  });

  it.each(cells.map((cell) => [`${cell.capability} (${cell.side})`, cell] as const))(
    '%s cites an existing surface',
    (_title, cell) => {
      expect(cell.surface.trim().length).toBeGreaterThan(0);
      expect(existsSync(resolve(REPO_ROOT, cell.surface)), `missing surface: ${cell.surface}`).toBe(
        true
      );
    }
  );

  it('every cell carries a one-sentence proof', () => {
    for (const cell of cells) {
      expect(cell.detail.trim().split(' ').length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('statuses are the three honest kinds, labeled and marked', () => {
  const KINDS: readonly ParityStatus[] = ['exists', 'in-repo', 'planned'];

  it('uses only exists / in-repo / planned', () => {
    for (const cell of cells) expect(KINDS).toContain(cell.status);
  });

  it('labels every kind visibly', () => {
    expect(STATUS_LABELS).toEqual({
      exists: 'Exists',
      'in-repo': 'In this repository',
      planned: 'Planned',
    });
    expect(template).toContain('{STATUS_LABELS[row.web.status]}');
    expect(template).toContain('{STATUS_LABELS[row.native.status]}');
  });

  it('marks planned cells with the site convention the native evidence section uses', () => {
    expect(PLANNED_MARKER).toBe('planned');
    // The committed native evidence section's marker, for consistency.
    expect(evidence).toContain('data-status="planned"');
    expect(template).toMatch(/data-status=\{row\.native\.status\}/);
    expect(template).toMatch(/data-status=\{row\.web\.status\}/);
    // And the visible word travels with the marker, never color alone.
    expect(STATUS_LABELS.planned).toBe('Planned');
  });

  it('keeps the distribution row honest on both sides', () => {
    const distribution = PARITY_ROWS.find((row) => row.capability === 'Distribution');
    expect(distribution).toBeDefined();
    expect(distribution?.web.status).toBe('exists');
    expect(distribution?.web.detail).toContain('0.1.0-next.1');
    expect(distribution?.web.detail).toContain('next');
    expect(distribution?.native.status).toBe('planned');
    expect(distribution?.native.detail).toContain('ADR-005');
    expect(distribution?.native.detail).toContain('com.texuli');
  });

  it('never marks a native capability shipped that the renderer does not have', () => {
    const rendering = PARITY_ROWS.find((row) => row.capability === 'Rendering');
    expect(rendering?.native.status).not.toBe('exists');
  });
});

describe('real table semantics inside a keyboard-scrollable region', () => {
  it('is one labelled section landmark named by its h2', () => {
    const sections = template.match(/<section[^>]*>/g) ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain('aria-labelledby={titleId}');
    expect(template).toContain('<h2 id={titleId}>');
  });

  it('has a caption, column headers and one row header per capability', () => {
    expect(template).toMatch(/<caption>\s*Web and native status per capability/);
    expect((template.match(/scope="col"/g) ?? []).length).toBe(4);
    expect(template).toContain('<th scope="col">Evidence</th>');
    expect(template).toContain('<th scope="row">{row.capability}</th>');
  });

  it('the only focusable element is the named scroll region', () => {
    expect(template).not.toContain('<button');
    expect((template.match(/tabindex/g) ?? []).length).toBe(1);
    expect(template).toMatch(/role="region" aria-label="Web and native parity table" tabindex="0"/);
  });

  it('states the legend on screen', () => {
    expect(template).toContain('{STATUS_LEGEND}');
    expect(STATUS_LEGEND).toContain('In this repository');
    expect(STATUS_LEGEND).toContain('not built');
  });

  it('keeps heading order h2 with no skipped levels', () => {
    const levels = [...template.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['2']);
  });

  it('renders surfaces as code text, not links — the site does not mirror files', () => {
    expect(template).toContain('<td class="arch-parity__evidence">');
    expect(template).toContain('<code>{row.web.surface}</code>');
    expect(template).toContain('<code>{row.native.surface}</code>');
    expect(template).not.toMatch(/<a[^>]*href=\{row\./);
  });
});

describe('the honesty contract', () => {
  it.each([
    /coming soon/i,
    /production-ready/i,
    /write once/i,
    / ios (is )?available (today|now)/i,
    /\bship(s|ping)? (in|on) (Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December|20\d\d)/i,
    /\b20\d\d\b/,
  ])('the copy never matches %s', (banned) => {
    expect(allCopy).not.toMatch(banned);
  });

  it('states the in-development renderer and the Maven truth, not implications', () => {
    expect(allCopy).toMatch(/in development/);
    expect(allCopy).toMatch(/consumed in place from this repository/);
    expect(allCopy).toMatch(/planned/);
  });

  it('cites the real npm preview exactly as shipped', () => {
    expect(allCopy).toContain('0.1.0-next.1');
    expect(allCopy).toContain('dist-tag next');
  });
});

describe('the style contract', () => {
  const style = template.slice(template.lastIndexOf('<style>'));

  it('themes through --tx-* tokens with no raw palette colors', () => {
    const tokens = new Set(style.match(/--tx-[a-z0-9-]+/g) ?? []);
    expect(tokens.size).toBeGreaterThanOrEqual(5);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(style).not.toMatch(/rgba?\(/);
    expect(style).toMatch(/var\(--tx-/);
  });

  it('uses logical properties only — no physical directional CSS', () => {
    expect(style).toMatch(/inline-size/);
    expect(style).toMatch(/padding-block/);
    for (const physical of [
      /[^-]margin-left:/,
      /[^-]margin-right:/,
      /[^-]padding-left:/,
      /[^-]padding-right:/,
      /text-align:\s*(left|right)/,
      /float:/,
    ]) {
      expect(physical.test(style)).toBe(false);
    }
  });

  it('keeps the forced-colors contract', () => {
    expect(style).toMatch(/@media \(forced-colors: active\)/);
  });
});

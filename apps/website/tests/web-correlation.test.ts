/**
 * T-42 — the unified landing's correlation section (`WebCorrelation.astro`
 * + `web-correlation-content.ts`): the T-16 flagship demo, "one line in,
 * two languages out".
 *
 * The vitest suite cannot compile .astro templates, so the tests pin the
 * section at its two seams:
 *
 *  1. the content module — the three demo panels quote the badge manifest
 *     and both generated projections byte for byte from the files they
 *     cite, the shared declaration string is identical across all three,
 *     and the honesty frame splits what moves today from what is planned;
 *  2. the section template, read as source — landmark/heading order, the
 *     shared string highlighted without HTML sinks, planned items carrying
 *     the planned marker, the ADR-005 honesty slot, and the style contract.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  highlightShared,
  WEB_CORR_ARCH_LINK,
  WEB_CORR_CAPTION,
  WEB_CORR_DEMO_LINK,
  WEB_CORR_IDS,
  WEB_CORR_LEDE,
  WEB_CORR_MOVES_TODAY,
  WEB_CORR_PANELS,
  WEB_CORR_PLANNED,
  WEB_CORR_SHARED_STRING,
  WEB_CORR_STATUS_CHIP,
} from '../src/components/sections/web/web-correlation-content.ts';

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
const SECTION_FILE = 'apps/website/src/components/sections/web/WebCorrelation.astro';

const readRepo = (relativePath: string): string =>
  readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
const normalize = (text: string): string => text.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();

const sectionSource = readRepo(SECTION_FILE);
const template = sectionSource.slice(
  sectionSource.indexOf('---', sectionSource.indexOf('---') + 3) + 3
);
const style = sectionSource.slice(sectionSource.lastIndexOf('<style>'));

describe('the demo panels quote the real artifacts', () => {
  it('walks the three surfaces in demo order: manifest, TypeScript, Kotlin', () => {
    expect(WEB_CORR_PANELS.map((panel) => panel.id)).toEqual(['manifest', 'typescript', 'kotlin']);
    expect(WEB_CORR_PANELS.map((panel) => panel.file)).toEqual([
      'packages/catalog/src/manifests/display/manifests.ts',
      'packages/spec/generated/typescript/vocabulary.ts',
      'packages/spec/generated/kotlin/com/texuli/spec/Vocabulary.kt',
    ]);
  });

  it('cites only files that exist in this checkout', () => {
    for (const panel of WEB_CORR_PANELS) {
      expect(existsSync(resolve(REPO_ROOT, panel.file))).toBe(true);
    }
  });

  it.each(
    WEB_CORR_PANELS.flatMap((panel) =>
      panel.excerpts.map((excerpt) => [panel.id, excerpt] as const)
    )
  )('the %s excerpt is quoted byte for byte from the cited file', (_panelId, excerpt) => {
    expect(readRepo(excerpt.file)).toContain(excerpt.code);
    expect(excerpt.code.length).toBeGreaterThan(40);
  });

  it('shows the badge declaration in every panel, with the same summary string', () => {
    for (const panel of WEB_CORR_PANELS) {
      const panelCode = panel.excerpts.map((excerpt) => excerpt.code).join('\n');
      expect(panelCode).toContain(WEB_CORR_SHARED_STRING);
      expect(panelCode).toContain('badge');
    }
  });

  it('the Kotlin panel declares the identical summary inside a generated SpecComponent', () => {
    const kotlin = WEB_CORR_PANELS.find((panel) => panel.id === 'kotlin');
    expect(kotlin?.excerpts.map((excerpt) => excerpt.code).join('\n')).toContain(
      'SpecComponent(\n            id = "badge",'
    );
  });
});

describe('the shared string is highlighted without HTML sinks', () => {
  it('splits the code on the shared string into text and mark segments', () => {
    const segments = highlightShared(`a ${WEB_CORR_SHARED_STRING} b`);
    expect(segments).toEqual([
      { text: 'a ', shared: false },
      { text: WEB_CORR_SHARED_STRING, shared: true },
      { text: ' b', shared: false },
    ]);
  });

  it('passes through code without the shared string unchanged', () => {
    expect(highlightShared('nothing to see')).toEqual([{ text: 'nothing to see', shared: false }]);
  });

  it('renders segments as mark elements, never as injected markup', () => {
    expect(template).toContain('highlightShared(');
    expect(template).toMatch(/<mark/);
    expect(template).not.toContain('{@html');
    expect(template).not.toContain('set:html');
    expect(sectionSource).not.toContain('innerHTML');
  });
});

describe('the honesty frame: today versus planned', () => {
  const allCopy = [
    WEB_CORR_LEDE,
    WEB_CORR_CAPTION,
    WEB_CORR_STATUS_CHIP,
    ...WEB_CORR_MOVES_TODAY,
    ...WEB_CORR_PLANNED,
  ].join(' ');

  it('keeps both columns populated', () => {
    expect(WEB_CORR_MOVES_TODAY.length).toBeGreaterThanOrEqual(3);
    expect(WEB_CORR_PLANNED.length).toBeGreaterThanOrEqual(2);
  });

  it('frames what moves today as contract artifacts, not a shipped renderer', () => {
    expect(normalize(WEB_CORR_MOVES_TODAY.join(' '))).toContain(
      normalize('declared once in the manifests')
    );
    expect(normalize(WEB_CORR_MOVES_TODAY.join(' '))).toContain(
      normalize('generates both a TypeScript and a Kotlin projection of that contract')
    );
  });

  it.each(WEB_CORR_PLANNED.map((item) => [item] as const))('planned row stays planned: %s', () => {
    // Every planned row names its gate; none carries a date.
  });

  it('marks every planned row with a planned keyword and no date', () => {
    for (const item of WEB_CORR_PLANNED) {
      expect(item).toMatch(/planned|pending|in development/i);
      expect(item).not.toMatch(/\b20\d\d\b/);
    }
  });

  it('names ADR-005 and the Maven truth in the planned column or status chip', () => {
    expect(`${WEB_CORR_PLANNED.join(' ')} ${WEB_CORR_STATUS_CHIP}`).toContain('ADR-005');
    expect(allCopy).toMatch(/Maven/i);
  });

  it('the status chip states the renderer is in development', () => {
    expect(WEB_CORR_STATUS_CHIP).toMatch(/in development/i);
  });

  it.each([/coming soon/i, /production-ready/i, /write once/i, /iOS today/i])(
    'the copy never matches the banned claim %s',
    (banned) => {
      expect(banned.test(allCopy)).toBe(false);
    }
  );
});

describe('the demo links the real rendered component', () => {
  it('links the badge component page on this site', () => {
    expect(WEB_CORR_DEMO_LINK.href).toBe('/component-pages/badge/');
    expect(
      existsSync(resolve(REPO_ROOT, 'apps/website/src/pages/component-pages/[id].astro'))
    ).toBe(true);
    // The page the link promises is backed by the real badge manifest.
    expect(readRepo('packages/catalog/src/manifests/display/manifests.ts')).toContain(
      "id: 'badge',"
    );
  });
});

describe('the section links the architecture page (T-84)', () => {
  it('names /web-and-native/ so phones keep a visible path to it', () => {
    // Under 40rem the header hides its platform doors (subsite IA §1.3): the
    // page body must carry both platform paths itself.
    expect(WEB_CORR_ARCH_LINK.href).toBe('/web-and-native/');
    expect(
      existsSync(resolve(REPO_ROOT, 'apps/website/src/pages/web-and-native/index.astro'))
    ).toBe(true);
    const template = readRepo('apps/website/src/components/sections/web/WebCorrelation.astro');
    expect(template).toContain('WEB_CORR_ARCH_LINK');
  });
});

describe('section structure and landmarks', () => {
  it('gives every heading a unique id for aria-labelledby', () => {
    const ids = Object.values(WEB_CORR_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^web-/);
  });

  it('renders one labelled section landmark named by its h2', () => {
    const sections = template.match(/<section[^>]*>/g) ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain(`aria-labelledby={WEB_CORR_IDS.section}`);
    expect(sections[0]).toContain('data-tx-web-correlation');
    expect(template).toContain('<h2 id={WEB_CORR_IDS.section}>');
  });

  it('keeps heading order h2 then the today and planned h3s', () => {
    const levels = [...template.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['2', '3', '3']);
  });

  it('renders planned items under the visible Planned heading with the planned marker', () => {
    expect(template).toContain('<h3 id={WEB_CORR_IDS.planned}>Planned</h3>');
    expect(template).toMatch(/WEB_CORR_PLANNED\.map\(\(item\)\s*=>\s*<li data-status="planned">/);
    expect(template).toMatch(
      /WEB_CORR_MOVES_TODAY\.map\(\(item\)\s*=>\s*<li data-status="shipped">/
    );
  });
});

describe('a11y baseline', () => {
  it('maps every panel excerpt into a named, keyboard-scrollable code region', () => {
    const preBlock = /<pre\b[\s\S]*?>[\s\S]*?<\/pre>/.exec(template)?.[0] ?? '';
    expect(preBlock).toContain('tabindex="0"');
    expect(preBlock).toContain('role="region"');
    expect(preBlock).toMatch(/aria-label=/);
  });

  it('captions each excerpt figure with its repository path', () => {
    expect(template).toContain('<figure>');
    expect(template).toContain('<figcaption>');
    expect(template).toContain('<code>{excerpt.file}</code>');
  });
});

describe('the style contract', () => {
  it('styles through --tx-* tokens and logical properties only', () => {
    expect(style).toMatch(/var\(--tx-/);
    expect(style).toMatch(/inline-size/);
    for (const physical of [
      /[^-]margin-left:/,
      /[^-]margin-right:/,
      /[^-]padding-left:/,
      /[^-]padding-right:/,
      /[^-](left|right):/,
      /text-align:\s*(left|right)/,
    ]) {
      expect(physical.test(style)).toBe(false);
    }
  });

  it('stays fluid at 360px and adapts at the desktop breakpoint', () => {
    expect(style).toMatch(/clamp\(/);
    expect(style).toMatch(/@media \(min-width: 56rem\)/);
    expect(style).toMatch(/@media \(forced-colors: active\)/);
  });
});

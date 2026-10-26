/**
 * T-41 — the unified landing's why-Svelte section (`WebWhySvelte.astro` +
 * `web-why-svelte-content.ts`).
 *
 * The vitest suite cannot compile .astro templates, so the tests pin the
 * section at its two seams:
 *
 *  1. the content module — every claim appears word for word in the
 *     repository file it cites (the why-svelte-kotlin guide, the
 *     accessibility guide, docs/ARCHITECTURE.md, docs/SECURITY.md and
 *     docs/STANDARDS.md), and the three ladder excerpts are verbatim
 *     repository code compared byte for byte against the files they name;
 *  2. the section template, read as source — landmark/heading order, the
 *     a11y baseline (named landmark, keyboard-scrollable code regions,
 *     captions, no HTML sinks), every claim linking its real docs route,
 *     and the style contract (tokens, logical properties, breakpoints).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WEB_WHY_CTA,
  WEB_WHY_GUARANTEES,
  WEB_WHY_IDS,
  WEB_WHY_LADDER,
  WEB_WHY_LEDE,
  WEB_WHY_STORY,
} from '../src/components/sections/web/web-why-svelte-content.ts';

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
const SECTION_FILE = 'apps/website/src/components/sections/web/WebWhySvelte.astro';

const readRepo = (relativePath: string): string =>
  readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');

const normalize = (text: string): string => text.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();

const sectionSource = readRepo(SECTION_FILE);
const template = sectionSource.slice(
  sectionSource.indexOf('---', sectionSource.indexOf('---') + 3) + 3
);
const style = sectionSource.slice(sectionSource.lastIndexOf('<style>'));

interface CopyPiece {
  name: string;
  text: string;
  sources: { file: string; phrase: string }[];
}

const copyPieces: CopyPiece[] = [
  { name: 'lede', text: WEB_WHY_LEDE.text, sources: WEB_WHY_LEDE.sources },
  ...WEB_WHY_STORY.map((claim) => ({
    name: `story claim "${claim.title}"`,
    text: claim.body,
    sources: claim.sources,
  })),
  ...WEB_WHY_LADDER.map((row) => ({
    name: `ladder row "${row.layer}"`,
    text: row.role,
    sources: row.sources,
  })),
  ...WEB_WHY_GUARANTEES.map((claim) => ({
    name: `guarantee "${claim.title}"`,
    text: claim.body,
    sources: claim.sources,
  })),
];

const citations = copyPieces.flatMap((piece) =>
  piece.sources.map((source) => ({ ...source, piece: piece.name, copy: piece.text }))
);
const sectionCopy = normalize(copyPieces.map((piece) => piece.text).join(' '));

describe('every claim is anchored in the file it cites (no drift)', () => {
  it.each(citations)('$piece anchors "$phrase"', ({ file, phrase, copy }) => {
    expect(normalize(readRepo(file))).toContain(normalize(phrase));
    expect(normalize(copy)).toContain(normalize(phrase));
  });

  it('cites only real repository files', () => {
    const files = new Set(citations.map((citation) => citation.file));
    for (const file of files) expect(readRepo(file).length).toBeGreaterThan(0);
  });
});

describe('the three-layer ladder quotes real repository code', () => {
  it('has exactly the texel, primitive and component rows, in ladder order', () => {
    expect(WEB_WHY_LADDER.map((row) => row.layer)).toEqual(['texel', 'primitive', 'component']);
  });

  it.each(WEB_WHY_LADDER.map((row) => [row.layer, row.excerpt] as const))(
    '%s excerpt is quoted byte for byte from its file',
    (_layer, excerpt) => {
      expect(readRepo(excerpt.file)).toContain(excerpt.code);
      expect(excerpt.code.split('\n').length).toBeGreaterThanOrEqual(4);
    }
  );

  it.each(WEB_WHY_LADDER.map((row) => [row.layer, row.excerpt.file] as const))(
    'the %s excerpt comes from the layer package it names',
    (_layer, file) => {
      expect(file.startsWith('packages/')).toBe(true);
      expect(existsSync(resolve(REPO_ROOT, file))).toBe(true);
    }
  );
});

describe('every claim links its real docs route', () => {
  const claimLinks = [
    ...WEB_WHY_STORY.map((claim) => claim.href),
    ...WEB_WHY_LADDER.map((row) => row.href),
    ...WEB_WHY_GUARANTEES.map((claim) => claim.href),
  ];

  it('points every claim at an on-site route that exists in this checkout', () => {
    expect(claimLinks.length).toBeGreaterThanOrEqual(9);
    for (const href of claimLinks) {
      expect(href.startsWith('/')).toBe(true);
      expect(href).not.toMatch(/^https?:/);
      expect(existsSync(resolve(REPO_ROOT, `apps/website/src/pages${href}`, 'index.astro'))).toBe(
        true
      );
    }
  });

  it.each([
    ['/guides/why-svelte-kotlin/', 'compiled story'],
    ['/perf/', 'size budgets'],
    ['/guides/accessibility/', 'accessibility contract'],
    ['/playground/', 'hostile presets'],
    ['/primitives-page/', 'primitives'],
    ['/component-pages/', 'components'],
  ])('the route %s backs the %s', (href) => {
    expect(claimLinks).toContain(href);
  });

  it('closes with the getting-started CTA', () => {
    expect(WEB_WHY_CTA).toMatchObject({ href: '/guides/getting-started/' });
  });
});

describe('section structure and landmarks', () => {
  it('gives every heading a unique id for aria-labelledby', () => {
    const ids = Object.values(WEB_WHY_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^web-/);
  });

  it('renders one labelled section landmark named by its h2', () => {
    const sections = template.match(/<section[^>]*>/g) ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain(`aria-labelledby={WEB_WHY_IDS.section}`);
    expect(sections[0]).toContain('data-tx-web-why-svelte');
    expect(template).toContain('<h2 id={WEB_WHY_IDS.section}>');
  });

  it('keeps heading order h2 then the story, ladder and guarantee h3s', () => {
    const levels = [...template.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['2', '3', '3', '3']);
    expect(template).toContain('<h3');
  });
});

describe('a11y baseline', () => {
  it('maps every ladder excerpt into a named, keyboard-scrollable code region', () => {
    expect(template).toContain('WEB_WHY_LADDER.map(');
    const preBlock = /<pre\b[\s\S]*?>[\s\S]*?<\/pre>/.exec(template)?.[0] ?? '';
    expect(preBlock).toContain('tabindex="0"');
    expect(preBlock).toContain('role="region"');
    expect(preBlock).toMatch(/aria-label=/);
  });

  it('captions each excerpt figure with its repository path', () => {
    expect(template).toContain('<figure>');
    expect(template).toContain('<figcaption>');
    expect(template).toContain('<code>{row.excerpt.file}</code>');
  });

  it('renders code as text, never through an HTML sink', () => {
    expect(template).toContain('<code>{row.excerpt.code}</code>');
    expect(template).not.toContain('{@html');
    expect(template).not.toContain('set:html');
    expect(sectionSource).not.toContain('innerHTML');
  });
});

describe('the honesty contract', () => {
  it.each([/coming soon/i, /production-ready/i, /write once/i, /\b20\d\d\b/])(
    'never matches the banned claim %s',
    (banned) => {
      expect(banned.test(sectionCopy)).toBe(false);
    }
  );

  it('states the three guarantees by name', () => {
    expect(sectionCopy).toContain('{@html}');
    expect(sectionCopy).toContain('URL policy');
    expect(sectionCopy).toContain('WCAG 2.1 A/AA');
  });

  it('does not overclaim native: the web story stays about the web', () => {
    expect(sectionCopy).not.toMatch(/Compose renderer (ships|is released)/i);
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

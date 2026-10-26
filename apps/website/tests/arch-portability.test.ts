import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KOTLIN_PROJECTION_FILE,
  MANIFEST_FILE,
  PORTABILITY_EXCERPTS,
  PORTABILITY_LEDE,
  PORTABILITY_LIMITS,
  PORTABILITY_LINKS,
  PORTABILITY_STEPS,
  SHARED_ID,
  SHARED_NOTE,
  SHARED_SUMMARY,
  TS_PROJECTION_FILE,
} from '../src/components/sections/architecture/portability-content.ts';

/**
 * T-51 unit gate for the portability deep-dive. Two seams must never drift:
 *
 *  1. the content module — every claim appears word for word in the
 *     repository file it cites, and every excerpt is a byte-for-byte
 *     substring of the file it names (joined from its segments). The
 *     shared-string highlights are re-proven mechanically: SHARED_ID is in
 *     the manifest and both generated projections; SHARED_SUMMARY is
 *     identical in the manifest and the Kotlin projection;
 *  2. the section template, read as source — landmark/heading order, named
 *     keyboard-scrollable code regions, limits on screen under a visible
 *     heading, the two on-site links, no HTML sinks, and the honest-status
 *     contract.
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
const SECTION_PATH = 'apps/website/src/components/sections/architecture/PortabilityDeepDive.astro';

const readRepo = (relativePath: string): string =>
  readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
/**
 * Collapse whitespace and drop backticks and JSDoc/markdown `*` markers so
 * wrapped sources compare as one line of prose (the committed why-kmp rule).
 */
const normalize = (text: string): string => text.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();

const sectionSource = readRepo(SECTION_PATH);
const template = sectionSource.slice(
  sectionSource.indexOf('---', sectionSource.indexOf('---') + 3) + 3
);

interface CopyPiece {
  name: string;
  text: string;
  copy: string;
  sources: { file: string; phrase: string }[];
}

const copyPieces: CopyPiece[] = [
  {
    name: 'lede',
    text: PORTABILITY_LEDE.text,
    copy: PORTABILITY_LEDE.text,
    sources: [...PORTABILITY_LEDE.sources],
  },
  ...PORTABILITY_STEPS.map((step) => ({
    name: `step "${step.title}"`,
    text: step.body,
    copy: step.body,
    sources: [...step.sources],
  })),
  ...PORTABILITY_LIMITS.map((limit, index) => ({
    name: `limit ${index + 1}`,
    text: limit.text,
    copy: limit.text,
    sources: [...limit.sources],
  })),
];

const citations = copyPieces.flatMap((piece) =>
  piece.sources.map((source) => ({ ...source, copy: piece.copy, piece: piece.name }))
);

const sectionCopy = normalize(copyPieces.map((piece) => piece.text).join(' '));

describe('every claim is anchored in the file it cites (no drift)', () => {
  it.each(citations.map((citation) => [citation] as const))(
    '$piece anchors "$phrase"',
    ({ file, phrase, copy }) => {
      expect(normalize(readRepo(file))).toContain(normalize(phrase));
      expect(normalize(copy)).toContain(normalize(phrase));
    }
  );

  it('cites only real repository files', () => {
    const files = new Set(citations.map((citation) => citation.file));
    for (const file of files) expect(readRepo(file).length).toBeGreaterThan(0);
    expect(files.has(MANIFEST_FILE)).toBe(true);
    expect(files.has(KOTLIN_PROJECTION_FILE)).toBe(true);
    expect(files.has('native/README.md')).toBe(true);
  });

  it('every limit names at least one repository anchor', () => {
    for (const limit of PORTABILITY_LIMITS) expect(limit.sources.length).toBeGreaterThanOrEqual(1);
    expect(PORTABILITY_LIMITS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('the excerpts are verbatim repository code', () => {
  it('walks manifest → TypeScript → Kotlin, in order', () => {
    expect(PORTABILITY_EXCERPTS.map((excerpt) => excerpt.file)).toEqual([
      MANIFEST_FILE,
      TS_PROJECTION_FILE,
      KOTLIN_PROJECTION_FILE,
    ]);
  });

  it.each(PORTABILITY_EXCERPTS.map((excerpt) => [excerpt] as const))(
    '$file is quoted byte for byte',
    (excerpt) => {
      const joined = excerpt.segments.map((segment) => segment.text).join('');
      expect(readRepo(excerpt.file)).toContain(joined);
      expect(joined.split('\n').length).toBeGreaterThanOrEqual(5);
    }
  );

  it('marks only strings the shared-string constants declare', () => {
    for (const excerpt of PORTABILITY_EXCERPTS) {
      for (const segment of excerpt.segments) {
        if (segment.mark) {
          expect([SHARED_ID, SHARED_SUMMARY]).toContain(segment.text);
        }
      }
    }
  });

  it('proves SHARED_ID is one identifier in all three cited surfaces', () => {
    for (const file of [MANIFEST_FILE, TS_PROJECTION_FILE, KOTLIN_PROJECTION_FILE]) {
      expect(readRepo(file), `${file} lacks "${SHARED_ID}"`).toContain(SHARED_ID);
    }
  });

  it('proves SHARED_SUMMARY is byte-identical in manifest and Kotlin projection', () => {
    expect(readRepo(MANIFEST_FILE)).toContain(SHARED_SUMMARY);
    expect(readRepo(KOTLIN_PROJECTION_FILE)).toContain(SHARED_SUMMARY);
    expect(readRepo(TS_PROJECTION_FILE)).not.toContain(SHARED_SUMMARY);
  });

  it('the shared note states exactly what the highlights prove', () => {
    expect(SHARED_NOTE).toContain('byte-identical');
    expect(SHARED_NOTE).toContain('no manual sync');
  });
});

describe('section structure and landmarks', () => {
  it('renders one labelled section landmark named by its h2', () => {
    const sections = template.match(/<section[^>]*>/g) ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain('aria-labelledby={titleId}');
    expect(template).toContain('<h2 id={titleId}>Interface portability: the mechanism</h2>');
  });

  it('keeps heading order h2 then the six h3 blocks', () => {
    const levels = [...template.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['2', '3', '3', '3', '3', '3', '3']);
    expect(template).toContain('<h3 id={panelsTitleId}>One declaration, two projections</h3>');
    expect(template).toContain('<h3>Define once</h3>');
    expect(template).toContain('<h3>Project twice</h3>');
    expect(template).toContain('<h3>Tokens cross</h3>');
    expect(template).toContain('<h3>Behavior patterns cross</h3>');
    expect(template).toContain('<h3 id={limitsTitleId}>What does not move today</h3>');
  });
});

describe('the limits are on screen', () => {
  it('renders the limits under their visible heading', () => {
    expect(template).toContain('{PORTABILITY_LIMITS.map((limit) => <li>{limit.text}</li>)}');
    const limitsHeading = template.indexOf('<h3 id={limitsTitleId}>');
    const limitsList = template.indexOf('<ul class="arch-portability__limits">');
    expect(limitsHeading).toBeGreaterThanOrEqual(0);
    expect(limitsList).toBeGreaterThan(limitsHeading);
  });

  it('says what does not move, in customer language', () => {
    expect(sectionCopy).toContain('No transpilation');
    expect(sectionCopy).toContain('No iOS renderer ships today');
    expect(sectionCopy).toContain('Web-extension props do not cross');
    expect(sectionCopy).toContain('Nothing is published to Maven Central yet');
  });
});

describe('the honesty contract', () => {
  it('states the real statuses: in development, planned, nothing published', () => {
    expect(sectionCopy).toContain('in development');
    expect(sectionCopy).toContain('planned, not done');
  });

  it.each([/coming soon/i, /production-ready/i, /write once/i, /\b20\d{2}-\d{2}-\d{2}\b/])(
    'never matches the banned claim %s',
    (banned) => {
      expect(banned.test(sectionCopy)).toBe(false);
    }
  );

  it('presents no calendar year and no quarter as a promise', () => {
    expect(sectionCopy).not.toMatch(/\bQ[1-4] 20\d{2}\b/);
    expect(sectionCopy).not.toMatch(/\bJanuary|\bFebruary|\bMarch/);
  });
});

describe('a11y baseline', () => {
  it('maps every excerpt into a named, keyboard-scrollable code region', () => {
    const preBlock = /<pre\b[^>]*>[\s\S]*?<\/pre>/.exec(template)?.[0] ?? '';
    expect(preBlock).toContain('tabindex="0"');
    expect(preBlock).toContain('role="region"');
    expect(preBlock).toMatch(/aria-label=\{`Source excerpt from \$\{excerpt\.file\}`\}/);
    expect(template).toContain('<code>{excerpt.segments.map(');
  });

  it('highlights shared strings with mark, not HTML', () => {
    expect(template).toContain('<mark>{segment.text}</mark>');
    expect(template).not.toContain('{@html');
    expect(template).not.toContain('set:html');
    expect(template).not.toContain('innerHTML');
    expect(template).not.toContain('dangerouslySetInnerHTML');
  });

  it('captions each excerpt figure with its repository path', () => {
    expect(template).toContain('<figure>');
    expect(template).toContain('<figcaption>');
    expect(template).toContain('<code>{excerpt.file}</code>');
  });
});

describe('links out, on-site only', () => {
  it('links the badge page and the guide, with no other hrefs', () => {
    expect(PORTABILITY_LINKS.map((link) => link.href)).toEqual([
      '/component-pages/badge/',
      '/guides/why-svelte-kotlin/',
    ]);
    expect(template.match(/href=\{[^}]+\}/g) ?? []).toEqual(['href={withBase(base, link.href)}']);
  });

  it('every linked label is a real sentence', () => {
    for (const link of PORTABILITY_LINKS) {
      expect(link.label.trim().split(' ').length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('the style contract', () => {
  const style = sectionSource.slice(sectionSource.lastIndexOf('<style>'));

  it('styles through --tx-* tokens and logical properties only', () => {
    const tokens = new Set(style.match(/--tx-[a-z0-9-]+/g) ?? []);
    expect(tokens.size).toBeGreaterThanOrEqual(5);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(style).not.toMatch(/rgba?\(/);
    expect(style).toMatch(/var\(--tx-/);
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

  it('stays fluid at 360px, adapts at the desktop breakpoint, keeps forced colors', () => {
    expect(style).toMatch(/clamp\(/);
    expect(style).toMatch(/@media \(min-width: 56rem\)/);
    expect(style).toMatch(/@media \(forced-colors: active\)/);
  });
});

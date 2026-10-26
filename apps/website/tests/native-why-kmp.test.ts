/**
 * T-46 — the /native/ why-KMP section (`WhyKmp.astro` + `why-kmp-content.ts`).
 *
 * The vitest suite cannot compile .astro templates, so these tests pin the
 * section at the two seams that must never drift:
 *
 *  1. the content module — every claim appears word for word in the
 *     repository file it cites (the why-svelte-kotlin guide, native/README.md,
 *     the Kotlin sources), and the Kotlin excerpts are verbatim repository
 *     code compared byte for byte against the files they name;
 *  2. the section template, read as source — landmark/heading order, the
 *     a11y baseline (named, keyboard-scrollable code regions, captions,
 *     no HTML sinks), the guide link and the honest-status contract.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WHY_KMP_ARCHITECTURE_HREF,
  WHY_KMP_CLAIMS,
  WHY_KMP_EXCERPTS,
  WHY_KMP_GUIDE_HREF,
  WHY_KMP_HOW_INTRO,
  WHY_KMP_LEDE,
  WHY_KMP_STATUS,
  WHY_KMP_STEPS,
  WHY_KMP_TOKEN_NOTE,
} from '../src/components/sections/native/why-kmp-content.ts';

// Tests run from the repository root (the convention every site spec uses).
const REPO_ROOT = process.cwd();
const SECTION_FILE = 'apps/website/src/components/sections/native/WhyKmp.astro';

const readRepo = (relativePath: string): string =>
  readFileSync(join(REPO_ROOT, relativePath), 'utf8');
/**
 * Collapse whitespace and drop backticks and JSDoc/markdown `*` markers so
 * wrapped .astro/.md/.kt sources compare as one line of prose.
 */
const normalize = (text: string): string => text.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();

const sectionSource = readRepo(SECTION_FILE);
const template = sectionSource.slice(
  sectionSource.indexOf('---', sectionSource.indexOf('---') + 3) + 3
);

interface CopyPiece {
  name: string;
  text: string;
  sources: { file: string; phrase: string }[];
}

/** Every piece of section copy that carries a claim, with its citations. */
const copyPieces: CopyPiece[] = [
  { name: 'lede', text: WHY_KMP_LEDE.text, sources: WHY_KMP_LEDE.sources },
  ...WHY_KMP_CLAIMS.map((claim) => ({
    name: `claim "${claim.title}"`,
    text: claim.body,
    sources: claim.sources,
  })),
  { name: 'how intro', text: WHY_KMP_HOW_INTRO.text, sources: WHY_KMP_HOW_INTRO.sources },
  ...WHY_KMP_STEPS.map((step, index) => ({
    name: `render step ${index + 1}`,
    text: step.code ? `${step.code} ${step.rest}` : step.rest,
    sources: step.sources,
  })),
  { name: 'token note', text: WHY_KMP_TOKEN_NOTE.text, sources: WHY_KMP_TOKEN_NOTE.sources },
  { name: 'status', text: WHY_KMP_STATUS.text, sources: WHY_KMP_STATUS.sources },
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
    expect(files.has('apps/website/src/pages/guides/why-svelte-kotlin/index.astro')).toBe(true);
    expect(files.has('native/README.md')).toBe(true);
  });
});

describe('the Kotlin excerpts are verbatim repository code', () => {
  it.each(WHY_KMP_EXCERPTS)('$file is quoted byte for byte', (excerpt) => {
    expect(excerpt.file.startsWith('native/')).toBe(true);
    expect(readRepo(excerpt.file)).toContain(excerpt.code);
    expect(excerpt.code.split('\n').length).toBeGreaterThanOrEqual(5);
  });
});

describe('section structure and landmarks', () => {
  it('renders one labelled section landmark named by its h2', () => {
    const sections = template.match(/<section[^>]*>/g) ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain('aria-labelledby="native-why-kmp-title"');
    expect(sections[0]).toContain('data-tx-native-section="why-kmp"');
    expect(template).toContain('<h2 id="native-why-kmp-title">');
  });

  it('keeps heading order h2 then the why/how h3 pair', () => {
    const levels = [...template.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['2', '3', '3']);
    expect(template).toContain('Why Kotlin Multiplatform</h2>');
    expect(template).toContain('Why Kotlin wins the native half</h3>');
    expect(template).toContain('How the renderer consumes the contract</h3>');
  });
});

describe('links out for depth', () => {
  it('links the full why-svelte-kotlin guide', () => {
    expect(WHY_KMP_GUIDE_HREF).toBe('/guides/why-svelte-kotlin/');
    expect(template).toContain('href={guideHref}');
    expect(
      normalize(readRepo('apps/website/src/pages/guides/why-svelte-kotlin/index.astro'))
    ).toContain('Why Kotlin');
  });

  it('cross-links the architecture page, with no other hrefs', () => {
    expect(WHY_KMP_ARCHITECTURE_HREF).toBe('/web-and-native/');
    expect(template.match(/href=\{[^}]+\}/g) ?? []).toEqual([
      'href={guideHref}',
      'href={architectureHref}',
    ]);
  });
});

describe('the honesty contract', () => {
  it('states the real status: in development, conformance-tested, not published', () => {
    expect(sectionCopy).toContain('in development');
    expect(sectionCopy).toContain('conformance-tested');
    expect(sectionCopy).toContain('Nothing is published to Maven Central yet');
  });

  it.each([/coming soon/i, /write once/i, /production-ready/i, /iOS today/i])(
    'never matches the banned claim %s',
    (banned) => {
      expect(banned.test(sectionCopy)).toBe(false);
    }
  );

  it('presents no date or quarter as a promise', () => {
    expect(sectionCopy).not.toMatch(/\b20\d{2}-\d{2}-\d{2}\b/);
    expect(sectionCopy).not.toMatch(/\bQ[1-4] 20\d{2}\b/);
  });
});

describe('a11y baseline', () => {
  it('maps every excerpt into a named, keyboard-scrollable code region', () => {
    expect(template).toContain('WHY_KMP_EXCERPTS.map(');
    const preBlock = /<pre\b[\s\S]*?>[\s\S]*?<\/pre>/.exec(template)?.[0] ?? '';
    expect(preBlock).toContain('tabindex="0"');
    expect(preBlock).toContain('role="region"');
    expect(preBlock).toMatch(/aria-label=\{`Kotlin source excerpt from \$\{excerpt\.file\}`\}/);
  });

  it('captions each excerpt figure with its repository path', () => {
    expect(template).toContain('<figure>');
    expect(template).toContain('<figcaption>');
    expect(template).toContain('<code>{excerpt.file}</code>');
  });

  it('renders code as text, never through an HTML sink', () => {
    expect(template).toContain('<code>{excerpt.code}</code>');
    expect(template).not.toContain('{@html');
    expect(template).not.toContain('set:html');
  });
});

describe('the style contract', () => {
  const style = sectionSource.slice(sectionSource.lastIndexOf('<style>'));

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

/**
 * T-80 row 4 — build-time highlighting for guide snippets.
 *
 * The scanner (`highlight.ts`) is the safety-critical half: it may only tag
 * slices of the input, never rewrite them, so the component can render each
 * token as template text with no HTML sink. The styling half is pinned by
 * computing WCAG 2.x contrast of every token color against the real
 * compiled code background of the site theme, in light and dark.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { describe, expect, it } from 'vitest';
import {
  type GuideLanguage,
  type GuideToken,
  highlightGuideCode,
} from '../src/components/guides/highlight.ts';

const textOf = (tokens: readonly GuideToken[]): string =>
  tokens.map((token) => token.text).join('');

/** The install snippet shape (bash): comments, a command, dist-tag names. */
const INSTALL = `# Texuli is in development: every package ships as the 0.1.0-next.1 prerelease (dist-tag next) — there is no stable release yet.
pnpm add texuli@next @texuli/tokens@next @texuli/primitives@next @texuli/core@next`;

/** The imports shape (TypeScript): keywords and strings. */
const IMPORTS = `import { Button } from 'texuli/button';
import { createRovingFocus } from '@texuli/core/roving';

// Avoid — root barrels pull unrelated code
// import { Button } from 'texuli';`;

/** The CSS shape: a multi-line block comment and at-rules. */
const LAYERS = `/* Declare once, first — then import Texuli base + components.
   Use hyphenated host layer names (site-base, site-overrides). */
@layer site-base, tx.base, tx.components, site-overrides;

@layer site-base {
  a { color: var(--tx-link); }
}`;

/** The markup shape: elements, attributes and both comment styles. */
const MARKUP = `<!-- index.html — the theme attribute selects the theme -->
<html lang="en" data-tx-theme="enterprise-neutral" data-tx-mode="light">
  <head>
    <!-- texuli:no-flash -->
    <script>/* inlined first */</script>
    <!-- /texuli:no-flash -->
  </head>
</html>`;

/** The outline shape: a plain text tree, nothing highlighted. */
const TREE = `guides/
  getting-started/   install the published preview
  why-svelte-kotlin/ web and native, one contract`;

const kindsOf = (tokens: readonly GuideToken[]): string =>
  tokens
    .filter((token) => token.kind !== 'plain')
    .map((token) => `${token.kind}:${token.text.replace(/\n/g, '\\n')}`)
    .join(' | ');

describe('highlightGuideCode never rewrites the snippet', () => {
  const fixtures: Array<[string, GuideLanguage | undefined]> = [
    [INSTALL, undefined],
    [IMPORTS, undefined],
    [LAYERS, undefined],
    [MARKUP, undefined],
    [TREE, undefined],
    [INSTALL, 'bash'],
    [LAYERS, 'css'],
    [MARKUP, 'html'],
    // Hostile shapes: the scanner must pass them through untouched.
    [`<script>alert("x")</script>`, 'html'],
    [`const s = "not // a comment";`, 'ts'],
    ['# not a comment in ts', 'ts'],
    [`pnpm add pkg # trailing comment`, 'bash'],
    ['a && b || c', 'bash'],
    ['unclosed "string stays whole', 'ts'],
    ['<!-- unclosed comment', 'html'],
  ];

  for (const [code, lang] of fixtures) {
    it(`round-trips: ${JSON.stringify(code.slice(0, 40))}${lang ? ` (${lang})` : ''}`, () => {
      expect(textOf(highlightGuideCode(code, lang ?? 'auto'))).toBe(code);
    });
  }

  it('only produces tokens whose text is an exact slice of the input', () => {
    const code = `${INSTALL}\n---\n${MARKUP}`;
    const tokens = highlightGuideCode(code);
    for (const token of tokens) {
      expect(code.includes(token.text)).toBe(true);
      // No token invents markup: every text is copied source, never HTML.
      expect(token.text).not.toMatch(/<span|<code|&lt;/);
    }
  });
});

describe('highlightGuideCode tags the expected shapes', () => {
  it('the install snippet: hash comment, command keyword, plain dist-tags', () => {
    const kinds = kindsOf(highlightGuideCode(INSTALL));
    expect(kinds).toContain('comment:# Texuli is in development');
    expect(kinds).toContain('keyword:pnpm');
    expect(kinds).toContain('keyword:texuli');
    // The bare command name is the keyword; package names and @next stay plain.
    expect(kinds).not.toContain('keyword:texuli@next');
    expect(kinds).not.toContain('keyword:add');
    expect(kinds).not.toMatch(/string:/);
  });

  it('the imports snippet: keywords and strings, strings win over keywords', () => {
    const tokens = highlightGuideCode(IMPORTS);
    const kinds = kindsOf(tokens);
    expect(kinds).toContain('keyword:import');
    expect(kinds).toContain('keyword:from');
    expect(kinds).toContain("string:'texuli/button'");
    // The string's content is never keyword-tagged.
    const stringToken = tokens.find((token) => token.text === "'texuli/button'");
    expect(stringToken?.kind).toBe('string');
    expect(kinds).toContain('comment:// Avoid — root barrels pull unrelated code');
  });

  it('the css snippet: one multi-line block comment, at-rules, custom property', () => {
    const kinds = kindsOf(highlightGuideCode(LAYERS));
    expect(kinds).toContain(
      'comment:/* Declare once, first — then import Texuli base + components.\\n   Use hyphenated host layer names (site-base, site-overrides). */'
    );
    expect(kinds).toContain('keyword:@layer');
    expect(kinds).toContain('keyword:var');
    expect(kinds).toContain('flag:--tx-link');
  });

  it('the markup snippet: tags and both comment styles, attributes stay plain', () => {
    const kinds = kindsOf(highlightGuideCode(MARKUP));
    expect(kinds).toContain('tag:<html');
    expect(kinds).toContain('tag:</html');
    expect(kinds).toContain('tag:<script');
    expect(kinds).toContain('comment:<!-- texuli:no-flash -->');
    expect(kinds).toContain('comment:<!-- index.html — the theme attribute selects the theme -->');
    expect(kinds).toContain('comment:/* inlined first */');
    expect(kinds).toContain('string:"en"');
    // Attribute names are not words in the keyword list.
    expect(kinds).not.toContain('keyword:data-tx-theme');
  });

  it('the tree snippet: plain text, nothing tagged', () => {
    expect(kindsOf(highlightGuideCode(TREE))).toBe('');
  });

  it('the auto detector separates the five shapes', () => {
    const tagged = (code: string) => kindsOf(highlightGuideCode(code, 'auto'));
    expect(tagged(INSTALL)).toContain('keyword:pnpm');
    expect(tagged(IMPORTS)).toContain("string:'texuli/button'");
    expect(tagged(LAYERS)).toContain('keyword:@layer');
    expect(tagged(MARKUP)).toContain('tag:<html');
    expect(tagged(TREE)).toBe('');
  });

  it('shell flags are tagged only after a separator', () => {
    const kinds = kindsOf(
      highlightGuideCode('pnpm exec tsx cli.ts init --cwd app --theme x', 'bash')
    );
    expect(kinds).toContain('flag:--cwd');
    expect(kinds).toContain('flag:--theme');
  });
});

describe('GuideCode.astro stays a text-only renderer', () => {
  const file = readFileSync(resolve('apps/website/src/components/guides/GuideCode.astro'), 'utf8');
  // Template claims are checked on the template only; the frontmatter comment
  // names the guarantee ("never set:html") in prose.
  const firstFence = file.indexOf('---');
  const source = file.slice(file.indexOf('---', firstFence + 3) + 3);

  it('renders token text as template text, with no HTML sink', () => {
    expect(file).toContain('highlightGuideCode(code, lang)');
    expect(source).toContain('{token.text}');
    expect(source).not.toContain('set:html');
    expect(source).not.toContain('{@html');
    expect(file).not.toContain('innerHTML');
    expect(source).not.toMatch(/<script/);
  });

  it('maps each kind to a class and collapses colors in forced-colors mode', () => {
    for (const kind of ['comment', 'keyword', 'string', 'tag', 'flag']) {
      expect(source).toContain(`.tk-${kind}`);
    }
    expect(source).toMatch(/@media \(forced-colors: active\)/);
  });
});

/**
 * WCAG 2.x relative luminance contrast for the token pairs the stylesheet
 * uses. The site theme is loaded through the real token engine; the guide
 * `<pre>` background is `var(--tx-muted, var(--tx-surface))`.
 */
describe('token colors pass WCAG AA on the code background in light and dark', () => {
  const luminance = (hex: string): number => {
    const value = hex.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error(`unsupported color: ${hex}`);
    const channels = [0, 2, 4]
      .map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
      .map((channel) =>
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      );
    const [r = 0, g = 0, b = 0] = channels;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const contrast = (foreground: string, background: string): number => {
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  };

  it.each([
    ['comment', 'mutedForeground'],
    ['keyword', 'primary'],
    ['tag', 'primary'],
    ['string', 'link'],
    ['flag', 'subtleForeground'],
  ] as const)('%s (%s) reaches 4.5:1 on muted in both modes', async (_kind, role) => {
    const theme = await loadLibraryTheme('enterprise-neutral');
    const pick = (mode: 'light' | 'dark'): { background: string; foreground: string } => {
      const palette = theme[mode] as Record<string, { default?: string } | undefined>;
      const background = palette.muted?.default;
      const foreground = palette[role]?.default;
      if (background === undefined || foreground === undefined) {
        throw new Error(`site theme ${mode} lacks muted or ${role}`);
      }
      return { background, foreground };
    };
    const light = pick('light');
    const dark = pick('dark');
    expect(contrast(light.foreground, light.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.foreground, dark.background)).toBeGreaterThanOrEqual(4.5);
  });
});

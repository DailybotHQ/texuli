/**
 * PLAN_006 Final Review P2-6: the header logo under forced colors.
 *
 * The logo's light and dark images are raster artwork (black on light
 * modes, white on dark ones), which forced colors never recolor. The variant
 * followed the site's chosen `data-tx-mode`, so a visitor who chose Light
 * while their system forced a dark palette got the black logo on a black
 * Canvas. Under `forced-colors: active` the variant must follow the forced
 * palette instead, which `prefers-color-scheme` reports.
 *
 * The unit environment has no Astro renderer, so the cascade is resolved
 * from the component source (the a11y-sr-pass.test.ts convention). Only one
 * image may display at a time: `display: none` keeps the other out of the
 * accessibility tree, so the alt="Texuli" / aria-hidden pairing still exposes
 * at most one image. The WebP <picture> structure stays pinned by
 * brand-assets.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const logo = readFileSync(resolve(HERE, '../src/components/brand/BrandLogo.astro'), 'utf8');

interface Env {
  forced: boolean;
  scheme: 'light' | 'dark';
  mode: 'light' | 'dark' | undefined;
}

interface Rule {
  selector: string;
  display: string;
  query: string;
  order: number;
}

function parseRules(source: string): Rule[] {
  const css = (source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );
  const rules: Rule[] = [];
  let order = 0;
  const pushBlock = (body: string, query: string) => {
    for (const match of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const display = match[2].match(/(?:^|;)\s*display:\s*([^;]+)/)?.[1]?.trim();
      if (!display) continue;
      for (const selector of match[1].split(',')) {
        rules.push({ selector: selector.trim(), display, query, order: order++ });
      }
    }
  };
  let rest = css;
  for (;;) {
    const at = rest.search(/@media\b/);
    if (at === -1) {
      pushBlock(rest, '');
      break;
    }
    pushBlock(rest.slice(0, at), '');
    const open = rest.indexOf('{', at);
    const query = rest.slice(at + '@media'.length, open).trim();
    let depth = 1;
    let index = open + 1;
    while (depth > 0) {
      if (rest[index] === '{') depth += 1;
      if (rest[index] === '}') depth -= 1;
      index += 1;
    }
    pushBlock(rest.slice(open + 1, index - 1), query);
    rest = rest.slice(index);
  }
  return rules;
}

function queryMatches(query: string, env: Env): boolean {
  if (!query) return true;
  return query.split(/\s+and\s+/).every((feature) => {
    const [name, value] = feature
      .replace(/[()]/g, '')
      .split(':')
      .map((part) => part.trim());
    if (name === 'forced-colors') return (value === 'active') === env.forced;
    if (name === 'prefers-color-scheme') return value === env.scheme;
    return false;
  });
}

/** Match `.x`, `:global(:root[data-tx-mode]) .x` and `:global(:root[data-tx-mode='dark']) .x`. */
function selectorMatches(selector: string, target: string, env: Env): boolean {
  const plain = selector.replace(/:global\(([^)]*\]?)\)/g, '$1');
  const parts = plain.split(/\s+/);
  if (parts.at(-1) !== `.${target}`) return false;
  const ancestor = parts.slice(0, -1).join(' ');
  if (!ancestor) return true;
  const mode = ancestor.match(/^:root\[data-tx-mode(?:='(\w+)')?\]$/);
  if (!mode) return false;
  return mode[1] === undefined ? env.mode !== undefined : env.mode === mode[1];
}

const specificity = (selector: string) =>
  (selector.replace(/:global\(|\)/g, '').match(/\.[\w-]+|\[[^\]]*\]|:root/g) ?? []).length;

function displayOf(target: string, env: Env): string {
  let best: Rule | undefined;
  for (const rule of parseRules(logo)) {
    if (!queryMatches(rule.query, env) || !selectorMatches(rule.selector, target, env)) continue;
    if (
      !best ||
      specificity(rule.selector) > specificity(best.selector) ||
      (specificity(rule.selector) === specificity(best.selector) && rule.order > best.order)
    ) {
      best = rule;
    }
  }
  return best?.display ?? 'inline';
}

const shown = (env: Env) => ({
  light: displayOf('brand-logo__light', env) !== 'none',
  dark: displayOf('brand-logo__dark', env) !== 'none',
});

const modes = ['light', 'dark', undefined] as const;

describe('BrandLogo under forced colors follows the forced palette', () => {
  for (const mode of modes) {
    it(`a dark forced Canvas shows the white logo (site mode ${mode ?? 'unset'})`, () => {
      expect(shown({ forced: true, scheme: 'dark', mode })).toEqual({ light: false, dark: true });
    });
    it(`a light forced Canvas shows the black logo (site mode ${mode ?? 'unset'})`, () => {
      expect(shown({ forced: true, scheme: 'light', mode })).toEqual({ light: true, dark: false });
    });
  }
});

describe('BrandLogo without forced colors still follows the site mode', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`light and unset modes show the black logo (system ${scheme})`, () => {
      expect(shown({ forced: false, scheme, mode: 'light' })).toEqual({ light: true, dark: false });
      expect(shown({ forced: false, scheme, mode: undefined })).toEqual({
        light: true,
        dark: false,
      });
    });
    it(`dark mode shows the white logo (system ${scheme})`, () => {
      expect(shown({ forced: false, scheme, mode: 'dark' })).toEqual({ light: false, dark: true });
    });
  }
});

describe('BrandLogo keeps one image in the accessibility tree', () => {
  it('never displays both images in any environment', () => {
    for (const forced of [true, false]) {
      for (const scheme of ['light', 'dark'] as const) {
        for (const mode of modes) {
          const { light, dark } = shown({ forced, scheme, mode });
          expect(Number(light) + Number(dark), JSON.stringify({ forced, scheme, mode })).toBe(1);
        }
      }
    }
  });

  it('keeps the alt and aria-hidden pairing on the two images', () => {
    expect(logo).toMatch(/<img class="brand-logo__light"[^>]*alt="Texuli"/);
    expect(logo).toMatch(/<img class="brand-logo__dark"[^>]*alt="" aria-hidden="true"/);
  });
});

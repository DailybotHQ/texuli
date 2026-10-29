// @vitest-environment node
/// <reference types="node" />

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup } from '@testing-library/svelte';
import { contrastRatio } from '@texuli/tokens';
import { getFullThemeLibraryMeta, loadFullLibraryTheme } from '@texuli/tokens/library-expand';
import { createHighContrastPalette } from '@texuli/tokens/modes';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetToastStore } from '../src/components/toast/toast-store.ts';
import { type ClassValue, cx } from '../src/internal/cx.ts';
import { variants } from '../src/internal/variants.ts';
import { clearLayoutRegistry, unregisterLayout } from '../src/layouts/host/registry.ts';
import { expectChecks } from './support/checks.ts';

// Static contracts read from source: CSS guards (logical properties, tokens,
// forced colors, focus rings, RTL, tap targets, the P1 polish findings),
// recipe CSS side effects, lazy layout registers, and the cx/variants rules.
// Each guard family runs as one table; a failure names the guard.

describe('internal-cx', () => {
  describe('cx', () => {
    it('every case holds', async () => {
      await expectChecks({
        'joins strings and numbers, skipping empty and whitespace-only parts': () => {
          expect(cx('a', 1, '  b  ', ' ')).toBe('a 1 b');
          expect(cx()).toBe('');
        },
        'skips falsy expression leftovers (null, undefined, false, 0, empty string, true)': () => {
          expect(cx('a', null, undefined, false, true, 0, '', 'b')).toBe('a b');
        },
        'flattens nested arrays (Svelte class={[a, [b, cond && c]]} shape)': () => {
          const full = true;
          const hidden = false;
          expect(cx(['base', full && 'w-full', hidden && 'hidden', ['deep', ['nested']]])).toBe(
            'base w-full deep nested'
          );
        },
        'takes object maps whose values are truthy (Svelte class={{ a: true, b: false }})': () => {
          expect(cx({ a: true, b: false, c: 1, d: null, 'e-f': 'yes' })).toBe('a c e-f');
        },
        'merges mixed shapes in order so consumer classes stay last': () => {
          const consumer: ClassValue = ['mine', { extra: true }, false && 'nope'];
          expect(cx('tx-base', { 'tx-on': true }, consumer)).toBe('tx-base tx-on mine extra');
        },
      });
    });
  });

  describe('variants', () => {
    const button = variants({
      base: 'tx-button',
      variants: {
        tone: { primary: 'tx-button--primary', neutral: 'tx-button--neutral' },
        size: { sm: 'tx-button--sm', md: 'tx-button--md' },
      },
      defaultVariants: { tone: 'neutral', size: 'md' },
    });

    it('every case holds', async () => {
      await expectChecks({
        'applies defaults, chosen variants and the consumer class last': () => {
          expect(button()).toBe('tx-button tx-button--neutral tx-button--md');
          expect(button({ tone: 'primary', class: 'mine' })).toBe(
            'tx-button tx-button--primary tx-button--md mine'
          );
        },
        'accepts ClassValue arrays and objects on class': () => {
          expect(button({ class: ['a', false && 'x', { b: true }] })).toBe(
            'tx-button tx-button--neutral tx-button--md a b'
          );
        },
        'ignores a value that is not a declared variant': () => {
          expect(button({ size: 'xl' as 'sm' })).toBe('tx-button tx-button--neutral');
        },
      });
    });
  });
});

describe('polish-css', () => {
  /**
   * Source guards for the CSS fixes of the component polish audit
   * (POLISH_AUDIT.md). Their layout behavior is measured in a browser by
   * tests/e2e/texuli-polish.spec.ts; these keep the rules from silently
   * regressing in a unit run.
   */

  const css = (path: string) =>
    readFileSync(join(process.cwd(), 'packages/texuli/src/components', path), 'utf8');

  /** The declarations of the first rule whose selector list is exactly `selector`. */
  function rule(source: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`).exec(source);
    if (!match?.[1]) throw new Error(`no rule for ${selector}`);
    return match[1];
  }

  describe('navigation lane CSS guards (T-57)', () => {
    const family = [
      'navigation/navigation.css',
      'stepper/stepper.css',
      'tabs-accordion/tabs-accordion.css',
    ];

    it('every guard holds', async () => {
      await expectChecks({
        'no hardcoded hex or color-function token fallbacks in the navigation family': () => {
          for (const file of family) {
            const hits = css(file).match(/var\(--tx-[^)]*#[0-9a-fA-F]{3,8}\b[^)]*\)/g) ?? [];
            expect(hits, file).toEqual([]);
          }
        },
        'navigation.css keeps active pagination and menu states visible under forced colors':
          () => {
            const source = css('navigation/navigation.css');
            const forced = source.slice(source.indexOf('@media (forced-colors: active)'));
            expect(forced).toMatch(
              /\.tx-pagination__button\[aria-current="page"\][^{]*\{[^}]*border-color:\s*Highlight/
            );
            expect(forced).toMatch(
              /\.tx-nav-menu__trigger\[data-state="open"\][^{]*\{[^}]*outline:\s*1px solid Highlight/
            );
          },
        'breadcrumb links meet the 24px block-axis tap target': () => {
          const link = rule(css('navigation/navigation.css'), '.tx-breadcrumb__link');
          expect(link).toMatch(/display:\s*inline-flex/);
          expect(link).toMatch(/min-block-size:\s*1\.5rem/);
        },
        'wizard direction chevrons flip in RTL': () => {
          const source = css('stepper/stepper.css');
          expect(source).toMatch(
            /\.tx-wizard:dir\(rtl\)\s+\.tx-wizard__chevron\s*\{[^}]*transform:\s*scaleX\(-1\)/
          );
        },
        'the wizard panel shows the family focus ring on keyboard focus': () => {
          const source = css('stepper/stepper.css');
          const panel = rule(source, '.tx-wizard__panel:focus-visible');
          expect(panel).toMatch(
            /outline:\s*var\(--tx-focus-ring-width, 2px\) solid var\(--tx-ring, Highlight\)/
          );
        },
        'the navigation menu indicator follows the block axis when vertical': () => {
          const vertical = rule(
            css('navigation/navigation.css'),
            '.tx-nav-menu__indicator[data-orientation="vertical"]'
          );
          expect(vertical).toMatch(
            /inset-block-start:\s*var\(--tx-navigation-menu-indicator-offset, 0\)/
          );
          expect(vertical).not.toMatch(
            /inset-inline-start:\s*var\(--tx-navigation-menu-indicator-offset/
          );
        },
      });
    });
  });

  describe('toolbar forced-colors state visibility', () => {
    it('remaps the shared pressed button primitive to system highlight colors', () => {
      const source = css('toolbar/toolbar.css');
      const forced = source.slice(source.indexOf('@media (forced-colors: active)'));
      expect(forced).toMatch(
        /\.tx-toolbar__button\[data-state="on"\]\s*\{[^}]*background:\s*Highlight[^}]*color:\s*HighlightText/
      );
    });
  });

  describe('dialog token names', () => {
    it('uses the emitted foreground role without a phantom variable alias', () => {
      expect(css('dialog/dialog.css')).not.toContain('--tx-color-foreground');
    });
  });

  describe('polish audit CSS guards', () => {
    it('every guard holds', async () => {
      await expectChecks({
        'P1-03: the tabs scroller has no negative inline margin': () => {
          const scroller = rule(css('tabs-accordion/tabs-accordion.css'), '.tx-tabs__scroller');
          expect(scroller).not.toMatch(/margin-inline\s*:\s*-/);
        },
        'P1-04: choice hit areas grow on the block axis only': () => {
          const source = css('choice/choice.css');
          expect(rule(source, '.tx-choice-control::before')).toMatch(/inset-inline:\s*0;/);
          expect(rule(source, '.tx-switch-control::before')).toMatch(/inset-inline:\s*0;/);
        },
        'P1-05: horizontal slider parts flip their centering translate in RTL': () => {
          const source = css('slider/slider.css');
          for (const part of ['thumb', 'tick', 'mark-label']) {
            expect(
              rule(source, `.tx-slider--horizontal .tx-slider__${part}:dir(rtl)`),
              part
            ).toMatch(/translate:\s*50%/);
          }
        },
        'P1-06: slide content cannot size the carousel and its dots wrap': () => {
          const source = css('carousel/carousel.css');
          expect(rule(source, '.tx-carousel-viewport')).toMatch(/contain:\s*inline-size/);
          expect(rule(source, '.tx-carousel-dots')).toMatch(/flex-wrap:\s*wrap/);
        },
        'P1-08: long rating scales wrap': () => {
          expect(rule(css('rating/rating.css'), '.tx-rating__stars')).toMatch(/flex-wrap:\s*wrap/);
        },
        'P1-09: PIN cells shrink toward a floor instead of a fixed size': () => {
          const cell = rule(css('number-pin/number-pin.css'), '.tx-pin-input__cell');
          expect(cell).toMatch(/flex:\s*0 1 auto/);
          expect(cell).toMatch(/min-inline-size:\s*2rem/);
        },
        'P1-10: swatches keep their fill in forced colors': () => {
          const source = css('tags-color/tags-color.css');
          const forced = source.slice(source.indexOf('@media (forced-colors: active)'));
          expect(forced).toMatch(
            /\.tx-color-picker__swatch,\s*\.tx-color-picker__preview\s*\{[^}]*forced-color-adjust:\s*none/
          );
        },
      });
    });
  });
});

describe('layouts-audit-css', () => {
  /**
   * Source guards for the T-75 layouts & shells audit.
   * Skip-target regions (tabindex="-1" focused by the skip link) must keep a
   * visible :focus-visible ring; shells need a forced-colors block; settings
   * list chevrons flip under RTL.
   */

  const layoutsRoot = join(process.cwd(), 'packages/texuli/src/layouts');

  const css = (path: string) => readFileSync(join(layoutsRoot, path), 'utf8');

  /** The declarations of the first rule whose selector list is exactly `selector`. */
  function rule(source: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`).exec(source);
    if (!match?.[1]) throw new Error(`no rule for ${selector}`);
    return match[1];
  }

  /** The forced-colors media block of a stylesheet (from its first occurrence). */
  function forcedColors(source: string): string {
    const index = source.indexOf('@media (forced-colors: active)');
    if (index === -1) throw new Error('no forced-colors block');
    return source.slice(index);
  }

  describe('layouts audit CSS guards (T-75)', () => {
    it('every guard holds', async () => {
      await expectChecks({
        'AppShell main shows a focus ring when the skip link focuses it': () => {
          const source = css('shells/shells.css');
          const focus = rule(source, '.tx-app-shell__main:focus-visible');
          expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
        },
        'shells.css keeps frame chrome visible under forced colors': () => {
          const forced = forcedColors(css('shells/shells.css'));
          expect(forced).toMatch(/\.tx-app-shell__command-bar/);
          expect(forced).toMatch(/CanvasText|ButtonText|Highlight/);
        },
        'app layout screen (skip target) shows a focus ring on keyboard focus': () => {
          const source = css('app/app.css');
          const focus = rule(source, '.tx-app-layout__screen:focus-visible');
          expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
        },
        'mobile layout main (skip target) shows a focus ring on keyboard focus': () => {
          const source = css('mobile/mobile.css');
          const focus = rule(source, '.tx-mobile-layout__main:focus-visible');
          expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
        },
        'dashboard main (skip target) shows a focus ring on keyboard focus': () => {
          const source = css('dashboard/dashboard.css');
          const focus = rule(source, '.tx-layout-dashboard__main:focus-visible');
          expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
        },
        'settings detail title shows a focus ring after list→detail focus move': () => {
          const source = css('auth-settings/auth-settings.css');
          const focus = rule(source, '.tx-settings-layout__detail-title:focus-visible');
          expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
        },
        'settings list chevrons flip under RTL': () => {
          const source = css('auth-settings/auth-settings.css');
          expect(source).toMatch(
            /\.tx-settings-layout:dir\(rtl\)\s+\.tx-settings-layout__chevron\s*\{[^}]*transform:\s*scaleX\(-1\)/
          );
        },
        'layout family stylesheets use no physical left/right inset properties': () => {
          const files = [
            'shells/shells.css',
            'app/app.css',
            'mobile/mobile.css',
            'dashboard/dashboard.css',
            'marketing/marketing.css',
            'auth-settings/auth-settings.css',
            'content/content.css',
            'host/host.css',
          ];
          for (const file of files) {
            const source = css(file);
            expect(source, file).not.toMatch(/(?<![-\w])(left|right)\s*:/);
            expect(source, file).not.toMatch(/(margin|padding|border)-(left|right)\s*:/);
          }
        },
        'layout family stylesheets keep colors on --tx-* tokens (no bare hex)': () => {
          const files = [
            'shells/shells.css',
            'app/app.css',
            'mobile/mobile.css',
            'dashboard/dashboard.css',
            'marketing/marketing.css',
            'auth-settings/auth-settings.css',
            'content/content.css',
            'host/host.css',
          ];
          for (const file of files) {
            const source = css(file);
            // Strip comments so hex in docs does not trip the guard.
            const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
            const bareHex =
              code.match(/(?<![\w-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g) ?? [];
            expect(bareHex, file).toEqual([]);
          }
        },
      });
    });
  });
});

describe('forms-audit-css', () => {
  /**
   * Source guards for the T-53 forms audit (tex-forms lane).
   *
   * - Forced colors: box-shadow does not render under forced-colors, so focus
   *   rings that live only in box-shadow disappear exactly when high-contrast
   *   system themes are in play. Each guard pins an outline fallback (outlines
   *   survive forced colors) next to the box-shadow ring.
   * - Invalid chrome: Input/Textarea turn the border destructive on
   *   `aria-invalid`; the Select trigger and Combobox field must speak the
   *   same grammar.
   * - Tap targets: the combobox chip remove control keeps a 24px target.
   */

  const css = (path: string) =>
    readFileSync(join(process.cwd(), 'packages/texuli/src/components', path), 'utf8');

  /** The declarations of the first rule whose selector list contains `selector`. */
  function rule(source: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:^|[\\s}])${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`).exec(source);
    if (!match?.[1]) throw new Error(`no rule containing ${selector}`);
    return match[1];
  }

  /** The forced-colors media block of a stylesheet (from its first occurrence). */
  function forcedColors(source: string): string {
    const index = source.indexOf('@media (forced-colors: active)');
    if (index === -1) throw new Error('no forced-colors block');
    return source.slice(index);
  }

  describe('forms audit forced-colors guards (T-53)', () => {
    it('every guard holds', async () => {
      await expectChecks({
        'text fields keep a visible focus ring under forced colors': () => {
          const forced = forcedColors(css('input/field.css'));
          expect(rule(forced, '.tx-field:focus-visible')).toMatch(/outline:[^;}]*Highlight/);
          expect(rule(forced, '.tx-input-group:focus-within')).toMatch(/outline:[^;}]*Highlight/);
        },
        'select trigger and highlighted items stay visible under forced colors': () => {
          const forced = forcedColors(css('select/select.css'));
          expect(rule(forced, '.tx-select-trigger:focus-visible')).toMatch(
            /outline:[^;}]*Highlight/
          );
          expect(rule(forced, '.tx-select-trigger[data-state="open"]')).toMatch(
            /outline:[^;}]*Highlight/
          );
          expect(rule(forced, '.tx-select-item[data-highlighted]')).toMatch(
            /outline:[^;}]*Highlight/
          );
        },
        'combobox field keeps a visible focus ring under forced colors': () => {
          const forced = forcedColors(css('combobox/combobox.css'));
          expect(rule(forced, '.tx-combobox-field:focus-within')).toMatch(
            /outline:[^;}]*Highlight/
          );
          expect(rule(forced, '.tx-combobox-field[data-state="open"]')).toMatch(
            /outline:[^;}]*Highlight/
          );
        },
      });
    });
  });

  describe('forms audit invalid-chrome guards (T-53)', () => {
    it('every guard holds', async () => {
      await expectChecks({
        'the select trigger shows destructive chrome on aria-invalid like inputs': () => {
          const source = css('select/select.css');
          expect(rule(source, '.tx-select-trigger[aria-invalid="true"]')).toMatch(
            /border-color:[^;}]*--tx-destructive/
          );
          expect(rule(source, '.tx-select-trigger[aria-invalid="true"]:focus-visible')).toMatch(
            /--tx-destructive/
          );
        },
        'the combobox field shows destructive chrome on an invalid input': () => {
          const source = css('combobox/combobox.css');
          expect(rule(source, '.tx-combobox-field:has([aria-invalid="true"])')).toMatch(
            /border-color:[^;}]*--tx-destructive/
          );
          expect(
            rule(source, '.tx-combobox-field:has([aria-invalid="true"]):focus-within')
          ).toMatch(/--tx-destructive/);
        },
      });
    });
  });

  describe('forms audit tap-target guards (T-53)', () => {
    it('combobox chip remove keeps a 24px touch target', () => {
      const remove = rule(css('combobox/combobox.css'), '.tx-combobox-chip__remove');
      expect(remove).toMatch(/min-inline-size:\s*1\.5rem/);
      expect(remove).toMatch(/min-block-size:\s*1\.5rem/);
    });
  });
});

describe('field-css', () => {
  const css = readFileSync(
    join(process.cwd(), 'packages/texuli/src/components/field/field.css'),
    'utf8'
  );

  describe('disabled field contrast', () => {
    it('keeps disabled descriptions at the foreground token contrast without dimming the root', () => {
      expect(css).not.toMatch(/\.tx-field-root\[data-disabled\]\s*\{[^}]*opacity:/);
      expect(css).toMatch(
        /\.tx-field-root\[data-disabled\]\s+\.tx-description\s*\{[^}]*color:\s*var\(--tx-foreground,/
      );
      expect(css).toMatch(
        /\.tx-field-root\[data-disabled\]\s+\.tx-field-control\s*\{[^}]*opacity:\s*0\.6/
      );
    });
  });
});

describe('variants-css', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const texuliSrc = join(root, 'packages/texuli/src');
  const componentsDir = join(texuliSrc, 'components');
  const require = createRequire(import.meta.url);

  type Esbuild = {
    build(options: Record<string, unknown>): Promise<{
      outputFiles?: { text: string }[];
    }>;
  };

  function loadEsbuild(): Esbuild {
    const vitePkg = require.resolve('vite/package.json');
    const esbuildId = require.resolve('esbuild', { paths: [dirname(vitePkg)] });
    return require(esbuildId) as Esbuild;
  }

  function walkTs(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) {
        if (name === 'node_modules') continue;
        walkTs(path, out);
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
        out.push(path);
      }
    }
    return out;
  }

  /** Recipe modules: call `variants(` and live under components (not internal). */
  function recipeModules(): string[] {
    return walkTs(componentsDir).filter((path) => {
      const text = readFileSync(path, 'utf8');
      return /\bvariants\s*\(/.test(text);
    });
  }

  async function bundleRecipe(entryAbs: string): Promise<string> {
    const esbuild = loadEsbuild();
    const result = await esbuild.build({
      stdin: {
        contents: `export * from ${JSON.stringify(entryAbs)};\n`,
        resolveDir: dirname(entryAbs),
        sourcefile: 'recipe-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      logLevel: 'silent',
      packages: 'bundle',
      // Keep CSS as a side-effect string in the JS output (like a consumer bundler
      // that honors package.json sideEffects: ['**/*.css']).
      plugins: [
        {
          name: 'texuli-css-side-effect',
          setup(build: {
            onLoad(
              options: { filter: RegExp },
              callback: (args: { path: string }) => { contents: string; loader: string }
            ): void;
          }) {
            build.onLoad({ filter: /\.css$/ }, (args) => {
              const css = readFileSync(args.path, 'utf8');
              // Assign so esbuild cannot DCE the CSS string as a pure void expression.
              return {
                contents: `;(globalThis.__TEXULI_RECIPE_CSS__ ??= []).push(${JSON.stringify(css)});\n`,
                loader: 'js',
              };
            });
          },
        },
      ],
    });
    const file = result.outputFiles?.[0];
    if (!file) throw new Error('esbuild produced no output');
    return file.text;
  }

  describe('variants recipe CSS side effects', () => {
    it('every recipe keeps its CSS', async () => {
      await expectChecks({
        'package.json keeps CSS sideEffects so bundlers retain recipe CSS': () => {
          const pkg = require(join(root, 'packages/texuli/package.json')) as {
            sideEffects?: unknown;
          };
          expect(pkg.sideEffects).toEqual(expect.arrayContaining(['**/*.css']));
        },
        'every components/*/ recipe that calls variants() imports a .css file': () => {
          const missing: string[] = [];
          for (const path of recipeModules()) {
            const text = readFileSync(path, 'utf8');
            if (!/import\s+['"][^'"]+\.css['"]/.test(text)) {
              missing.push(relative(root, path));
            }
          }
          expect(missing, `recipes without CSS import:\n${missing.join('\n')}`).toEqual([]);
        },
        'bundling only buttonVariants pulls button.css into the output': async () => {
          const entry = join(componentsDir, 'button/button-variants.ts');
          const code = await bundleRecipe(entry);
          expect(code).toMatch(/buttonVariants|tx-button/);
          // CSS loaded as text — selectors from button.css must appear.
          expect(code).toContain('.tx-button');
          expect(code).toContain('@layer tx.components');
          expect(code).toContain('tx-button--default');
        },
        'bundling only badge variants pulls badge.css into the output': async () => {
          const entry = join(componentsDir, 'badge/variants.ts');
          const code = await bundleRecipe(entry);
          expect(code).toContain('.tx-badge');
          expect(code).toContain('@layer tx.components');
        },
        'bundling only fieldVariants pulls field.css into the output': async () => {
          const entry = join(componentsDir, 'input/field-classes.ts');
          const code = await bundleRecipe(entry);
          expect(code).toMatch(/tx-input|tx-field|tx-textarea/);
          expect(code).toContain('@layer tx.components');
        },
      });
    });
  });
});

describe('layout-register-tree-shake', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const texuliSrc = join(root, 'packages/texuli/src');
  const require = createRequire(import.meta.url);

  type EsbuildResult = {
    outputFiles?: { path: string; text: string }[];
  };

  type Esbuild = {
    build(options: Record<string, unknown>): Promise<EsbuildResult>;
  };

  function loadEsbuild(): Esbuild {
    const vitePkg = require.resolve('vite/package.json');
    const esbuildId = require.resolve('esbuild', { paths: [dirname(vitePkg)] });
    return require(esbuildId) as Esbuild;
  }

  async function bundleRegister(registerRel: string, exportName: string): Promise<string> {
    const esbuild = loadEsbuild();
    const entry = join(texuliSrc, registerRel);
    const result = await esbuild.build({
      stdin: {
        contents: `export { ${exportName} } from ${JSON.stringify(entry)};\n`,
        resolveDir: dirname(entry),
        sourcefile: 'register-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      logLevel: 'silent',
      packages: 'bundle',
      external: [
        'svelte',
        'svelte/internal',
        'svelte/internal/client',
        '@texuli/core',
        '@texuli/primitives',
        '@texuli/tokens',
      ],
      plugins: [
        {
          name: 'external-svelte-layouts',
          setup(build: {
            onResolve(
              options: { filter: RegExp },
              callback: (args: { path: string }) => { path: string; external: boolean }
            ): void;
          }) {
            build.onResolve({ filter: /\.svelte$/ }, (args) => ({
              path: args.path,
              external: true,
            }));
          },
        },
      ],
    });
    const file = result.outputFiles?.[0];
    if (!file) throw new Error(`no output for ${registerRel}`);
    return file.text;
  }

  describe('layout register-only subpaths (tree-shake)', () => {
    it('every register entry stays lazy', async () => {
      await expectChecks({
        'package.json exports register subpaths and keeps sideEffects CSS-only': () => {
          const pkg = require(join(root, 'packages/texuli/package.json')) as {
            sideEffects?: unknown;
            exports?: Record<string, unknown>;
          };
          expect(pkg.sideEffects).toEqual(['**/*.css']);
          expect(pkg.exports?.['./layouts/mobile/register']).toBeTruthy();
          expect(pkg.exports?.['./layouts/dashboard/register']).toBeTruthy();
          expect(pkg.exports?.['./layouts/marketing/register']).toBeTruthy();
        },
        'mobile register entry has no layout component bodies; two separate dynamic imports':
          async () => {
            const entryCode = await bundleRegister(
              'layouts/mobile/register.ts',
              'registerMobileLayouts'
            );
            expect(entryCode).toMatch(/registerMobileLayouts/);
            expect(entryCode).toMatch(/import\(\s*['"][^'"]*MobileTabsLayout\.svelte['"]\s*\)/);
            expect(entryCode).toMatch(/import\(\s*['"][^'"]*MobileDrawerLayout\.svelte['"]\s*\)/);
            for (const marker of [
              'data-tx-mobile-layout',
              'tx-mobile-tabs',
              'tx-mobile-drawer',
              'create_fragment',
            ]) {
              expect(entryCode.includes(marker), `entry leaked ${marker}`).toBe(false);
            }
            expect(entryCode.match(/import\(/g)?.length).toBe(2);
          },
        'dashboard register entry has one dynamic import and no grid body': async () => {
          const entryCode = await bundleRegister(
            'layouts/dashboard/register.ts',
            'registerDashboardLayouts'
          );
          expect(entryCode).toMatch(/registerDashboardLayouts/);
          expect(entryCode).toMatch(/import\(\s*['"][^'"]*DashboardGridLayout\.svelte['"]\s*\)/);
          for (const marker of [
            'data-tx-layout-dashboard',
            'tx-layout-dashboard',
            'AnalyticsGrid',
            'create_fragment',
          ]) {
            expect(entryCode.includes(marker), `entry leaked ${marker}`).toBe(false);
          }
          expect(entryCode.match(/import\(/g)?.length).toBe(1);
        },
        'marketing register entry has one dynamic import and no marketing body': async () => {
          const entryCode = await bundleRegister(
            'layouts/marketing/register.ts',
            'registerMarketingLayouts'
          );
          expect(entryCode).toMatch(/registerMarketingLayouts/);
          expect(entryCode).toMatch(/import\(\s*['"][^'"]*MarketingLayout\.svelte['"]\s*\)/);
          for (const marker of [
            'tx-layout-marketing',
            'LandingLayout',
            'PricingLayout',
            'create_fragment',
          ]) {
            expect(entryCode.includes(marker), `entry leaked ${marker}`).toBe(false);
          }
          expect(entryCode.match(/import\(/g)?.length).toBe(1);
        },
      });
    });
  });
});

describe('button', () => {
  afterEach(() => {
    cleanup();
  });

  describe('button CSS source guards', () => {
    // Source guards for the audit lane T-54 (tex-buttons-actions). Layout and
    // motion behavior they pin is measured in browsers by the behavior suite;
    // these keep the family CSS rules from silently regressing in a unit run.
    const buttonCss = () =>
      readFileSync(join(process.cwd(), 'packages/texuli/src/components/button/button.css'), 'utf8');

    it('every guard holds', async () => {
      await expectChecks({
        'spinner period matches the sibling Spinner (tx-motion-slow, 0.75s)': () => {
          // components/feedback/feedback.css spins at var(--tx-motion-slow, 0.75s);
          // the busy spinner inside buttons must share the family period, not the
          // 200ms transition base (a frantic 5 revolutions per second).
          expect(buttonCss()).toMatch(
            /animation:\s*tx-button-spin\s+var\(--tx-motion-slow,\s*0\.75s\)\s+linear\s+infinite;/
          );
        },
        'colors only through --tx-* tokens (no hex literals)': () => {
          expect(buttonCss()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        },
        'icon-only controls keep the square ratio at every size': () => {
          expect(buttonCss()).toMatch(
            /\.tx-button\[data-icon-only=['"]true['"]\]\s*\{[^}]*aspect-ratio:\s*1;/
          );
        },
        'uses logical properties only (no physical top/right/bottom/left)': () => {
          expect(buttonCss()).not.toMatch(/(^|[^-a-z])(top|right|bottom|left)\s*:/);
        },
        // A host that layers its element defaults (`a { color }`) before
        // Texuli's keeps Button colors; the cascade itself is measured in a
        // browser by tests/e2e/texuli-polish.spec.ts.
        'ships no unlayered anchor pin rules; every rule sits in tx.components': () => {
          expect(buttonCss()).not.toMatch(/^\s*a\.tx-button/m);
          expect(buttonCss()).toContain('@layer tx.components');
        },
      });
    });
  });
});

describe('timeline', () => {
  afterEach(cleanup);

  describe('styles', () => {
    const css = readFileSync(
      join(import.meta.dirname, '../src/components/timeline/timeline.css'),
      'utf8'
    );

    it('every guard holds', async () => {
      await expectChecks({
        'live in the components layer, so consumer classes win': () => {
          expect(css).toMatch(/^@layer tx\.components \{/m);
        },
        'use logical properties only, so the timeline mirrors in right-to-left': () => {
          const physical =
            /(?:^|[\s;{])(?:left|right|top|bottom|width|height|min-width|max-width|min-height|max-height|(?:margin|padding|border)-(?:left|right|top|bottom)(?:-[a-z]+)?)\s*:/m;
          expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(physical);
        },
        'have a forced-colors fallback': () => {
          expect(css).toContain('@media (forced-colors: active)');
        },
      });
    });
  });
});

describe('tree', () => {
  afterEach(cleanup);

  describe('TreeView styles', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/components/tree/tree.css'), 'utf8');

    it('every guard holds', async () => {
      await expectChecks({
        'is in the components layer and uses logical properties': () => {
          expect(css).toMatch(/^@layer tx\.components \{/m);
          const physical =
            /(?:^|[\s;{])(?:left|right|top|bottom|width|height|min-width|max-width|min-height|max-height|(?:margin|padding|border)-(?:left|right|top|bottom)(?:-[a-z]+)?)\s*:/m;
          expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(physical);
        },
        'has forced-colors and reduced-motion fallbacks': () => {
          expect(css).toContain('@media (forced-colors: active)');
          expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
        },
      });
    });
  });
});

describe('shells', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const SHELLS_DIR = join(import.meta.dirname, '../src/layouts/shells');

  describe('shells: no prototype pieces', () => {
    it('imports nothing from Protoyard or Lucide and names its context for Texuli', () => {
      const files = readdirSync(SHELLS_DIR).filter((file) => /\.(ts|svelte|css)$/.test(file));
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const source = readFileSync(join(SHELLS_DIR, file), 'utf8');
        expect(source, file).not.toMatch(/@protoyard|lucide/);
        expect(source, file).not.toMatch(/Symbol\('protoyard/);
      }
      expect(readFileSync(join(SHELLS_DIR, 'context.ts'), 'utf8')).toContain(
        "Symbol('texuli.app-shell')"
      );
    });

    it('uses logical properties only in its CSS', () => {
      const css = readFileSync(join(SHELLS_DIR, 'shells.css'), 'utf8');
      expect(css).not.toMatch(/(?<![-\w])(left|right|top|bottom)\s*:/);
      expect(css).not.toMatch(/(margin|padding|border)-(left|right|top|bottom)/);
    });
  });
});

describe('layout-host-contract', () => {
  const layoutsRoot = join(process.cwd(), 'packages/texuli/src/layouts');

  afterEach(() => {
    cleanup();
    clearLayoutRegistry();
    vi.restoreAllMocks();
  });

  function walkCss(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walkCss(path, out);
      else if (name.endsWith('.css')) out.push(path);
    }
    return out;
  }

  describe('layout CSS host contract', () => {
    it('layouts and shells never use raw 100dvh/100vh or env(safe-area-*)', () => {
      const files = walkCss(layoutsRoot);
      expect(files.length).toBeGreaterThan(5);
      const offenders: string[] = [];
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        const lines = text.split('\n');
        lines.forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//'))
            return;
          if (/env\s*\(\s*safe-area-inset-/.test(line)) {
            offenders.push(`${file}:${index + 1}: raw env(safe-area)`);
          }
          // Bare viewport units (not as the default inside var(--tx-app-height, …)).
          if (
            /(?<![\w-])100(?:dvh|vh)(?![\w-])/.test(line) &&
            !/var\(\s*--tx-app-height/.test(line)
          ) {
            offenders.push(`${file}:${index + 1}: raw viewport unit`);
          }
        });
      }
      expect(offenders).toEqual([]);
    });
  });
});

describe('toast', () => {
  afterEach(() => {
    cleanup();
    resetToastStore();
  });

  describe('Toaster viewport placement and motion', () => {
    it('every guard holds', async () => {
      await expectChecks({
        'resets the popover UA box and honors reduced motion in toast.css': () => {
          const css = readFileSync(
            join(import.meta.dirname, '../src/components/toast/toast.css'),
            'utf8'
          );
          const viewport = css.slice(
            css.indexOf('.tx-toaster__viewport {'),
            css.indexOf('}', css.indexOf('.tx-toaster__viewport {'))
          );
          for (const rule of [
            'position: fixed;',
            'inset: auto;',
            'margin: 0;',
            'border: 0;',
            'background: transparent;',
            'overflow: visible;',
          ]) {
            expect(viewport).toContain(rule);
          }
          expect(css).toMatch(/\[data-position\$=["']-center["']\]/);
          expect(css).toContain('margin-inline: auto;');
          // Enter, exit and the stack reflow play through texuli/motion (instant
          // under reduced motion there); CSS keeps only the pending pulse.
          expect(css).not.toMatch(/@keyframes tx-toast-(in|out)/);
          expect(css).toMatch(
            /prefers-reduced-motion: reduce\)[^}]*\.tx-toast__icon[^}]*animation: none;/s
          );
        },
        'keeps safe-area padding direction-independent (physical env insets, not inline slots)':
          () => {
            const css = readFileSync(
              join(import.meta.dirname, '../src/components/toast/toast.css'),
              'utf8'
            );
            const viewport = css.slice(
              css.indexOf('.tx-toaster__viewport {'),
              css.indexOf('}', css.indexOf('.tx-toaster__viewport {'))
            );
            // env() safe-area insets are physical: the notch does not move with the
            // reading direction. In a logical inline slot, the right-hand inset would
            // guard the physical left edge in RTL and leave the real edge unprotected.
            expect(viewport).not.toMatch(/padding-inline:[^;]*env\(/);
            expect(viewport).toContain(
              'padding-right: calc(var(--tx-toaster-edge) + env(safe-area-inset-right, 0px));'
            );
            expect(viewport).toContain(
              'padding-left: calc(var(--tx-toaster-edge) + env(safe-area-inset-left, 0px));'
            );
          },
      });
    });
  });
});

describe('dialog', () => {
  afterEach(() => {
    cleanup();
  });

  describe('dialog CSS source', () => {
    it('takes danger colors from the shared destructive token with no hex or phantom fallbacks', () => {
      const source = readFileSync(
        join(process.cwd(), 'packages/texuli/src/components/dialog/dialog.css'),
        'utf8'
      );
      // Sibling convention (alert, toast, button): var(--tx-destructive, crimson).
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toContain('--tx-color-danger');
      expect(source).toContain('var(--tx-destructive, crimson)');
    });
  });
});

describe('sidebar-height', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sidebarCss = readFileSync(join(root, 'src/components/sidebar/sidebar.css'), 'utf8');
  const appCss = readFileSync(join(root, 'src/layouts/app/app.css'), 'utf8');

  afterEach(() => {
    cleanup();
    unregisterLayout('sidebar');
    unregisterLayout('dual-sidebar');
    unregisterLayout('rail');
  });

  describe('sidebar / rail column height CSS contract', () => {
    it('defines definite app-height and stretch chains for sidebar shells', () => {
      expect(appCss).toMatch(/\.tx-app-layout\s*\{[^}]*block-size:\s*var\(--tx-app-height/s);
      expect(appCss).toMatch(/\.tx-app-layout--sidebar/);
      expect(appCss).toMatch(/\.tx-app-layout--three-pane/);
      expect(appCss).toMatch(
        /\.tx-app-layout--sidebar\s*>\s*\.tx-app-nav[\s\S]*block-size:\s*100%/
      );
      expect(sidebarCss).toMatch(/\.tx-app-nav\s*\{[^}]*block-size:\s*100%/s);
      expect(sidebarCss).toMatch(/\.tx-app-nav__sidebar\s*\{[^}]*align-self:\s*stretch/s);
      expect(sidebarCss).toMatch(
        /\.tx-app-nav__sidebar\s*>\s*\.tx-sidebar\s*\{[^}]*block-size:\s*100%/s
      );
      expect(appCss).toMatch(/\.tx-app-layout__rail\s*\{[^}]*block-size:\s*100%/s);
    });
  });
});

describe('avatar', () => {
  afterEach(cleanup);

  describe('avatar initials contrast', () => {
    const css = readFileSync(
      join(import.meta.dirname, '../src/components/avatar/avatar.css'),
      'utf8'
    );

    it('meets 4.5:1 for foreground on muted in every library theme, light and dark, and high contrast', async () => {
      const themes = await getFullThemeLibraryMeta();
      expect(themes).toHaveLength(210);
      const failures: string[] = [];
      let checked = 0;
      for (const meta of themes) {
        const theme = await loadFullLibraryTheme(meta.id);
        for (const mode of ['light', 'dark'] as const) {
          const palette = theme[mode] as unknown as Record<string, { default: string }>;
          const foreground = palette.foreground?.default ?? '';
          const muted = palette.muted?.default ?? '';
          const ratio = contrastRatio(foreground, muted);
          checked += 1;
          if (!(ratio >= 4.5))
            failures.push(`${meta.id} ${mode}: ${foreground} on ${muted} = ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
      expect(checked).toBe(420);
      // High contrast uses system colors: CanvasText on Canvas, the forced-colors pair.
      const highContrast = createHighContrastPalette() as unknown as Record<
        string,
        { default: string }
      >;
      expect(highContrast.foreground?.default).toBe('CanvasText');
      expect(highContrast.muted?.default).toBe('Canvas');
      expect(css).toMatch(
        /@media \(forced-colors: active\)[\s\S]*\.tx-avatar__surface[^{]*\{[^}]*background-color: Canvas;[^}]*color: CanvasText;/
      );
    }, 120_000);
  });
});

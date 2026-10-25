// @vitest-environment node
/// <reference types="node" />
/**
 * Every exported class recipe (`*Variants` / `*Class` helpers built with
 * `variants()`) must side-import its component CSS so recipe-only usage
 * (e.g. `buttonVariants` on an `<a>`) still renders styled.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
  it('package.json keeps CSS sideEffects so bundlers retain recipe CSS', () => {
    const pkg = require(join(root, 'packages/texuli/package.json')) as {
      sideEffects?: unknown;
    };
    expect(pkg.sideEffects).toEqual(expect.arrayContaining(['**/*.css']));
  });

  it('every components/*/ recipe that calls variants() imports a .css file', () => {
    const missing: string[] = [];
    for (const path of recipeModules()) {
      const text = readFileSync(path, 'utf8');
      if (!/import\s+['"][^'"]+\.css['"]/.test(text)) {
        missing.push(relative(root, path));
      }
    }
    expect(missing, `recipes without CSS import:\n${missing.join('\n')}`).toEqual([]);
  });

  it('bundling only buttonVariants pulls button.css into the output', async () => {
    const entry = join(componentsDir, 'button/button-variants.ts');
    const code = await bundleRecipe(entry);
    expect(code).toMatch(/buttonVariants|tx-button/);
    // CSS loaded as text — selectors from button.css must appear.
    expect(code).toContain('.tx-button');
    expect(code).toContain('@layer tx.components');
    expect(code).toContain('tx-button--default');
  });

  it('bundling only badge variants pulls badge.css into the output', async () => {
    const entry = join(componentsDir, 'badge/variants.ts');
    const code = await bundleRecipe(entry);
    expect(code).toContain('.tx-badge');
    expect(code).toContain('@layer tx.components');
  });

  it('bundling only fieldVariants pulls field.css into the output', async () => {
    const entry = join(componentsDir, 'input/field-classes.ts');
    const code = await bundleRecipe(entry);
    expect(code).toMatch(/tx-input|tx-field|tx-textarea/);
    expect(code).toContain('@layer tx.components');
  });
});

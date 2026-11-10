/**
 * Prebuilt `@texuli/tools/ds-check/host` IIFE (T-017-render).
 *
 * `pnpm verify:packages` builds `packages/tools/src/ds-check/host.ts` into
 * `dist/ds-check/host.iife.js` beside the conformance sheet, so a prototype
 * page can load the host without a bundler:
 *
 *   <script src="./node_modules/@texuli/tools/dist/ds-check/host.iife.js"></script>
 *
 *   pnpm exec tsx scripts/ds-check-host.ts <out-file>
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const DS_CHECK_HOST_ENTRY = join('packages', 'tools', 'src', 'ds-check', 'host.ts');
export const DS_CHECK_HOST_IIFE = 'host.iife.js';
export const DS_CHECK_HOST_DIST = join('ds-check', DS_CHECK_HOST_IIFE);

/** Problems with a built IIFE: missing file, or it does not look like the host. */
export function checkBuiltHost(file: string): string[] {
  if (!existsSync(file)) return [`ds-check host: ${file} was not built`];
  const text = readFileSync(file, 'utf8');
  const problems: string[] = [];
  if (!text.includes('installDsCheckHost') && !text.includes('texuliDsCheck'))
    problems.push('ds-check host: IIFE does not expose installDsCheckHost or texuliDsCheck');
  if (!/\(function|typeof exports|TexuliDsCheckHost/.test(text))
    problems.push('ds-check host: output is not an IIFE bundle');
  return problems;
}

/**
 * Bundle the host as an IIFE into `outFile`. Returns problems; an empty list
 * means the file is a self-contained script.
 */
export async function buildDsCheckHost(outFile: string, root = ROOT): Promise<string[]> {
  const entry = join(root, DS_CHECK_HOST_ENTRY);
  if (!existsSync(entry)) return [`ds-check host: ${entry} does not exist`];
  const { build } = await import('vite');
  const outDir = dirname(outFile);
  const fileName = outFile.slice(outDir.length + 1) || DS_CHECK_HOST_IIFE;
  try {
    await build({
      configFile: false,
      root,
      logLevel: 'error',
      build: {
        lib: {
          entry,
          name: 'TexuliDsCheckHost',
          formats: ['iife'],
          fileName: () => fileName,
        },
        outDir,
        emptyOutDir: false,
        minify: true,
      },
    });
  } catch (error) {
    return [
      `ds-check host: build failed: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  return checkBuiltHost(outFile);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2];
  if (!out) {
    console.error('Usage: pnpm exec tsx scripts/ds-check-host.ts <out-file>');
    process.exit(2);
  }
  const problems = await buildDsCheckHost(resolve(out));
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}

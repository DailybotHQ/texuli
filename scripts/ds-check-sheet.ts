/**
 * The built-in conformance sheet of `texuli ds check --render` (D-G-013).
 *
 * `pnpm verify:packages` (and so the publish workflow) builds
 * `tests/fixtures/app/ds-conformance.html`, the same page the repository's
 * conformance spec drives, with Vite into the packed `@texuli/tools` at
 * `dist/ds-check/sheet/`: one HTML page, one script and one stylesheet,
 * every catalog component and theme bundled in (no code splitting). The
 * published `render.js` serves that folder with a read-only static server,
 * so a consumer needs neither a bundler nor any other Texuli package to run
 * the render check. Nothing is committed: the sheet is rebuilt from the
 * workspace source on every pack, so it cannot drift.
 *
 *   pnpm exec tsx scripts/ds-check-sheet.ts <out-dir>   build it alone
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The sheet page, as `@texuli/tools` names it (`DS_CHECK_SHEET_PATH`). */
export const DS_CHECK_SHEET_PAGE = 'ds-conformance.html';

/** Where the sheet lands inside a package's `dist/` (beside `ds-check/render.js`). */
export const DS_CHECK_SHEET_DIST = join('ds-check', 'sheet');

/**
 * The files a built sheet page references (`src` and `href` of its scripts
 * and stylesheets), each a relative path that exists in `dir`. Returns the
 * problems: an absolute or remote reference, or a missing file.
 */
export function checkBuiltSheet(dir: string, page = DS_CHECK_SHEET_PAGE): string[] {
  const file = join(dir, page);
  if (!existsSync(file)) return [`ds-check sheet: ${page} was not built`];
  const html = readFileSync(file, 'utf8');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/gu)].map(
    (match) => match[1] as string
  );
  if (!refs.some((ref) => ref.endsWith('.js')))
    return [`ds-check sheet: ${page} references no script`];
  const problems: string[] = [];
  for (const ref of refs) {
    if (!ref.startsWith('./')) problems.push(`ds-check sheet: ${ref} is not a relative reference`);
    else if (!existsSync(join(dir, ref))) problems.push(`ds-check sheet: ${ref} is missing`);
  }
  return problems;
}

/**
 * Build the conformance sheet into `outDir` (emptied first). Returns the
 * problems; an empty list means the folder holds a self-contained page.
 */
export async function buildDsCheckSheet(outDir: string, root = ROOT): Promise<string[]> {
  const app = join(root, 'tests', 'fixtures', 'app');
  const input = join(app, DS_CHECK_SHEET_PAGE);
  if (!existsSync(input)) return [`ds-check sheet: ${input} does not exist`];
  rmSync(outDir, { recursive: true, force: true });
  const { build } = await import('vite');
  try {
    await build({
      root: app,
      configFile: join(app, 'vite.config.ts'),
      base: './',
      logLevel: 'error',
      build: {
        outDir,
        emptyOutDir: true,
        target: 'esnext',
        // One script: no chunk to load lazily from a path the page cannot reach.
        chunkSizeWarningLimit: 8192,
        reportCompressedSize: false,
        rolldownOptions: {
          input,
          output: { codeSplitting: false },
        },
      },
    });
  } catch (error) {
    return [`ds-check sheet: vite build failed: ${error instanceof Error ? error.message : error}`];
  }
  return checkBuiltSheet(outDir);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) {
    console.error('Usage: pnpm exec tsx scripts/ds-check-sheet.ts <out-dir>');
    process.exitCode = 2;
  } else {
    const problems = await buildDsCheckSheet(resolve(out));
    for (const problem of problems) console.error(problem);
    if (problems.length === 0) console.log(`✓ ds-check sheet built in ${out}`);
    process.exitCode = problems.length === 0 ? 0 : 1;
  }
}

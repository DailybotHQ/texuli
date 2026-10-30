/**
 * Write every generated agent surface from the operations registry
 * (ADR-017), or check that the committed files match (`--check`, which is
 * `pnpm check:surfaces` and runs inside `pnpm check`):
 *
 * - `apps/website/public/.well-known/mcp/server-card.json`
 * - `apps/website/public/llms.txt` (the nav sections plus the Tools section)
 * - `packages/tools/docs/ops.md` (the block between the surfaces markers)
 * - `apps/website/src/components/mcp-server/mcp-server-data.ts`
 *
 * `--check` regenerates everything into a temporary directory, compares it
 * byte for byte with the repository, prints the first differing line of
 * each file and exits 1 on any drift. JSON and TypeScript go through the
 * repository's Biome formatter, so the files are lint-clean as written.
 *
 *     pnpm exec tsx scripts/generate-surfaces.ts          # write
 *     pnpm check:surfaces                                 # check
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMcpPageModule,
  buildOpsTables,
  buildServerCard,
  spliceOpsDoc,
} from './agent-surfaces.ts';
import { buildSiteLlmsTxt } from './generate-site-llms.ts';

export const ROOT = resolve(import.meta.dirname, '..');

export const SURFACE_PATHS = {
  serverCard: 'apps/website/public/.well-known/mcp/server-card.json',
  llms: 'apps/website/public/llms.txt',
  opsDoc: 'packages/tools/docs/ops.md',
  mcpPageData: 'apps/website/src/components/mcp-server/mcp-server-data.ts',
} as const;

/** Format JSON or TypeScript with the repository's Biome, as `pnpm lint` expects. */
export function biomeFormat(path: string, text: string, root: string = ROOT): string {
  const biome = join(root, 'node_modules', '.bin', 'biome');
  return execFileSync(biome, ['format', `--stdin-file-path=${path}`], {
    cwd: root,
    input: text,
    encoding: 'utf8',
  });
}

/** Every generated file: repository-relative path → exact contents. */
export async function buildSurfaces(root: string = ROOT): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  files.set(
    SURFACE_PATHS.serverCard,
    biomeFormat(
      SURFACE_PATHS.serverCard,
      `${JSON.stringify(await buildServerCard(), null, 2)}\n`,
      root
    )
  );
  files.set(SURFACE_PATHS.llms, buildSiteLlmsTxt());
  files.set(
    SURFACE_PATHS.opsDoc,
    spliceOpsDoc(readFileSync(join(root, SURFACE_PATHS.opsDoc), 'utf8'), buildOpsTables())
  );
  files.set(
    SURFACE_PATHS.mcpPageData,
    biomeFormat(SURFACE_PATHS.mcpPageData, await buildMcpPageModule(), root)
  );
  return files;
}

/** The drift between generated files under `generated` and the repository. Pure over the fs. */
export function surfaceDrift(root: string, generated: string, paths: readonly string[]): string[] {
  const problems: string[] = [];
  for (const path of paths) {
    const want = readFileSync(join(generated, path), 'utf8');
    const file = join(root, path);
    if (!existsSync(file)) {
      problems.push(`${path}: missing (run pnpm exec tsx scripts/generate-surfaces.ts)`);
      continue;
    }
    const have = readFileSync(file, 'utf8');
    if (have === want) continue;
    const a = have.split('\n');
    const b = want.split('\n');
    let line = 0;
    while (line < Math.max(a.length, b.length) && a[line] === b[line]) line++;
    problems.push(
      `${path}:${line + 1} differs from the registry\n    committed: ${JSON.stringify(a[line] ?? '(end of file)')}\n    generated: ${JSON.stringify(b[line] ?? '(end of file)')}`
    );
  }
  return problems;
}

async function main(argv: readonly string[]): Promise<number> {
  const files = await buildSurfaces();
  if (!argv.includes('--check')) {
    for (const [path, text] of files) {
      mkdirSync(dirname(join(ROOT, path)), { recursive: true });
      writeFileSync(join(ROOT, path), text);
      console.log(`wrote ${path}`);
    }
    return 0;
  }
  const temp = mkdtempSync(join(tmpdir(), 'texuli-surfaces-'));
  try {
    for (const [path, text] of files) {
      mkdirSync(dirname(join(temp, path)), { recursive: true });
      writeFileSync(join(temp, path), text);
    }
    const drift = surfaceDrift(ROOT, temp, [...files.keys()]);
    if (drift.length === 0) {
      console.log(`check:surfaces ✓ ${files.size} generated surfaces match the registry`);
      return 0;
    }
    console.error(`check:surfaces ✗ ${drift.length} surface(s) drifted from the registry:`);
    for (const problem of drift) console.error(`  ${problem}`);
    console.error('Regenerate with: pnpm exec tsx scripts/generate-surfaces.ts');
    return 1;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main(process.argv.slice(2));

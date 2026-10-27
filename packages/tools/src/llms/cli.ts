#!/usr/bin/env node
/// <reference types="node" />
/**
 * CLI: generate llms.txt + agent docs from the live catalog manifests.
 *
 *   pnpm exec tsx packages/tools/src/llms/cli.ts --out apps/website/public/llms --json
 */

import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { isMainModule } from '../internal/is-main.ts';
import { buildLlmsBundle } from './bundle.ts';
import { writeLlmsBundle } from './write.ts';

export interface LlmsCliArgs {
  outDir: string;
  baseUrl: string;
  title: string;
  dryRun: boolean;
  json: boolean;
  help: boolean;
}

export function parseLlmsArgs(argv: string[]): LlmsCliArgs {
  const args: LlmsCliArgs = {
    outDir: 'dist/llms',
    baseUrl: '',
    title: 'Texuli',
    dryRun: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--out' || arg === '-o') {
      args.outDir = argv[++i] ?? args.outDir;
    } else if (arg === '--base-url') {
      args.baseUrl = argv[++i] ?? '';
    } else if (arg === '--title') {
      args.title = argv[++i] ?? args.title;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return args;
}

export async function runLlmsCli(
  argv: string[] = process.argv.slice(2)
): Promise<{ ok: true; files: number; outDir: string } | { ok: false; error: string }> {
  try {
    const args = parseLlmsArgs(argv);
    if (args.help) {
      const help = `Usage: texuli-llms [--out <dir>] [--base-url <url>] [--title <name>] [--dry-run] [--json]

Generate llms.txt, llms-full.txt and components/<id>.md from catalog manifests.
`;
      if (!args.json) process.stdout.write(help);
      else process.stdout.write(`${JSON.stringify({ ok: true, help }, null, 2)}\n`);
      return { ok: true, files: 0, outDir: args.outDir };
    }

    const groups = await discoverManifestGroups();
    const { catalog, hash } = await buildCatalog(groups);
    const bundle = buildLlmsBundle({
      catalog,
      baseUrl: args.baseUrl,
      title: args.title,
    });
    const result = await writeLlmsBundle(args.outDir, bundle, { dryRun: args.dryRun });

    if (args.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: true,
            outDir: result.outDir,
            dryRun: result.dryRun,
            entryCount: bundle.entryCount,
            files: result.written,
            catalogHash: hash,
          },
          null,
          2
        )}\n`
      );
    } else {
      process.stdout.write(
        `Wrote ${result.written.length} files to ${result.outDir} (${bundle.entryCount} components)${result.dryRun ? ' [dry-run]' : ''}\n`
      );
    }
    return { ok: true, files: result.written.length, outDir: result.outDir };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return { ok: false, error: message };
  }
}

if (isMainModule(import.meta.url)) {
  runLlmsCli().then((result) => {
    if (!result.ok) process.exitCode = 1;
  });
}

export { isMainModule };

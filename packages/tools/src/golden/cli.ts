#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatGoldenReport, scoreGoldenRun } from './report.ts';

/**
 * `texuli-golden <outputs.json> [--json]`: scores a model run, an object of
 * `{ "<task id>": <catalog tree> }`, and prints the report. Report-only: the
 * exit code is 0 whatever the scores; only unreadable input exits 2. The axe
 * check needs a DOM and is skipped here (the test suite runs it).
 */
async function main(argv: readonly string[]): Promise<number> {
  const file = argv.find((arg) => !arg.startsWith('--'));
  if (!file) {
    process.stderr.write('usage: texuli-golden <outputs.json> [--json]\n');
    return 2;
  }
  let outputs: unknown;
  try {
    outputs = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    process.stderr.write(`texuli-golden: cannot read ${file}: ${(error as Error).message}\n`);
    return 2;
  }
  const report = await scoreGoldenRun(outputs);
  process.stdout.write(
    argv.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : formatGoldenReport(report)
  );
  return 0;
}

function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fileURLToPath(metaUrl) === entry;
  } catch {
    return false;
  }
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

export { main as runGoldenCli };

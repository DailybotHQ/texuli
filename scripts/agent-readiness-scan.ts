/**
 * Scan a URL with isitagentready.com and report every check (PLAN_011
 * T-ar-score). Network access is the point of this script, so it is never
 * part of `pnpm check` or CI; the developer or the plan runs it by hand.
 *
 *   pnpm exec tsx scripts/agent-readiness-scan.ts <url> [--out <file.json>]
 *     [--require-all-pass] [--allow <check>[,<check>…]]
 *
 * `--require-all-pass` exits 1 unless every non-commerce check passes
 * (informational checks may stay neutral); `--allow` names checks accepted
 * as failing, e.g. the ones that compare against texuli.com while a preview
 * deployment is scanned.
 */
import { writeFileSync } from 'node:fs';
import { blockingRows, type ScanResult, scanRows } from './agent-readiness.ts';

const SCAN_API = 'https://isitagentready.com/api/scan';

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const url = args.find((arg) => /^https:\/\//.test(arg));
  if (!url) {
    console.error(
      'usage: agent-readiness-scan.ts <https-url> [--out file] [--require-all-pass] [--allow a,b]'
    );
    return 2;
  }
  const response = await fetch(SCAN_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    console.error(`scan failed: HTTP ${response.status}`);
    return 2;
  }
  const scan = (await response.json()) as ScanResult;
  const out = option(args, '--out');
  if (out) writeFileSync(out, `${JSON.stringify(scan, null, 2)}\n`);
  const allow = new Set((option(args, '--allow') ?? '').split(',').filter(Boolean));
  const rows = scanRows(scan, allow);
  console.log(`${scan.url ?? url}: level ${scan.level ?? '?'} (${scan.levelName ?? 'unknown'})`);
  for (const row of rows) {
    const mark =
      row.status === 'pass' ? '✓' : row.status === 'neutral' ? '·' : row.allowed ? '~' : '✗';
    console.log(`${mark} ${row.category}/${row.check}: ${row.status} — ${row.message}`);
  }
  const blocking = blockingRows(rows);
  if (args.includes('--require-all-pass') && blocking.length > 0) {
    console.error(
      `${blocking.length} required check(s) not passing: ${blocking.map((row) => row.check).join(', ')}`
    );
    return 1;
  }
  return 0;
}

process.exitCode = await main();

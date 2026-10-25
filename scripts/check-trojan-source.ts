/**
 * Fail when tracked text files contain literal Trojan Source / bidi control
 * characters. Intentional fixtures must use `\uXXXX` escapes in source.
 *
 * Ranges: U+202A–U+202E, U+2066–U+2069, U+200B–U+200F, U+FEFF.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

/** Code points that must never appear literally in tracked text. */
const FORBIDDEN = new Set<number>([
  ...range(0x202a, 0x202e),
  ...range(0x2066, 0x2069),
  ...range(0x200b, 0x200f),
  0xfeff,
]);

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let c = from; c <= to; c += 1) out.push(c);
  return out;
}

/** Binary / non-text extensions skipped entirely. */
const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.pdf',
  '.zip',
  '.gz',
  '.tgz',
  '.lock',
  '.mp3',
  '.mp4',
  '.wav',
  '.webm',
  '.svg', // may embed binary; still scan if text — keep scanning svg
]);

/**
 * Paths (repo-relative, posix) that may keep intentional control characters.
 * Prefer rewriting fixtures to `\u` escapes instead of growing this list.
 */
const ALLOWLIST = new Set<string>([
  // empty by default — fixtures use escapes
]);

function listedFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function isProbablyBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  if (sample.includes(0)) return true;
  return false;
}

export type TrojanHit = { path: string; codePoint: number; line: number; column: number };

export function scanText(path: string, text: string): TrojanHit[] {
  const hits: TrojanHit[] = [];
  let line = 1;
  let column = 1;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (FORBIDDEN.has(cp)) {
      hits.push({ path, codePoint: cp, line, column });
    }
    if (ch === '\n') {
      line += 1;
      column = 1;
    } else {
      column += ch === '\t' ? 4 : 1;
    }
  }
  return hits;
}

export function scanRepo(files: string[] = listedFiles()): TrojanHit[] {
  const hits: TrojanHit[] = [];
  for (const path of files) {
    if (ALLOWLIST.has(path.replaceAll('\\', '/'))) continue;
    const ext = extname(path).toLowerCase();
    if (BINARY_EXT.has(ext) && ext !== '.svg') continue;
    let buf: Buffer;
    try {
      buf = readFileSync(path);
    } catch {
      continue;
    }
    if (isProbablyBinary(buf)) continue;
    let text: string;
    try {
      text = buf.toString('utf8');
    } catch {
      continue;
    }
    hits.push(...scanText(path, text));
  }
  return hits;
}

function main(): void {
  const hits = scanRepo();
  if (hits.length === 0) {
    process.stdout.write('check-trojan-source: clean\n');
    return;
  }
  for (const hit of hits) {
    process.stderr.write(
      `${hit.path}:${hit.line}:${hit.column}: literal U+${hit.codePoint.toString(16).toUpperCase()} (Trojan Source / bidi control). Use \\u escapes.\n`
    );
  }
  process.stderr.write(`check-trojan-source: ${hits.length} hit(s)\n`);
  process.exitCode = 1;
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('check-trojan-source.ts') ||
    process.argv[1].endsWith('check-trojan-source.js'));

if (isMain) main();

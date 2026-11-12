import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const INLINE_STYLE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const STYLE_ATTRIBUTE = /\sstyle=(['"])(.*?)\1/gi;
const sha = (value) => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;

async function htmlFiles(dir) {
  const rows = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const row of rows) {
    const path = join(dir, row.name);
    if (row.isDirectory()) files.push(...(await htmlFiles(path)));
    else if (row.isFile() && row.name.endsWith('.html')) files.push(path);
  }
  return files;
}

const pages = await htmlFiles(DIST);
const scripts = new Set();
const styles = new Set();
const attributes = new Set();
for (const path of pages) {
  const html = await readFile(path, 'utf8');
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    if (!/\ssrc\s*=/.test(match[1] ?? '')) scripts.add(sha(match[2] ?? ''));
  }
  for (const match of html.matchAll(INLINE_STYLE)) styles.add(sha(match[1] ?? ''));
  for (const match of html.matchAll(STYLE_ATTRIBUTE)) attributes.add(sha(match[2] ?? ''));
}
const sorted = (values) => [...values].sort().join(' ');
const policy = [
  "default-src 'self'",
  `script-src 'self' ${sorted(scripts)}`.trim(),
  `style-src 'self' ${sorted(styles)}`.trim(),
  `style-src-attr ${attributes.size ? `'unsafe-hashes' ${sorted(attributes)}` : "'none'"}`,
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const escaped = policy.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
for (const path of pages) {
  const html = await readFile(path, 'utf8');
  const updated = html.replace(
    /<head\b[^>]*>/i,
    (head) => `${head}\n<meta http-equiv="Content-Security-Policy" content="${escaped}">`
  );
  if (updated === html && !/<meta http-equiv="Content-Security-Policy"/i.test(html))
    throw new Error(`no head element to attach CSP: ${relative(DIST, path)}`);
  await writeFile(path, updated);
}
const headers = [
  '/*',
  `  Content-Security-Policy: ${policy}`,
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  X-Frame-Options: DENY',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
  '',
].join('\n');
await writeFile(join(DIST, '_headers'), headers);
console.log(
  `wrote CSP for ${pages.length} static pages (${scripts.size} inline script hashes, ${styles.size} style hashes)`
);

/**
 * Snapshot every @texuli/examples registration into the website catalog JSON
 * so Astro SSR does not depend on side-effect order during the build.
 *
 * Deterministic: sorted ids, sorted object keys, relative source paths only,
 * no timestamps. Two runs with the same tree must write identical bytes.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplesSrc = join(root, 'packages/examples/src');
const outDir = join(root, 'apps/website/src/components/examples/generated');
const outFile = join(outDir, 'catalog.json');

const { listExamples } = await import(pathToFileURL(join(examplesSrc, 'index.ts')).href);

function walk(dir, out = []) {
  const names = readdirSync(dir).sort((a, b) => a.localeCompare(b, 'en'));
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.svelte') || name.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** Deep-sort plain objects by key; arrays keep order (caller sorts when needed). */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b, 'en'))
        .map((key) => [key, sortKeys(value[key])])
    );
  }
  return value;
}

function preferDemo(path) {
  return /Demo\.svelte$/i.test(path) || path.endsWith('.svelte');
}

const srcMap = new Map();
for (const path of walk(examplesSrc)) {
  const text = readFileSync(path, 'utf8');
  const ids = [
    ...[...text.matchAll(/data-example=["']([a-z][a-z0-9-]*)["']/g)].map((m) => m[1]),
    ...[...text.matchAll(/\bid\s*:\s*["']([a-z][a-z0-9-]*)["']/g)].map((m) => m[1]),
  ].filter(Boolean);
  for (const id of [...new Set(ids)].sort((a, b) => a.localeCompare(b, 'en'))) {
    const prev = srcMap.get(id);
    if (!prev) {
      srcMap.set(id, path);
      continue;
    }
    // Prefer Demo.svelte; otherwise lexicographically smaller relative path.
    const prevRel = relative(examplesSrc, prev);
    const nextRel = relative(examplesSrc, path);
    if (preferDemo(path) && !preferDemo(prev)) srcMap.set(id, path);
    else if (preferDemo(path) === preferDemo(prev) && nextRel.localeCompare(prevRel, 'en') < 0) {
      srcMap.set(id, path);
    }
  }
}

const PACKAGE_TAGS = new Set(['texuli', 'blocks', 'charts', 'chat', 'core', 'data', 'media', 'ui']);
const SKIP_KIND = new Set(['rtl', 'dark', 'a11y', 'keyboard']);

const items = listExamples()
  .map((entry) => {
    const packageId = entry.component.split('/')[0];
    let kind = packageId;
    for (const tag of entry.tags) {
      if (tag === packageId || SKIP_KIND.has(tag)) continue;
      if (PACKAGE_TAGS.has(tag) && tag !== packageId) continue;
      kind = tag;
      break;
    }
    if (kind === packageId) {
      for (const tag of entry.tags) {
        if (tag !== packageId) {
          kind = tag;
          break;
        }
      }
    }
    const sourceFile = srcMap.get(entry.id) ?? null;
    let source = null;
    let sourcePath = null;
    if (sourceFile && existsSync(sourceFile)) {
      const raw = readFileSync(sourceFile, 'utf8');
      source = raw.length > 80_000 ? `${raw.slice(0, 80_000)}\n/* …truncated */\n` : raw;
      sourcePath = relative(examplesSrc, sourceFile).split('\\').join('/');
    }
    return {
      component: entry.component,
      description: entry.description,
      id: entry.id,
      kind,
      packageId,
      props: [...(entry.props ?? [])].sort((a, b) => a.localeCompare(b, 'en')),
      source,
      sourcePath,
      tags: [...entry.tags].sort((a, b) => a.localeCompare(b, 'en')),
      title: entry.title,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id, 'en'));

const body = `${JSON.stringify(sortKeys(items))}\n`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, body);
console.log(`generate-examples-catalog: ${items.length} examples → ${relative(root, outFile)}`);

/**
 * Parity gate for the agent-facing surfaces (T-24). Four id sets must
 * reconcile, and every mismatch is listed with a severity:
 *
 * - **catalog ids** (`packages/catalog/src/manifests/*`) — the source of
 *   truth; every component page exists because of one;
 * - **component-page twins** (`md-manifest.json`, keys
 *   `/component-pages/<id>/`) — what an agent fetching `page.md` receives;
 * - **llms component docs** (`dist/llms/components/<id>.md`) — the
 *   pre-rendered agent docs;
 * - **example entries** (`generated/catalog.json`) — ids unique, every
 *   `sourcePath` on disk, every example directory covered by at least one
 *   entry (an uncovered directory is an orphan demo that can never render).
 *
 * **Policy.** Fatal (exit 1): a catalog id without a twin or a component
 * doc; an orphan twin or doc id with no catalog manifest; duplicate example
 * ids; a missing `sourcePath`; an example directory no entry references
 * (`SHARED_EXAMPLE_DIRS` names the helper directories that hold no demo).
 * The twin axis covers the component-page twins only: the manifest also
 * carries guides/primitives twins (T-23), which have no catalog manifest by
 * design. The example axis stays registry-internal on purpose: gallery
 * examples cover more than components (site, charts, blocks…), so no
 * example-to-component equality is asserted. The build must have run before
 * this script (`pnpm build`), which is also what T-94 documents.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONTENT_MANIFESTS } from '../packages/catalog/src/manifests/content/index.ts';
import { DISPLAY_MANIFESTS } from '../packages/catalog/src/manifests/display/index.ts';
import { FORMS_MANIFESTS } from '../packages/catalog/src/manifests/forms/index.ts';
import { LAYOUTS_MANIFESTS } from '../packages/catalog/src/manifests/layouts/index.ts';
import { OVERLAYS_MANIFESTS } from '../packages/catalog/src/manifests/overlays/index.ts';

/** One fatal mismatch, print-ready. */
export type ParityFinding = string;

export interface ParityInput {
  /** Catalog manifest ids (the source of truth). */
  catalogIds: readonly string[];
  /** Raw twin keys from `md-manifest.json` (`/component-pages/<id>/`). */
  twinKeys: readonly string[];
  /** Raw llms component doc file names (`<id>.md`). */
  llmsFiles: readonly string[];
  /** Generated example entries. */
  examples: readonly { id: string; sourcePath: string }[];
  /** Directory names under `packages/examples/src`. */
  exampleDirs: readonly string[];
  /** Whether an examples-root-relative `sourcePath` exists. */
  pathExists: (path: string) => boolean;
}

const TWIN_KEY = /^\/component-pages\/([^/]+)\/$/;
const LLMS_FILE = /^([a-z0-9-]+)\.md$/;

/**
 * Example directories that hold shared helper modules, not demos, so no
 * entry covers them. When you add one, name it here — the gate fails on any
 * other uncovered directory.
 */
export const SHARED_EXAMPLE_DIRS: readonly string[] = ['core-safe-href', 'player-shared'];

/** The component id a twin key carries, or `null` when it is not one. */
export function twinIdOf(key: string): string | null {
  return TWIN_KEY.exec(key)?.[1] ?? null;
}

/** The component id an llms component doc file name carries, or `null`. */
export function llmsIdOf(file: string): string | null {
  return LLMS_FILE.exec(file)?.[1] ?? null;
}

/**
 * Reconciles the four sets. Pure: the filesystem is reachable only through
 * `pathExists`, so tests run on fixtures.
 */
export function compareParity(input: ParityInput): ParityFinding[] {
  const fatal: ParityFinding[] = [];
  const catalog = [...new Set(input.catalogIds)].sort();
  const twinIds = [...new Set(input.twinKeys.map(twinIdOf).filter((id) => id !== null))].sort();
  const docIds = [...new Set(input.llmsFiles.map(llmsIdOf).filter((id) => id !== null))].sort();
  const unrecognizedTwins = input.twinKeys.filter((key) => twinIdOf(key) === null);
  const unrecognizedDocs = input.llmsFiles.filter((file) => llmsIdOf(file) === null);

  const catalogSet = new Set(catalog);
  const twinSet = new Set(twinIds);
  const docSet = new Set(docIds);
  for (const id of catalog) {
    if (!twinSet.has(id)) fatal.push(`[fatal] catalog id "${id}" has no component-page twin`);
    if (!docSet.has(id)) fatal.push(`[fatal] catalog id "${id}" has no llms component doc`);
  }
  for (const id of twinIds)
    if (!catalogSet.has(id))
      fatal.push(`[fatal] twin "/component-pages/${id}/" has no catalog manifest`);
  for (const id of docIds)
    if (!catalogSet.has(id)) fatal.push(`[fatal] llms doc "${id}.md" has no catalog manifest`);
  for (const key of unrecognizedTwins)
    fatal.push(`[fatal] twin key "${key}" is not a component page`);
  for (const file of unrecognizedDocs)
    fatal.push(`[fatal] llms file "${file}" is not a component doc name`);

  const seenExamples = new Set<string>();
  for (const example of input.examples) {
    if (seenExamples.has(example.id)) fatal.push(`[fatal] duplicate example id "${example.id}"`);
    seenExamples.add(example.id);
    if (!input.pathExists(example.sourcePath))
      fatal.push(`[fatal] example "${example.id}" sourcePath "${example.sourcePath}" is missing`);
  }
  const coveredDirs = new Set(
    input.examples.map((example) => example.sourcePath.split('/')[0] ?? '')
  );
  for (const dir of input.exampleDirs)
    if (!coveredDirs.has(dir)) fatal.push(`[fatal] example directory "${dir}" has no entry`);
  return fatal;
}

function pathExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function main(): number {
  const root = join(import.meta.dirname, '..');
  const dist = join(root, 'apps/website/dist');
  const examplesRoot = join(root, 'packages/examples/src');
  const catalogIds = [
    ...CONTENT_MANIFESTS,
    ...DISPLAY_MANIFESTS,
    ...FORMS_MANIFESTS,
    ...LAYOUTS_MANIFESTS,
    ...OVERLAYS_MANIFESTS,
  ].map((manifest) => manifest.id);
  const manifest = JSON.parse(readFileSync(join(dist, 'md-manifest.json'), 'utf8')) as {
    twins: Record<string, string>;
  };
  const examples = JSON.parse(
    readFileSync(join(root, 'apps/website/src/components/examples/generated/catalog.json'), 'utf8')
  ) as { id: string; sourcePath: string }[];
  const exampleDirs = readdirSync(examplesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const fatal = compareParity({
    catalogIds,
    twinKeys: Object.keys(manifest.twins).filter((key) => twinIdOf(key) !== null),
    llmsFiles: readdirSync(join(dist, 'llms/components')),
    examples,
    exampleDirs: exampleDirs.filter((dir) => !SHARED_EXAMPLE_DIRS.includes(dir)),
    pathExists: (sourcePath) => pathExists(join(examplesRoot, sourcePath)),
  });

  if (fatal.length === 0) {
    console.log(
      `llms parity ✓ ${new Set(catalogIds).size} components: twins, llms docs, ` +
        `${examples.length} examples over ${exampleDirs.length} directories all reconcile`
    );
    return 0;
  }
  console.error(`llms parity ✗ ${fatal.length} mismatch(es):`);
  for (const finding of fatal) console.error(`  ${finding}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exit(main());

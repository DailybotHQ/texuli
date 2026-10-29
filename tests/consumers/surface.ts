/// <reference types="node" />
/**
 * The consumer surface: every exported subpath of every packable package,
 * derived from the source `package.json` `exports` maps (never listed by
 * hand), and the environment each one needs.
 *
 * Kinds:
 * - `module`: imported by every consumer app, in the client bundle and in
 *   the server render where the framework has one (SvelteKit prerender,
 *   Astro build), and type-checked by svelte-check and tsc;
 * - `css`: imported for its side effect by every app; the built CSS must
 *   carry a marker taken from the packed stylesheet;
 * - `tailwind-css`: a Tailwind 4 stylesheet (`@custom-variant`, `@theme`,
 *   `@utility`), imported by the Tailwind apps' own stylesheet after
 *   `@import "tailwindcss"`; a plain app has no Tailwind compiler for it;
 * - `astro`: the entry imports `.astro` components, which only the Astro
 *   compiler resolves; the Astro apps import it in a generated page;
 * - `node`: the entry imports Node built-ins (`node:fs` …); it gets a Node
 *   import check in every app instead of a browser one.
 *
 * {@link NON_BROWSER_SUBPATHS} is the only hand-written part: the reason each
 * `astro` and `node` entry is kept out of the browser. The harness walks the
 * installed `dist/` import graph and fails when the table and the graph
 * disagree, so a browser entry that starts importing `node:fs` (or an entry
 * listed here that no longer needs it) fails instead of being reclassified.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { readWorkspace, selectPackages, type WorkspacePackage } from '../../scripts/packages.ts';

export type SubpathKind = 'module' | 'css' | 'tailwind-css' | 'astro' | 'node';

export interface ConsumerSubpath {
  /** Package name, e.g. `@texuli/core`. */
  pkg: string;
  /** Directory under `packages/`. */
  dir: string;
  /** Export key, e.g. `.` or `./url-policy`. */
  subpath: string;
  /** Import specifier, e.g. `@texuli/core/url-policy`. */
  specifier: string;
  kind: SubpathKind;
}

/** Why an entry stays out of the browser bundle. Keys are import specifiers. */
export const NON_BROWSER_SUBPATHS: Readonly<
  Record<string, { kind: 'astro' | 'node'; reason: string }>
> = {
  '@texuli/astro/layouts/ContentLayout': {
    kind: 'astro',
    reason: 'wraps ContentLayout.astro; only the Astro compiler resolves .astro files',
  },
  '@texuli/astro/sections/Hero': {
    kind: 'astro',
    reason: 'wraps Hero.astro; only the Astro compiler resolves .astro files',
  },
  '@texuli/astro/sections/Section': {
    kind: 'astro',
    reason: 'wraps Section.astro; only the Astro compiler resolves .astro files',
  },
  '@texuli/catalog/build/node': {
    kind: 'node',
    reason: 'the Node side of the catalog build: reads manifest folders and writes files (node:fs)',
  },
  '@texuli/tools': {
    kind: 'node',
    reason: 'the root re-exports the file-writing CLIs (cli-add, cli-init, cli-update, llms)',
  },
  '@texuli/tools/cli-add': {
    kind: 'node',
    reason: 'the texuli-add CLI copies component files into a project (node:fs)',
  },
  '@texuli/tools/cli-init': {
    kind: 'node',
    reason: 'the texuli-init CLI writes project files (node:fs)',
  },
  '@texuli/tools/cli-update': {
    kind: 'node',
    reason: 'the texuli-update CLI diffs and rewrites copied components (node:fs)',
  },
  '@texuli/tools/llms': {
    kind: 'node',
    reason: 'the texuli-llms CLI writes llms.txt bundles (node:fs)',
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** The packable packages (the same selection `pnpm verify:packages` packs). */
export function packablePackages(root: string): WorkspacePackage[] {
  return selectPackages(readWorkspace(root), []);
}

/** The import specifier for an export key of `pkg`. */
export function specifierFor(pkg: string, subpath: string): string {
  return subpath === '.' ? pkg : `${pkg}/${subpath.slice(2)}`;
}

/**
 * The runtime target of an export value for a bundler: the `svelte`, then
 * `import`, then `default` condition (the order Vite and SvelteKit use for a
 * Svelte library); a string value is its own target.
 */
export function runtimeTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return undefined;
  for (const condition of ['svelte', 'import', 'default']) {
    const inner = runtimeTarget(value[condition]);
    if (inner !== undefined) return inner;
  }
  return undefined;
}

/** A stylesheet that needs the Tailwind 4 compiler. */
export function needsTailwind(css: string): boolean {
  return /@(custom-variant|theme|utility|plugin|source|variant)\b/.test(css);
}

/** Every exported subpath of every packable package, in package then export order. */
export function consumerSubpaths(root: string): ConsumerSubpath[] {
  const out: ConsumerSubpath[] = [];
  for (const pkg of packablePackages(root)) {
    const exports = pkg.manifest.exports;
    if (!isRecord(exports)) throw new Error(`${pkg.name} has no exports map`);
    for (const [subpath, value] of Object.entries(exports)) {
      if (!subpath.startsWith('.')) throw new Error(`${pkg.name}: conditional root exports`);
      if (subpath.includes('*')) throw new Error(`${pkg.name}: pattern export ${subpath}`);
      const specifier = specifierFor(pkg.name, subpath);
      const target = runtimeTarget(value);
      if (target === undefined) throw new Error(`${specifier}: no runtime target`);
      let kind: SubpathKind = 'module';
      if (target.endsWith('.css')) {
        const css = readFileSync(join(root, 'packages', pkg.dir, target), 'utf8');
        kind = needsTailwind(css) ? 'tailwind-css' : 'css';
      } else if (NON_BROWSER_SUBPATHS[specifier]) {
        kind = NON_BROWSER_SUBPATHS[specifier].kind;
      }
      out.push({ pkg: pkg.name, dir: pkg.dir, subpath, specifier, kind });
    }
  }
  return out;
}

// ── the installed import graph ────────────────────────────────────────────

/** Static and dynamic import specifiers of a JavaScript or Svelte file (type-only imports excluded). */
export function importSpecifiers(code: string): string[] {
  const text = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '');
  const found = new Set<string>();
  const statement =
    /(?:^|[;\n}])\s*(?:import|export)(?!\s+type\b)(?:[\s\w{},*$]*?\sfrom\s*|\s*)(['"])([^'"\n]+)\1/g;
  for (const match of text.matchAll(statement)) found.add(match[2] as string);
  for (const match of text.matchAll(/\bimport\(\s*(['"])([^'"\n]+)\1\s*\)/g)) {
    found.add(match[2] as string);
  }
  return [...found];
}

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`. */
export function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string);
}

export interface InstalledGraph {
  /** Node built-ins reached, each with the first file that imports it. */
  nodeBuiltins: Map<string, string>;
  /** `.astro` files reached. */
  astroFiles: string[];
  /** Relative imports that point at no file in the tarball. */
  missing: string[];
  /** Bare imports a package uses without declaring them. */
  undeclared: string[];
  /** Texuli subpaths imported that the target package does not export. */
  unexported: string[];
  /** `.svelte` files reached (plain Node cannot import the entry). */
  svelteFiles: number;
  /** Stylesheets imported for their side effect (plain Node cannot import the entry). */
  styleImports: number;
  /** Files visited. */
  files: number;
}

interface InstalledManifest {
  name: string;
  exports?: unknown;
  /** Package `imports` (`#…` specifiers), mapped to `dist` by the packer. */
  imports?: unknown;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const NODE_BUILTIN = /^node:/;
const isTexuli = (name: string) => name === 'texuli' || name.startsWith('@texuli/');

/** Every file target of a package `imports` value, whatever the condition. */
export function importTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(importTargets);
}

/** The target a browser bundler resolves for an `imports` value (`browser` first). */
export function browserImportTarget(value: unknown): string | undefined {
  if (isRecord(value) && value.browser !== undefined) return browserImportTarget(value.browser);
  return runtimeTarget(value);
}

/**
 * Walk the runtime import graph of `specifier` inside an installed
 * `node_modules`, following relative imports and every Texuli package's
 * packed exports map. Third-party packages are leaves (only their
 * declaration is checked).
 */
export function walkInstalled(installDir: string, specifier: string): InstalledGraph {
  const consumerDir = resolve(installDir);
  const graph: InstalledGraph = {
    nodeBuiltins: new Map(),
    astroFiles: [],
    missing: [],
    undeclared: [],
    unexported: [],
    svelteFiles: 0,
    styleImports: 0,
    files: 0,
  };
  const manifests = new Map<string, InstalledManifest>();
  const manifestOf = (name: string): InstalledManifest | undefined => {
    if (!manifests.has(name)) {
      const file = join(consumerDir, 'node_modules', ...name.split('/'), 'package.json');
      if (!existsSync(file)) return undefined;
      manifests.set(name, JSON.parse(readFileSync(file, 'utf8')) as InstalledManifest);
    }
    return manifests.get(name);
  };
  const resolveTexuli = (spec: string, from: string): string | undefined => {
    const name = packageNameOf(spec);
    const manifest = manifestOf(name);
    if (!manifest) {
      graph.missing.push(`${from} imports ${spec}: ${name} is not installed`);
      return undefined;
    }
    const key = spec === name ? '.' : `./${spec.slice(name.length + 1)}`;
    const exports = isRecord(manifest.exports) ? manifest.exports : {};
    const target = runtimeTarget(exports[key]);
    if (target === undefined) {
      graph.unexported.push(`${from} imports ${spec}: ${name} does not export ${key}`);
      return undefined;
    }
    return join(consumerDir, 'node_modules', ...name.split('/'), target);
  };
  const ownerOf = (file: string): string => {
    const rel = file.slice(join(consumerDir, 'node_modules').length + 1).split(/[/\\]/);
    return rel[0]?.startsWith('@') ? `${rel[0]}/${rel[1]}` : (rel[0] as string);
  };

  const seen = new Set<string>();
  const queue: string[] = [];
  const entry = resolveTexuli(specifier, '(consumer)');
  if (entry) queue.push(entry);
  while (queue.length > 0) {
    const file = normalize(queue.pop() as string);
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) {
      graph.missing.push(`${file.slice(consumerDir.length + 1)} is not in the tarball`);
      continue;
    }
    graph.files += 1;
    if (file.endsWith('.astro')) {
      graph.astroFiles.push(file.slice(consumerDir.length + 1));
      continue;
    }
    if (!/\.(m?js|svelte)$/.test(file)) continue;
    if (file.endsWith('.svelte')) graph.svelteFiles += 1;
    const owner = ownerOf(file);
    const ownManifest = manifestOf(owner);
    const declared = new Set([
      owner,
      ...Object.keys(ownManifest?.dependencies ?? {}),
      ...Object.keys(ownManifest?.peerDependencies ?? {}),
      ...Object.keys(ownManifest?.optionalDependencies ?? {}),
    ]);
    const where = file.slice(consumerDir.length + 1);
    for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
      if (NODE_BUILTIN.test(spec)) {
        if (!graph.nodeBuiltins.has(spec)) graph.nodeBuiltins.set(spec, where);
        continue;
      }
      if (spec.startsWith('.')) {
        const target = resolve(dirname(file), spec.split(/[?#]/)[0] as string);
        if (/\.css$/.test(target)) {
          graph.styleImports += 1;
          if (!existsSync(target))
            graph.missing.push(`${where} imports ${spec}: not in the tarball`);
          continue;
        }
        queue.push(target);
        continue;
      }
      if (spec.startsWith('#')) {
        // A package `imports` specifier (e.g. `#deck-ssr`): resolved through
        // the owner's own manifest. Every condition's file must be in the
        // tarball; the walk follows the one a browser bundler picks.
        const imports = isRecord(ownManifest?.imports) ? ownManifest.imports : {};
        const value = imports[spec];
        const targets = importTargets(value);
        if (targets.length === 0) {
          graph.unexported.push(`${where} imports ${spec}: ${owner} declares no such import`);
          continue;
        }
        const base = join(consumerDir, 'node_modules', ...owner.split('/'));
        for (const target of targets) {
          if (!target.startsWith('./')) {
            graph.missing.push(
              `${where} imports ${spec}: target ${target} is not a file in ${owner}`
            );
          } else if (!existsSync(join(base, target))) {
            graph.missing.push(`${where} imports ${spec}: ${target} is not in the tarball`);
          }
        }
        const picked = browserImportTarget(value);
        if (picked?.startsWith('./') && existsSync(join(base, picked)))
          queue.push(join(base, picked));
        continue;
      }
      if (spec.startsWith('/') || /^[a-z]+:/.test(spec)) {
        graph.missing.push(`${where} imports the absolute or URL specifier ${spec}`);
        continue;
      }
      const name = packageNameOf(spec);
      if (!declared.has(name)) graph.undeclared.push(`${owner} (${where}) imports ${spec}`);
      if (isTexuli(name)) {
        const target = resolveTexuli(spec, where);
        if (target?.endsWith('.css')) graph.styleImports += 1;
        else if (target) queue.push(target);
      }
    }
  }
  return graph;
}

/** Plain Node (no bundler) can import the entry: no Svelte files and no stylesheet imports. */
export function nodeImportable(graph: InstalledGraph): boolean {
  return graph.svelteFiles === 0 && graph.styleImports === 0 && graph.astroFiles.length === 0;
}

/**
 * The environment an installed entry needs according to its import graph:
 * `astro` when it reaches `.astro` files, `node` when it reaches Node
 * built-ins, otherwise `browser`.
 */
export function detectedEnvironment(graph: InstalledGraph): 'astro' | 'node' | 'browser' {
  if (graph.astroFiles.length > 0) return 'astro';
  if (graph.nodeBuiltins.size > 0) return 'node';
  return 'browser';
}

// ── stylesheets ───────────────────────────────────────────────────────────

/**
 * The classes (`.tx-…`) and custom properties (`--tx-…:` definitions) a
 * stylesheet defines, comments removed. A minifier keeps both names.
 */
export function cssIdentifiers(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = new Set<string>();
  for (const match of text.matchAll(/\.(tx-[A-Za-z0-9_-]+)/g)) found.add(`.${match[1]}`);
  for (const match of text.matchAll(/(--tx-[A-Za-z0-9_-]+)\s*:/g)) found.add(match[1] as string);
  return [...found].sort();
}

// ── rendered components ───────────────────────────────────────────────────

/** Packages that ship Svelte components (each must render one in every app). */
export function uiPackages(root: string): string[] {
  const hasSvelte = (dir: string): boolean =>
    existsSync(dir) &&
    readdirSync(dir, { withFileTypes: true }).some((entry) =>
      entry.isDirectory()
        ? hasSvelte(join(dir, entry.name))
        : entry.name.endsWith('.svelte') || entry.name.endsWith('.astro')
    );
  return packablePackages(root)
    .filter((pkg) => hasSvelte(join(root, 'packages', pkg.dir, 'src')))
    .map((pkg) => pkg.name);
}

export interface RenderCheck {
  /** The region in Smoke.svelte or Packages.svelte. */
  region: string;
  /** Text the hydrated region contains. */
  client: string;
  /**
   * Text the server-rendered HTML contains (SvelteKit prerender, Astro
   * island); `null` when the component mounts only after hydration.
   */
  ssr: string | null;
  /** The component ships CSS: some `tx-` class in the region has a loaded rule. */
  styled: boolean;
}

/** One rendered component per UI package (Smoke.svelte and Packages.svelte). */
export const RENDER_CHECKS: Readonly<Record<string, RenderCheck>> = {
  '@texuli/primitives': {
    region: '[data-package="primitives"]',
    client: 'checkbox off',
    ssr: 'checkbox off',
    styled: false,
  },
  texuli: {
    region: '[data-package="texuli-ui"]',
    client: 'Smoke button',
    ssr: 'Smoke button',
    styled: true,
  },
  '@texuli/data': {
    region: '[data-package="data-grid"]',
    client: 'Ada',
    ssr: null,
    styled: true,
  },
  '@texuli/astro': {
    region: '[data-render="@texuli/astro"]',
    client: 'Consumer appearance',
    ssr: 'Consumer appearance',
    styled: true,
  },
  '@texuli/blocks': {
    region: '[data-render="@texuli/blocks"]',
    client: 'Consumer block heading',
    ssr: 'Consumer block heading',
    styled: true,
  },
  '@texuli/canvas': {
    region: '[data-render="@texuli/canvas"]',
    client: 'Consumer canvas note',
    ssr: 'Consumer canvas note',
    styled: true,
  },
  '@texuli/charts': {
    region: '[data-render="@texuli/charts"]',
    client: 'Consumer chart',
    ssr: 'Consumer chart',
    styled: true,
  },
  '@texuli/chat': {
    region: '[data-render="@texuli/chat"]',
    client: 'Consumer chat message',
    ssr: 'Consumer chat message',
    styled: true,
  },
  '@texuli/editor': {
    region: '[data-render="@texuli/editor"]',
    client: 'Consumer editor text',
    ssr: 'Consumer editor text',
    styled: true,
  },
  '@texuli/forms': {
    region: '[data-render="@texuli/forms"]',
    client: 'Consumer form email',
    ssr: 'Consumer form email',
    styled: true,
  },
  '@texuli/media': {
    region: '[data-render="@texuli/media"]',
    client: 'Consumer image',
    ssr: 'Consumer image',
    styled: true,
  },
  '@texuli/pages': {
    region: '[data-render="@texuli/pages"]',
    client: 'Consumer page text',
    ssr: 'Consumer page text',
    styled: true,
  },
  '@texuli/player': {
    region: '[data-render="@texuli/player"]',
    client: 'Consumer player',
    ssr: 'Consumer player',
    styled: true,
  },
  '@texuli/slides': {
    region: '[data-render="@texuli/slides"]',
    client: 'Consumer deck slide',
    // The server pass paints the stage shell; slide content loads on the client.
    ssr: 'Presentation: Consumer deck',
    styled: true,
  },
  '@texuli/workflows': {
    region: '[data-render="@texuli/workflows"]',
    client: 'Consumer request',
    ssr: 'Consumer request',
    styled: true,
  },
};

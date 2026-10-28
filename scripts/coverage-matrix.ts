/**
 * JSON coverage matrix (`pnpm exec tsx scripts/coverage-matrix.ts [--json] [--out <file>]`).
 *
 * For every Svelte component exported by the published component packages
 * (texuli, @texuli/data, @texuli/charts, @texuli/media, @texuli/chat,
 * @texuli/blocks) it reports which JSON surfaces cover it: the catalog
 * manifest id, the spec id and capability (`packages/spec/catalog`), the
 * player loader, the render catalogs that accept the id, the examples
 * registry entry and the package docs page. It also lists the gaps.
 *
 * Offline and read-only. Components are discovered statically from each
 * package.json `exports`, following re-exports through the TypeScript AST:
 *
 * - `component`: a `.svelte` default export bound to a public name;
 * - `compound`: an exported object whose members are components
 *   (`Select = { Root, Content, … }`); its parts get `Select.Content` aliases;
 * - `lazy`: a component reached only through a dynamic `import('./X.svelte')`
 *   in an exported loader (`loadTextFamily`) or a registering entry module.
 *
 * Manifests do not name the export they describe, so a manifest is matched
 * to a component by its player loader target (and any export of the same
 * package with that target's public name: a drop-in such as the
 * `sparkline-lite` Sparkline), then by a loader map its own
 * package exports (`CHAT_DISPLAY_LOADERS`), and
 * otherwise by name (label, id, id without its family prefix). Unmatched
 * manifests are listed as a gap rather than guessed.
 *
 * `collectCoverageInputs()` does the file-system and module work;
 * `buildCoverageMatrix()` is pure over those inputs.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The published component packages the matrix covers (workspace dir → npm name). */
export const COMPONENT_PACKAGES: readonly { dir: string; name: string; short: string }[] = [
  { dir: 'texuli', name: 'texuli', short: 'texuli' },
  { dir: 'data', name: '@texuli/data', short: 'data' },
  { dir: 'charts', name: '@texuli/charts', short: 'charts' },
  { dir: 'media', name: '@texuli/media', short: 'media' },
  { dir: 'chat', name: '@texuli/chat', short: 'chat' },
  { dir: 'blocks', name: '@texuli/blocks', short: 'blocks' },
];

export type ComponentKind = 'component' | 'compound' | 'lazy';

/** One exported Svelte component, as discovered from the package exports. */
export interface ComponentExport {
  /** Stable key: `<package>::<repo-relative file>` (plus `#Name` for compounds). */
  key: string;
  package: string;
  /** Every subpath that exposes it (`.`, `./alert`, …), sorted. */
  subpaths: string[];
  name: string;
  /** Every public name it is reachable by (export names, `Compound.Part`, file basename). */
  aliases: string[];
  kind: ComponentKind;
  /** Repo-relative source file (the `.svelte` file, or the module defining a compound). */
  file: string;
  /** Ids this component paints through a loader map its own package exports (`CHAT_DISPLAY_LOADERS`). */
  paints: string[];
}

export interface ManifestInput {
  id: string;
  package: string;
  label: string;
  /** `catalog`: packages/catalog/src/manifests; `player`: held in packages/player until adopted. */
  source: 'catalog' | 'player';
  agentEmittable: boolean;
}

export interface SpecInput {
  id: string;
  label: string;
  group: string;
  capability: string;
}

export interface LoaderInput {
  id: string;
  /** `<module specifier>#<export>` as written in packages/player/src/loaders.ts. */
  target: string;
  /** Key of the component row the loader paints, when it is one of the covered packages. */
  componentKey?: string;
}

export interface ExampleInput {
  id: string;
  /** `package/Export` or `package/subpath` (examples registry format). */
  component: string;
}

export interface DocInput {
  package: string;
  /** Repo-relative path. */
  file: string;
  text: string;
}

export interface CoverageInputs {
  components: ComponentExport[];
  manifests: ManifestInput[];
  spec: SpecInput[];
  loaders: LoaderInput[];
  /** Ids the shipped Player's render catalog (`createPlayerCatalog()`) accepts. */
  playerRendererIds: string[];
  examples: ExampleInput[];
  docs: DocInput[];
}

export interface CoverageRow {
  package: string;
  subpath: string;
  subpaths: string[];
  component: string;
  kind: ComponentKind;
  file: string;
  manifest: string | null;
  manifestSource: 'catalog' | 'player' | null;
  specId: string | null;
  capability: string | null;
  loader: string | null;
  /** Id painted through a loader map the component's own package exports (merged into the Player by the host). */
  packageLoader: string | null;
  /** `catalog` (built catalog accepts the id), `player` (Player render catalog accepts it). */
  renderer: string[];
  examples: string[];
  docs: string | null;
}

export interface CoverageSummary {
  components: number;
  perPackage: Record<string, number>;
  perKind: Record<ComponentKind, number>;
  columns: {
    manifest: number;
    catalogManifest: number;
    specId: number;
    capabilityKnown: number;
    loader: number;
    packageLoader: number;
    renderer: number;
    example: number;
    docs: number;
  };
  spec: { ids: number; capabilities: Record<string, number> };
  loaders: number;
  manifests: { catalog: number; player: number };
  gaps: {
    /** Components with no catalog manifest (player-held manifests do not count). */
    componentsWithoutManifest: string[];
    /** Components whose only manifest is still held by the player. */
    componentsWithPlayerManifestOnly: string[];
    componentsWithoutSpecId: string[];
    componentsWithoutExample: string[];
    componentsWithoutDocs: string[];
    /** Manifests of the covered packages that no exported component matched. */
    manifestsWithoutComponent: string[];
    specIdsCapabilityUnknown: string[];
    loaderIdsWithoutSpecId: string[];
    specIdsWithoutLoader: string[];
    specIdsWithoutPlayerRenderer: string[];
    /** Spec ids no loader paints and the Player's render catalog does not accept. */
    specIdsWithoutLoaderOrRenderer: string[];
  };
}

export interface CoverageMatrix {
  rows: CoverageRow[];
  summary: CoverageSummary;
}

// ---------------------------------------------------------------------------
// Pure matrix
// ---------------------------------------------------------------------------

/** Lowercase alphanumerics only: `Select.Content` → `selectcontent`. */
export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ID_PREFIXES = ['charts-', 'media-', 'blocks-', 'data-', 'chat-', 'layout-'];
const DOC_PREFIXES = ['ui-', 'data-', 'charts-', 'media-', 'chat-', 'blocks-', 'layouts-'];

/** Name keys a manifest may be known by. */
function manifestKeys(manifest: ManifestInput): Set<string> {
  const keys = new Set([normalizeName(manifest.label), normalizeName(manifest.id)]);
  for (const prefix of ID_PREFIXES) {
    if (!manifest.id.startsWith(prefix)) continue;
    const rest = manifest.id.slice(prefix.length);
    // `layout-card` names CardLayout, never Card.
    keys.add(normalizeName(prefix === 'layout-' ? `${rest}-layout` : rest));
  }
  return keys;
}

function shortName(pkg: string): string {
  return pkg.startsWith('@texuli/') ? pkg.slice('@texuli/'.length) : pkg;
}

function primarySubpath(subpaths: readonly string[]): string {
  const specific = subpaths.filter((subpath) => subpath !== '.');
  if (specific.length === 0) return '.';
  return [...specific].sort((a, b) => a.length - b.length || a.localeCompare(b))[0] as string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function label(row: { package: string; component: string }): string {
  return `${row.package} ${row.component}`;
}

/** Builds the matrix rows and summary from collected inputs (no I/O). */
export function buildCoverageMatrix(inputs: CoverageInputs): CoverageMatrix {
  const specById = new Map(inputs.spec.map((entry) => [entry.id, entry]));
  const loaderById = new Map(inputs.loaders.map((loader) => [loader.id, loader]));
  const playerRenderer = new Set(inputs.playerRendererIds);
  const catalogIds = new Set(
    inputs.manifests.filter((manifest) => manifest.source === 'catalog').map((m) => m.id)
  );
  const coveredPackages = new Set(inputs.components.map((component) => component.package));

  // Manifest → component keys: loader target first, then names within the package.
  const manifestsByKey = new Map<string, ManifestInput[]>();
  const matchedManifests = new Set<string>();
  const attach = (key: string, manifest: ManifestInput): void => {
    const list = manifestsByKey.get(key) ?? [];
    if (!list.includes(manifest)) list.push(manifest);
    manifestsByKey.set(key, list);
    matchedManifests.add(`${manifest.source}:${manifest.id}`);
  };
  for (const manifest of inputs.manifests) {
    const loaderKey = loaderById.get(manifest.id)?.componentKey;
    const loaded = loaderKey
      ? inputs.components.find((component) => component.key === loaderKey)
      : undefined;
    if (loaded) {
      attach(loaded.key, manifest);
      // A drop-in exported under the same public name by the same package
      // (`@texuli/charts/sparkline-lite` Sparkline next to the compact one)
      // takes the same props, so it shares the manifest.
      for (const component of inputs.components) {
        if (component.package === loaded.package && component.name === loaded.name) {
          attach(component.key, manifest);
        }
      }
      continue;
    }
    const painters = inputs.components.filter((component) =>
      component.paints.includes(manifest.id)
    );
    if (painters.length > 0) {
      for (const component of painters) attach(component.key, manifest);
      continue;
    }
    const keys = manifestKeys(manifest);
    for (const component of inputs.components) {
      if (component.package !== manifest.package) continue;
      if (component.aliases.some((alias) => keys.has(normalizeName(alias)))) {
        attach(component.key, manifest);
      }
    }
  }

  const rows: CoverageRow[] = inputs.components.map((component) => {
    const subpath = primarySubpath(component.subpaths);
    const manifests = [...(manifestsByKey.get(component.key) ?? [])].sort(
      (a, b) =>
        Number(b.source === 'catalog') - Number(a.source === 'catalog') || a.id.localeCompare(b.id)
    );
    const manifest = manifests[0] ?? null;
    const ids = manifests.map((entry) => entry.id);
    const spec = ids.map((id) => specById.get(id)).find((entry) => entry !== undefined) ?? null;
    const loaderId = ids.find((id) => loaderById.has(id)) ?? null;
    const renderer: string[] = [];
    if (ids.some((id) => catalogIds.has(id))) renderer.push('catalog');
    if (ids.some((id) => playerRenderer.has(id))) renderer.push('player');

    const short = shortName(component.package);
    const targets = new Set([
      ...component.aliases,
      ...component.subpaths.filter((entry) => entry !== '.').map((entry) => entry.slice(2)),
    ]);
    const examples = inputs.examples
      .filter((example) => {
        const slash = example.component.indexOf('/');
        return (
          example.component.slice(0, slash) === short &&
          targets.has(example.component.slice(slash + 1))
        );
      })
      .map((example) => example.id)
      .sort();

    const docs = findDoc(component, subpath, inputs.docs);
    return {
      package: component.package,
      subpath,
      subpaths: component.subpaths,
      component: component.name,
      kind: component.kind,
      file: component.file,
      manifest: manifest ? manifest.id : null,
      manifestSource: manifest ? manifest.source : null,
      specId: spec ? spec.id : null,
      capability: spec ? spec.capability : null,
      loader: loaderId,
      packageLoader: ids.find((id) => component.paints.includes(id)) ?? null,
      renderer,
      examples,
      docs,
    };
  });
  rows.sort(
    (a, b) =>
      a.package.localeCompare(b.package) ||
      a.subpath.localeCompare(b.subpath) ||
      a.component.localeCompare(b.component)
  );

  const perPackage: Record<string, number> = {};
  for (const pkg of coveredPackages) perPackage[pkg] = 0;
  const perKind: Record<ComponentKind, number> = { component: 0, compound: 0, lazy: 0 };
  for (const row of rows) {
    perPackage[row.package] = (perPackage[row.package] ?? 0) + 1;
    perKind[row.kind] += 1;
  }
  const capabilities: Record<string, number> = {};
  for (const entry of inputs.spec) {
    capabilities[entry.capability] = (capabilities[entry.capability] ?? 0) + 1;
  }
  const specIds = inputs.spec.map((entry) => entry.id).sort();
  const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();

  const summary: CoverageSummary = {
    components: rows.length,
    perPackage,
    perKind,
    columns: {
      manifest: rows.filter((row) => row.manifest !== null).length,
      catalogManifest: rows.filter((row) => row.manifestSource === 'catalog').length,
      specId: rows.filter((row) => row.specId !== null).length,
      capabilityKnown: rows.filter((row) => row.capability !== null && row.capability !== 'unknown')
        .length,
      loader: rows.filter((row) => row.loader !== null).length,
      packageLoader: rows.filter((row) => row.packageLoader !== null).length,
      renderer: rows.filter((row) => row.renderer.length > 0).length,
      example: rows.filter((row) => row.examples.length > 0).length,
      docs: rows.filter((row) => row.docs !== null).length,
    },
    spec: { ids: specIds.length, capabilities },
    loaders: inputs.loaders.length,
    manifests: {
      catalog: inputs.manifests.filter((manifest) => manifest.source === 'catalog').length,
      player: inputs.manifests.filter((manifest) => manifest.source === 'player').length,
    },
    gaps: {
      componentsWithoutManifest: rows.filter((row) => row.manifestSource !== 'catalog').map(label),
      componentsWithPlayerManifestOnly: rows
        .filter((row) => row.manifestSource === 'player')
        .map(label),
      componentsWithoutSpecId: rows.filter((row) => row.specId === null).map(label),
      componentsWithoutExample: rows.filter((row) => row.examples.length === 0).map(label),
      componentsWithoutDocs: rows.filter((row) => row.docs === null).map(label),
      manifestsWithoutComponent: sorted(
        inputs.manifests
          .filter(
            (manifest) =>
              coveredPackages.has(manifest.package) &&
              !matchedManifests.has(`${manifest.source}:${manifest.id}`)
          )
          .map((manifest) => `${manifest.id} (${manifest.package}, ${manifest.source})`)
      ),
      specIdsCapabilityUnknown: specIds.filter((id) => specById.get(id)?.capability === 'unknown'),
      loaderIdsWithoutSpecId: sorted(
        inputs.loaders.map((loader) => loader.id).filter((id) => !specById.has(id))
      ),
      specIdsWithoutLoader: specIds.filter((id) => !loaderById.has(id)),
      specIdsWithoutPlayerRenderer: specIds.filter((id) => !playerRenderer.has(id)),
      specIdsWithoutLoaderOrRenderer: specIds.filter(
        (id) => !loaderById.has(id) && !playerRenderer.has(id)
      ),
    },
  };
  return { rows, summary };
}

/** The package docs page for a component: by subpath file name, then by a mention. */
function findDoc(component: ComponentExport, subpath: string, docs: readonly DocInput[]) {
  const own = docs.filter((doc) => doc.package === component.package);
  const pages = own.filter((doc) => doc.file.includes('/docs/'));
  if (subpath !== '.') {
    const wanted = new Set([
      subpath.slice(2).replaceAll('/', '-'),
      subpath.slice(2).split('/').at(-1) ?? '',
    ]);
    const byName = pages.find((doc) => {
      let stem = basename(doc.file, '.md');
      for (const prefix of DOC_PREFIXES) {
        if (stem.startsWith(prefix)) stem = stem.slice(prefix.length);
      }
      return wanted.has(stem) || wanted.has(basename(doc.file, '.md'));
    });
    if (byName) return byName.file;
  }
  const names = component.aliases.filter((alias) => /^[A-Z]/.test(alias));
  if (names.length === 0) return null;
  const mention = new RegExp(`[<\`](?:${names.map(escapeRegExp).join('|')})\\b`);
  const readme = own.filter((doc) => !doc.file.includes('/docs/'));
  return [...pages, ...readme].find((doc) => mention.test(doc.text))?.file ?? null;
}

// ---------------------------------------------------------------------------
// Static export discovery (TypeScript AST)
// ---------------------------------------------------------------------------

type Binding =
  | { kind: 'svelte'; file: string }
  | { kind: 'compound'; file: string; members: { member: string; file: string }[] }
  | { kind: 'lazy'; file: string }
  | { kind: 'loaderMap'; entries: { id: string; file: string }[] }
  | { kind: 'other' };

interface ParsedModule {
  source: ts.SourceFile;
  imports: Map<string, { from: string; imported: string }>;
  declarations: Map<string, ts.Node>;
}

const OTHER: Binding = { kind: 'other' };

/** Resolves exports across the workspace; one instance per collection run. */
export class ExportResolver {
  readonly #root: string;
  readonly #packages = new Map<string, string>();
  readonly #parsed = new Map<string, ParsedModule>();
  readonly #exports = new Map<string, Map<string, Binding>>();
  readonly #inProgress = new Set<string>();

  constructor(root: string) {
    this.#root = root;
    const dir = join(root, 'packages');
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const manifest = join(dir, entry.name, 'package.json');
      if (!entry.isDirectory() || !existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string };
      if (pkg.name) this.#packages.set(pkg.name, join(dir, entry.name));
    }
  }

  /** `[subpath, absolute entry file]` for a workspace package's source exports. */
  entries(pkg: string): [string, string][] {
    const dir = this.#packages.get(pkg);
    if (!dir) return [];
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      exports?: Record<string, unknown>;
    };
    const out: [string, string][] = [];
    for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
      const target = exportTarget(value);
      if (target && /\.(ts|svelte)$/.test(target)) out.push([subpath, join(dir, target)]);
    }
    return out.sort(([a], [b]) => a.localeCompare(b));
  }

  /** Resolves a module specifier from `from` to an absolute file, or undefined. */
  resolveSpecifier(from: string, specifier: string): string | undefined {
    if (specifier.startsWith('.')) {
      const base = resolve(dirname(from), specifier);
      return [base, `${base}.ts`, join(base, 'index.ts')].find(
        (candidate) => existsSync(candidate) && /\.(ts|svelte)$/.test(candidate)
      );
    }
    const match = /^(@texuli\/[^/]+|texuli)(\/.*)?$/.exec(specifier);
    if (!match?.[1]) return undefined;
    const subpath = match[2] ? `.${match[2]}` : '.';
    return this.entries(match[1]).find(([entry]) => entry === subpath)?.[1];
  }

  /** Every runtime export binding of a module (memoized; cycles resolve to nothing). */
  exportsOf(file: string): Map<string, Binding> {
    const cached = this.#exports.get(file);
    if (cached) return cached;
    if (file.endsWith('.svelte')) {
      return new Map([['default', { kind: 'svelte', file }]]);
    }
    if (this.#inProgress.has(file)) return new Map();
    this.#inProgress.add(file);
    const out = new Map<string, Binding>();
    const module = this.#parse(file);
    const stars: string[] = [];
    for (const statement of module.source.statements) {
      if (ts.isExportDeclaration(statement)) {
        if (statement.isTypeOnly) continue;
        const from =
          statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
            ? statement.moduleSpecifier.text
            : undefined;
        if (!statement.exportClause) {
          if (from) stars.push(from);
          continue;
        }
        if (!ts.isNamedExports(statement.exportClause)) continue;
        for (const element of statement.exportClause.elements) {
          if (element.isTypeOnly) continue;
          const exported = element.name.text;
          const local = (element.propertyName ?? element.name).getText(module.source);
          out.set(
            exported,
            from ? this.#importBinding(file, from, local) : this.#localBinding(file, local)
          );
        }
        continue;
      }
      if (!hasExportModifier(statement)) continue;
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            out.set(declaration.name.text, this.#declarationBinding(file, declaration));
          }
        }
      } else if (ts.isFunctionDeclaration(statement) && statement.name) {
        out.set(statement.name.text, this.#declarationBinding(file, statement));
      }
    }
    for (const from of stars) {
      const target = this.resolveSpecifier(file, from);
      if (!target) continue;
      for (const [name, binding] of this.exportsOf(target)) {
        if (name !== 'default' && !out.has(name)) out.set(name, binding);
      }
    }
    this.#inProgress.delete(file);
    this.#exports.set(file, out);
    return out;
  }

  /**
   * Components an entry module registers or loads without exporting them
   * (`registerLayout('blog', { load: () => import('./BlogLayout.svelte') })`),
   * following its side-effect imports.
   */
  registeredComponents(file: string, seen: Set<string> = new Set()): string[] {
    if (file.endsWith('.svelte') || seen.has(file)) return [];
    seen.add(file);
    const module = this.#parse(file);
    const found = dynamicSvelteImports(module.source).flatMap((specifier) => {
      const target = this.resolveSpecifier(file, specifier);
      return target ? [target] : [];
    });
    for (const statement of module.source.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        !statement.importClause &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const target = this.resolveSpecifier(file, statement.moduleSpecifier.text);
        if (target) found.push(...this.registeredComponents(target, seen));
      }
    }
    return found;
  }

  relative(file: string): string {
    return relative(this.#root, file).split('\\').join('/');
  }

  #parse(file: string): ParsedModule {
    const cached = this.#parsed.get(file);
    if (cached) return cached;
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const imports = new Map<string, { from: string; imported: string }>();
    const declarations = new Map<string, ts.Node>();
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const clause = statement.importClause;
        if (!clause || clause.isTypeOnly) continue;
        const from = statement.moduleSpecifier.text;
        if (clause.name) imports.set(clause.name.text, { from, imported: 'default' });
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
          imports.set(bindings.name.text, { from, imported: '*' });
        } else if (bindings) {
          for (const element of bindings.elements) {
            if (element.isTypeOnly) continue;
            imports.set(element.name.text, {
              from,
              imported: (element.propertyName ?? element.name).getText(source),
            });
          }
        }
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name))
            declarations.set(declaration.name.text, declaration);
        }
      } else if (ts.isFunctionDeclaration(statement) && statement.name) {
        declarations.set(statement.name.text, statement);
      }
    }
    const parsed = { source, imports, declarations };
    this.#parsed.set(file, parsed);
    return parsed;
  }

  #importBinding(file: string, from: string, imported: string): Binding {
    const target = this.resolveSpecifier(file, from);
    if (!target || imported === '*') return OTHER;
    return this.exportsOf(target).get(imported) ?? OTHER;
  }

  #localBinding(file: string, local: string): Binding {
    const module = this.#parse(file);
    const imported = module.imports.get(local);
    if (imported) return this.#importBinding(file, imported.from, imported.imported);
    const declaration = module.declarations.get(local);
    return declaration ? this.#declarationBinding(file, declaration) : OTHER;
  }

  /** `{ 'chat-thread': async () => (await import('./X.svelte')).default }` → id/file pairs. */
  #loaderMap(file: string, value: ts.ObjectLiteralExpression): { id: string; file: string }[] {
    const entries: { id: string; file: string }[] = [];
    for (const property of value.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)) continue;
      const specifier = dynamicSvelteImports(property.initializer)[0];
      const target = specifier ? this.resolveSpecifier(file, specifier) : undefined;
      if (target) entries.push({ id: property.name.text, file: target });
    }
    return entries;
  }

  #declarationBinding(file: string, node: ts.Node): Binding {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const value = unwrap(node.initializer);
      if (ts.isIdentifier(value)) return this.#localBinding(file, value.text);
      const map = ts.isObjectLiteralExpression(value) ? this.#loaderMap(file, value) : [];
      if (map.length > 0) return { kind: 'loaderMap', entries: map };
      if (ts.isObjectLiteralExpression(value)) {
        const members: { member: string; file: string }[] = [];
        for (const property of value.properties) {
          let member: string | undefined;
          let reference: string | undefined;
          if (ts.isPropertyAssignment(property) && ts.isIdentifier(unwrap(property.initializer))) {
            member = property.name.getText(this.#parse(file).source);
            reference = (unwrap(property.initializer) as ts.Identifier).text;
          } else if (ts.isShorthandPropertyAssignment(property)) {
            member = property.name.text;
            reference = property.name.text;
          }
          if (!member || !reference) continue;
          const binding = this.#localBinding(file, reference);
          if (binding.kind === 'svelte') members.push({ member, file: binding.file });
        }
        if (members.length > 0) return { kind: 'compound', file, members };
        return OTHER;
      }
    }
    const lazy = dynamicSvelteImports(node)
      .map((specifier) => this.resolveSpecifier(file, specifier))
      .find((target) => target !== undefined);
    return lazy ? { kind: 'lazy', file: lazy } : OTHER;
  }
}

function exportTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const condition of ['svelte', 'default', 'types']) {
    const target = record[condition];
    if (typeof target === 'string') return target;
  }
  return undefined;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  for (;;) {
    if (
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
    } else if (
      ts.isCallExpression(current) &&
      current.expression.getText() === 'Object.freeze' &&
      current.arguments.length === 1 &&
      current.arguments[0]
    ) {
      current = current.arguments[0];
    } else {
      return current;
    }
  }
}

/** String specifiers of `import('….svelte')` calls under `node`. */
function dynamicSvelteImports(node: ts.Node): string[] {
  const found: string[] = [];
  const visit = (child: ts.Node): void => {
    if (
      ts.isCallExpression(child) &&
      child.expression.kind === ts.SyntaxKind.ImportKeyword &&
      child.arguments[0] &&
      ts.isStringLiteralLike(child.arguments[0]) &&
      child.arguments[0].text.endsWith('.svelte')
    ) {
      found.push(child.arguments[0].text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

interface Draft {
  package: string;
  file: string;
  subpaths: Set<string>;
  direct: Set<string>;
  dotted: Set<string>;
  loaders: Set<string>;
  paints: Set<string>;
  compound?: string;
}

/** Discovers every exported Svelte component of one package. */
export function discoverComponents(resolver: ExportResolver, pkg: string): ComponentExport[] {
  const drafts = new Map<string, Draft>();
  const draft = (key: string, file: string): Draft => {
    let existing = drafts.get(key);
    if (!existing) {
      existing = {
        package: pkg,
        file,
        subpaths: new Set(),
        direct: new Set(),
        dotted: new Set(),
        loaders: new Set(),
        paints: new Set(),
      };
      drafts.set(key, existing);
    }
    return existing;
  };
  for (const [subpath, entry] of resolver.entries(pkg)) {
    for (const [name, binding] of resolver.exportsOf(entry)) {
      if (binding.kind === 'svelte') {
        const row = draft(binding.file, binding.file);
        row.subpaths.add(subpath);
        if (name !== 'default') row.direct.add(name);
      } else if (binding.kind === 'lazy') {
        const row = draft(binding.file, binding.file);
        row.subpaths.add(subpath);
        row.loaders.add(name);
      } else if (binding.kind === 'loaderMap') {
        for (const entry of binding.entries) {
          const row = draft(entry.file, entry.file);
          row.subpaths.add(subpath);
          row.paints.add(entry.id);
        }
      } else if (binding.kind === 'compound') {
        const row = draft(`${binding.file}#${name}`, binding.file);
        row.subpaths.add(subpath);
        row.compound = name;
        for (const member of binding.members) {
          const part = draft(member.file, member.file);
          part.subpaths.add(subpath);
          part.dotted.add(`${name}.${member.member}`);
        }
      }
    }
    for (const file of resolver.registeredComponents(entry)) {
      draft(file, file).subpaths.add(subpath);
    }
  }
  return [...drafts.entries()].map(([key, row]) => {
    const fileName = basename(row.file).replace(/\.(svelte|ts)$/, '');
    const direct = [...row.direct].sort();
    const dotted = [...row.dotted].sort();
    let name: string;
    let kind: ComponentKind;
    if (row.compound) {
      name = row.compound;
      kind = 'compound';
    } else if (direct.length > 0) {
      name = direct.includes(fileName) ? fileName : (direct[0] as string);
      kind = 'component';
    } else if (dotted.length > 0) {
      name = dotted[0] as string;
      kind = 'component';
    } else {
      name = fileName;
      kind = 'lazy';
    }
    const aliases = row.compound
      ? [row.compound]
      : [...new Set([...direct, ...dotted, fileName, ...row.loaders])];
    return {
      key: `${pkg}::${resolver.relative(row.file)}${row.compound ? `#${row.compound}` : ''}`,
      package: pkg,
      subpaths: [...row.subpaths].sort(),
      name,
      aliases,
      kind,
      file: resolver.relative(key.split('#')[0] as string),
      paints: [...row.paints].sort(),
    };
  });
}

// ---------------------------------------------------------------------------
// Collection (file system and module imports)
// ---------------------------------------------------------------------------

interface ManifestLike {
  id: string;
  package: string;
  label: string;
  agentEmittable?: boolean;
}

/** Reads every source the matrix needs. Offline; imports only data and manifest modules. */
export async function collectCoverageInputs(root: string = DEFAULT_ROOT): Promise<CoverageInputs> {
  const resolver = new ExportResolver(root);
  const components = COMPONENT_PACKAGES.flatMap((pkg) => discoverComponents(resolver, pkg.name));
  const load = async <T>(path: string): Promise<T> =>
    (await import(pathToFileURL(join(root, path)).href)) as T;

  const build = await load<{
    discoverManifestGroups: () => Promise<{ manifests: ManifestLike[] }[]>;
    manifestsOf: (module: Record<string, unknown>) => ManifestLike[];
  }>('packages/catalog/src/build/node.ts');
  const toInput = (manifest: ManifestLike, source: 'catalog' | 'player'): ManifestInput => ({
    id: manifest.id,
    package: manifest.package,
    label: manifest.label,
    source,
    agentEmittable: manifest.agentEmittable === true,
  });
  const manifests: ManifestInput[] = (await build.discoverManifestGroups()).flatMap((group) =>
    group.manifests.map((manifest) => toInput(manifest, 'catalog'))
  );
  const playerSrc = join(root, 'packages/player/src');
  const catalogIds = new Set(manifests.map((manifest) => manifest.id));
  for (const file of readdirSync(playerSrc)
    .filter((name) => name.endsWith('-manifests.ts'))
    .sort()) {
    const module = await load<Record<string, unknown>>(`packages/player/src/${file}`);
    for (const manifest of build.manifestsOf(module)) {
      if (!catalogIds.has(manifest.id)) manifests.push(toInput(manifest, 'player'));
    }
  }

  const specFile = JSON.parse(
    readFileSync(join(root, 'packages/spec/catalog/components.json'), 'utf8')
  ) as { components: SpecInput[] };
  const spec = specFile.components.map((entry) => ({
    id: entry.id,
    label: entry.label,
    group: entry.group,
    capability: entry.capability,
  }));

  const { PLAYER_LOADERS } = await load<{ PLAYER_LOADERS: Record<string, unknown> }>(
    'packages/player/src/loaders.ts'
  );
  const loaderTargets = loaderTargetsOf(join(playerSrc, 'loaders.ts'));
  const keys = new Set(components.map((component) => component.key));
  const loaders: LoaderInput[] = Object.keys(PLAYER_LOADERS)
    .sort()
    .map((id) => {
      const target = loaderTargets.get(id) ?? '';
      const [specifier = '', member = ''] = target.split('#');
      const pkg = /^(@texuli\/[^/]+|texuli)/.exec(specifier)?.[1];
      const entry = pkg ? resolver.resolveSpecifier(join(playerSrc, 'loaders.ts'), specifier) : '';
      const binding = entry ? resolver.exportsOf(entry).get(member) : undefined;
      const file = binding && 'file' in binding ? binding.file : undefined;
      const key = file && pkg ? `${pkg}::${resolver.relative(file)}` : undefined;
      return key && keys.has(key) ? { id, target, componentKey: key } : { id, target };
    });

  const { createPlayerCatalog } = await load<{
    createPlayerCatalog: () => { get(id: string): unknown };
  }>('packages/player/src/catalog.ts');
  const playerCatalog = createPlayerCatalog();
  const candidates = new Set([
    ...spec.map((entry) => entry.id),
    ...manifests.map((manifest) => manifest.id),
    ...loaders.map((loader) => loader.id),
  ]);
  const playerRendererIds = [...candidates].filter((id) => playerCatalog.get(id) !== undefined);

  const { listExamples } = await load<{
    listExamples: () => { id: string; component: string }[];
  }>('packages/examples/src/index.ts');
  const examples = listExamples().map((example) => ({
    id: example.id,
    component: example.component,
  }));

  const docs: DocInput[] = [];
  for (const pkg of COMPONENT_PACKAGES) {
    const dir = join(root, 'packages', pkg.dir);
    const docsDir = join(dir, 'docs');
    const files = existsSync(docsDir)
      ? readdirSync(docsDir)
          .filter((name) => name.endsWith('.md'))
          .sort()
          .map((name) => join(docsDir, name))
      : [];
    if (existsSync(join(dir, 'README.md'))) files.push(join(dir, 'README.md'));
    for (const file of files) {
      docs.push({
        package: pkg.name,
        file: resolver.relative(file),
        text: readFileSync(file, 'utf8'),
      });
    }
  }

  return {
    components,
    manifests,
    spec,
    loaders,
    playerRendererIds: playerRendererIds.sort(),
    examples,
    docs,
  };
}

/** `id → '<specifier>#<export>'` from the loader map source. */
function loaderTargetsOf(file: string): Map<string, string> {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const out = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) {
      const text = node.initializer.getText(source);
      const match = /import\(\s*'([^']+)'\s*\)\s*\)\s*\.(\w+)/.exec(text);
      if (match) out.set(node.name.text, `${match[1]}#${match[2]}`);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** Collects the inputs and builds the matrix. */
export async function coverageMatrix(root: string = DEFAULT_ROOT): Promise<CoverageMatrix> {
  return buildCoverageMatrix(await collectCoverageInputs(root));
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const cell = (value: string | null | undefined): string =>
  value ? value.replaceAll('|', '\\|') : '—';

function list(title: string, values: readonly string[]): string {
  if (values.length === 0) return `### ${title} (0)\n\nNone.\n`;
  return `### ${title} (${values.length})\n\n${values.map((value) => `- ${value}`).join('\n')}\n`;
}

/** Renders the matrix as Markdown: summary, gap lists, then one table per package. */
export function renderMarkdown(matrix: CoverageMatrix): string {
  const { summary, rows } = matrix;
  const c = summary.columns;
  const out: string[] = [
    '# JSON coverage matrix',
    '',
    'Generated by `pnpm exec tsx scripts/coverage-matrix.ts` (offline, read-only). Components are discovered from each package.json `exports`; manifests are matched by player loader target (shared by a same-named export of that package), then by a loader map the package exports, else by name. Do not edit by hand.',
    '',
    '## Summary',
    '',
    '| Measure | Count |',
    '| --- | --- |',
    `| Exported components | ${summary.components} (component ${summary.perKind.component}, compound ${summary.perKind.compound}, lazy ${summary.perKind.lazy}) |`,
    ...Object.entries(summary.perPackage).map(([pkg, count]) => `| — ${pkg} | ${count} |`),
    `| With a catalog manifest | ${c.catalogManifest} |`,
    `| With any manifest (catalog or player-held) | ${c.manifest} |`,
    `| With a spec id | ${c.specId} |`,
    `| With a known capability | ${c.capabilityKnown} |`,
    `| With a player loader | ${c.loader} |`,
    `| With a package-owned loader map entry | ${c.packageLoader} |`,
    `| With a render-catalog entry | ${c.renderer} |`,
    `| With an example | ${c.example} |`,
    `| With a docs entry | ${c.docs} |`,
    `| Spec ids | ${summary.spec.ids} (${Object.entries(summary.spec.capabilities)
      .map(([capability, count]) => `${capability}: ${count}`)
      .join(', ')}) |`,
    `| Player loaders | ${summary.loaders} |`,
    `| Manifests | catalog ${summary.manifests.catalog}, player-held ${summary.manifests.player} |`,
    '',
    '## Gaps',
    '',
    list('Loader ids with no spec id', summary.gaps.loaderIdsWithoutSpecId),
    list('Spec ids with no player loader', summary.gaps.specIdsWithoutLoader),
    list(
      'Spec ids with no loader and no Player render-catalog entry',
      summary.gaps.specIdsWithoutLoaderOrRenderer
    ),
    list('Spec ids with capability unknown', summary.gaps.specIdsCapabilityUnknown),
    list('Manifests matched to no exported component', summary.gaps.manifestsWithoutComponent),
    list(
      'Components whose only manifest is player-held',
      summary.gaps.componentsWithPlayerManifestOnly
    ),
    list('Components with no catalog manifest', summary.gaps.componentsWithoutManifest),
    list('Components with no example', summary.gaps.componentsWithoutExample),
    list('Components with no docs entry', summary.gaps.componentsWithoutDocs),
    '## Matrix',
    '',
  ];
  for (const pkg of Object.keys(summary.perPackage)) {
    out.push(`### ${pkg}`, '');
    out.push(
      '| Subpath | Component | Kind | Manifest | Spec id | Capability | Loader | Renderer | Example | Docs |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
    );
    for (const row of rows.filter((entry) => entry.package === pkg)) {
      const manifest = row.manifest
        ? `${row.manifest}${row.manifestSource === 'player' ? ' (player)' : ''}`
        : null;
      const examples =
        row.examples.length > 2
          ? `${row.examples.slice(0, 2).join(', ')} +${row.examples.length - 2}`
          : row.examples.join(', ');
      out.push(
        `| ${cell(row.subpath)} | ${cell(row.component)} | ${row.kind} | ${cell(manifest)} | ${cell(row.specId)} | ${cell(row.capability)} | ${cell(row.loader ?? (row.packageLoader ? `(package) ${row.packageLoader}` : null))} | ${cell(row.renderer.join('+'))} | ${cell(examples)} | ${cell(row.docs)} |`
      );
    }
    out.push('');
  }
  return `${out.join('\n').trimEnd()}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(argv: readonly string[]): Promise<number> {
  let json = false;
  let outFile: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') json = true;
    else if (arg === '--out' && argv[index + 1]) {
      outFile = argv[index + 1];
      index += 1;
    } else {
      console.error('Usage: tsx scripts/coverage-matrix.ts [--json] [--out <file>]');
      return 2;
    }
  }
  const matrix = await coverageMatrix();
  const text = json ? `${JSON.stringify(matrix, null, 2)}\n` : renderMarkdown(matrix);
  if (outFile) {
    writeFileSync(resolve(outFile), text);
    console.log(`coverage matrix: ${matrix.summary.components} components → ${outFile}`);
  } else {
    process.stdout.write(text);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}

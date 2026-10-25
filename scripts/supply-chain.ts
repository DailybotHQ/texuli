/**
 * Supply chain gates for the Texuli monorepo:
 * - runtime dependency allowlist (ARCHITECTURE.md)
 * - license check on direct external deps
 * - no npm install lifecycle scripts in workspace manifests
 * - CycloneDX 1.5 SBOM for direct workspace components + external deps
 *
 * Local filesystem only. Does not install, publish or call the network.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Lifecycle script names that must not appear in any workspace package.json. */
export const FORBIDDEN_LIFECYCLE_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'preuninstall',
  'uninstall',
  'postuninstall',
] as const;

/**
 * Packages that must never appear in `dependencies` / `optionalDependencies`
 * of any workspace package (including the root).
 */
export const BANNED_RUNTIME_PACKAGES = [
  'clsx',
  'tailwind-merge',
  'tailwind-variants',
  '@floating-ui/dom',
  '@floating-ui/core',
  '@floating-ui/utils',
] as const;

/** SPDX licenses allowed on direct external dependencies. */
export const ALLOWED_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'BlueOak-1.0.0',
]);

/**
 * External packages allowed as runtime (`dependencies`) by workspace package
 * name. Workspace (`workspace:*`) and `svelte` peers are handled separately.
 * Apps may list more than library packages.
 */
export const RUNTIME_EXTERNAL_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  '@texuli/core': [],
  '@texuli/tokens': [],
  '@texuli/primitives': ['@internationalized/date'],
  texuli: [],
  '@texuli/charts': [],
  '@texuli/chat': [],
  // @texuli/editor has only internal runtime deps; it stays private
  // (NEVER_PACKED) until its own release.
  '@texuli/editor': [],
  '@texuli/data': [],
  '@texuli/media': [],
  '@texuli/blocks': [],
  '@texuli/catalog': [],
  '@texuli/tools': [],
  '@texuli/astro': ['astro'],
  '@texuli/slides': [],
  '@texuli/spec': [],
  '@texuli/player': [],
  '@texuli/agent': [],
  '@texuli/examples': [],
  '@texuli/website': ['astro', '@astrojs/check', '@astrojs/svelte'],
  'texuli-workspace': [],
};

export type WorkspaceManifest = {
  name?: string;
  version?: string;
  private?: boolean;
  license?: string;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export type WorkspacePackage = {
  /** Path relative to the repo root. */
  dir: string;
  absDir: string;
  manifest: WorkspaceManifest;
  name: string;
};

export type SupplyFinding = {
  package: string;
  code: string;
  message: string;
};

export type SbomComponent = {
  type: 'library' | 'application' | 'framework';
  'bom-ref': string;
  name: string;
  version?: string;
  description?: string;
  licenses?: Array<{ license: { id: string } }>;
  purl?: string;
  scope?: 'required' | 'optional' | 'excluded';
  properties?: Array<{ name: string; value: string }>;
};

export type CycloneDxBom = {
  bomFormat: 'CycloneDX';
  specVersion: '1.5';
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: Array<{ vendor: string; name: string; version: string }>;
    component: SbomComponent;
  };
  components: SbomComponent[];
  dependencies: Array<{ ref: string; dependsOn: string[] }>;
};

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export function isWorkspaceRange(range: string): boolean {
  return range === 'workspace:*' || range.startsWith('workspace:');
}

export function isSveltePeer(name: string): boolean {
  return name === 'svelte';
}

export function isInternalName(name: string): boolean {
  return name === 'texuli' || name.startsWith('@texuli/') || name === 'texuli-workspace';
}

/** True when a license string is allowed (handles "MIT OR Apache-2.0"). */
export function licenseAllowed(license: string | undefined): boolean {
  if (!license || license === 'UNLICENSED') return false;
  const parts = license.split(/\s+OR\s+|\s+AND\s+|\/|\s*,\s*/i).map((p) => p.trim());
  return parts.every((part) => ALLOWED_LICENSES.has(part) || part === 'MIT');
}

export function listPackageJsonDirs(root: string = REPO_ROOT): string[] {
  const dirs: string[] = [root];
  for (const group of ['packages', 'apps'] as const) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const dir = join(base, name.name);
      if (existsSync(join(dir, 'package.json'))) dirs.push(dir);
    }
  }
  return dirs;
}

export function readWorkspace(root: string = REPO_ROOT): WorkspacePackage[] {
  const out: WorkspacePackage[] = [];
  for (const absDir of listPackageJsonDirs(root)) {
    const raw = readFileSync(join(absDir, 'package.json'), 'utf8');
    const manifest = JSON.parse(raw) as WorkspaceManifest;
    const name = manifest.name ?? (relative(root, absDir) || 'texuli-workspace');
    out.push({
      dir: relative(root, absDir) || '.',
      absDir,
      manifest,
      name,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolve a package.json for an installed dependency from the pnpm store layout.
 * Returns null when the package is not installed (tests still run offline).
 */
export function resolveInstalledPackageJson(
  packageName: string,
  root: string = REPO_ROOT
): { path: string; manifest: WorkspaceManifest } | null {
  const direct = join(root, 'node_modules', ...packageName.split('/'), 'package.json');
  if (existsSync(direct)) {
    return {
      path: direct,
      manifest: JSON.parse(readFileSync(direct, 'utf8')) as WorkspaceManifest,
    };
  }
  const pnpm = join(root, 'node_modules', '.pnpm');
  if (!existsSync(pnpm)) return null;
  const needle = packageName.startsWith('@') ? packageName.replace('/', '+') : packageName;
  for (const entry of readdirSync(pnpm)) {
    if (!entry.startsWith(`${needle}@`) && !entry.startsWith(`${needle}+`)) continue;
    const candidate = join(pnpm, entry, 'node_modules', ...packageName.split('/'), 'package.json');
    if (existsSync(candidate)) {
      return {
        path: candidate,
        manifest: JSON.parse(readFileSync(candidate, 'utf8')) as WorkspaceManifest,
      };
    }
  }
  return null;
}

export function checkLifecycleScripts(packages: readonly WorkspacePackage[]): SupplyFinding[] {
  const findings: SupplyFinding[] = [];
  for (const pkg of packages) {
    const scripts = pkg.manifest.scripts ?? {};
    for (const name of FORBIDDEN_LIFECYCLE_SCRIPTS) {
      if (Object.hasOwn(scripts, name)) {
        findings.push({
          package: pkg.name,
          code: 'lifecycle-script',
          message: `forbidden lifecycle script "${name}"`,
        });
      }
    }
  }
  return findings;
}

export function checkBannedRuntime(packages: readonly WorkspacePackage[]): SupplyFinding[] {
  const findings: SupplyFinding[] = [];
  for (const pkg of packages) {
    for (const field of ['dependencies', 'optionalDependencies'] as const) {
      const block = pkg.manifest[field] ?? {};
      for (const banned of BANNED_RUNTIME_PACKAGES) {
        if (Object.hasOwn(block, banned)) {
          findings.push({
            package: pkg.name,
            code: 'banned-runtime',
            message: `${field} must not include ${banned}`,
          });
        }
      }
    }
  }
  return findings;
}

export function checkRuntimeAllowlist(packages: readonly WorkspacePackage[]): SupplyFinding[] {
  const findings: SupplyFinding[] = [];
  const names = new Set(packages.map((p) => p.name));

  for (const pkg of packages) {
    const allow = RUNTIME_EXTERNAL_ALLOWLIST[pkg.name];
    if (allow === undefined) {
      findings.push({
        package: pkg.name,
        code: 'allowlist-missing',
        message: 'package has no runtime external allowlist entry',
      });
      continue;
    }
    const deps = pkg.manifest.dependencies ?? {};
    for (const [dep, range] of Object.entries(deps)) {
      if (isWorkspaceRange(range) || isInternalName(dep)) {
        // Internal deps may be pinned to exact reserved versions
        // (0.1.0-next.1) instead of workspace: ranges; they are still
        // workspace packages, resolved by the workspace, not externals.
        if (!isInternalName(dep) && !names.has(dep)) {
          findings.push({
            package: pkg.name,
            code: 'workspace-unknown',
            message: `workspace dependency ${dep} is not a workspace package`,
          });
        }
        continue;
      }
      if (isSveltePeer(dep)) {
        // svelte may appear in dependencies on some packages; prefer peer, but allow.
        continue;
      }
      if (!allow.includes(dep)) {
        findings.push({
          package: pkg.name,
          code: 'runtime-not-allowed',
          message: `dependencies includes ${dep}@${range}, not on the allowlist`,
        });
      }
    }
  }
  return findings;
}

export function checkPackageLicenses(packages: readonly WorkspacePackage[]): SupplyFinding[] {
  const findings: SupplyFinding[] = [];
  for (const pkg of packages) {
    const license = pkg.manifest.license;
    if (!licenseAllowed(license)) {
      findings.push({
        package: pkg.name,
        code: 'package-license',
        message: `workspace package license must be MIT-compatible (got ${license ?? 'missing'})`,
      });
    }
  }
  return findings;
}

export function checkExternalLicenses(
  packages: readonly WorkspacePackage[],
  root: string = REPO_ROOT
): SupplyFinding[] {
  const findings: SupplyFinding[] = [];
  const seen = new Set<string>();

  for (const pkg of packages) {
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      const block = pkg.manifest[field] ?? {};
      for (const [dep, range] of Object.entries(block)) {
        if (isWorkspaceRange(range) || isInternalName(dep)) continue;
        if (seen.has(dep)) continue;
        seen.add(dep);
        const installed = resolveInstalledPackageJson(dep, root);
        if (!installed) {
          findings.push({
            package: pkg.name,
            code: 'license-unresolved',
            message: `could not resolve installed package.json for ${dep}`,
          });
          continue;
        }
        const license = installed.manifest.license;
        if (!licenseAllowed(typeof license === 'string' ? license : undefined)) {
          findings.push({
            package: pkg.name,
            code: 'external-license',
            message: `${dep} license ${JSON.stringify(license)} is not on the allowlist`,
          });
        }
      }
    }
  }
  return findings;
}

export function collectFindings(
  packages: readonly WorkspacePackage[],
  root: string = REPO_ROOT
): SupplyFinding[] {
  return [
    ...checkLifecycleScripts(packages),
    ...checkBannedRuntime(packages),
    ...checkRuntimeAllowlist(packages),
    ...checkPackageLicenses(packages),
    ...checkExternalLicenses(packages, root),
  ];
}

function purl(name: string, version: string | undefined): string | undefined {
  if (!version) return undefined;
  if (name.startsWith('@')) {
    const [scope, pkg] = name.slice(1).split('/');
    return `pkg:npm/%40${scope}/${pkg}@${version}`;
  }
  return `pkg:npm/${name}@${version}`;
}

function componentFromWorkspace(pkg: WorkspacePackage): SbomComponent {
  const version = pkg.manifest.version ?? '0.0.0';
  return {
    type: pkg.dir === '.' ? 'application' : 'library',
    'bom-ref': `workspace:${pkg.name}@${version}`,
    name: pkg.name,
    version,
    description:
      typeof pkg.manifest.description === 'string' ? pkg.manifest.description : undefined,
    licenses: pkg.manifest.license
      ? [{ license: { id: String(pkg.manifest.license) } }]
      : undefined,
    purl: purl(pkg.name, version),
    scope: 'required',
    properties: [
      { name: 'texuli:dir', value: pkg.dir },
      { name: 'texuli:private', value: String(pkg.manifest.private ?? false) },
    ],
  };
}

function componentFromExternal(
  name: string,
  version: string | undefined,
  license: string | undefined,
  scope: 'required' | 'optional' | 'excluded'
): SbomComponent {
  return {
    type: 'library',
    'bom-ref': `npm:${name}@${version ?? 'unknown'}`,
    name,
    version,
    licenses: license ? [{ license: { id: license } }] : undefined,
    purl: purl(name, version),
    scope,
  };
}

export function buildCycloneDxBom(
  packages: readonly WorkspacePackage[],
  root: string = REPO_ROOT,
  options: { timestamp?: string } = {}
): CycloneDxBom {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const workspaceComponents = packages.map(componentFromWorkspace);
  const external = new Map<string, SbomComponent>();
  const dependencyEdges: Array<{ ref: string; dependsOn: string[] }> = [];

  for (const pkg of packages) {
    const selfRef = `workspace:${pkg.name}@${pkg.manifest.version ?? '0.0.0'}`;
    const dependsOn: string[] = [];

    const addDep = (name: string, range: string, scope: 'required' | 'optional' | 'excluded') => {
      if (isWorkspaceRange(range) || isInternalName(name)) {
        const target = packages.find((p) => p.name === name);
        const ver = target?.manifest.version ?? '0.0.0';
        dependsOn.push(`workspace:${name}@${ver}`);
        return;
      }
      const installed = resolveInstalledPackageJson(name, root);
      const version =
        (typeof installed?.manifest.version === 'string'
          ? installed.manifest.version
          : undefined) ??
        (range.replace(/^[\^~>=<\s]+/, '') || undefined);
      const license =
        typeof installed?.manifest.license === 'string' ? installed.manifest.license : undefined;
      const ref = `npm:${name}@${version ?? 'unknown'}`;
      if (!external.has(name)) {
        external.set(name, componentFromExternal(name, version, license, scope));
      }
      dependsOn.push(ref);
    };

    for (const [name, range] of Object.entries(pkg.manifest.dependencies ?? {})) {
      addDep(name, range, 'required');
    }
    for (const [name, range] of Object.entries(pkg.manifest.optionalDependencies ?? {})) {
      addDep(name, range, 'optional');
    }
    for (const [name, range] of Object.entries(pkg.manifest.peerDependencies ?? {})) {
      addDep(name, range, 'required');
    }
    // Dev dependencies of the root only (tooling) — excluded scope.
    if (pkg.dir === '.') {
      for (const [name, range] of Object.entries(pkg.manifest.devDependencies ?? {})) {
        if (isInternalName(name) || isWorkspaceRange(range)) continue;
        addDep(name, range, 'excluded');
      }
    }

    dependencyEdges.push({ ref: selfRef, dependsOn: [...new Set(dependsOn)].sort() });
  }

  const components = [
    ...workspaceComponents,
    ...[...external.values()].sort((a, b) => a.name.localeCompare(b.name)),
  ];

  const serialSeed = createHash('sha256')
    .update(components.map((c) => c['bom-ref']).join('|'))
    .digest('hex')
    .slice(0, 32);
  const serialNumber = `urn:uuid:${serialSeed.slice(0, 8)}-${serialSeed.slice(8, 12)}-${serialSeed.slice(12, 16)}-${serialSeed.slice(16, 20)}-${serialSeed.slice(20, 32)}`;

  const rootPkg =
    packages.find((p) => p.dir === '.') ??
    packages[0] ??
    ({
      name: 'texuli-workspace',
      dir: '.',
      absDir: root,
      manifest: { name: 'texuli-workspace', version: '0.0.0', license: 'MIT' },
    } satisfies WorkspacePackage);
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber,
    version: 1,
    metadata: {
      timestamp,
      tools: [{ vendor: 'Dailybot', name: 'texuli-supply-chain', version: '0.0.0' }],
      component: componentFromWorkspace(rootPkg),
    },
    components,
    dependencies: dependencyEdges.sort((a, b) => a.ref.localeCompare(b.ref)),
  };
}

export function defaultSbomPath(root: string = REPO_ROOT): string {
  return join(root, 'tmp', 'supply-chain', 'sbom.cdx.json');
}

export function writeSbom(bom: CycloneDxBom, path: string = defaultSbomPath()): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(bom, null, 2)}\n`, 'utf8');
  return path;
}

export function runSupplyChain(root: string = REPO_ROOT): {
  findings: SupplyFinding[];
  bom: CycloneDxBom;
  sbomPath: string;
  packages: WorkspacePackage[];
} {
  const packages = readWorkspace(root);
  const findings = collectFindings(packages, root);
  const bom = buildCycloneDxBom(packages, root);
  const sbomPath = writeSbom(bom, defaultSbomPath(root));
  return { findings, bom, sbomPath, packages };
}

function main(argv: string[]): number {
  const json = argv.includes('--json');
  const { findings, bom, sbomPath, packages } = runSupplyChain(REPO_ROOT);
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ ok: findings.length === 0, findings, sbomPath, packages: packages.length, components: bom.components.length }, null, 2)}\n`
    );
  } else {
    process.stdout.write(
      `supply-chain: ${packages.length} packages, ${bom.components.length} SBOM components → ${relative(REPO_ROOT, sbomPath)}\n`
    );
    if (findings.length === 0) {
      process.stdout.write('supply-chain: ok\n');
    } else {
      for (const f of findings) {
        process.stderr.write(`supply-chain: ${f.package}: ${f.code}: ${f.message}\n`);
      }
    }
  }
  return findings.length === 0 ? 0 : 1;
}

const isCli =
  typeof process.argv[1] === 'string' &&
  /supply-chain\.(ts|js|mjs|cjs)$/.test(process.argv[1].replace(/\\/g, '/'));
if (isCli) {
  process.exit(main(process.argv.slice(2)));
}

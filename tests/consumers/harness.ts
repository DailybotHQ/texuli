/// <reference types="node" />
/**
 * Pack Texuli library packages and install them into consumer fixtures.
 * Uses scripts/packages.ts (same path as `pnpm verify:packages`).
 *
 * Install policy (T-quality-supply-chain + FIX-consumers-install):
 * - no `--legacy-peer-deps` (peer errors must surface; fix peers on Texuli packages)
 * - `--ignore-scripts` (no install lifecycle scripts)
 * - `--prefer-offline` (reproducible once the npm cache is warm)
 * - third-party versions are exact pins in fixtures (no ^ / ~)
 *
 * Typecheck (FIX-css-types-ship): Vite and SvelteKit fixtures run svelte-check
 * and tsc --noEmit against packed tarballs with no consumer-local *.css ambient.
 */
import { execFile } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { verifyPackages } from '../../scripts/packages.ts';

const execFileAsync = promisify(execFile);

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Packages required for the smoke consumer (each major layer + data). */
export const CONSUMER_PACK_FILTER = ['core', 'tokens', 'primitives', 'texuli', 'data'] as const;

/** Texuli packages that must resolve from packed file: tarballs after install. */
export const TEXULI_INSTALL_NAMES = [
  '@texuli/core',
  '@texuli/tokens',
  '@texuli/primitives',
  'texuli',
  '@texuli/data',
] as const;

const ASTRO_TRANSITIVE_PACKAGES = [
  '@texuli/astro',
  '@texuli/blocks',
  '@texuli/charts',
  '@texuli/media',
] as const;

/** Frameworks that run svelte-check + tsc against packed tarballs. */
export const TYPECHECK_FRAMEWORKS = ['vite', 'sveltekit'] as const;

export type ConsumerKind =
  | 'vite-plain'
  | 'vite-tailwind'
  | 'astro-plain'
  | 'astro-tailwind'
  | 'sveltekit-plain'
  | 'sveltekit-tailwind';

export interface ConsumerDef {
  id: ConsumerKind;
  framework: 'vite' | 'astro' | 'sveltekit';
  tailwind: boolean;
  /** Relative path under tests/consumers/fixtures. */
  fixture: string;
}

export const CONSUMERS: readonly ConsumerDef[] = [
  { id: 'vite-plain', framework: 'vite', tailwind: false, fixture: 'vite-plain' },
  { id: 'vite-tailwind', framework: 'vite', tailwind: true, fixture: 'vite-tailwind' },
  { id: 'astro-plain', framework: 'astro', tailwind: false, fixture: 'astro-plain' },
  { id: 'astro-tailwind', framework: 'astro', tailwind: true, fixture: 'astro-tailwind' },
  { id: 'sveltekit-plain', framework: 'sveltekit', tailwind: false, fixture: 'sveltekit-plain' },
  {
    id: 'sveltekit-tailwind',
    framework: 'sveltekit',
    tailwind: true,
    fixture: 'sveltekit-tailwind',
  },
];

export interface TarballMap {
  core: string;
  tokens: string;
  primitives: string;
  texuli: string;
  data: string;
  astro: string;
  blocks: string;
  charts: string;
  media: string;
  /** Directory containing tarballs. */
  dir: string;
}

/**
 * Pack consumer packages (or reuse existing tarballs when present and fresh).
 */
export async function ensureConsumerTarballs(options?: {
  force?: boolean;
  root?: string;
}): Promise<TarballMap> {
  const root = options?.root ?? REPO_ROOT;
  const tarballsDir = join(root, 'tmp/packages/tarballs');
  const needed = [
    'texuli-core',
    'texuli-tokens',
    'texuli-primitives',
    'texuli-0',
    'texuli-data',
    'texuli-astro',
    'texuli-blocks',
    'texuli-charts',
    'texuli-media',
  ];

  const hasAll =
    existsSync(tarballsDir) &&
    needed.every((prefix) =>
      readdirSync(tarballsDir).some((f) => f.startsWith(prefix) || f.includes(prefix))
    );

  if (!hasAll || options?.force) {
    const { packages: reports } = await verifyPackages({
      root,
      filters: [...CONSUMER_PACK_FILTER, 'astro', 'blocks', 'charts', 'media'],
    });
    const failed = reports.filter((r) => !r.ok);
    if (failed.length > 0) {
      const detail = failed.map((r) => `${r.name}: ${r.problems.join('; ')}`).join('\n');
      throw new Error(`Pack failed:\n${detail}`);
    }
  }

  if (!existsSync(tarballsDir)) {
    throw new Error(`Missing tarballs dir ${tarballsDir}`);
  }

  const files = readdirSync(tarballsDir).filter((f) => f.endsWith('.tgz'));
  const pick = (patterns: string[]) => {
    for (const pattern of patterns) {
      const hit = files.find((f) => f.startsWith(pattern));
      if (hit) return join(tarballsDir, hit);
    }
    throw new Error(`Tarball not found for ${patterns.join('|')}: have ${files.join(', ')}`);
  };

  return {
    dir: tarballsDir,
    core: pick(['texuli-core-']),
    tokens: pick(['texuli-tokens-']),
    primitives: pick(['texuli-primitives-']),
    texuli: pick(['texuli-0.', 'texuli-1.', 'texuli-2.']),
    data: pick(['texuli-data-']),
    astro: pick(['texuli-astro-']),
    blocks: pick(['texuli-blocks-']),
    charts: pick(['texuli-charts-']),
    media: pick(['texuli-media-']),
  };
}

function rewritePlaceholders(pkgJson: string, tarballs: TarballMap): string {
  return pkgJson
    .replaceAll('file:PLACEHOLDER_CORE', `file:${tarballs.core}`)
    .replaceAll('file:PLACEHOLDER_PRIMITIVES', `file:${tarballs.primitives}`)
    .replaceAll('file:PLACEHOLDER_TOKENS', `file:${tarballs.tokens}`)
    .replaceAll('file:PLACEHOLDER_TEXULI', `file:${tarballs.texuli}`)
    .replaceAll('file:PLACEHOLDER_DATA', `file:${tarballs.data}`)
    .replaceAll('file:PLACEHOLDER_ASTRO', `file:${tarballs.astro}`)
    .replaceAll('file:PLACEHOLDER_BLOCKS', `file:${tarballs.blocks}`)
    .replaceAll('file:PLACEHOLDER_CHARTS', `file:${tarballs.charts}`)
    .replaceAll('file:PLACEHOLDER_MEDIA', `file:${tarballs.media}`);
}

/**
 * Assert every Texuli dependency resolved from a local packed tarball (`file:`),
 * never the public registry.
 */
export function assertInstalledFromTarballs(consumerDir: string, tarballs: TarballMap): void {
  const expected: Record<(typeof TEXULI_INSTALL_NAMES)[number], string> = {
    '@texuli/core': realpathSync(tarballs.core),
    '@texuli/tokens': realpathSync(tarballs.tokens),
    '@texuli/primitives': realpathSync(tarballs.primitives),
    texuli: realpathSync(tarballs.texuli),
    '@texuli/data': realpathSync(tarballs.data),
  };

  const lockPath = join(consumerDir, 'package-lock.json');
  if (!existsSync(lockPath)) {
    throw new Error(`Missing package-lock.json in ${consumerDir} after npm install`);
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
    packages?: Record<string, { resolved?: string; version?: string; link?: boolean }>;
  };

  for (const name of TEXULI_INSTALL_NAMES) {
    const key = `node_modules/${name}`;
    const entry = lock.packages?.[key];
    if (!entry) {
      throw new Error(`package-lock missing ${key}`);
    }
    const resolved = entry.resolved ?? '';
    if (!resolved.startsWith('file:')) {
      throw new Error(
        `${name} resolved to "${resolved || '(empty)'}" — expected a file: tarball, not the registry`
      );
    }
    let filePath = resolved.slice('file:'.length);
    if (!filePath.startsWith('/')) {
      filePath = resolve(consumerDir, filePath);
    }
    let actual: string;
    try {
      actual = realpathSync(filePath);
    } catch {
      throw new Error(`${name} file: path does not exist: ${filePath}`);
    }
    const want = expected[name];
    if (actual !== want) {
      throw new Error(`${name} resolved to ${actual}, expected packed tarball ${want}`);
    }

    const nm = join(consumerDir, 'node_modules', ...name.split('/'));
    if (!existsSync(nm)) {
      throw new Error(`Missing installed package at ${nm}`);
    }
  }
}

/** Assert the Astro fixture resolves @texuli/astro from its packed tarball. */
export function assertAstroInstalledFromTarball(consumerDir: string, tarballs: TarballMap): void {
  const lockPath = join(consumerDir, 'package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
    packages?: Record<string, { resolved?: string }>;
  };
  const expected: Record<(typeof ASTRO_TRANSITIVE_PACKAGES)[number], string> = {
    '@texuli/astro': realpathSync(tarballs.astro),
    '@texuli/blocks': realpathSync(tarballs.blocks),
    '@texuli/charts': realpathSync(tarballs.charts),
    '@texuli/media': realpathSync(tarballs.media),
  };
  for (const name of ASTRO_TRANSITIVE_PACKAGES) {
    const resolved = lock.packages?.[`node_modules/${name}`]?.resolved ?? '';
    if (!resolved.startsWith('file:')) {
      throw new Error(`${name} resolved to "${resolved || '(empty)'}" — expected a file: tarball`);
    }
    let actual: string;
    try {
      actual = realpathSync(resolve(consumerDir, resolved.slice('file:'.length)));
    } catch {
      throw new Error(`${name} file: path does not exist: ${resolved}`);
    }
    if (actual !== expected[name]) {
      throw new Error(`${name} resolved to ${actual}, expected ${expected[name]}`);
    }
    if (!existsSync(join(consumerDir, 'node_modules', ...name.split('/')))) {
      throw new Error(`Missing installed package ${name} in ${consumerDir}`);
    }
  }
}

/**
 * Consumer tsconfig for svelte-check / tsc: strict, no local *.css ambient,
 * noUncheckedSideEffectImports so missing package CSS types fail the gate.
 */
export function writeConsumerTypecheckConfig(consumerDir: string): {
  svelteTsconfig: string;
  tscTsconfig: string;
} {
  const shared = {
    target: 'ES2023',
    lib: ['ES2023', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    moduleDetection: 'force',
    resolveJsonModule: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    noUncheckedSideEffectImports: true,
    forceConsistentCasingInFileNames: true,
    types: [] as string[],
  };

  // Pure TS import surface for tsc (no local .svelte — those need svelte-check).
  // Entry imports pull /// <reference path="…/css-modules.d.ts" /> from packed d.ts.
  writeFileSync(
    join(consumerDir, 'typecheck-imports.ts'),
    [
      "import { DataGrid } from '@texuli/data/grid-core';",
      "import { Button } from 'texuli/button';",
      "import { Select } from 'texuli/select';",
      'export type ConsumerPackSurface = {',
      '  Button: typeof Button;',
      '  Select: typeof Select;',
      '  DataGrid: typeof DataGrid;',
      '};',
      '',
    ].join('\n')
  );

  const svelteTsconfig = join(consumerDir, 'tsconfig.consumer.json');
  writeFileSync(
    svelteTsconfig,
    `${JSON.stringify(
      {
        compilerOptions: shared,
        include: ['src/**/*.ts', 'src/**/*.svelte', 'Smoke.svelte', 'typecheck-imports.ts'],
      },
      null,
      2
    )}\n`
  );

  const tscTsconfig = join(consumerDir, 'tsconfig.consumer-tsc.json');
  writeFileSync(
    tscTsconfig,
    `${JSON.stringify(
      {
        compilerOptions: shared,
        include: ['typecheck-imports.ts'],
      },
      null,
      2
    )}\n`
  );
  return { svelteTsconfig, tscTsconfig };
}

/**
 * Assert packed texuli/data install the CSS type surface (sibling stubs + ambient
 * reference on entries that consumers import for the smoke gate).
 */
export function assertPackedCssTypes(consumerDir: string): void {
  const checks: Array<{ pkg: string; files: string[]; entryIndexes: string[] }> = [
    {
      pkg: 'texuli',
      files: [
        'dist/css-modules.d.ts',
        'dist/components/button/button.css.d.ts',
        'dist/components/select/select.css.d.ts',
      ],
      entryIndexes: ['dist/components/button/index.d.ts', 'dist/components/select/index.d.ts'],
    },
    {
      pkg: '@texuli/data',
      files: ['dist/css-modules.d.ts', 'dist/grid-core/grid-core.css.d.ts'],
      entryIndexes: ['dist/grid-core/index.d.ts'],
    },
  ];
  for (const { pkg, files, entryIndexes } of checks) {
    const root = join(consumerDir, 'node_modules', ...pkg.split('/'));
    for (const rel of [...files, ...entryIndexes]) {
      const full = join(root, rel);
      if (!existsSync(full)) {
        throw new Error(`Packed ${pkg} missing CSS type surface file: ${rel}`);
      }
    }
    for (const entry of entryIndexes) {
      const text = readFileSync(join(root, entry), 'utf8');
      if (!text.includes('css-modules.d.ts')) {
        throw new Error(
          `Packed ${pkg} ${entry} must /// <reference> css-modules.d.ts (got head: ${text.slice(0, 120)})`
        );
      }
    }
  }
}

/**
 * Run svelte-check and tsc --noEmit. Fails if either reports errors.
 * Does not add a consumer-local `*.css` ambient — package types must suffice.
 */
export async function typecheckConsumer(consumerDir: string): Promise<void> {
  const { svelteTsconfig, tscTsconfig } = writeConsumerTypecheckConfig(consumerDir);

  // Guard: fixtures must not ship a local *.css ambient that would hide packaging bugs.
  for (const file of walkLocalDts(consumerDir)) {
    const text = readFileSync(file, 'utf8');
    if (/declare\s+module\s+['"]\*\.css['"]/.test(text)) {
      throw new Error(
        `Consumer fixture must not declare module '*.css' (${file}); package types must ship it`
      );
    }
  }

  assertPackedCssTypes(consumerDir);

  try {
    await execFileAsync(
      'npx',
      ['--no-install', 'svelte-check', '--tsconfig', svelteTsconfig, '--threshold', 'error'],
      {
        cwd: consumerDir,
        env: process.env,
        maxBuffer: 20 * 1024 * 1024,
      }
    );
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `svelte-check failed:\n${err.stdout ?? ''}${err.stderr ?? err.message ?? error}`
    );
  }

  try {
    await execFileAsync('npx', ['--no-install', 'tsc', '--noEmit', '-p', tscTsconfig], {
      cwd: consumerDir,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `tsc --noEmit failed:\n${err.stdout ?? ''}${err.stderr ?? err.message ?? error}`
    );
  }
}

function walkLocalDts(dir: string): string[] {
  const out: string[] = [];
  const skip = new Set(['node_modules', 'dist', 'build', '.svelte-kit']);
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.d.ts')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * Copy a fixture into a temp dir, point deps at tarballs, npm install, build.
 */
export async function buildConsumer(
  consumer: ConsumerDef,
  tarballs: TarballMap,
  options?: { workRoot?: string; typecheck?: boolean }
): Promise<{ dir: string; dist: string }> {
  const workRoot = options?.workRoot ?? join(REPO_ROOT, 'tmp/consumers');
  mkdirSync(workRoot, { recursive: true });
  const dir = mkdtempSync(join(workRoot, `${consumer.id}-`));
  const fixtureSrc = join(REPO_ROOT, 'tests/consumers/fixtures', consumer.fixture);
  const smokeSrc = join(REPO_ROOT, 'tests/consumers/fixtures/Smoke.svelte');

  cpSync(fixtureSrc, dir, { recursive: true });
  cpSync(smokeSrc, join(dir, 'Smoke.svelte'));

  const rewriteSmokeImports = (file: string, rel: string) => {
    if (!existsSync(file)) return;
    let text = readFileSync(file, 'utf8');
    text = text.replaceAll('../../Smoke.svelte', rel);
    text = text.replaceAll('../../../Smoke.svelte', rel);
    writeFileSync(file, text);
  };
  rewriteSmokeImports(join(dir, 'src/main.ts'), '../Smoke.svelte');
  rewriteSmokeImports(join(dir, 'src/pages/index.astro'), '../../Smoke.svelte');
  rewriteSmokeImports(join(dir, 'src/routes/+page.svelte'), '../../Smoke.svelte');

  const pkgPath = join(dir, 'package.json');
  writeFileSync(pkgPath, rewritePlaceholders(readFileSync(pkgPath, 'utf8'), tarballs));

  await execFileAsync(
    'npm',
    ['install', '--no-fund', '--no-audit', '--ignore-scripts', '--prefer-offline'],
    {
      cwd: dir,
      env: { ...process.env, npm_config_package_lock: 'true' },
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  assertInstalledFromTarballs(dir, tarballs);
  if (consumer.id === 'astro-plain') assertAstroInstalledFromTarball(dir, tarballs);

  const shouldTypecheck =
    options?.typecheck ?? (TYPECHECK_FRAMEWORKS as readonly string[]).includes(consumer.framework);
  if (shouldTypecheck) {
    await typecheckConsumer(dir);
  }

  await execFileAsync('npm', ['run', 'build'], {
    cwd: dir,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });

  const distCandidates = [
    join(dir, 'dist'),
    join(dir, 'build'),
    join(dir, '.svelte-kit/output/client'),
  ];
  const dist = distCandidates.find((p) => existsSync(p)) ?? join(dir, 'dist');
  if (!existsSync(dist)) {
    throw new Error(`Build produced no dist for ${consumer.id} in ${dir}`);
  }
  return { dir, dist };
}

export async function run(cmd: string, args: string[], cwd: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    cwd,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  return `${stdout}${stderr}`;
}

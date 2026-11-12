/**
 * The Solutions registry contract (ADR-029). Every Solution landing, the catalog, the
 * home band, the nav group and the machine-readable index read entries of this shape.
 *
 * `checkSolutionEntry` validates the shape and the vocabulary only. Checks that need the
 * file system (package names and subpaths, routes, docs paths, native evidence) live in
 * `validate.ts`. Package versions and native statuses are derived there, never typed here.
 */

/** The honest status vocabulary used on every page. */
export const SOLUTION_STATUSES = [
  'available',
  'in development',
  'experimental',
  'planned',
] as const;
export type SolutionStatus = (typeof SOLUTION_STATUSES)[number];

/** The Solutions promoted by ADR-027 and ADR-036. */
export const SOLUTION_SLUGS = [
  'slides',
  'documents',
  'workflows',
  'canvas',
  'sheets',
  'design-systems',
  'dashboards',
  'forms',
  'agent-chat',
  'editor',
] as const;
export type SolutionSlug = (typeof SOLUTION_SLUGS)[number];

/** Rendering targets a Solution can name. Native targets need evidence (ADR-029). */
export const SOLUTION_PLATFORMS = ['web', 'compose-desktop', 'android', 'ios'] as const;
export type SolutionPlatform = (typeof SOLUTION_PLATFORMS)[number];

/** Illustration variants from apps/website/docs/ILLUSTRATIONS.md. */
export const ART_VARIANTS = ['banner', 'plate', 'band'] as const;
export type ArtVariant = (typeof ART_VARIANTS)[number];

export interface SolutionLink {
  readonly label: string;
  /** A site-relative path (`/…/`) or an `https:` URL; checked by the URL policy when rendered. */
  readonly href: string;
}

export interface SolutionPackage {
  /** An npm package name from `packages/*\/package.json`, for example `@texuli/slides`. */
  readonly name: string;
  /** Subpath exports the Solution uses, for example `./engine`; `.` for the root. */
  readonly subpaths: readonly string[];
  readonly role: string;
}

export interface SolutionCapability {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly status: SolutionStatus;
}

export interface SolutionPlatformEntry {
  readonly platform: SolutionPlatform;
  readonly status: SolutionStatus;
  /** Repository paths that prove the status; required for every platform except `web`. */
  readonly evidence: readonly string[];
}

export interface SolutionDemo {
  /** The island directory: `src/components/solutions/<slug>/demo/`. */
  readonly id: SolutionSlug;
  readonly title: string;
  /** Scenario ids exported by the demo model's fixtures. */
  readonly scenarios: readonly string[];
  readonly limits: readonly string[];
}

export interface SolutionArtSlot {
  /** A slot id in `src/data/illustrations.json`; a missing file paints the texel mosaic. */
  readonly slot: string;
  readonly variant: ArtVariant;
}

export interface SolutionEntry {
  readonly slug: SolutionSlug;
  readonly name: string;
  readonly status: SolutionStatus;
  /** One line for cards and meta descriptions. */
  readonly tagline: string;
  readonly summary: string;
  /** Landing route: `/solutions/<slug>/`. */
  readonly route: string;
  /** Docs route: `/guides/solutions/<slug>/`. */
  readonly docs: string;
  /** The `*-page` route this landing replaces (ADR-028), if any. */
  readonly replaces?: string;
  readonly packages: readonly SolutionPackage[];
  readonly capabilities: readonly SolutionCapability[];
  readonly platforms: readonly SolutionPlatformEntry[];
  readonly demo: SolutionDemo;
  readonly art: Readonly<{ hero: SolutionArtSlot; extra?: readonly SolutionArtSlot[] }>;
  /** What the Solution does not do today (honesty; at least one line). */
  readonly limits: readonly string[];
  readonly links: readonly SolutionLink[];
}

export interface SchemaIssue {
  readonly path: string;
  readonly message: string;
}

const PACKAGE_NAME = /^(?:@texuli\/[a-z][a-z0-9-]*|texuli)$/;
const SUBPATH = /^\.(?:\/[a-z0-9][a-z0-9/-]*)?$/;
const SLOT = /^[a-z0-9][a-z0-9-]*$/;

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Site-relative paths must stay on the site; external links must be `https:`. */
export function isSafeRegistryHref(href: string): boolean {
  if (href.startsWith('/')) return !href.startsWith('//') && !href.includes('\\');
  return /^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(href);
}

/** Validates one entry's shape and vocabulary. An empty array means the entry is valid. */
export function checkSolutionEntry(entry: SolutionEntry): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });

  if (!isOneOf(SOLUTION_SLUGS, entry.slug)) fail('slug', `unknown slug "${String(entry.slug)}"`);
  if (!isOneOf(SOLUTION_STATUSES, entry.status))
    fail('status', `status "${String(entry.status)}" is not in the vocabulary`);
  for (const key of ['name', 'tagline', 'summary'] as const) {
    if (!isText(entry[key])) fail(key, 'must be non-empty text');
  }
  if (entry.route !== `/solutions/${entry.slug}/`)
    fail('route', `must be /solutions/${entry.slug}/`);
  if (entry.docs !== `/guides/solutions/${entry.slug}/`)
    fail('docs', `must be /guides/solutions/${entry.slug}/`);
  if (entry.replaces !== undefined && !/^\/[a-z0-9-]+-page\/$/.test(entry.replaces)) {
    fail('replaces', 'must be a /<name>-page/ route');
  }

  if (entry.packages.length === 0) fail('packages', 'needs at least one package');
  entry.packages.forEach((pkg, i) => {
    if (!PACKAGE_NAME.test(pkg.name))
      fail(`packages[${i}].name`, `"${pkg.name}" is not a Texuli package name`);
    if (pkg.subpaths.length === 0) fail(`packages[${i}].subpaths`, 'needs at least one subpath');
    pkg.subpaths.forEach((sub, j) => {
      if (!SUBPATH.test(sub)) fail(`packages[${i}].subpaths[${j}]`, `"${sub}" is not a subpath`);
    });
    if (!isText(pkg.role)) fail(`packages[${i}].role`, 'must be non-empty text');
  });

  if (entry.capabilities.length === 0) fail('capabilities', 'needs at least one capability');
  const capIds = new Set<string>();
  entry.capabilities.forEach((cap, i) => {
    if (!SLOT.test(cap.id)) fail(`capabilities[${i}].id`, 'must be kebab-case');
    if (capIds.has(cap.id)) fail(`capabilities[${i}].id`, `duplicate id "${cap.id}"`);
    capIds.add(cap.id);
    if (!isText(cap.title) || !isText(cap.summary))
      fail(`capabilities[${i}]`, 'needs a title and a summary');
    if (!isOneOf(SOLUTION_STATUSES, cap.status))
      fail(`capabilities[${i}].status`, 'status is not in the vocabulary');
  });

  if (!entry.platforms.some((p) => p.platform === 'web')) fail('platforms', 'must include web');
  entry.platforms.forEach((p, i) => {
    if (!isOneOf(SOLUTION_PLATFORMS, p.platform))
      fail(`platforms[${i}].platform`, 'unknown platform');
    if (!isOneOf(SOLUTION_STATUSES, p.status))
      fail(`platforms[${i}].status`, 'status is not in the vocabulary');
    if (p.platform !== 'web' && p.status !== 'planned' && p.evidence.length === 0) {
      fail(`platforms[${i}].evidence`, 'a native status other than planned needs evidence');
    }
  });

  if (entry.demo.id !== entry.slug) fail('demo.id', 'must match the slug');
  if (!isText(entry.demo.title)) fail('demo.title', 'must be non-empty text');
  if (entry.demo.scenarios.length === 0) fail('demo.scenarios', 'needs at least one scenario');

  for (const [path, slot] of [
    ['art.hero', entry.art.hero],
    ...(entry.art.extra ?? []).map((s, i) => [`art.extra[${i}]`, s] as const),
  ] as const) {
    if (!SLOT.test(slot.slot)) fail(`${path}.slot`, 'must be a kebab-case slot id');
    if (!isOneOf(ART_VARIANTS, slot.variant)) fail(`${path}.variant`, 'unknown variant');
  }

  if (entry.limits.length === 0 || !entry.limits.every(isText))
    fail('limits', 'needs at least one honest limit');
  entry.links.forEach((link, i) => {
    if (!isText(link.label)) fail(`links[${i}].label`, 'must be non-empty text');
    if (!isSafeRegistryHref(link.href)) fail(`links[${i}].href`, 'must be site-relative or https');
  });

  return issues;
}

/** Validates a full registry: every entry, unique slugs, and catalog order. */
export function checkSolutionRegistry(entries: readonly SolutionEntry[]): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const seen = new Set<string>();
  entries.forEach((entry, i) => {
    if (seen.has(entry.slug))
      issues.push({ path: `[${i}].slug`, message: `duplicate slug "${entry.slug}"` });
    seen.add(entry.slug);
    for (const issue of checkSolutionEntry(entry))
      issues.push({ path: `[${i}].${issue.path}`, message: issue.message });
  });
  return issues;
}

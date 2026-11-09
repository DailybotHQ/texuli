/**
 * View models for the status badge, the Platforms block and the Agents block (ADR-029).
 * Statuses come from the registry entry; `validate.ts` checks its native statuses against
 * `native/docs/parity.json` in `registry-validator.test.ts` (part of `pnpm test`, not the
 * build). This module never raises a status, and it refuses a native status above "planned"
 * that has no evidence, which fails the build.
 */
import { safeHref } from '@texuli/core/url-policy';
import {
  SOLUTION_PLATFORMS,
  SOLUTION_STATUSES,
  type SolutionEntry,
  type SolutionPlatform,
  type SolutionStatus,
} from '../../../../data/solutions/schema.ts';
import { REPOSITORY_URL, withBase } from '../../../foundation/site.ts';
import type { SolutionAgentsProps } from '../types.ts';

/** Visual tone per status: filled for available, outlined for the rest, dashed for planned. */
export type StatusTone = 'solid' | 'outline' | 'dashed';

export interface StatusBadgeView {
  readonly status: SolutionStatus;
  readonly label: string;
  readonly tone: StatusTone;
}

const TONES: Readonly<Record<SolutionStatus, StatusTone>> = {
  available: 'solid',
  'in development': 'outline',
  experimental: 'outline',
  planned: 'dashed',
};

/** The badge for one status word; throws on a word outside the vocabulary. */
export function statusBadgeView(status: SolutionStatus): StatusBadgeView {
  if (!(SOLUTION_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`StatusBadge: "${String(status)}" is not a status word`);
  }
  return { status, label: status.charAt(0).toUpperCase() + status.slice(1), tone: TONES[status] };
}

/** Display name and a one-line, factual description of each rendering target. */
export const PLATFORM_META: Readonly<
  Record<SolutionPlatform, Readonly<{ name: string; renderer: string }>>
> = {
  web: { name: 'Web', renderer: 'Svelte 5 packages published on npm (pre-1.0).' },
  'compose-desktop': {
    name: 'Compose Desktop',
    renderer: 'Kotlin Multiplatform renderer on the JVM, built in this repository.',
  },
  android: { name: 'Android', renderer: 'Native renderer target.' },
  ios: { name: 'iOS', renderer: 'Native renderer target.' },
};

export interface PlatformEvidenceLink {
  /** The repository path, shown as the link text. */
  readonly path: string;
  readonly href: string;
}

export interface PlatformRowView {
  readonly platform: SolutionPlatform;
  readonly name: string;
  readonly renderer: string;
  readonly badge: StatusBadgeView;
  readonly evidence: readonly PlatformEvidenceLink[];
}

/** A repository path as a link to the file on GitHub, checked by the URL policy. */
export function evidenceHref(path: string): string {
  if (path.length === 0 || path.startsWith('/') || path.split('/').includes('..')) {
    throw new Error(`Platforms: evidence "${path}" is not a repository path`);
  }
  const url = `${REPOSITORY_URL}/blob/main/${path.split('/').map(encodeURIComponent).join('/')}`;
  const safe = safeHref(url, 'developer');
  if (safe === undefined) throw new Error(`Platforms: evidence "${path}" fails the URL policy`);
  return safe;
}

/**
 * One row per platform the entry lists, in the fixed order web → Compose Desktop →
 * Android → iOS. A platform the entry does not list is not shown (no invented row).
 */
export function platformRows(entry: Pick<SolutionEntry, 'platforms'>): PlatformRowView[] {
  return SOLUTION_PLATFORMS.flatMap((platform) => {
    const row = entry.platforms.find((p) => p.platform === platform);
    if (!row) return [];
    if (platform !== 'web' && row.status !== 'planned' && row.evidence.length === 0) {
      throw new Error(`Platforms: ${platform} is "${row.status}" without evidence`);
    }
    return [
      {
        platform,
        name: PLATFORM_META[platform].name,
        renderer: PLATFORM_META[platform].renderer,
        badge: statusBadgeView(row.status),
        evidence: row.evidence.map((path) => ({ path, href: evidenceHref(path) })),
      },
    ];
  });
}

/** Site routes the Platforms and Agents blocks link to (all exist today). */
export const PLATFORM_LINKS = {
  native: { label: 'How the native renderer works', href: '/native/' },
} as const;
export const AGENT_LINKS = [
  { label: 'MCP server', href: '/mcp-server/' },
  { label: 'Agent skill', href: '/skill/' },
  { label: 'Building with agents', href: '/agents-page/' },
] as const;

/** Resolves an app-authored site route (developer tier) with the site base. */
export function resolveSiteHref(href: string, base = '/'): string | undefined {
  const safe = safeHref(href, 'developer');
  if (safe === undefined) return undefined;
  return safe.startsWith('/') ? withBase(base, safe) : safe;
}

export interface AgentSurfaceView {
  readonly label: string;
  readonly detail: string;
  readonly badge: StatusBadgeView;
}

/** The Agents block's surfaces with their badges; empty labels fail the build. */
export function agentSurfaceViews(surfaces: SolutionAgentsProps['surfaces']): AgentSurfaceView[] {
  return surfaces.map((surface) => {
    if (surface.label.trim().length === 0) throw new Error('Agents: a surface has no label');
    return { label: surface.label, detail: surface.detail, badge: statusBadgeView(surface.status) };
  });
}

/** Heading ids for the two sections, unique per Solution. */
export function sectionHeadingId(slug: string, block: 'platforms' | 'agents'): string {
  return `solution-${slug}-${block}-title`;
}

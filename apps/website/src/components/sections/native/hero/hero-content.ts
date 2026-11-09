/**
 * Copy and status for the /native/ hero, "Beyond the browser". The status line is derived,
 * never typed: the web row is the npm release, and the native rows come from
 * `NATIVE_COMPATIBILITY` (`src/data/native/compatibility.ts`), which reads
 * `native/docs/parity.json` and the Gradle targets at build time. Calls to action point
 * only at pages that exist and at the repository's `native/` directory.
 */
import { NATIVE_COMPATIBILITY } from '../../../../data/native/compatibility.ts';
import type { SolutionStatus } from '../../../../data/solutions/schema.ts';
import { REPOSITORY_URL } from '../../../foundation/site.ts';

export interface NativeHeroStatusRow {
  readonly id: 'web' | 'compose-desktop' | 'android' | 'ios';
  readonly platform: string;
  readonly status: SolutionStatus;
  readonly detail: string;
}

export interface NativeHeroAction {
  readonly role: 'primary' | 'secondary' | 'text';
  readonly label: string;
  readonly href: string;
}

type CompatibilityData = typeof NATIVE_COMPATIBILITY;

function platform(data: CompatibilityData, target: string) {
  const row = data.platforms.find((p) => p.target === target);
  if (!row)
    throw new Error(`Native hero: platform "${target}" missing from the compatibility data`);
  return row;
}

/** Maps a renderer target's compatibility status onto the site's status vocabulary. */
function rendererStatus(status: string): SolutionStatus {
  if (status === 'Planned' || status === 'Unsupported') return 'planned';
  if (status === 'Experimental') return 'experimental';
  return 'in development';
}

/** The four status rows: web, Compose Desktop, Android, iOS. */
export function nativeHeroStatus(
  data: CompatibilityData = NATIVE_COMPATIBILITY
): NativeHeroStatusRow[] {
  const desktop = platform(data, 'Compose Desktop');
  const { painted, catalog } = data.totals;
  return [
    {
      id: 'web',
      platform: 'Web',
      status: 'available',
      detail: 'Every published package is on npm, pre-1.0.',
    },
    {
      id: 'compose-desktop',
      platform: 'Compose Desktop',
      status: desktop.status === 'Unsupported' ? 'planned' : 'in development',
      detail: `Paints ${painted} of ${catalog} catalog components; interactive web views paint read-only.`,
    },
    {
      id: 'android',
      platform: 'Android',
      status: rendererStatus(platform(data, 'Android UI renderer').status),
      detail: 'No Android renderer yet.',
    },
    {
      id: 'ios',
      platform: 'iOS',
      status: rendererStatus(platform(data, 'iOS UI renderer').status),
      detail: 'No iOS renderer yet.',
    },
  ];
}

export const NATIVE_HERO = {
  ids: { heading: 'native-hero-22-title', status: 'native-hero-22-status' },
  eyebrow: 'Texuli Native · In development',
  title: { lead: 'Your interface language,', accent: 'beyond the browser.' },
  sub: 'Shared blueprints, semantic contracts and design tokens are the foundation. Texuli Native brings them to native UIs, one validated capability at a time.',
  statusLabel: 'Platform status',
  note: 'There is no Android or iOS SDK yet.',
  actions: [
    { role: 'primary', label: 'Explore the architecture', href: '/guides/why-svelte-kotlin/' },
    {
      role: 'secondary',
      label: 'View compatibility',
      href: '/web-and-native/#what-exists-today',
    },
    { role: 'text', label: 'See the source', href: `${REPOSITORY_URL}/tree/main/native` },
  ] satisfies NativeHeroAction[],
  art: {
    slot: 'native-hero',
    alt: 'One blueprint feeding the same structure to a browser window and a native app.',
  },
} as const;

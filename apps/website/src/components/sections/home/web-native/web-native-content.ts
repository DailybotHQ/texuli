/**
 * Home 2.2 "Web & Native" band (vision §49.3): eyebrow, h2, body and status line from the
 * vision copy, then three platform cards whose status and counts come from
 * `data/native/compatibility.ts` (generated from `native/docs/parity.json`, the conformance
 * traces and the Gradle build files). No number is typed here.
 *
 * Status words map the compatibility vocabulary onto the site's honest set: the web
 * library is published (available); the Compose Desktop renderer paints a read-only slice
 * and is unpublished (in development, whatever its slice size); Android and iOS read
 * planned until a renderer source or target exists (then experimental).
 */
import {
  NATIVE_COMPATIBILITY,
  type NativeCompatibilityData,
} from '../../../../data/native/compatibility.ts';
import type { SolutionStatus } from '../../../../data/solutions/schema.ts';
import { siteRouteExists } from '../../../foundation/nav-data.ts';

export type RouteExists = (route: string) => boolean;

export const WEB_NATIVE_COPY = {
  id: 'home-web-native-title',
  eyebrow: 'One foundation, multiple platforms',
  title: 'Your interfaces shouldn’t stop at the browser.',
  body: 'Texuli uses shared blueprints and design contracts so interfaces can be understood across renderers. Build with the web library today and explore the evolving native toolkit.',
  status: 'Native is under active development.',
  art: 'home-web-native',
  actions: [
    { label: 'Explore Texuli Native', href: '/native/', role: 'primary' },
    { label: 'Web and native side by side', href: '/web-and-native/', role: 'text' },
  ],
} as const;

export interface WebNativeCard {
  readonly id: 'web' | 'compose-desktop' | 'mobile';
  readonly title: string;
  readonly status: SolutionStatus;
  readonly body: string;
}

type Compat = Pick<NativeCompatibilityData, 'totals' | 'platforms' | 'components'>;

function platform(data: Compat, target: string) {
  const row = data.platforms.find((p) => p.target === target);
  if (!row) throw new Error(`compatibility data has no "${target}" row`);
  return row;
}

/** Maps a compatibility status onto the site status words (never above in development). */
function nativeWord(status: string): SolutionStatus {
  if (status === 'Planned' || status === 'Unsupported' || status === 'Not applicable')
    return 'planned';
  if (status === 'Experimental') return 'experimental';
  return 'in development';
}

/** The three cards: web, the Compose Desktop slice, and Android and iOS. */
export function webNativeCards(data: Compat = NATIVE_COMPATIBILITY): WebNativeCard[] {
  const desktop = platform(data, 'Compose Desktop');
  const ios = platform(data, 'iOS UI renderer');
  const android = platform(data, 'Android UI renderer');
  const spec = platform(data, 'KMP shared spec (JVM + iOS targets)');
  const readOnly = data.components.filter((c) => c.composeDesktop === 'Partial').length;
  const { painted, catalog } = data.totals;
  const mobile = [nativeWord(ios.status), nativeWord(android.status)];
  const mobileStatus: SolutionStatus = mobile.includes('experimental') ? 'experimental' : 'planned';
  return [
    {
      id: 'web',
      title: 'Web',
      status: 'available',
      body: 'The Svelte 5 library, published on npm as pre-1.0 packages: components, themes, data views and the agent catalog.',
    },
    {
      id: 'compose-desktop',
      title: 'Compose Desktop',
      status: desktop.status === 'Unsupported' ? 'planned' : nativeWord(desktop.status),
      body: `${painted} of ${catalog} catalog components paint through Kotlin Multiplatform and Compose on the JVM, ${readOnly} of them read-only. Not published yet.`,
    },
    {
      id: 'mobile',
      title: 'Android and iOS',
      status: mobileStatus,
      body:
        mobileStatus === 'experimental'
          ? 'A mobile renderer source or target exists; device readiness is not implied.'
          : nativeWord(spec.status) === 'planned'
            ? 'No Android or iOS UI renderer exists yet.'
            : 'The shared contract already compiles for iOS. No Android or iOS UI renderer exists yet.',
    },
  ];
}

/** The band's calls to action, only for routes whose page exists. */
export function webNativeActions(exists: RouteExists = siteRouteExists) {
  return WEB_NATIVE_COPY.actions.filter((action) => exists(action.href));
}

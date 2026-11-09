/**
 * Copy for the /native/ principles, agents and start-building bands. Status
 * and catalog counts come from `NATIVE_COMPATIBILITY` (and `nativeHeroStatus`).
 * The blueprint spec version is the parity file's `specVersion`. Agent surfaces
 * are real: `validateDraft` (`@texuli/catalog/validate`) and `blueprint.validate`
 * (`packages/tools/src/ops/blueprint.ts`). Art is the existing `home-agents` plate.
 */
import { NATIVE_COMPATIBILITY } from '../../../../data/native/compatibility.ts';
import { REPOSITORY_URL } from '../../../foundation/site.ts';
import { nativeHeroStatus } from '../hero/hero-content.ts';

export interface NativePrinciple {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface NativeAgentStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface NativeStartAction {
  readonly role: 'primary' | 'secondary' | 'text';
  readonly label: string;
  readonly href: string;
}

type CompatibilityData = typeof NATIVE_COMPATIBILITY;

export const NATIVE_PRINCIPLES = {
  ids: {
    principles: 'native-principles-title',
    agents: 'native-agents-title',
    start: 'native-start-title',
  },
  art: 'home-agents',
  artAlt: 'An agent orb emitting tiles through a validation gate into an interface.',
  principles: {
    title: 'Native should feel native.',
    lede: 'These are experience principles, not a checklist of what Compose already paints. Touch, IME, safe areas, haptics and live regions wait on a host that supports them.',
    items: [
      {
        id: 'input',
        title: 'Platform input',
        body: 'Touch targets, gestures, system keyboards and dynamic type belong to the host. The Compose slice today is read-only: it does not take form input.',
      },
      {
        id: 'navigation',
        title: 'Platform navigation',
        body: 'Back, escape, safe areas and system bars are host concerns. Linked images send navigate intents. There are no blueprint-bound interactive controls.',
      },
      {
        id: 'assistive',
        title: 'Assistive technology',
        body: 'Compose semantics expose headings, image alternatives, chart summaries, tables, lists and boards. Heading rank is visual only. There are no live regions.',
      },
    ] satisfies NativePrinciple[],
  },
  agents: {
    title: 'Built for humans and agents, on every target.',
    lede: 'People direct and review. Agents emit a blueprint. Texuli validates it, then each renderer paints what it supports.',
  },
  start: {
    title: 'Start building.',
    lede: 'The web packages are on npm, pre-1.0. Native is a Gradle project in this repository, not a published SDK.',
  },
} as const;

/** Steps, surfaces and start actions filled from the compatibility data. */
export function nativePrinciplesView(data: CompatibilityData = NATIVE_COMPATIBILITY) {
  const { painted, catalog } = data.totals;
  const spec = data.specVersion;
  const status = nativeHeroStatus(data);
  const byId = Object.fromEntries(status.map((row) => [row.id, row]));
  const desktop = byId['compose-desktop'];
  if (!desktop) throw new Error('Native principles: missing Compose Desktop status');
  return {
    spec,
    painted,
    catalog,
    platforms: status,
    steps: [
      {
        id: 'emit',
        title: 'Emit',
        body: `Agents describe an interface as a JSON blueprint against spec ${spec}.`,
      },
      {
        id: 'validate',
        title: 'Validate',
        body: 'Hosts run validateDraft from @texuli/catalog/validate, or the blueprint.validate MCP operation, at the untrusted tier.',
      },
      {
        id: 'resolve',
        title: 'Resolve',
        body: `Web is available. Compose Desktop paints ${painted} of ${catalog} catalog components, read-only, and is ${desktop.status}. Android and iOS are planned.`,
      },
      {
        id: 'render',
        title: 'Render',
        body: 'The web player paints the tree. The Kotlin twin in native/ paints the Compose Desktop slice. Svelte does not run on device.',
      },
      {
        id: 'review',
        title: 'Review',
        body: 'A person reviews and edits. Nothing is activated without a host. There is no deployed agent that writes native apps.',
      },
    ] satisfies NativeAgentStep[],
    surfaces: [
      {
        label: '@texuli/spec',
        detail: `Blueprint contract, spec ${spec}.`,
        status: 'available' as const,
      },
      {
        label: 'validateDraft',
        detail: '@texuli/catalog/validate: sink-free draft check.',
        status: 'available' as const,
      },
      {
        label: 'blueprint.validate',
        detail: 'MCP operation: the same check through any MCP client.',
        status: 'in development' as const,
      },
    ],
    actions: [
      { role: 'primary', label: 'Build on the web now', href: '/guides/getting-started/' },
      {
        role: 'secondary',
        label: 'Explore Native development',
        href: `${REPOSITORY_URL}/tree/main/native`,
      },
      { role: 'text', label: 'View compatibility', href: '/web-and-native/#what-exists-today' },
    ] satisfies NativeStartAction[],
  };
}

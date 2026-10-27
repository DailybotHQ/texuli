/**
 * The unified landing's why-Svelte section: copy, citations and code
 * excerpts (PLAN_006 T-41; narrative blueprint §2 pillar 1, §3, §5 s4).
 * Kept out of the .astro so the unit test
 * (`apps/website/tests/section-contracts.test.ts`) can pin every claim against
 * the repository file it is cited from.
 *
 * The rule the module enforces on itself: a claim's `sources` phrases appear
 * word for word in both the cited repository file and in this module's copy,
 * and the three ladder excerpts are quoted byte for byte from the packages
 * they name — one excerpt per layer of the ladder:
 *
 *   texel (`@texuli/core`) -> primitive (`@texuli/primitives`) -> component (`texuli`)
 *
 * Every claim also names the real on-site route that documents it. Nothing
 * here is invented; nothing compares or names any other component library.
 */

/** Repository-relative path of the cited file. */
export interface CitedPhrase {
  file: string;
  /** The exact phrase (whitespace-normalized) the file and the copy share. */
  phrase: string;
}

/** A piece of section copy plus the sources every phrase of it rests on. */
export interface WhyPiece {
  text: string;
  sources: CitedPhrase[];
}

/** A claim with its docs route: the site page that documents it. */
export interface WhyClaim {
  title: string;
  body: string;
  /** Real on-site route (developer trust tier at render time). */
  href: string;
  label: string;
  sources: CitedPhrase[];
}

/** A verbatim repository excerpt shown in the section. */
export interface WhyExcerpt {
  /** Repository-relative path, shown as the citation. */
  file: string;
  label: string;
  code: string;
}

/** One rung of the ladder: layer, package, role, real code, real route. */
export interface WhyLadderRow {
  /** The ladder layer, in down-only order. */
  layer: 'texel' | 'primitive' | 'component';
  name: string;
  role: string;
  href: string;
  label: string;
  excerpt: WhyExcerpt;
  sources: CitedPhrase[];
}

const GUIDE = 'apps/website/src/pages/guides/why-svelte-kotlin/index.astro';
const A11Y_GUIDE = 'apps/website/src/pages/guides/accessibility/index.astro';
const PLAYGROUND = 'apps/website/src/pages/playground/index.astro';
const ARCHITECTURE = 'docs/ARCHITECTURE.md';
const SECURITY = 'docs/SECURITY.md';
const STANDARDS = 'docs/STANDARDS.md';

/** Heading ids: the component wires `aria-labelledby` from these. */
export const WEB_WHY_IDS = {
  section: 'web-why-svelte-title',
  story: 'web-why-story-title',
  ladder: 'web-why-ladder-title',
  guarantees: 'web-why-guarantees-title',
} as const;

/** The section lede, anchored in the why-svelte-kotlin guide. */
export const WEB_WHY_LEDE: WhyPiece = {
  text: 'Svelte is the half of Texuli you run in a browser, and Texuli ships as compiled source, not as a runtime you download. Three layers, one ladder — texels, primitives, styled components — each held to the same contract, so the web stays compiled, small and explicit.',
  sources: [
    {
      file: GUIDE,
      phrase: 'Texuli ships as compiled source, not as a runtime you download',
    },
  ],
};

/** The web story, in customer language, claim by claim. */
export const WEB_WHY_STORY: readonly WhyClaim[] = [
  {
    title: 'Compiled, not carried',
    body: 'Svelte is a compiler: a component becomes plain JavaScript that touches the DOM directly. Updates land on exactly the nodes that changed.',
    href: '/guides/why-svelte-kotlin/',
    label: 'Read the why-Svelte guide',
    sources: [
      {
        file: GUIDE,
        phrase:
          'Svelte is a compiler: a component becomes plain JavaScript that touches the DOM directly',
      },
      {
        file: GUIDE,
        phrase: 'Updates land on exactly the nodes that changed',
      },
    ],
  },
  {
    title: 'Small by budget',
    body: 'Small bundles by default: `pnpm size` measures package subpaths against budgets, the site publishes its page budgets on the performance page, and the entries still over budget are tracked in the open.',
    href: '/perf/',
    label: 'See the published budgets',
    sources: [{ file: GUIDE, phrase: 'Small bundles by default' }],
  },
  {
    title: 'Runes make state explicit',
    body: 'Runes make state explicit: in Svelte 5, $state, $derived and $effect put reactivity in the language surface, so a component contract stays readable and auditable.',
    href: '/guides/why-svelte-kotlin/',
    label: 'Read the why-Svelte guide',
    sources: [
      { file: GUIDE, phrase: 'Runes make state explicit' },
      { file: GUIDE, phrase: 'put reactivity in the language surface' },
    ],
  },
];

/**
 * The ladder, one verbatim excerpt per layer — real code from the real
 * packages, byte-checked by the unit test:
 *
 * - L0 texel: the roving texel in `@texuli/core` (framework-free, no
 *   Svelte anywhere);
 * - L1 primitive: the headless Toggle in `@texuli/primitives` (behavior and
 *   ARIA state, no styles);
 * - L3 component: the styled Badge in `texuli` (the token contract paints
 *   it) — the same badge whose contract the correlation section projects.
 */
export const WEB_WHY_LADDER: readonly WhyLadderRow[] = [
  {
    layer: 'texel',
    name: '@texuli/core',
    role: 'Texels are framework-free behavior and policy: keyboard roving, focus, overlays and the URL policy live in @texuli/core, importable from any runtime. Composite widgets use roving tabindex from @texuli/core/roving.',
    href: '/guides/accessibility/',
    label: 'See the accessibility contract',
    excerpt: {
      file: 'packages/core/src/roving/roving.ts',
      label: 'A texel, quoted verbatim: framework-free roving policy',
      code: `/**
 * True when a roving item cannot be chosen: \`disabled\`, \`aria-disabled="true"\`
 * or \`hidden\`. Disabled items are skipped by arrows, Home/End and typeahead.
 */
export function isItemDisabled(item: Element): boolean {
  return (
    item.hasAttribute('disabled') ||
    item.getAttribute('aria-disabled') === 'true' ||
    item.hasAttribute('hidden')
  );
}`,
    },
    sources: [
      { file: ARCHITECTURE, phrase: 'framework-free behavior and policy' },
      { file: A11Y_GUIDE, phrase: 'use roving tabindex from' },
    ],
  },
  {
    layer: 'primitive',
    name: '@texuli/primitives',
    role: '41 owned headless primitives, one subpath each, held to the WAI-ARIA APG patterns: behavior and ARIA state computed in the open, with no styles to fight.',
    href: '/primitives-page/',
    label: 'Browse the primitives',
    excerpt: {
      file: 'packages/primitives/src/toggle/Toggle.svelte',
      label: 'A primitive, quoted verbatim: the headless toggle ARIA state',
      code: `const attrs = $derived.by(
  (): ToggleRootAttrs => ({
    type: 'button',
    role: 'button',
    'aria-pressed': isPressed,
    'data-state': isPressed ? 'on' : 'off',
    ...(isDisabled ? { 'data-disabled': '' as const } : {}),
    disabled: isDisabled || undefined,
    tabindex: isDisabled ? -1 : 0,
    onclick: onClick,
    onkeydown: onKeydown,
    onkeyup: onKeyup,
    ...(typeof className === 'string' ? { class: className } : {}),
  })
);`,
    },
    sources: [
      { file: ARCHITECTURE, phrase: '41 owned headless primitives, one subpath each' },
      { file: ARCHITECTURE, phrase: 'held to the WAI-ARIA APG patterns' },
    ],
  },
  {
    layer: 'component',
    name: 'texuli',
    role: 'The styled components, layouts, shells layer: the catalog themed through the --tx-* token contract, light and dark by default — the same badge the correlation section projects to two languages.',
    href: '/component-pages/',
    label: 'Browse the component catalog',
    excerpt: {
      file: 'packages/texuli/src/components/badge/Badge.svelte',
      label: 'A component, quoted verbatim: the styled badge, whole file',
      code: `<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type BadgeVariant, badgeClass } from './variants.ts';
import './badge.css';

type Props = HTMLAttributes<HTMLSpanElement> & {
  /** Semantic fill. Filled pairs use token foregrounds for AA on small text. */
  variant?: BadgeVariant;
  /**
   * Plain-text label, rendered as escaped text. A non-empty \`label\`
   * replaces \`children\` when both are given.
   */
  label?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  variant = 'default',
  label,
  class: className,
  children,
  ...rest
}: Props = $props();

const hasLabel = $derived(typeof label === 'string' && label.length > 0);
</script>

<span bind:this={ref} class={badgeClass({ variant, class: className })} data-tx-badge data-variant={variant} {...rest}
  >{#if hasLabel}{label}{:else}{@render children?.()}{/if}</span
>`,
    },
    sources: [{ file: ARCHITECTURE, phrase: 'styled components, layouts, shells' }],
  },
];

/** The guarantee row: what the ladder is held to, whatever builds on it. */
export const WEB_WHY_GUARANTEES: readonly WhyClaim[] = [
  {
    title: 'No HTML sinks',
    body: 'No {@html} on anything that comes from props, content or an agent: hostile catalog trees meet the sink-free renderer, and the playground keeps a hostile corpus as presets — nothing there executes agent HTML or loads remote code.',
    href: '/playground/',
    label: 'Run the hostile presets',
    sources: [
      {
        file: STANDARDS,
        phrase: 'No {@html} on anything that comes from props, content or an agent',
      },
      {
        file: PLAYGROUND,
        phrase: 'executes agent HTML or loads remote code',
      },
    ],
  },
  {
    title: 'The URL policy on every link',
    body: 'Every rendered URL passes the URL policy: developer-authored props and untrusted agent links are different trust tiers, and a rejected value renders inert text instead.',
    href: '/guides/why-svelte-kotlin/',
    label: 'The tiers in context',
    sources: [{ file: SECURITY, phrase: 'Every rendered URL passes the URL policy' }],
  },
  {
    title: 'The accessibility contract',
    body: 'Texuli components target WCAG 2.1 A/AA: keyboard operation, associated labels, visible focus rings, and contrast measured in light, dark and forced-colors.',
    href: '/guides/accessibility/',
    label: 'Read the accessibility guide',
    sources: [{ file: A11Y_GUIDE, phrase: 'Texuli components target WCAG 2.1 A/AA' }],
  },
];

/** The section's closing CTA: the getting-started guide. */
export const WEB_WHY_CTA = {
  href: '/guides/getting-started/',
  label: 'Start building',
} as const;

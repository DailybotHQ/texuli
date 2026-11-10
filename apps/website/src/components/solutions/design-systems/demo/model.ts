/**
 * The design-systems demo model (PLAN_017 T-demo): the locked allowed set the visitor
 * toggles, the sample prototype it checks, and how the island reads the check results.
 * The check itself runs at build time (`build.ts`: `usageFromBlueprint` and
 * `checkLockedUsage` from `@texuli/tools/ds-check`, what `texuli ds validate --locked
 * --prototype` runs) once per toggle combination, so this module stays browser-safe and
 * imports nothing. Pure functions, unit-tested in
 * `apps/website/tests/solutions/design-systems-demo.test.ts`.
 */

/** The allow entries the visitor can switch off. */
export const DEMO_TOGGLES = [
  { id: 'badge', label: 'Badge', detail: 'the component' },
  { id: 'button-ghost', label: 'Button, ghost variant', detail: 'one variant' },
] as const;
export type DemoToggleId = (typeof DEMO_TOGGLES)[number]['id'];
export type DemoToggles = Readonly<Record<DemoToggleId, boolean>>;

export const DEMO_TOGGLES_ON: DemoToggles = Object.freeze({ badge: true, 'button-ghost': true });

const BUTTON_VARIANTS = ['default', 'secondary', 'outline', 'ghost'] as const;

/** The locked `allow` section for the toggles (catalog ids and axis values). */
export function demoAllow(toggles: DemoToggles): Record<string, Record<string, string[]>> {
  const allow: Record<string, Record<string, string[]>> = {
    card: { variants: ['elevated', 'flat'] },
    input: {},
    button: {
      variants: BUTTON_VARIANTS.filter((variant) => variant !== 'ghost' || toggles['button-ghost']),
    },
  };
  if (toggles.badge) allow.badge = { variants: ['default', 'secondary', 'outline'] };
  return allow;
}

/** The sample prototype: a catalog tree, as a blueprint carries it. */
export const DEMO_PROTOTYPE = Object.freeze({
  tree: {
    id: 'card',
    props: { variant: 'elevated' },
    children: [
      { id: 'input', props: { label: 'Work email' } },
      { id: 'button', props: { variant: 'default', label: 'Join the beta' } },
      { id: 'button', props: { variant: 'ghost', label: 'Maybe later' } },
      { id: 'badge', props: { variant: 'secondary', label: 'New' } },
    ],
  },
});

export interface DemoFinding {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

/** Every toggle combination, keyed by `demoToggleKey`. */
export function demoToggleCombinations(): DemoToggles[] {
  const out: DemoToggles[] = [];
  for (let mask = 0; mask < 2 ** DEMO_TOGGLES.length; mask++) {
    const entry = {} as Record<DemoToggleId, boolean>;
    DEMO_TOGGLES.forEach((toggle, index) => {
      entry[toggle.id] = (mask & (1 << index)) === 0;
    });
    out.push(entry);
  }
  return out;
}

/** A stable key for a toggle combination (`badge:on,button-ghost:off`). */
export function demoToggleKey(toggles: DemoToggles): string {
  return DEMO_TOGGLES.map((toggle) => `${toggle.id}:${toggles[toggle.id] ? 'on' : 'off'}`).join(
    ','
  );
}

/** The precomputed findings for the toggles; an unknown combination reads as not checked. */
export function demoFindingsFor(
  checks: Readonly<Record<string, readonly DemoFinding[]>>,
  toggles: DemoToggles
): readonly DemoFinding[] | undefined {
  const key = demoToggleKey(toggles);
  return Object.hasOwn(checks, key) ? checks[key] : undefined;
}

/** Whether the prototype node at `index` (a child of the card) passes the check. */
export function demoNodeAllowed(findings: readonly DemoFinding[], index: number): boolean {
  const prefix = `$.tree.children[${index}]`;
  return !findings.some((finding) => finding.path.startsWith(prefix));
}

/** The one-line summary the live region announces. */
export function demoCheckSummary(findings: readonly DemoFinding[]): string {
  if (findings.length === 0)
    return 'Locked check passed: every component in the prototype is allowed.';
  const codes = [...new Set(findings.map((finding) => finding.code))].join(', ');
  return `Locked check failed: ${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} (${codes}).`;
}

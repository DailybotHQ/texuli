/**
 * The Design systems demo section copy (PLAN_017 T-demo). The island
 * (`DesignSystemsDemo.svelte`) runs on build-time results of `generateDesignSystem` for
 * three fictional brands, and the locked check of a sample prototype that `checkLockedUsage`
 * (`@texuli/tools/ds-check`) ran at build time.
 */
import type { SolutionDemoFrameProps } from '../../shared/types.ts';
import { LEDGERLINE_DEMO_FIXTURE } from './fixtures/ledgerline.ts';

export const DESIGN_SYSTEMS_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Lock a brand in a minute.',
  label: 'Design systems demo',
  tryThis: [
    'Pick a brand input: a brief, a token file or a stylesheet. Read what was dropped or repaired.',
    'Preview the generated brand on real components, in light and dark.',
    'Switch Badge or the ghost button off, and watch the locked check report the finding.',
    'Note the status: draft. Approval is a person and a reviewed commit, not a button here.',
  ],
};

/** The full kit of a finished example brand, for a deeper look. */
export const DESIGN_SYSTEMS_DEMO_LINK = {
  label: 'See a full kit: Ledgerline',
  href: LEDGERLINE_DEMO_FIXTURE.reference,
} as const;

export const DESIGN_SYSTEMS_DEMO_LIMITS =
  'Fictional brands. The drafts were generated when this site was built, and the check runs on a sample prototype, not your app.';

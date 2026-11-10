/**
 * The Design systems demo section. Until T-demo mounts its island (PLAN_017), the section
 * is static: what the visitor can do today is open the Ledgerline kit, a fictional brand
 * rendered by `texuli/ds-kit`. T-demo replaces `tryThis` with the island's own steps.
 */
import type { SolutionDemoFrameProps } from '../../shared/types.ts';
import { LEDGERLINE_DEMO_FIXTURE } from './fixtures/ledgerline.ts';

export const DESIGN_SYSTEMS_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'See a locked brand.',
  label: 'Design systems demo',
  tryThis: [
    'Open the Ledgerline kit: every component the fictional brand allows, in light and dark.',
    'Compare the allowed variants with the ones the kit marks as not allowed.',
    'Read the approval record and its content-hash check at the end of the kit.',
  ],
};

export const DESIGN_SYSTEMS_DEMO_LINK = {
  label: 'Open the Ledgerline kit',
  href: LEDGERLINE_DEMO_FIXTURE.reference,
} as const;

export const DESIGN_SYSTEMS_DEMO_LIMITS =
  'Ledgerline is a fictional brand. The interactive demo is not on this page yet.';

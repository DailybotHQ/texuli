/**
 * Fragments and steps of deck model v2 (model-v2 §3.7): one algorithm for
 * blocks, list items, code highlights and layout props markers, with dense
 * renumbering and Protoyard's fragment phases.
 */
export {
  activeCodeHighlight,
  FRAGMENT_PHASES,
  type FragmentPhase,
  fragmentPhase,
  isPhaseShown,
} from './phase.ts';
export {
  type FragmentKind,
  REVEAL_EFFECT,
  type SlideFragment,
  type SlideStep,
  type SlideSteps,
  type SlideStepsOptions,
  STEP_CODES,
  type StepCode,
  type StepDiagnostic,
  type StepMarkerFields,
  type StepSource,
  type StepSourceBlock,
  slideFragments,
  slideStepCount,
  slideSteps,
  steppablePattern,
} from './slide-steps.ts';

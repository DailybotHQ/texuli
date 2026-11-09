/**
 * `texuli/ds-kit` (ADR-032; kit API `decisions/kit-api.md`): a whole design system on one
 * page, from data. `DesignSystemKit` takes a design-system document, its compiled output,
 * the allow manifest and the catalog; each section is also exported on its own. A subpath of
 * its own: the `texuli` root never imports it. No network and no HTML sinks.
 */

export { default as DesignSystemKit } from './DesignSystemKit.svelte';
export { default as KitFoundations } from './foundations/KitFoundations.svelte';
export {
  FOUNDATION_GROUPS,
  type FoundationGroup,
  type FoundationGroupId,
  type FoundationsModel,
  type FoundationToken,
  foundationGroupOf,
  foundationItems,
  foundationsModel,
} from './foundations/model.ts';
export {
  type KitApprovalView,
  type KitHashCheck,
  kitApproval,
  kitContentHash,
} from './shared/approval.ts';
export { default as KitApproval } from './shared/KitApproval.svelte';
export { default as KitModeSwitch } from './shared/KitModeSwitch.svelte';
export { KIT_LIMITS, kitIdPart, kitText } from './shared/limits.ts';
export {
  KIT_DEFAULT_PREFIX,
  KIT_SECTIONS,
  type KitSectionMeta,
  kitItemId,
  kitSectionId,
  kitVisibleSections,
} from './shared/navigation.ts';
export type {
  DesignSystemKitProps,
  KitAllowManifest,
  KitAxis,
  KitCatalog,
  KitCompiled,
  KitLibraryEntry,
  KitLibrarySnippet,
  KitMode,
  KitModeView,
  KitSampleContext,
  KitSectionId,
  KitState,
} from './shared/types.ts';
export { default as KitVoice } from './voice/KitVoice.svelte';
export {
  type VoiceAccessibility,
  type VoiceLexiconRow,
  type VoiceModel,
  type VoiceRules,
  type VoiceText,
  voiceItems,
  voiceModel,
} from './voice/model.ts';

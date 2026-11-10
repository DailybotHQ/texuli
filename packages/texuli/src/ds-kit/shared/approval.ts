/**
 * Re-export of the Svelte-free approval model from `@texuli/spec/design-system`
 * (T-017-kit). No API break: `texuli/ds-kit` still exports `kitApproval` and
 * `kitContentHash`.
 */
export {
  type KitApprovalView,
  type KitHashCheck,
  kitApproval,
  kitContentHash,
} from '@texuli/spec/design-system';

/**
 * `@texuli/blocks/i18n` — every block label id with its English default
 * (ADR-026). Translate them once, near the root, with `setTexuliLabels` or
 * `<LabelsProvider>` from `texuli`; a block's own `labels` prop still wins.
 */
export { BLOCKS_MESSAGES_EN, type BlocksMessageId } from './messages.en.ts';

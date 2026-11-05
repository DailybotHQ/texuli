/** Component labels through `@texuli/core/i18n` (ADR-016), and one dictionary for all of them (ADR-026). */

export { default as LabelsProvider } from './LabelsProvider.svelte';
export { TEXULI_MESSAGES_EN, type TexuliMessageId } from './messages.en.ts';
export type { TexuliLabels } from './types.ts';
export {
  getI18nContext,
  setI18nContext,
  setTexuliLabels,
  type TexuliLabelsOptions,
  useMessages,
} from './use-messages.ts';

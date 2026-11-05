/** Component labels through `@texuli/core/i18n` (ADR-016), and one dictionary for all of them (ADR-026). */

export { PRIMITIVES_MESSAGES_EN, type PrimitivesMessageId } from './messages.en.ts';
export {
  getI18nContext,
  setI18nContext,
  useMessages,
} from './use-messages.ts';

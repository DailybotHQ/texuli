import type { LabelDictionary } from '@texuli/core/i18n';
import type { PrimitivesMessageId } from '@texuli/primitives';
import type { TexuliMessageId } from './messages.en.ts';

/**
 * A dictionary for every label `texuli` and `@texuli/primitives` write
 * (ADR-026). Domain packages export their own id unions; join them:
 * `LabelDictionary<TexuliMessageId | PrimitivesMessageId | BlocksMessageId>`.
 */
export type TexuliLabels = LabelDictionary<TexuliMessageId | PrimitivesMessageId>;

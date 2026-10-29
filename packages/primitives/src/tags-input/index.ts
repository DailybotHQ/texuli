/**
 * TagsInput: owned, headless tags input (T-prim-tags-input), composed as
 * `TagsInput.*`: `Root`, `List`, `Tag`, `TagRemove` and `Input`.
 */
import Input from './TagsInputInput.svelte';
import List from './TagsInputList.svelte';
import Root from './TagsInputRoot.svelte';
import Tag from './TagsInputTag.svelte';
import TagRemove from './TagsInputTagRemove.svelte';

export const TagsInput = { Root, List, Tag, TagRemove, Input };

export { DEFAULT_TAGS_INPUT_LABELS, type TagsInputLabels } from './labels.ts';
export {
  addTags,
  isDelimiterKey,
  splitTags,
  type TagDecision,
  type TagDelimiter,
  type TagRejection,
  type TagRules,
} from './tags.ts';
export type {
  TagsInputInputProps,
  TagsInputInvalidDetail,
  TagsInputListProps,
  TagsInputRootProps,
  TagsInputTagProps,
  TagsInputTagRemoveProps,
} from './types.ts';

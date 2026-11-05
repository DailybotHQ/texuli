/**
 * `@texuli/blocks/code-field` (D-G-022, new in 0.13.1): an editable,
 * syntax-highlighted code field. `<CodeField bind:value language="ts" />`
 * puts a real textarea over the owned tokenizer's output, printed as
 * elements (never HTML). It bundles every grammar, so the server renders the
 * highlighted value and the first paint matches it. The read-only
 * `CodeBlockView` stays on `@texuli/blocks/code/renderers`.
 */

export { default as CodeField } from './CodeField.svelte';
export {
  applyCodeFieldEdit,
  CODE_FIELD_HIGHLIGHT_LIMIT,
  CODE_FIELD_SYNC_LIMIT,
  type CodeFieldEdit,
  type CodeFieldLabels,
  type CodeFieldProps,
  DEFAULT_CODE_FIELD_LABELS,
  indentEdit,
  indentUnit,
  newlineEdit,
  resolveCodeFieldLabels,
} from './code-field.ts';

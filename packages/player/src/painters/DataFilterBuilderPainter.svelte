<script lang="ts">
import {
  emptyFilter,
  FilterBuilder,
  type FilterField,
  type FilterGroup,
  parseFilter,
} from '@texuli/data/filter-builder';
import { getPlayerInteraction } from '../context.ts';

/**
 * `data-filter-builder`: fields from plain JSON and an optional starting
 * filter, parsed against those fields within the engine's limits; one that
 * does not fit starts empty. Edits stay in view and run `on.change` (no
 * spec state type holds a nested filter, so `value` is not bindable).
 * `optionLabels` gives an enum value its menu text; `issues` show under
 * their conditions.
 */
interface Field {
  key: string;
  header: string;
  type: FilterField['type'];
  options?: readonly string[];
  optionLabels?: Readonly<Record<string, string>>;
}

let {
  label,
  fields,
  value,
  maxDepth = 3,
  issues,
  disabled = false,
  txPath,
}: {
  label: string;
  fields: readonly Field[];
  value?: unknown;
  maxDepth?: number;
  issues?: readonly { path: readonly number[]; message: string }[];
  disabled?: boolean;
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
const fieldDefs = $derived(
  fields.map(
    (field): FilterField => ({
      key: field.key,
      header: field.header,
      type: field.type,
      ...(field.options
        ? {
            options: field.options.map((option) => {
              const text = Object.hasOwn(field.optionLabels ?? {}, option)
                ? field.optionLabels?.[option]
                : undefined;
              return text ? { value: option, label: text } : option;
            }),
          }
        : {}),
    })
  )
);

function start(input: unknown, defs: readonly FilterField[]): FilterGroup {
  if (input === undefined) return emptyFilter();
  try {
    return parseFilter(input, defs);
  } catch {
    return emptyFilter();
  }
}

let model = $state.raw<FilterGroup>(emptyFilter());
$effect.pre(() => {
  model = start(value, fieldDefs);
});
</script>

<section class="tx-player-data" aria-label={label}>
  <FilterBuilder
    fields={fieldDefs}
    bind:value={model}
    {maxDepth}
    {issues}
    {disabled}
    onValueChange={() => {
      if (txPath !== undefined) interaction?.dispatch(txPath, 'change');
    }}
  />
</section>

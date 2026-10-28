<script lang="ts">
import { untrack } from 'svelte';
import {
  applyFilter,
  emptyFilter,
  FilterBuilder,
  type FilterField,
  type FilterGroup,
} from '../../src/filter-builder/index.ts';

export interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  won: boolean;
  closes: string;
}

let { value = emptyFilter(), maxDepth }: { value?: FilterGroup; maxDepth?: number } = $props();
// The harness owns the model after mount; `value` seeds it once.
let model = $state<FilterGroup>(untrack(() => value));

const fields: FilterField<Deal>[] = [
  { key: 'name', header: 'Deal', type: 'text' },
  { key: 'stage', header: 'Stage', type: 'enum', options: ['open', 'won', 'lost'] },
  { key: 'amount', header: 'Amount', type: 'number' },
  { key: 'won', header: 'Won', type: 'boolean' },
  { key: 'closes', header: 'Closes', type: 'date' },
];
const deals: Deal[] = [
  {
    id: 'd1',
    name: 'Harbor renewal',
    stage: 'won',
    amount: 12000,
    won: true,
    closes: '2026-01-15',
  },
  { id: 'd2', name: 'Atlas pilot', stage: 'open', amount: 4500, won: false, closes: '2026-03-02' },
  {
    id: 'd3',
    name: 'Pine expansion',
    stage: 'lost',
    amount: 900,
    won: false,
    closes: '2026-02-10',
  },
];
const matches = $derived(applyFilter(deals, model, fields).map((deal) => deal.id));
</script>

<FilterBuilder {fields} bind:value={model} {...maxDepth ? { maxDepth } : {}} />
<output data-testid="model">{JSON.stringify(model)}</output>
<output data-testid="matches">{matches.join(',')}</output>

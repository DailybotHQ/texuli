<script lang="ts">
import { untrack } from 'svelte';
import {
  applyFilter,
  emptyFilter,
  FilterBuilder,
  type FilterField,
  type FilterFieldGroup,
  type FilterGroup,
  type FilterOperatorDef,
} from '../../src/filter-builder/index.ts';

export interface Account {
  id: string;
  name: string;
  plan: string;
  seats: number;
  renews: string;
}

let { value = emptyFilter() }: { value?: FilterGroup } = $props();
let model = $state<FilterGroup>(untrack(() => value));

const groups: FilterFieldGroup[] = [
  { id: 'billing', label: 'Billing' },
  { id: 'usage', label: 'Usage' },
];
const fields: FilterField<Account>[] = [
  { key: 'name', header: 'Account', type: 'text' },
  {
    key: 'plan',
    header: 'Plan',
    type: 'enum',
    options: ['free', 'team', 'enterprise'],
    group: 'billing',
  },
  { key: 'renews', header: 'Renews', type: 'date', group: 'billing' },
  { key: 'seats', header: 'Seats', type: 'number', group: 'usage' },
];
const operators: FilterOperatorDef<Account>[] = [
  {
    id: 'atLeastSeats',
    label: 'has at least',
    editor: 'number',
    types: ['number'],
    validate: (value) => (typeof value === 'number' && value > 1000 ? 'At most 1000 seats' : null),
    test: (cell, value) => typeof cell === 'number' && cell >= (value as number),
  },
];
const accounts: Account[] = [
  { id: 'a1', name: 'Harbor', plan: 'team', seats: 40, renews: '2026-11-01' },
  { id: 'a2', name: 'Atlas', plan: 'free', seats: 3, renews: '2027-01-15' },
  { id: 'a3', name: 'Pine', plan: 'enterprise', seats: 900, renews: '2026-12-01' },
];
const matches = $derived(applyFilter(accounts, model, fields, operators).map((a) => a.id));
</script>

<FilterBuilder {fields} {operators} {groups} bind:value={model} />
<output data-testid="model">{JSON.stringify(model)}</output>
<output data-testid="matches">{matches.join(',')}</output>

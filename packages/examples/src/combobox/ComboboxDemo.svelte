<script lang="ts">
import type { ComboboxItemData } from 'texuli/combobox';
import { Combobox, MultiSelect } from 'texuli/combobox';

const people: ComboboxItemData[] = [
  { value: 'ada', label: 'Ada Example' },
  { value: 'grace', label: 'Grace Harbor' },
  { value: 'linus', label: 'Linus Notes' },
  { value: 'nina', label: 'Nina Sketch', disabled: true },
];

const tags: ComboboxItemData[] = [
  { value: 'design', label: 'Design' },
  { value: 'docs', label: 'Docs' },
  { value: 'release', label: 'Release' },
  { value: 'support', label: 'Support' },
];

let assignee = $state('grace');
let assigneeOpen = $state(true);
let multi = $state<string[]>(['design']);
let multiOpen = $state(false);
let asyncValue = $state('');
let asyncOpen = $state(false);
let failOnce = $state(true);

async function loadPeople(
  query: string,
  signal: AbortSignal
): Promise<readonly ComboboxItemData[]> {
  await new Promise((r) => setTimeout(r, 40));
  if (signal.aborted) return [];
  if (failOnce && query.toLowerCase().includes('fail')) {
    failOnce = false;
    throw new Error('Harbor directory offline (simulated)');
  }
  const q = query.trim().toLowerCase();
  return people.filter((p) => !q || p.label.toLowerCase().includes(q));
}
</script>

<section data-example="texuli-combobox" aria-labelledby="tx-combobox-title">
  <h2 id="tx-combobox-title">Combobox and MultiSelect</h2>
  <p>
    Harbor Notes assignee search and tag multi-select. Fictional people only — async demo can
    type “fail” once to exercise error + retry.
  </p>

  <h3>Default (open)</h3>
  <div data-axis="default" class="field">
    <label for="assignee-input">Assignee</label>
    <Combobox.Root bind:value={assignee} bind:open={assigneeOpen} items={people}>
      <Combobox.Field open={assigneeOpen}>
        <Combobox.Input id="assignee-input" placeholder="Search people" />
        <Combobox.Trigger aria-label="Show people" />
      </Combobox.Field>
      <Combobox.Portal>
        <Combobox.Content aria-label="People">
          <Combobox.Empty />
          <Combobox.Viewport>
            {#snippet children(item)}
              <Combobox.Item value={item.value} label={item.label} disabled={item.disabled}>
                {item.label}
              </Combobox.Item>
            {/snippet}
          </Combobox.Viewport>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox.Root>
  </div>

  <h3>MultiSelect chips</h3>
  <div data-axis="multiselect" class="field">
    <label for="tags-input">Tags</label>
    <MultiSelect.Root bind:value={multi} bind:open={multiOpen} items={tags}>
      <MultiSelect.Field open={multiOpen} variant="soft">
        <MultiSelect.Chips aria-label="Selected tags">
          {#each multi as tag (tag)}
            <MultiSelect.Chip value={tag} />
          {/each}
        </MultiSelect.Chips>
        <MultiSelect.Input id="tags-input" placeholder="Add tag" />
        <MultiSelect.Trigger aria-label="Show tags" />
      </MultiSelect.Field>
      <MultiSelect.Portal>
        <MultiSelect.Content aria-label="Tags">
          <MultiSelect.Empty />
          <MultiSelect.Viewport>
            {#snippet children(item)}
              <MultiSelect.Item value={item.value} label={item.label}>{item.label}</MultiSelect.Item>
            {/snippet}
          </MultiSelect.Viewport>
        </MultiSelect.Content>
      </MultiSelect.Portal>
    </MultiSelect.Root>
  </div>

  <h3>Async + empty/error</h3>
  <div data-axis="async" class="field">
    <label for="async-input">Directory search</label>
    <Combobox.Root
      bind:value={asyncValue}
      bind:open={asyncOpen}
      items={[]}
      loadOptions={loadPeople}
    >
      <Combobox.Field open={asyncOpen}>
        <Combobox.Input id="async-input" placeholder="Type to search (try fail)" />
        <Combobox.Trigger aria-label="Show directory" />
      </Combobox.Field>
      <Combobox.Portal>
        <Combobox.Content aria-label="Directory results">
          <Combobox.Loading />
          <Combobox.Empty />
          <Combobox.Error />
          <Combobox.Viewport>
            {#snippet children(item)}
              <Combobox.Item value={item.value} label={item.label}>{item.label}</Combobox.Item>
            {/snippet}
          </Combobox.Viewport>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox.Root>
  </div>

  <h3>Disabled</h3>
  <div data-axis="disabled" class="field">
    <Combobox.Root value="" items={people} disabled>
      <Combobox.Field disabled>
        <Combobox.Input placeholder="Disabled" />
        <Combobox.Trigger />
      </Combobox.Field>
    </Combobox.Root>
  </div>

  <h3>RTL</h3>
  <div data-axis="rtl" dir="rtl" lang="ar" class="field">
    <label for="rtl-input">المكلف</label>
    <Combobox.Root items={people}>
      <Combobox.Field>
        <Combobox.Input id="rtl-input" placeholder="بحث" />
        <Combobox.Trigger aria-label="عرض" />
      </Combobox.Field>
      <Combobox.Portal>
        <Combobox.Content>
          <Combobox.Viewport>
            {#snippet children(item)}
              <Combobox.Item value={item.value} label={item.label}>{item.label}</Combobox.Item>
            {/snippet}
          </Combobox.Viewport>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox.Root>
  </div>

  <h3>Dark</h3>
  <div data-axis="dark" data-tx-mode="dark" class="dark-panel field">
    <Combobox.Root items={people} variant="soft">
      <Combobox.Field variant="soft">
        <Combobox.Input placeholder="Dark search" />
        <Combobox.Trigger />
      </Combobox.Field>
      <Combobox.Portal>
        <Combobox.Content>
          <Combobox.Viewport>
            {#snippet children(item)}
              <Combobox.Item value={item.value} label={item.label}>{item.label}</Combobox.Item>
            {/snippet}
          </Combobox.Viewport>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox.Root>
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    max-inline-size: 28rem;
  }

  .field {
    display: grid;
    gap: 0.35rem;
    justify-items: stretch;
  }

  label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .dark-panel {
    padding: 1rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, #0a0a0a);
    color: var(--tx-foreground, #fafafa);
  }
</style>

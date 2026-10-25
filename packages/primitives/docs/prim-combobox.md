# Combobox

`@texuli/primitives/combobox` exports a headless Svelte 5 combobox built from owned behavior. Its input keeps DOM focus while `aria-activedescendant` tracks the highlighted option. The listbox is filtered from `items` by the input text, and `loadOptions(query, signal)` can provide remote results; a new query or unmount aborts the previous request.

```svelte
<script lang="ts">
  import { Combobox } from '@texuli/primitives/combobox';
  const people = [{ value: 'ada', label: 'Ada Example' }];
  let value = $state('');
  let inputValue = $state('');
</script>

<label for="assignee">Assignee</label>
<Combobox.Root bind:value bind:inputValue items={people}>
  <Combobox.Input id="assignee" />
  <Combobox.Trigger aria-label="Show people">Open</Combobox.Trigger>
  <Combobox.Portal>
    <Combobox.Content>
      <Combobox.Viewport>
        {#snippet children(person)}
          <Combobox.Item value={person.value}>{person.label}</Combobox.Item>
        {/snippet}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
```

For async data, pass `loadOptions={(query, signal) => searchPeople(query, signal)}`. The callback should honor the abort signal. A rejected promise leaves the option list empty and sets `status` to `error`; `Combobox.Error` renders a `role="alert"` with an optional Retry button that calls `retry()`. `Combobox.Empty` shows when the open list has nothing to show: local items that are empty or filtered out (even before typing), or an async load that returned none (opening alone does not load, so an unloaded async list stays idle); `Combobox.Loading` shows while a request is in flight (the input also sets `aria-busy`). `multiple` enables toggling selections and the `Chips`, `Chip`, and `ChipRemove` parts; the input is cleared after each selection. `Viewport` renders all options up to 200, then keeps a small fixed-height window and spacer elements for larger collections. Set `itemSize` to match the option row height when customizing virtualization.

```svelte
<Combobox.Content>
  <Combobox.Loading />
  <Combobox.Empty>No people match.</Combobox.Empty>
  <Combobox.Error retryLabel="Try again" />
  <Combobox.Viewport>
    {#snippet children(person)}
      <Combobox.Item value={person.value}>{person.label}</Combobox.Item>
    {/snippet}
  </Combobox.Viewport>
</Combobox.Content>
```

The primitive is headless: consumers own option and chip styling. Inputs expose the combobox pattern, options expose `role="option"` and selected/disabled state, and keyboard navigation supports Arrow Up/Down, Enter, Escape and Backspace chip removal.

## Filtering

By default an item matches when its label contains the trimmed query, ignoring case. Accents count: "sao" does not find "São Paulo". Pass `filter={(item, query) => boolean}` to replace that rule; it is never combined with the default. The filter runs only when the trimmed query is not empty (an empty query shows every item), and it receives the trimmed query. It does not apply with `loadOptions`, where the server decides.

For accent-insensitive search, `foldSearchText(text, locale?)` lower-cases in the locale, decomposes (NFD) and strips combining marks. `createFoldedFilter({ fields?, locale? })` builds a filter from it that searches the label by default; add the value to match ids too:

```svelte
<script lang="ts">
  import { Combobox, createFoldedFilter } from '@texuli/primitives/combobox';
  const zones = [
    { value: 'America/Sao_Paulo', label: 'São Paulo' },
    { value: 'America/New_York', label: 'New York' },
  ];
  // "sao paulo" finds São Paulo; "new_york" finds America/New_York.
  const filter = createFoldedFilter({ fields: (zone) => [zone.label, zone.value] });
</script>

<Combobox.Root items={zones} {filter}>…</Combobox.Root>
```

## Forms

Give the root a `name` to submit the selection with the surrounding form. A single combobox submits one entry (empty when nothing is selected); with `multiple` it submits one entry per selected value, and none when empty.

- `required`: the form does not submit until a value is selected. When the browser rejects the form, focus moves to the input. `requiredMessage` replaces the browser's message (pass a translated string); without it the browser's own message shows.
- `disabled`: nothing is submitted and the field is not validated.
- `form`: the id of a form the combobox belongs to when it is outside it.
- **Reset:** the form's reset restores `defaultValue` (and its label in the input).

The constraint field is the shared `@texuli/core/form-bridge` input placed after the combobox input. It is unnamed, so only the values submit, through hidden fields. It exists while the combobox has a `name` or is `required`, and follows `name`, `required` and `form` after mount (no remount).

```svelte
<form>
  <label for="city">City</label>
  <Combobox.Root items={cities} name="city" required requiredMessage="Choose a city." defaultValue="Europe/Lisbon">
    <Combobox.Input id="city" />
    …
  </Combobox.Root>
</form>
```

Sizes (gzip): `@texuli/primitives/combobox` went from 14.58 to 15.58 KiB with this change; it is 15.72 KiB today (`pnpm size`, 2026-10-24; budget 24 KiB).

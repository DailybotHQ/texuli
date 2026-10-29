<script lang="ts">
// Keeps the first match active while the menu is open, so Enter inserts the
// best match at once and `aria-activedescendant` always names an option.
import { getComboboxContext } from '@texuli/primitives/combobox';

let { first }: { first: string | undefined } = $props();
const combobox = getComboboxContext();

$effect(() => {
  const active = combobox.activeValue;
  const items = combobox.items;
  if (!combobox.open || first === undefined) return;
  if (active === undefined || !items.some((item) => item.value === active))
    combobox.setActive(first);
});
</script>

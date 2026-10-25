<script lang="ts">
import type { ComponentProps } from 'svelte';
import SheetContent from './SheetContent.svelte';

type Props = Omit<ComponentProps<typeof SheetContent>, 'side' | 'drag' | 'modal'> & {
  /** Where the bottom drawer replaces the centered dialog. */
  query?: string;
};
let { query = '(max-width: 40rem)', activeSnapPoint = $bindable(), ...rest }: Props = $props();

let phone = $state(false);
$effect(() => {
  const media = globalThis.matchMedia?.(query);
  if (!media) return;
  const update = () => (phone = media.matches);
  update();
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
});
</script>

<!-- A dialog on wide screens and a bottom drawer on phones (data-side tells which). -->
<SheetContent {...rest} side={phone ? 'bottom' : 'center'} drag={phone} bind:activeSnapPoint />

<script lang="ts">
import type { ComponentProps } from 'svelte';
import { type ResponsivePresentation, resolveResponsivePresentation } from './model.ts';
import SheetContent from './SheetContent.svelte';

type Props = Omit<ComponentProps<typeof SheetContent>, 'side' | 'drag' | 'modal'> & {
  /** Where the bottom drawer replaces the centered dialog (a viewport media query). */
  query?: string;
  /**
   * `auto` (default) picks from the width; `dialog` or `sheet` always shows
   * that presentation and ignores the width.
   */
  force?: ResponsivePresentation | 'auto';
  /**
   * Size by this element's inline size instead of the viewport (a preview
   * frame, a split pane). Observed with a `ResizeObserver`; `query` is then
   * ignored and `breakpoint` decides.
   */
  host?: Element | null;
  /** With `host`: the inline size in px at or below which the sheet shows. Default 640 (40rem). */
  breakpoint?: number;
};
let {
  query = '(max-width: 40rem)',
  force = 'auto',
  host = null,
  breakpoint = 640,
  activeSnapPoint = $bindable(),
  ...rest
}: Props = $props();

// Server render and first client frame: the dialog (no width is known yet).
let narrow = $state(false);
$effect(() => {
  if (force !== 'auto') return;
  if (host) {
    const element = host;
    const limit = breakpoint;
    const update = () => (narrow = element.getBoundingClientRect().width <= limit);
    update();
    const Observer = element.ownerDocument.defaultView?.ResizeObserver;
    if (!Observer) return;
    const observer = new Observer(update);
    observer.observe(element);
    return () => observer.disconnect();
  }
  const media = globalThis.matchMedia?.(query);
  if (!media) return;
  const update = () => (narrow = media.matches);
  update();
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
});
const presentation = $derived(resolveResponsivePresentation(force, narrow));
</script>

<!-- A dialog on wide screens (or hosts) and a bottom drawer on narrow ones (data-side tells which). -->
<SheetContent
  {...rest}
  side={presentation === 'sheet' ? 'bottom' : 'center'}
  drag={presentation === 'sheet'}
  data-presentation={presentation}
  bind:activeSnapPoint
/>

<script lang="ts">
/**
 * One live sample of the matrix (kit API §5.2): the real component, loaded lazily, with the
 * combination's axis props and the state's props. The component paints its own root
 * attributes; the kit adds none on it. While it loads, the cell shows the combination as
 * text, so the matrix stays complete as data.
 */
import type { KitBuiltinSample } from './samples.ts';

type Props = {
  sample: KitBuiltinSample;
  /** Axis props and state props, merged over the sample's own. */
  props: Readonly<Record<string, unknown>>;
  /** Text shown while the component loads. */
  pending: string;
};

let { sample, props, pending }: Props = $props();

const merged = $derived({ ...sample.props, ...props });
const loading = $derived(sample.load());
</script>

{#await loading}
  <span class="tx-ds-kit__muted">{pending}</span>
{:then mod}
  {@const Sample = mod.default}
  {#if sample.text}
    <Sample {...merged}>{sample.text}</Sample>
  {:else}
    <Sample {...merged} />
  {/if}
{:catch}
  <span class="tx-ds-kit__muted">{pending}</span>
{/await}

<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import { renderCompositionSvg } from './render.ts';
import SvgNode from './SvgNode.svelte';
import type { RenderCompositionSvgOptions } from './types.ts';
import './composition-svg.css';

type Props = RenderCompositionSvgOptions & {
  composition: unknown;
  class?: ClassValue;
};

let {
  composition,
  trust = 'untrusted',
  title = 'Composition',
  description,
  validate = true,
  focusable = true,
  class: className,
}: Props = $props();

const result = $derived(
  renderCompositionSvg(composition, {
    trust,
    title,
    description,
    validate,
    focusable: false,
    className: 'tx-composition-svg__canvas',
  })
);

const shellClass = $derived(cx('tx-composition-svg', className));
</script>

{#if result.ok}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <figure
    class={shellClass}
    data-tx-composition-svg="true"
    data-tx-composition-ok="true"
    role="group"
    tabindex={focusable ? 0 : undefined}
    aria-label={title}
  >
    <SvgNode node={result.root} />
  </figure>
{:else}
  <div
    class={cx(shellClass, 'tx-composition-svg--error')}
    role="alert"
    data-tx-composition-svg="true"
    data-tx-composition-ok="false"
  >
    <p>Composition could not be rendered.</p>
    <ul>
      {#each result.errors as issue (issue.path + issue.code)}
        <li><code>{issue.path}</code>: {issue.message}</li>
      {/each}
    </ul>
  </div>
{/if}

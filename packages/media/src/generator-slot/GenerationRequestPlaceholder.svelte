<script lang="ts">
import './generator-slot.css';
import { parseMediaGenerationRequest } from './request-node.ts';

let { node }: { node: unknown } = $props();
let parsed = $derived(parseMediaGenerationRequest(node));
</script>

{#if parsed.success}
  <div
    class="tx-generator-request"
    data-tx-generator-request
    data-kind={parsed.node.props.kind}
    data-aspect-ratio={parsed.node.props.aspectRatio ?? '16:9'}
    role="status"
    aria-label={`${parsed.node.props.kind === 'image' ? 'Image' : 'Video'} request pending host resolution`}
    style:background-color={parsed.node.props.placeholder?.color}
  >
    <span class="tx-generator-request__kind">
      {parsed.node.props.kind === 'image' ? 'Image' : 'Video'} request pending
    </span>
    <span class="tx-generator-request__description">Waiting for the host to resolve this request.</span>
  </div>
{:else}
  <p class="tx-generator-request__error" role="alert">Media request is invalid.</p>
{/if}

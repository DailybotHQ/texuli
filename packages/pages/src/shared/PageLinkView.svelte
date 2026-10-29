<script lang="ts">
// A link to a nested page. The host owns navigation: with `pageHref` it is
// a link (through `safeHref`), and `onNavigate` takes the click; without an
// href it is a button that calls `onNavigate`.
import type { PageLinkBlock } from '@texuli/document/model';
import { pageLinkHref } from './media.ts';

let {
  node,
  label,
  onNavigate,
  pageHref,
  tabindex,
}: {
  node: PageLinkBlock;
  label: string;
  onNavigate?: ((ref: string) => void) | undefined;
  pageHref?: ((ref: string) => string | null | undefined) | undefined;
  tabindex?: number | undefined;
} = $props();
const href = $derived(pageLinkHref(node.ref, pageHref));

function onclick(event: MouseEvent): void {
  if (!onNavigate) return;
  if (href && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
  event.preventDefault();
  onNavigate(node.ref);
}
</script>

{#if href}
  <a class="tx-pages-page-link" {href} {onclick} {tabindex} aria-label={label} data-ref={node.ref}>
    <span class="tx-pages-page-link__icon" aria-hidden="true">▤</span>
    <span>{node.title}</span>
  </a>
{:else}
  <button type="button" class="tx-pages-page-link" {onclick} {tabindex} aria-label={label} disabled={!onNavigate} data-ref={node.ref}>
    <span class="tx-pages-page-link__icon" aria-hidden="true">▤</span>
    <span>{node.title}</span>
  </button>
{/if}

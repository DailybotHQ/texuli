<script lang="ts">
import type { EditorInlineNode } from '@texuli/core/editor-model';
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import Self from './EditorInline.svelte';

// Owned rendering of the closed inline vocabulary: text interpolation only,
// links re-checked by the URL policy at render, host extension entities
// (mentions, references) as a span carrying their name and id. Kept on one line per node so
// no template whitespace becomes a counted text node inside the block.
let { nodes, trust }: { nodes: readonly EditorInlineNode[]; trust: HrefTrust } = $props();
</script>

{#each nodes as node, index (index)}{#if node.type === 'text'}{node.text}{:else if node.type === 'code'}<code class="tx-editor-code">{node.text}</code>{:else if node.type === 'break'}<br data-tx-break="" />{:else if node.type === 'strong'}<strong><Self nodes={node.children} {trust} /></strong>{:else if node.type === 'em'}<em><Self nodes={node.children} {trust} /></em>{:else if node.type === 'strike'}<s><Self nodes={node.children} {trust} /></s>{:else if node.type === 'link'}{@const href = safeHref(node.href, trust)}{#if href}<a class="tx-editor-link" {href} rel="noopener noreferrer nofollow"><Self nodes={node.children} {trust} /></a>{:else}<span class="tx-editor-link-rejected"><Self nodes={node.children} {trust} /></span>{/if}{:else if node.type === 'extension'}<span class="tx-editor-extension" data-tx-extension={node.name} data-tx-entity={node.id}><Self nodes={node.children} {trust} /></span>{/if}{/each}

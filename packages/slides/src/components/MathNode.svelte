<script lang="ts">
/**
 * One MathML element of a `texToMath` tree, built by Svelte (never from a
 * markup string). Only the closed `MATH_TAGS` and `MATH_ATTRIBUTES` pass;
 * anything else becomes an `mrow` or is dropped, and token text is text.
 */
import { MATH_ATTRIBUTES, MATH_TAGS, type MathNode as MathNodeData } from '@texuli/deck/math';
import Self from './MathNode.svelte';

const MATHML = 'http://www.w3.org/1998/Math/MathML';
const TAGS: readonly string[] = MATH_TAGS;
const ATTRIBUTES: readonly string[] = MATH_ATTRIBUTES;

let { node, depth = 0 }: { node: MathNodeData; depth?: number } = $props();

let tag = $derived(TAGS.includes(node.tag) ? node.tag : 'mrow');
let attributes = $derived(
  Object.fromEntries(
    Object.entries(node.attrs ?? {}).filter(
      ([name, value]) =>
        ATTRIBUTES.includes(name) && typeof value === 'string' && value.length <= 2_000
    )
  )
);
</script>

<svelte:element this={tag} xmlns={MATHML} {...attributes}>
  {#if node.text !== undefined}{node.text}{:else if depth < 64}{#each node.children ?? [] as child, index (index)}<Self
        node={child}
        depth={depth + 1}
      />{/each}{/if}
</svelte:element>

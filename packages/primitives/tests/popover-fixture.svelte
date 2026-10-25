<script lang="ts">
import { Close, Content, Root, Trigger } from '../src/popover/index.ts';

interface Props {
  modal?: boolean;
  /** What `initialFocus` returns: the search field, nothing, an element outside, or unset. */
  focusTarget?: 'search' | 'none' | 'outside';
}

let { modal = false, focusTarget }: Props = $props();
let open = $state(false);
let search = $state<HTMLInputElement>();
let outside = $state<HTMLButtonElement>();

const initialFocus = $derived(
  focusTarget === undefined
    ? undefined
    : () =>
        focusTarget === 'search'
          ? (search ?? null)
          : focusTarget === 'outside'
            ? (outside ?? null)
            : null
);
</script>

<main>
  <Root bind:open {modal} positioning={false}>
    <Trigger>Filters</Trigger>
    <Content aria-label="Filter tasks" {initialFocus}>
      <label>
        Assigned to me
        <input type="checkbox" />
      </label>
      <input aria-label="Search filters" bind:this={search} />
      <Close>Apply</Close>
    </Content>
  </Root>
  <button type="button" bind:this={outside}>Outside action</button>
  <output data-open-state>{open ? 'open' : 'closed'}</output>
</main>

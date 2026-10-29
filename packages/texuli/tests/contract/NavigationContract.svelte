<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { Breadcrumb, NavigationMenu, Pagination } from '../../src/components/navigation/index.ts';

let { p, refs, variant = 'inline' }: HarnessProps = $props();
const k = (name: string) => `components/navigation/${name}`;
</script>

<Breadcrumb
  label="Trail"
  items={[{ label: 'Home', href: 'https://example.com/' }, { label: 'Docs' }]}
  {...p(k('Breadcrumb'))}
  bind:ref={refs[k('Breadcrumb')]}
/>
<NavigationMenu.Root value="docs" aria-label="Main" {...p(k('NavigationMenuRoot'))} bind:ref={refs[k('NavigationMenuRoot')]}>
  <NavigationMenu.List {...p(k('NavigationMenuList'))} bind:ref={refs[k('NavigationMenuList')]}>
    <NavigationMenu.Item value="docs" {...p(k('NavigationMenuItem'))} bind:ref={refs[k('NavigationMenuItem')]}>
      <NavigationMenu.Trigger {...p(k('NavigationMenuTrigger'))} bind:ref={refs[k('NavigationMenuTrigger')]}>Docs</NavigationMenu.Trigger>
      <NavigationMenu.Content {...p(k('NavigationMenuContent'))} bind:ref={refs[k('NavigationMenuContent')]}>
        <NavigationMenu.Link href="https://example.com/guide">Guide</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item value="blog">
      <NavigationMenu.Link href="https://example.com/blog" {...p(k('NavigationMenuLink'))} bind:ref={refs[k('NavigationMenuLink')]}>Blog</NavigationMenu.Link>
    </NavigationMenu.Item>
    <NavigationMenu.Indicator {...p(k('NavigationMenuIndicator'))} bind:ref={refs[k('NavigationMenuIndicator')]} />
  </NavigationMenu.List>
  {#if variant === 'viewport'}
    <NavigationMenu.Viewport {...p(k('NavigationMenuViewport'))} bind:ref={refs[k('NavigationMenuViewport')]} />
  {/if}
</NavigationMenu.Root>
<Pagination.Root pageCount={10} page={5} {...p(k('PaginationRoot'))} bind:ref={refs[k('PaginationRoot')]}>
  {#snippet children({ pages })}
    <Pagination.PreviousButton {...p(k('PaginationPrevious'))} bind:ref={refs[k('PaginationPrevious')]} />
    {#each pages as token (token)}
      {#if token === 'ellipsis-start'}
        <Pagination.Ellipsis {...p(k('PaginationEllipsis'))} bind:ref={refs[k('PaginationEllipsis')]} />
      {:else if token === 'ellipsis-end'}
        <Pagination.Ellipsis />
      {:else if token === 6}
        <Pagination.Page page={token} {...p(k('PaginationPage'))} bind:ref={refs[k('PaginationPage')]}>{token}</Pagination.Page>
      {:else}
        <Pagination.Page page={token}>{token}</Pagination.Page>
      {/if}
    {/each}
    <Pagination.NextButton {...p(k('PaginationNext'))} bind:ref={refs[k('PaginationNext')]} />
  {/snippet}
</Pagination.Root>

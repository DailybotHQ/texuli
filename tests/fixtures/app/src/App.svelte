<script lang="ts">
import { safeHref } from '@texuli/core';
import type { Component } from 'svelte';
import { type ExampleEntry, getExample, listExamples } from './examples.ts';

// Reserved fixture ids that are not registry examples.
const RESERVED = new Set(['smoke', 'examples', 'builder', 'builder-draft']);

const params = new URLSearchParams(location.search);
const fixture = params.get('fixture') ?? 'smoke';

const links = [
  { label: 'Documentation', href: 'https://texuli.com/docs' },
  { label: 'Unsafe link', href: 'javascript:alert(1)' },
] as const;

const catalog = listExamples();
const exampleEntry: ExampleEntry | undefined = !RESERVED.has(fixture)
  ? getExample(fixture)
  : undefined;

let Demo: Component | null = $state(null);
// The website builder island (Task 77 visual baselines), loaded lazily like an example.
let Builder: Component<{ seeded?: boolean }> | null = $state(null);
if (fixture === 'builder' || fixture === 'builder-draft') {
  void import('./BuilderFixture.svelte').then((mod) => {
    Builder = mod.default;
  });
}
let loadError: string | null = $state(null);

$effect(() => {
  if (!exampleEntry) {
    Demo = null;
    loadError = null;
    return;
  }
  let cancelled = false;
  loadError = null;
  Demo = null;
  void exampleEntry.load().then(
    (mod) => {
      if (!cancelled) Demo = mod.default;
    },
    (error: unknown) => {
      if (!cancelled) {
        loadError = error instanceof Error ? error.message : 'Failed to load example.';
      }
    }
  );
  return () => {
    cancelled = true;
  };
});
</script>

<main data-fixture={fixture}>
  {#if fixture === 'smoke'}
    <h1>Texuli fixtures</h1>
    <ul>
      {#each links as link (link.label)}
        <li>
          {#if safeHref(link.href)}
            <a href={safeHref(link.href)}>{link.label}</a>
          {:else}
            <span data-blocked-link>{link.label}</span>
          {/if}
        </li>
      {/each}
    </ul>
    <p>
      <a href="?fixture=examples">Browse registered examples</a>
    </p>
  {:else if fixture === 'builder' || fixture === 'builder-draft'}
    {#if Builder}
      <Builder seeded={fixture === 'builder-draft'} />
    {:else}
      <p role="status">Loading the builder…</p>
    {/if}
  {:else if fixture === 'examples'}
    <h1>Registered examples</h1>
    {#if catalog.length === 0}
      <p role="status">No examples are registered yet.</p>
    {:else}
      <ul data-example-list>
        {#each catalog as entry (entry.id)}
          <li>
            <a href={`?fixture=${entry.id}`} data-example-link={entry.id}>{entry.title}</a>
            <span> — {entry.component}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {:else if exampleEntry}
    <article data-example-host={exampleEntry.id}>
      <header>
        <p>
          <a href="?fixture=examples">All examples</a>
        </p>
        <h1>{exampleEntry.title}</h1>
        <p>{exampleEntry.description}</p>
      </header>
      {#if loadError}
        <p role="alert">{loadError}</p>
      {:else if Demo}
        <Demo />
      {:else}
        <p role="status">Loading example…</p>
      {/if}
    </article>
  {:else}
    <p role="alert">Unknown fixture: {fixture}</p>
  {/if}
</main>

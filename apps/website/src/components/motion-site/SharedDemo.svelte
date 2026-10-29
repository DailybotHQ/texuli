<script lang="ts">
/**
 * /motion-page/ shared elements: a card's preview grows into the detail
 * view and returns to the grid, through `createSharedElements` from
 * `@texuli/core/motion`. Capture the box before the change, play the new
 * element from it after. Focus moves with the view.
 */
import { createSharedElements, type SharedElements } from '@texuli/core/motion';
import { tick } from 'svelte';
import SettingsNote from './SettingsNote.svelte';
import { describeRun, runtimeTiming } from './settings.svelte.ts';

interface Project {
  id: string;
  name: string;
  owner: string;
  tone: 'a' | 'b' | 'c' | 'd';
  summary: string;
}

const PROJECTS: readonly Project[] = [
  {
    id: 'harbor',
    name: 'Harbor Notes',
    owner: 'Ana',
    tone: 'a',
    summary: 'Release notes that write themselves from merged work, reviewed by the crew.',
  },
  {
    id: 'tide',
    name: 'Tide Board',
    owner: 'Lee',
    tone: 'b',
    summary: 'A planning board that keeps every column under its work-in-progress limit.',
  },
  {
    id: 'lumen',
    name: 'Lumen Docs',
    owner: 'Sam',
    tone: 'c',
    summary: 'Docs with a Markdown twin for every page, readable by people and agents.',
  },
  {
    id: 'orbit',
    name: 'Orbit Status',
    owner: 'Kai',
    tone: 'd',
    summary: 'A status page fed by the checks, at status.example.com.',
  },
];

let shared: SharedElements | null = null;
let open = $state<Project | null>(null);
let outcome = $state('Not played yet');
let root = $state<HTMLElement | null>(null);

const art = (id: string) => root?.querySelector<HTMLElement>(`[data-shared-art="${id}"]`) ?? null;

function play(id: string): void {
  const element = art(id);
  if (!element || !shared) return;
  const result = shared.play(id, element);
  outcome = describeRun(result);
  void result.finished.then((value) => {
    outcome = describeRun(result, value);
  });
}

/** A fresh registry per change, so it plays at the settings chosen now. */
function capture(id: string): void {
  shared = createSharedElements({ ...runtimeTiming(), duration: 360 });
  const from = art(id);
  if (from) shared.capture(id, from);
}

async function show(project: Project): Promise<void> {
  capture(project.id);
  open = project;
  await tick();
  play(project.id);
  root?.querySelector<HTMLElement>('[data-shared-back]')?.focus();
}

async function back(): Promise<void> {
  const project = open;
  if (!project) return;
  capture(project.id);
  open = null;
  await tick();
  play(project.id);
  root?.querySelector<HTMLElement>(`[data-shared-open="${project.id}"]`)?.focus();
}
</script>

<div class="shared" bind:this={root} data-motion-shared="">
  {#if open}
    <article class="detail" aria-labelledby="shared-detail-title">
      <div class={`art art--large tone-${open.tone}`} data-shared-art={open.id} aria-hidden="true">
        <span>{open.name.slice(0, 1)}</span>
      </div>
      <div class="detail__body">
        <h3 id="shared-detail-title">{open.name}</h3>
        <p>{open.summary}</p>
        <p class="detail__meta">Owner: {open.owner}</p>
        <button type="button" data-shared-back="" onclick={back}>Back to all projects</button>
      </div>
    </article>
  {:else}
    <ul class="grid" aria-label="Projects">
      {#each PROJECTS as project (project.id)}
        <li class="card">
          <div class={`art tone-${project.tone}`} data-shared-art={project.id} aria-hidden="true">
            <span>{project.name.slice(0, 1)}</span>
          </div>
          <span class="card__name">{project.name}</span>
          <button type="button" data-shared-open={project.id} onclick={() => show(project)}>
            Open <span class="sr-only">{project.name}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <SettingsNote name="shared" {outcome} />
</div>

<style>
  .shared {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    display: grid;
    gap: 0.5rem;
    padding: 0.6rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.85rem;
  }
  .card__name {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .art {
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    border-radius: 0.6rem;
    font-size: 1.5rem;
    font-weight: 800;
    border: 1px solid var(--tx-border, CanvasText);
  }
  .art--large {
    aspect-ratio: 16 / 9;
    font-size: 3rem;
  }
  .tone-a {
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
  }
  .tone-b {
    background: var(--tx-success-soft, Canvas);
    color: var(--tx-success-soft-foreground, CanvasText);
  }
  .tone-c {
    background: var(--tx-info-soft, Canvas);
    color: var(--tx-info-soft-foreground, CanvasText);
  }
  .tone-d {
    background: var(--tx-warning-soft, Canvas);
    color: var(--tx-warning-soft-foreground, CanvasText);
  }
  .detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
  @media (min-width: 40rem) {
    .detail {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .detail__body {
    display: grid;
    gap: 0.5rem;
  }
  .detail h3 {
    margin: 0;
    font-size: 1.25rem;
  }
  .detail p {
    margin: 0;
  }
  .detail__meta {
    color: var(--tx-muted-foreground, CanvasText);
    font-size: 0.875rem;
  }
  button {
    justify-self: start;
    min-block-size: 2.25rem;
    padding-inline: 0.85rem;
    border: 1px solid var(--tx-border, ButtonText);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>

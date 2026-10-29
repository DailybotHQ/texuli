<script lang="ts">
/**
 * /motion-page/ layout: a keyed list that glides on every reorder and
 * insert (FLIP), through `createListMotion` from `texuli/motion`, the seam
 * the Board and the DataGrid use. Every change is a button, so the whole
 * demo works from the keyboard; focus stays on the moved item.
 */
import { tick, untrack } from 'svelte';
import { createListMotion } from 'texuli/motion';
import SettingsNote from './SettingsNote.svelte';
import { pageMotionSettings } from './settings.svelte.ts';

interface Task {
  id: string;
  label: string;
}

const POOL = [
  'Draft the changelog',
  'Record the demo video',
  'Translate the docs',
  'Update the status page',
  'Email the beta group',
  'Archive old branches',
];

let tasks = $state<Task[]>([
  { id: 't1', label: 'Write launch notes' },
  { id: 't2', label: 'Refresh pricing page' },
  { id: 't3', label: 'Check status page' },
  { id: 't4', label: 'Send May invoices' },
]);
let added = 0;
let status = $state('');
let list = $state<HTMLElement | null>(null);

const motion = createListMotion({
  motion: () => ({ layout: true }),
  defaults: { layout: true, duration: 'slow' },
  settings: pageMotionSettings,
  enter: 'block-start',
  items: () =>
    Array.from(
      list?.querySelectorAll<HTMLElement>('[data-task]') ?? [],
      (element) => [element.dataset.task ?? '', element] as const
    ),
});
$effect.pre(() => {
  void tasks;
  untrack(() => motion.measure());
});
$effect(() => {
  void tasks;
  untrack(() => motion.play());
});

async function focusTask(id: string, action: string): Promise<void> {
  await tick();
  list?.querySelector<HTMLElement>(`[data-task="${id}"] [data-action="${action}"]`)?.focus();
}

function move(index: number, by: -1 | 1): void {
  const to = index + by;
  const task = tasks[index];
  if (!task || to < 0 || to >= tasks.length) return;
  const next = [...tasks];
  next.splice(index, 1);
  next.splice(to, 0, task);
  tasks = next;
  status = `${task.label} moved to position ${to + 1} of ${next.length}.`;
  const edge = (by < 0 && to === 0) || (by > 0 && to === next.length - 1);
  void focusTask(task.id, edge ? (by < 0 ? 'down' : 'up') : by < 0 ? 'up' : 'down');
}

function remove(index: number): void {
  const task = tasks[index];
  if (!task) return;
  tasks = tasks.filter((entry) => entry.id !== task.id);
  status = `${task.label} removed. ${tasks.length} left.`;
  const neighbour = tasks[Math.min(index, tasks.length - 1)];
  if (neighbour) void focusTask(neighbour.id, 'remove');
}

function add(): void {
  const label = POOL[added % POOL.length] ?? 'New task';
  added += 1;
  tasks = [{ id: `n${added}`, label }, ...tasks];
  status = `${label} added at the top.`;
}

function shuffle(): void {
  // A fixed rotation and swap, so the result is the same every time (no randomness to test).
  if (tasks.length < 2) return;
  const [first, ...rest] = tasks;
  const next = [...rest, first as Task];
  const a = next[0] as Task;
  next[0] = next[1] as Task;
  next[1] = a;
  tasks = next;
  status = 'List shuffled.';
}

function sort(): void {
  tasks = [...tasks].sort((a, b) => a.label.localeCompare(b.label, 'en'));
  status = 'List sorted from A to Z.';
}
</script>

<div class="layout" data-motion-layout="">
  <div class="layout__bar" role="toolbar" aria-label="List actions">
    <button type="button" onclick={add} disabled={tasks.length >= 10}>Add a task</button>
    <button type="button" onclick={shuffle}>Shuffle</button>
    <button type="button" onclick={sort}>Sort A to Z</button>
  </div>
  <ol class="layout__list" bind:this={list} aria-label="Launch tasks">
    {#each tasks as task, index (task.id)}
      <li class="task" data-task={task.id}>
        <span class="task__index" aria-hidden="true">{index + 1}</span>
        <span class="task__label">{task.label}</span>
        <span class="task__actions">
          <button
            type="button"
            data-action="up"
            aria-label={`Move ${task.label} up`}
            disabled={index === 0}
            onclick={() => move(index, -1)}>↑</button
          >
          <button
            type="button"
            data-action="down"
            aria-label={`Move ${task.label} down`}
            disabled={index === tasks.length - 1}
            onclick={() => move(index, 1)}>↓</button
          >
          <button
            type="button"
            data-action="remove"
            aria-label={`Remove ${task.label}`}
            disabled={tasks.length === 1}
            onclick={() => remove(index)}>×</button
          >
        </span>
      </li>
    {/each}
  </ol>
  <p class="layout__status" role="status" data-motion-list-status="">{status}</p>
  <SettingsNote name="layout" />
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    min-inline-size: 0;
  }
  .layout__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  button {
    min-block-size: 2.25rem;
    min-inline-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonText);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .layout__list {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .task {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem 0.4rem 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-surface, Canvas);
  }
  .task__index {
    display: inline-grid;
    place-items: center;
    inline-size: 1.6rem;
    block-size: 1.6rem;
    border-radius: 999px;
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    font-size: 0.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .task__label {
    flex: 1;
    min-inline-size: 0;
    font-size: 0.9rem;
  }
  .task__actions {
    display: inline-flex;
    gap: 0.25rem;
  }
  .task__actions button {
    padding-inline: 0;
  }
  .layout__status {
    margin: 0;
    min-block-size: 1.25rem;
    font-size: 0.8125rem;
  }
</style>

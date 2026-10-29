<script lang="ts">
// Decorations over the editor: comment and suggestion highlights (CSS
// Custom Highlight API, no DOM change in the editor) and remote carets with
// name flags. Everything here is aria-hidden; the collaborator list and the
// sidebar are the accessible views.
import { tick } from 'svelte';
import { blockElement, HIGHLIGHT_NAMES, HighlightLayer, rangeFor } from './highlights.ts';
import { type CollabSession, presenceColor } from './session.svelte.ts';

interface Props {
  session: CollabSession;
  /** The positioned element that holds the editor (carets are placed relative to it). */
  root: HTMLElement | undefined;
}

let { session, root }: Props = $props();

interface Caret {
  replica: string;
  name: string;
  color: string;
  x: number;
  y: number;
  height: number;
}

let carets = $state.raw<Caret[]>([]);
const layer = new HighlightLayer();
let frame = 0;

function caretRect(container: HTMLElement, block: string, offset: number) {
  const range = rangeFor(container, block, offset, offset);
  if (!range) return null;
  let rect: DOMRect | undefined = range.getClientRects()[0];
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const element = blockElement(container, block);
    rect = element?.getBoundingClientRect();
  }
  return rect ?? null;
}

function paint(): void {
  const container = root;
  if (!container) return;
  const byKind: Record<string, Range[]> = { comment: [], active: [], insert: [], delete: [] };
  for (const entry of session.ranges()) {
    const range = rangeFor(container, entry.block, entry.from, entry.to);
    if (!range) continue;
    if (entry.kind === 'comment')
      (entry.id === session.activeThread ? byKind.active : byKind.comment)?.push(range);
    else byKind[entry.kind]?.push(range);
  }
  layer.set(HIGHLIGHT_NAMES.comment, byKind.comment ?? []);
  layer.set(HIGHLIGHT_NAMES.active, byKind.active ?? []);
  layer.set(HIGHLIGHT_NAMES.insert, byKind.insert ?? []);
  layer.set(HIGHLIGHT_NAMES.delete, byKind.delete ?? []);
  const box = container.getBoundingClientRect();
  const next: Caret[] = [];
  const selections = new Map<string, Range[]>();
  for (const person of session.collaborators) {
    if (!person.focus) continue;
    const rect = caretRect(container, person.focus.block, person.focus.offset);
    if (!rect) continue;
    next.push({
      replica: person.replica,
      name: person.name,
      color: presenceColor(person.color),
      x: rect.left - box.left,
      y: rect.top - box.top,
      height: rect.height || 18,
    });
    if (person.anchor && person.anchor.block === person.focus.block) {
      const from = Math.min(person.anchor.offset, person.focus.offset);
      const to = Math.max(person.anchor.offset, person.focus.offset);
      const range = to > from ? rangeFor(container, person.focus.block, from, to) : null;
      if (range) {
        const name = HIGHLIGHT_NAMES.remote(person.color);
        selections.set(name, [...(selections.get(name) ?? []), range]);
      }
    }
  }
  for (let color = 0; color < 8; color += 1) {
    const name = HIGHLIGHT_NAMES.remote(color);
    layer.set(name, selections.get(name) ?? []);
  }
  carets = next;
}

function schedule(): void {
  if (typeof requestAnimationFrame !== 'function') {
    paint();
    return;
  }
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => paint());
}

// Repaint after every change of the document, annotations or presence.
$effect(() => {
  void session.revision;
  void session.document;
  void session.collaborators;
  void session.activeThread;
  if (!root) return;
  tick().then(schedule);
});

$effect(() => {
  const container = root;
  if (!container) return;
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  observer?.observe(container);
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, { capture: true });
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    layer.clear();
  };
});
</script>

<div class="tx-pages-collab__overlay" aria-hidden="true">
  {#each carets as caret (caret.replica)}
    <span
      class="tx-pages-collab__caret"
      data-replica={caret.replica}
      style:--tx-pages-caret-color={caret.color}
      style:transform={`translate(${caret.x}px, ${caret.y}px)`}
      style:block-size={`${caret.height}px`}
    ><span class="tx-pages-collab__caret-name">{caret.name}</span></span>
  {/each}
</div>

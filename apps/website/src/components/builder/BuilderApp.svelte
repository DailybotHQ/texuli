<script lang="ts">
import type { CatalogPropSchema } from '@texuli/catalog';
import { applyEditOp } from '@texuli/catalog/edit';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { TRUST_PINNED_IDS } from '@texuli/player';
import { tick, untrack } from 'svelte';
import {
  announceMove,
  createBuilderUndo,
  type HistoryMove,
  historyShortcut,
  ownsTextUndo,
  selectionAfterMove,
} from './history/model.ts';
import ChoiceField from './inspector/choice/ChoiceField.svelte';
import { isChoiceProp } from './inspector/choice/model.ts';
import AltField from './inspector/media/AltField.svelte';
import MediaBlockEditor from './inspector/media/MediaBlockEditor.svelte';
import MediaUrlField from './inspector/media/MediaUrlField.svelte';
import { isAltProp, urlRoleOf } from './inspector/media/model.ts';
import { isNumberProp } from './inspector/number/model.ts';
import NumberField from './inspector/number/NumberField.svelte';
import { chartNumberHints } from './inspector/number/sources.ts';
import StructProp from './inspector/struct/StructProp.svelte';
import { chartStructSchema } from './inspector/struct/sources.ts';
import TextBlockEditor from './inspector/text/TextBlockEditor.svelte';
import { paneCycle } from './keyboard/panes.ts';
import { BUILDER_MANIFEST_BY_ID } from './manifest.ts';
import {
  canonicalJson,
  createBuilderHistory,
  EMPTY_BLUEPRINT,
  flattenTree,
  inspectorFields,
} from './model.ts';
import { moveKeepsStructure } from './outline/guard.ts';
import { type MoveOp, manifestCanContain } from './outline/model.ts';
import Outline from './outline/Outline.svelte';
import { createPaletteEntries } from './palette/model.ts';
import Palette from './palette/Palette.svelte';
import { PALETTE_MANIFESTS, playerPaints } from './palette/sources.ts';
import PayloadPanel from './payload/PayloadPanel.svelte';
import PreviewPane from './preview/PreviewPane.svelte';

let {
  initial,
  initialSelection = [],
}: {
  /** The draft to start from (default: an empty page). Read once, at mount. */
  initial?: CatalogTreeInput;
  /** The node selected at mount, as a path (default: none). */
  initialSelection?: number[];
} = $props();

// Every pane writes through one labeled history (inspector edits, outline moves, JSON commits).
const history = createBuilderUndo(createBuilderHistory(untrack(() => initial)), (id) =>
  labelOf(id)
);
let tree = $state<CatalogTreeInput>(history.tree);
let historyView = $state(readHistory());
let builderRoot = $state<HTMLElement | undefined>();
let selected = $state<number[]>(untrack(() => [...initialSelection]));
let diagnostic = $state('');
let propDraft = $state<Record<string, string>>({});

// Tier U palette: the builder inserts its own manifests; other Tier U ids show as unavailable.
const paletteEntries = createPaletteEntries(PALETTE_MANIFESTS, {
  paintable: playerPaints,
  insertable: (id) => BUILDER_MANIFEST_BY_ID.has(id),
});
/** The value the player forces for a prop: media `trust` is always the host's tier, never the blueprint's. */
const pinnedFor = (id: string, name: string) =>
  name === 'trust' && TRUST_PINNED_IDS.includes(id) ? 'untrusted' : undefined;
const labelOf = (id: string) => BUILDER_MANIFEST_BY_ID.get(id)?.label ?? id;
const canContain = (id: string) => {
  const manifest = BUILDER_MANIFEST_BY_ID.get(id);
  return manifest ? manifestCanContain(manifest) : false;
};
let flatNodes = $derived(flattenTree(tree));
let selectedKey = $derived(selected.join('.'));
let selectedEntry = $derived(flatNodes.find((entry) => entry.path.join('.') === selectedKey));
let selectedManifest = $derived(
  selectedEntry ? BUILDER_MANIFEST_BY_ID.get(selectedEntry.node.id) : undefined
);
let inspectorProps = $derived(selectedManifest ? inspectorFields(selectedManifest.props) : []);

function atPath(path: number[]): CatalogTreeInput | undefined {
  let current: CatalogTreeInput | undefined = tree;
  for (const index of path) current = current?.children?.[index];
  return current;
}

function readHistory() {
  return {
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undoLabel: history.undoLabel,
    redoLabel: history.redoLabel,
  };
}

function apply(op: Parameters<typeof applyEditOp>[1], coalesceKey?: string) {
  const result = history.apply(op, coalesceKey ? { coalesceKey } : undefined);
  if (!result.ok) {
    diagnostic = result.error.message;
    return false;
  }
  tree = result.tree;
  historyView = readHistory();
  diagnostic = 'Draft updated.';
  return true;
}

async function insert(id: string) {
  const manifest = BUILDER_MANIFEST_BY_ID.get(id);
  if (!manifest) return;
  let parentPath = selected;
  let index = atPath(parentPath)?.children?.length ?? 0;
  if (!atPath(parentPath)) {
    parentPath = [];
    index = tree.children?.length ?? 0;
  }
  if (apply({ op: 'insert', parent: parentPath, index, node: { id, props: {}, children: [] } })) {
    selected = [...parentPath, index];
    await tick();
    document
      .querySelector<HTMLButtonElement>(`[data-builder-row="${selected.join('.')}" ]`)
      ?.focus();
  }
}

/** Outline moves: refused when the edit core rejects them or they add structural errors. */
function move(op: MoveOp): string | null {
  const next = applyEditOp(tree, op);
  if (!next.ok) return next.error.message;
  if (!moveKeepsStructure(tree, next.tree)) {
    return 'That move would break the page structure, so it was not applied.';
  }
  return apply(op) ? null : diagnostic;
}

function remove(path: number[]) {
  if (apply({ op: 'remove', path })) selected = path.slice(0, -1);
}

function updateProp(prop: CatalogPropSchema, value: unknown) {
  if (!selectedEntry) return;
  const op =
    value === undefined
      ? { op: 'unsetProp' as const, path: selectedEntry.path, name: prop.name }
      : { op: 'setProp' as const, path: selectedEntry.path, name: prop.name, value };
  apply(op, `prop:${selectedEntry.path.join('.')}:${prop.name}`);
}

/** A payload-panel commit: the panel already checked the text; one replaceAll entry. */
function commitTree(next: CatalogTreeInput): string | null {
  const result = history.apply({ op: 'replaceAll', tree: next }, { label: 'Commit JSON' });
  if (!result.ok) return result.error.message;
  tree = result.tree;
  historyView = readHistory();
  selected = [];
  diagnostic = 'JSON committed. Canonical export is ready.';
  return null;
}

/** A history move: the tree comes back, the status names it, the selection follows it. */
function settle(move: HistoryMove | null) {
  if (!move) return;
  tree = move.tree;
  selected = selectionAfterMove(move, selected);
  historyView = readHistory();
  diagnostic = announceMove(move);
}

const undo = () => settle(history.undo());
const redo = () => settle(history.redo());

/** Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y) inside the builder; text fields keep their own undo. */
function onHistoryKey(event: KeyboardEvent) {
  const action = historyShortcut(event);
  if (!action || ownsTextUndo(event.target)) return;
  const target = event.target as Node | null;
  if (!builderRoot || !target || !builderRoot.contains(target)) return;
  event.preventDefault();
  if (action === 'undo') undo();
  else redo();
}

function reset() {
  if (history.apply({ op: 'replaceAll', tree: EMPTY_BLUEPRINT }, { label: 'New draft' }).ok) {
    tree = history.tree;
    historyView = readHistory();
    selected = [];
    diagnostic = 'Started a new draft.';
  }
}
</script>

<svelte:window onkeydown={onHistoryKey} />

<!-- F6 / Shift+F6 cycle the panes (keyboard/panes.ts). -->
<section class="builder" data-tx-builder aria-label="Blueprint builder" bind:this={builderRoot} use:paneCycle>
  <div class="builder__toolbar" aria-label="Draft actions" data-builder-pane>
    <p class="builder__status" role="status" aria-live="polite">{diagnostic || 'Untrusted draft · changes stay in this browser'}</p>
    <div class="builder__actions">
      <button
        type="button"
        onclick={undo}
        disabled={!historyView.canUndo}
        aria-keyshortcuts="Control+Z Meta+Z"
        title={historyView.undoLabel ? `Undo: ${historyView.undoLabel}` : 'Nothing to undo'}
      >Undo</button>
      <button
        type="button"
        onclick={redo}
        disabled={!historyView.canRedo}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        title={historyView.redoLabel ? `Redo: ${historyView.redoLabel}` : 'Nothing to redo'}
      >Redo</button>
      <button type="button" onclick={reset}>New draft</button>
      <button type="button" onclick={() => navigator.clipboard?.writeText(canonicalJson(tree))}>Copy JSON</button>
    </div>
  </div>

  <div class="builder__grid">
    <div class="builder__pane builder__palette" data-builder-pane>
      <Palette entries={paletteEntries} searchId="palette-search" oninsert={(id) => void insert(id)} />
    </div>

    <section class="builder__pane builder__outline" aria-labelledby="outline-heading" data-builder-pane>
      <h2 id="outline-heading">Structure</h2>
      <p class="builder__hint">Select a row, then use the palette to insert a child.</p>
      <Outline
        {tree}
        {selected}
        {labelOf}
        {canContain}
        onselect={(path) => (selected = path)}
        onmove={move}
        onremove={remove}
      />
      <PreviewPane
        {tree}
        labelOf={(path) => labelOf(atPath(path)?.id ?? '')}
        onselect={(path) => (selected = path)}
      />
    </section>

    <aside class="builder__pane builder__inspector" aria-labelledby="inspector-heading" data-builder-pane>
      <h2 id="inspector-heading">Inspector</h2>
      {#if selectedEntry && selectedManifest}
        <h3>{selectedManifest.label}</h3>
        <p class="builder__hint">{selectedManifest.summary}</p>
        {#each inspectorProps as prop (prop.name)}
          {@const value = selectedEntry.node.props?.[prop.name]}
          {@const struct = prop.kind === 'object' || prop.kind === 'array' ? chartStructSchema(selectedManifest.id, prop.name) : undefined}
          {#if selectedManifest.id === 'blocks-text' && prop.name === 'block'}
            <!-- G16: blocks-* props get structured editors from the blocks schemas. -->
            <TextBlockEditor {value} onchange={(block) => updateProp(prop, block)} />
          {:else if selectedManifest.id === 'blocks-media' && prop.name === 'block'}
            <MediaBlockEditor {value} onchange={(block) => updateProp(prop, block)} />
          {:else if urlRoleOf(selectedManifest.id, prop.name)}
            <MediaUrlField {prop} role={urlRoleOf(selectedManifest.id, prop.name) ?? 'image-src'} {value} onchange={(next) => updateProp(prop, next)} />
          {:else if isAltProp(selectedManifest.id, prop.name)}
            <AltField {prop} {value} onchange={(next) => updateProp(prop, next)} />
          {:else if isChoiceProp(prop)}
            <ChoiceField
              {prop}
              {value}
              pinned={pinnedFor(selectedManifest.id, prop.name)}
              onchange={(next) => updateProp(prop, next)}
            />
          {:else if isNumberProp(prop)}
            <NumberField
              {prop}
              {value}
              hints={chartNumberHints(selectedManifest.id, prop.name)}
              onchange={(next) => updateProp(prop, next)}
            />
          {:else if struct}
            <StructProp {prop} {value} {struct} onchange={(next) => updateProp(prop, next)} />
          {:else}
          <label class="builder__field">
            <span>{prop.name}{prop.required ? ' · required' : ''}</span>
            {#if prop.kind === 'string'}
              <input
                type="text"
                value={value === undefined ? '' : String(value)}
                placeholder={prop.default === undefined ? '' : `Default: ${String(prop.default)}`}
                aria-describedby={`prop-hint-${prop.name}`}
                oninput={(event) => {
                  const raw = event.currentTarget.value;
                  updateProp(prop, raw === '' ? undefined : raw);
                }}
              />
            {:else}
              <textarea
                rows="4"
                value={propDraft[`${selectedKey}:${prop.name}`] ?? JSON.stringify(value ?? prop.default ?? null, null, 2)}
                oninput={(event) => propDraft[`${selectedKey}:${prop.name}`] = event.currentTarget.value}
                onblur={() => {
                  const key = `${selectedKey}:${prop.name}`;
                  try { updateProp(prop, JSON.parse(propDraft[key] ?? 'null')); }
                  catch { diagnostic = `Invalid JSON for ${prop.name}; the draft was not changed.`; }
                }}
              ></textarea>
            {/if}
            <small id={`prop-hint-${prop.name}`}>{prop.description ?? (prop.default === undefined ? 'Optional value.' : `Default ${String(prop.default)} is a placeholder and is not saved.`)}{prop.kind === 'object' || prop.kind === 'array' ? ' No sub-field schema exists for this prop yet (G16), so it is edited as JSON; the renderer checks only that it is an object or a list.' : ''}</small>
          </label>
          {/if}
        {/each}
        <div class="builder__guidance">
          <h4>Use guidance</h4>
          <p>{selectedManifest.useWhen.join(' · ') || 'No use guidance in this manifest.'}</p>
          {#if selectedManifest.dontUseWhen.length}<p>Avoid when: {selectedManifest.dontUseWhen.join(' · ')}</p>{/if}
        </div>
      {:else}
        <p class="builder__hint">Select a component in the structure to edit its manifest-defined properties.</p>
      {/if}
    </aside>
  </div>

  <PayloadPanel {tree} oncommit={commitTree} />
</section>

<style>
  .builder { display: grid; gap: 1rem; color: var(--tx-foreground, CanvasText); }
  .builder__toolbar { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
  .builder__status, .builder__hint { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: .875rem; }
  .builder__actions { display: flex; flex-wrap: wrap; gap: .5rem; }
  .builder button, .builder input, .builder textarea { font: inherit; }
  .builder button { border: 1px solid var(--tx-border, ButtonBorder); border-radius: .45rem; padding: .45rem .7rem; color: inherit; background: var(--tx-surface, Canvas); cursor: pointer; }
  .builder button:focus-visible, .builder input:focus-visible, .builder textarea:focus-visible { outline: 3px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .builder button:disabled { opacity: .55; cursor: not-allowed; }
  .builder__grid { display: grid; grid-template-columns: minmax(15rem, .9fr) minmax(20rem, 1.5fr) minmax(16rem, .9fr); align-items: start; gap: 1rem; }
  .builder__pane { min-inline-size: 0; border: 1px solid var(--tx-border, ButtonBorder); border-radius: .65rem; padding: 1rem; background: var(--tx-surface, Canvas); }
  .builder__pane h2 { margin: 0 0 .75rem; font-size: 1.1rem; }
  .builder__field input:not([type='checkbox']), .builder__field textarea { box-sizing: border-box; inline-size: 100%; border: 1px solid var(--tx-border, ButtonBorder); border-radius: .4rem; padding: .55rem; color: inherit; background: var(--tx-background, Canvas); }
  .builder__field { display: grid; gap: .35rem; margin-block: .75rem; font-size: .875rem; }
  .builder__field small { color: var(--tx-muted-foreground, GrayText); font-size: .75rem; }
  .builder__field span { font-weight: 600; }
  .builder__guidance { border-block-start: 1px solid var(--tx-border, ButtonBorder); margin-block-start: 1rem; padding-block-start: .75rem; font-size: .875rem; }
  .builder__guidance h4, .builder__guidance p { margin: 0 0 .4rem; }
  @media (max-width: 68rem) { .builder__grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .builder__palette { grid-column: 1 / -1; } }
  @media (max-width: 44rem) { .builder__grid { grid-template-columns: minmax(0, 1fr); } .builder__palette { grid-column: auto; } }
  @media (prefers-reduced-motion: reduce) { .builder *, .builder *::before, .builder *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
</style>

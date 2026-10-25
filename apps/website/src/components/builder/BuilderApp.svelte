<script lang="ts">
import type { CatalogPropSchema } from '@texuli/catalog';
import { applyEditOps, type EditOp } from '@texuli/catalog/edit';
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
import { fieldFamily, unsupportedReason } from './inspector/coverage.ts';
import JsonField from './inspector/json/JsonField.svelte';
import { propExamples, schemaCheck } from './inspector/json/model.ts';
import AltField from './inspector/media/AltField.svelte';
import MediaBlockEditor from './inspector/media/MediaBlockEditor.svelte';
import MediaUrlField from './inspector/media/MediaUrlField.svelte';
import { urlRoleOf } from './inspector/media/model.ts';
import { isNumberProp } from './inspector/number/model.ts';
import NumberField from './inspector/number/NumberField.svelte';
import { numberHints } from './inspector/number/sources.ts';
import { isStringProp, stringRule } from './inspector/string/model.ts';
import StringField from './inspector/string/StringField.svelte';
import StructProp from './inspector/struct/StructProp.svelte';
import { chartStructSchema } from './inspector/struct/sources.ts';
import TextBlockEditor from './inspector/text/TextBlockEditor.svelte';
import { paneCycle } from './keyboard/panes.ts';
import { BUILDER_MANIFEST_BY_ID, builderInsertable } from './manifest.ts';
import {
  canonicalJson,
  createBuilderHistory,
  EMPTY_BLUEPRINT,
  flattenTree,
  inspectorFields,
} from './model.ts';
import {
  copySubtrees,
  duplicateOps,
  GROUP_REFUSAL_TEXT,
  groupName,
  groupRemoveOps,
  groupRoots,
  pasteOps,
  placedPaths,
} from './outline/group.ts';
import { moveKeepsStructure } from './outline/guard.ts';
import { type MoveOp, manifestCanContain } from './outline/model.ts';
import Outline from './outline/Outline.svelte';
import { createPaletteEntries } from './palette/model.ts';
import Palette from './palette/Palette.svelte';
import { PALETTE_MANIFESTS, playerPaints, unavailableReason } from './palette/sources.ts';
import { checkPayloadText, describeIssue } from './payload/model.ts';
import PayloadPanel from './payload/PayloadPanel.svelte';
import { DEFAULT_PREVIEW_VIEW, type PreviewView } from './preview/model.ts';
import PreviewPane from './preview/PreviewPane.svelte';
import { decodeShare, encodeShare, isShareHash } from './share/model.ts';
import { loadStarter, STARTERS, type StarterId } from './starters/model.ts';

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
// The outline's multi-selection, as row keys; `selected` is the focused row the inspector shows.
let selection = $state<string[]>(untrack(() => [initialSelection.join('.')]));
// Copied subtrees live here only: no system clipboard, so nothing leaves the page.
let clipboard = $state<CatalogTreeInput[]>([]);
let diagnostic = $state('');

// Tier U palette: the builder inserts its own manifests; other Tier U ids show as unavailable.
const paletteEntries = createPaletteEntries(PALETTE_MANIFESTS, {
  paintable: playerPaints,
  insertable: builderInsertable,
  reason: unavailableReason,
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
let inspectorProps = $derived(
  selectedManifest
    ? inspectorFields(selectedManifest.props).filter(
        (prop) => !unsupportedReason(selectedManifest.id, prop)
      )
    : []
);
/** Props the inspector deliberately leaves out, each with its reason (inspector/coverage.ts). */
let unsupportedProps = $derived(
  selectedManifest
    ? inspectorFields(selectedManifest.props).flatMap((prop) => {
        const reason = unsupportedReason(selectedManifest.id, prop);
        return reason ? [{ name: prop.name, reason }] : [];
      })
    : []
);

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

function apply(op: EditOp | readonly EditOp[], coalesceKey?: string) {
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
    select([...parentPath, index]);
    await tick();
    document
      .querySelector<HTMLButtonElement>(`[data-builder-row="${selected.join('.')}" ]`)
      ?.focus();
  }
}

/** Select one row, dropping any multi-selection. */
function select(path: number[]) {
  selected = path;
  selection = [path.join('.')];
}

/**
 * Structural outline edits (moves, duplicates, pastes) as one labeled step:
 * refused when the edit core rejects them or they add structural errors,
 * the same guard for keyboard, drag, group and paste.
 */
function applyStructural(ops: readonly EditOp[], label?: string): string | null {
  const next = applyEditOps(tree, ops);
  if (!next.ok) return next.error.message;
  if (!moveKeepsStructure(tree, next.tree)) {
    return 'That change would break the page structure, so it was not applied.';
  }
  const result = history.apply(ops, label ? { label } : undefined);
  if (!result.ok) {
    diagnostic = result.error.message;
    return diagnostic;
  }
  tree = result.tree;
  historyView = readHistory();
  diagnostic = 'Draft updated.';
  return null;
}

/** Outline moves, one node or a group. The outline moves the selection after. */
function move(ops: MoveOp[]): string | null {
  return applyStructural(ops);
}

/** Remove one or more subtrees (never the root) as one step; select the first one's parent. */
function remove(paths: number[][]) {
  const roots = groupRoots(paths);
  if (roots.length > 0 && apply(groupRemoveOps(roots))) select(roots[0]?.slice(0, -1) ?? []);
}

function copy(paths: number[][]): string {
  clipboard = copySubtrees(tree, paths);
  return `Copied ${groupName(tree, paths, labelOf)}. Paste with Control or Command+V.`;
}

/** Duplicate or paste: insert ops, guarded and labeled, then select what was added. */
function place(
  result: ReturnType<typeof duplicateOps>,
  verb: 'Duplicate' | 'Paste',
  name: () => string
): { ok: boolean; message: string } {
  if (!result.ok) return { ok: false, message: GROUP_REFUSAL_TEXT[result.reason] };
  const label = `${verb} ${name()}`;
  const refused = applyStructural(result.ops, label);
  if (refused) return { ok: false, message: refused };
  selected = result.paths[0] ?? [];
  selection = result.paths.map((path) => path.join('.'));
  return { ok: true, message: `${verb === 'Duplicate' ? 'Duplicated' : 'Pasted'} ${name()}.` };
}

const duplicate = (paths: number[][]) =>
  place(duplicateOps(tree, paths), 'Duplicate', () => groupName(tree, paths, labelOf));

function paste(at: number[]) {
  const pasted = $state.snapshot(clipboard) as CatalogTreeInput[];
  const first = pasted[0];
  const name = () =>
    pasted.length === 1 && first ? labelOf(first.id) : `${pasted.length} components`;
  return place(pasteOps(tree, pasted, at, canContain), 'Paste', name);
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
  select([]);
  diagnostic = 'JSON committed. Canonical export is ready.';
  return null;
}

/** A history move: the tree comes back, the status names it, the selection follows it. */
function settle(move: HistoryMove | null) {
  if (!move) return;
  tree = move.tree;
  select(selectionAfterMove(move, selected));
  // A group step brings the whole group back selected.
  const group = placedPaths(move.ops).filter((path) => atPath(path));
  if (group.length > 1) {
    selection = group.map((path) => path.join('.'));
    if (!selection.includes(selected.join('.'))) selected = group[0] ?? selected;
  }
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

/** Replace the whole draft as one labeled, undoable step. */
function replaceDraft(next: CatalogTreeInput, label: string): string | null {
  const result = history.apply({ op: 'replaceAll', tree: next }, { label });
  if (!result.ok) return result.error.message;
  tree = result.tree;
  historyView = readHistory();
  select([]);
  return null;
}

let view = $state<PreviewView>({ ...DEFAULT_PREVIEW_VIEW });
/** Set once a mode is picked (or a link sets one): the preview stops following the page mode. */
let modeTouched = false;

function setView(next: PreviewView) {
  if (next.mode !== view.mode) modeTouched = true;
  view = next;
}

// The preview starts in the page's mode and follows it until a mode is picked.
$effect(() => {
  const root = document.documentElement;
  const sync = () => {
    if (!modeTouched) {
      const mode = root.dataset.txMode === 'dark' ? 'dark' : 'light';
      if (untrack(() => view.mode) !== mode) view = { ...untrack(() => view), mode };
    }
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['data-tx-mode'] });
  return () => observer.disconnect();
});
let shareUrl = $state('');
/** The hash this page wrote itself, so it is not opened again as a pasted link. */
let ownHash = '';

/** Starters pass the same check as a JSON commit before they replace the draft. */
async function start(id: StarterId) {
  const starter = STARTERS.find((candidate) => candidate.id === id);
  if (!starter) return;
  const checked = checkPayloadText(JSON.stringify(await loadStarter(id)));
  if (!checked.ok) {
    diagnostic = `The ${starter.label} starter was refused: ${describeIssue(checked.issues[0] ?? { message: 'it did not pass the checks' })}`;
    return;
  }
  const refused = replaceDraft(checked.tree, `Start from ${starter.label}`);
  diagnostic = refused ?? `Started from ${starter.label}. Undo returns to the previous draft.`;
}

/** Put the draft and the preview view in the URL hash, and offer the link. */
async function share() {
  const hash = await encodeShare(tree, view);
  ownHash = hash;
  window.history.replaceState(window.history.state, '', hash);
  shareUrl = window.location.href;
  let copied = false;
  try {
    await navigator.clipboard?.writeText(shareUrl);
    copied = navigator.clipboard !== undefined;
  } catch {
    copied = false;
  }
  diagnostic = copied
    ? 'Share link copied. It holds the whole draft; nothing was uploaded.'
    : 'Share link ready below. It holds the whole draft; nothing was uploaded.';
}

/**
 * Open a draft from the link: it is checked like a JSON commit before
 * anything paints. A link that fails at load leaves the empty draft and
 * says why; a link pasted later never replaces the current draft unless it
 * passes.
 */
async function openFromHash(hash: string, atLoad: boolean) {
  if (!isShareHash(hash) || hash === ownHash) return;
  const result = await decodeShare(hash);
  if (!result.ok) {
    if (atLoad) replaceDraft(EMPTY_BLUEPRINT, 'New draft');
    diagnostic = `The shared link could not be opened: ${result.message}${atLoad ? ' Started an empty draft.' : ' The draft was not changed.'}`;
    return;
  }
  const refused = replaceDraft(result.tree, 'Open shared draft');
  if (refused) {
    diagnostic = `The shared link could not be opened: ${refused}`;
    return;
  }
  view = result.view;
  modeTouched = true;
  ownHash = hash;
  diagnostic = 'Opened the shared draft. It was checked like a JSON commit before painting.';
}

$effect(() => {
  untrack(() => void openFromHash(window.location.hash, true));
  const onHash = () => void openFromHash(window.location.hash, false);
  window.addEventListener('hashchange', onHash);
  return () => window.removeEventListener('hashchange', onHash);
});

function reset() {
  if (history.apply({ op: 'replaceAll', tree: EMPTY_BLUEPRINT }, { label: 'New draft' }).ok) {
    tree = history.tree;
    historyView = readHistory();
    select([]);
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
      <button type="button" onclick={() => void share()} data-builder-share>Share link</button>
    </div>
    <div class="builder__starters" role="group" aria-labelledby="builder-starters-label" data-builder-starters>
      <span id="builder-starters-label" class="builder__starters-label">Start from</span>
      {#each STARTERS as starter (starter.id)}
        <button type="button" title={starter.summary} data-builder-starter={starter.id} onclick={() => void start(starter.id)}>{starter.label}</button>
      {/each}
    </div>
    {#if shareUrl}
      <label class="builder__share">
        <span>Share link</span>
        <input type="text" readonly value={shareUrl} data-builder-share-url onfocus={(event) => event.currentTarget.select()} />
      </label>
    {/if}
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
        {selection}
        {labelOf}
        {canContain}
        canPaste={clipboard.length > 0}
        onselect={select}
        onselectionchange={(keys, focus) => {
          selection = keys;
          selected = focus;
        }}
        onmove={move}
        onremove={remove}
        oncopy={copy}
        onduplicate={duplicate}
        onpaste={paste}
      />
      <PreviewPane
        {tree}
        {view}
        onviewchange={setView}
        labelOf={(path) => labelOf(atPath(path)?.id ?? '')}
        onselect={select}
      />
    </section>

    <aside class="builder__pane builder__inspector" aria-labelledby="inspector-heading" data-builder-pane>
      <h2 id="inspector-heading">Inspector</h2>
      {#if selectedEntry && selectedManifest}
        <h3>{selectedManifest.label}</h3>
        <p class="builder__hint">{selectedManifest.summary}</p>
        {#key selectedKey}
        {#each inspectorProps as prop (prop.name)}
          {@const value = selectedEntry.node.props?.[prop.name]}
          {@const family = fieldFamily(selectedManifest.id, prop)}
          {#if family === 'text-block'}
            <!-- G16: blocks-* props get structured editors from the blocks schemas. -->
            <TextBlockEditor {value} onchange={(block) => updateProp(prop, block)} />
          {:else if family === 'media-block'}
            <MediaBlockEditor {value} onchange={(block) => updateProp(prop, block)} />
          {:else if family === 'url'}
            <MediaUrlField {prop} role={urlRoleOf(selectedManifest.id, prop.name) ?? 'image-src'} {value} onchange={(next) => updateProp(prop, next)} />
          {:else if family === 'alt'}
            <AltField {prop} {value} onchange={(next) => updateProp(prop, next)} />
          {:else if family === 'choice' && isChoiceProp(prop)}
            <ChoiceField
              {prop}
              {value}
              pinned={pinnedFor(selectedManifest.id, prop.name)}
              onchange={(next) => updateProp(prop, next)}
            />
          {:else if family === 'number' && isNumberProp(prop)}
            <NumberField
              {prop}
              {value}
              hints={numberHints(selectedManifest.id, prop.name)}
              onchange={(next) => updateProp(prop, next)}
            />
          {:else if family === 'struct'}
            {@const struct = chartStructSchema(selectedManifest.id, prop.name)}
            {#if struct}<StructProp {prop} {value} {struct} onchange={(next) => updateProp(prop, next)} />{/if}
          {:else if family === 'string' && isStringProp(prop)}
            <StringField {prop} {value} rule={stringRule(selectedManifest.id, prop.name)} onchange={(next) => updateProp(prop, next)} />
          {:else}
            <JsonField
              {prop}
              {value}
              check={schemaCheck(selectedManifest.id, prop.name)}
              examples={propExamples(selectedManifest, prop.name)}
              onchange={(next) => updateProp(prop, next)}
            />
          {/if}
        {/each}
        {/key}
        {#if unsupportedProps.length}
          <div class="builder__unsupported" data-builder-unsupported>
            <h4>Not editable here</h4>
            <ul>
              {#each unsupportedProps as item (item.name)}<li><code>{item.name}</code>: {item.reason}</li>{/each}
            </ul>
          </div>
        {/if}
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
  .builder__starters { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; inline-size: 100%; }
  .builder__starters-label { font-size: .875rem; font-weight: 600; }
  .builder__share { display: grid; gap: .25rem; inline-size: 100%; font-size: .875rem; }
  .builder__share input { box-sizing: border-box; inline-size: 100%; border: 1px solid var(--tx-border, ButtonBorder); border-radius: .4rem; padding: .45rem; color: inherit; background: var(--tx-background, Canvas); }
  .builder__status, .builder__hint { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: .875rem; }
  .builder__actions { display: flex; flex-wrap: wrap; gap: .5rem; }
  .builder button { font: inherit; border: 1px solid var(--tx-border, ButtonBorder); border-radius: .45rem; padding: .45rem .7rem; color: inherit; background: var(--tx-surface, Canvas); cursor: pointer; }
  .builder button:focus-visible { outline: 3px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .builder button:disabled { opacity: .55; cursor: not-allowed; }
  .builder__grid { display: grid; grid-template-columns: minmax(15rem, .9fr) minmax(20rem, 1.5fr) minmax(16rem, .9fr); align-items: start; gap: 1rem; }
  .builder__pane { min-inline-size: 0; border: 1px solid var(--tx-border, ButtonBorder); border-radius: .65rem; padding: 1rem; background: var(--tx-surface, Canvas); }
  .builder__pane h2 { margin: 0 0 .75rem; font-size: 1.1rem; }
  .builder__unsupported { margin-block-start: 1rem; font-size: .8125rem; color: var(--tx-muted-foreground, GrayText); }
  .builder__unsupported h4 { margin: 0 0 .35rem; color: var(--tx-foreground, CanvasText); }
  .builder__unsupported ul { margin: 0; padding-inline-start: 1.1rem; }
  .builder__guidance { border-block-start: 1px solid var(--tx-border, ButtonBorder); margin-block-start: 1rem; padding-block-start: .75rem; font-size: .875rem; }
  .builder__guidance h4, .builder__guidance p { margin: 0 0 .4rem; }
  @media (max-width: 68rem) { .builder__grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .builder__palette { grid-column: 1 / -1; } }
  @media (max-width: 44rem) { .builder__grid { grid-template-columns: minmax(0, 1fr); } .builder__palette { grid-column: auto; } }
  @media (prefers-reduced-motion: reduce) { .builder *, .builder *::before, .builder *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
</style>

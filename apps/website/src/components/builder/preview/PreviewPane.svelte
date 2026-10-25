<script lang="ts">
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import {
  PLAYER_LOADERS,
  Player,
  type PlayerDiagnosticsEvent,
  type PlayerNodeError,
} from '@texuli/player';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { tick } from 'svelte';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import { SITE_THEME } from '../../foundation/site.ts';
import {
  DEFAULT_PREVIEW_VIEW,
  PREVIEW_LOAD_TIMEOUT_MS,
  PREVIEW_MODES,
  PREVIEW_WIDTH_LABELS,
  PREVIEW_WIDTHS,
  type PreviewMode,
  type PreviewView,
  type PreviewWidth,
  previewIssues,
  previewSummary,
  stageClass,
  stageInlineSize,
} from './model.ts';

let {
  tree,
  labelOf,
  onselect,
  view = DEFAULT_PREVIEW_VIEW,
  onviewchange = () => {},
}: {
  tree: CatalogTreeInput;
  labelOf: (path: number[]) => string;
  onselect: (path: number[]) => void;
  /** The stage width and color mode (they travel with the draft in a share link). */
  view?: PreviewView;
  onviewchange?: (view: PreviewView) => void;
} = $props();

let stage = $state<HTMLElement | undefined>();
/** The host page's theme id: the preview keeps the theme and changes only the mode. */
let hostTheme = $state(SITE_THEME);

$effect(() => {
  const root = document.documentElement;
  const read = () => {
    hostTheme = root.dataset.txTheme || SITE_THEME;
  };
  read();
  const observer = new MutationObserver(read);
  observer.observe(root, { attributes: true, attributeFilter: ['data-tx-theme'] });
  return () => observer.disconnect();
});

/**
 * The stage carries the theme's tokens for its own mode (applyTheme, the
 * tokens contract), so the toggle works whether the host scoped both modes
 * in CSS or applied one mode inline. Until the theme loads, the stage's
 * data-tx-theme and data-tx-mode attributes scope the host's CSS.
 */
$effect(() => {
  const element = stage;
  const mode = view.mode;
  const id = hostTheme;
  if (!element) return;
  let live = true;
  loadLibraryTheme(id).then(
    (theme) => {
      if (live) applyTheme(element, { theme, mode });
    },
    () => {
      // An unknown host theme keeps the CSS scoping only.
    }
  );
  return () => {
    live = false;
  };
});

function onWidth(next: string | string[]) {
  if (typeof next === 'string' && PREVIEW_WIDTHS.includes(next as PreviewWidth)) {
    onviewchange({ ...view, width: next as PreviewWidth });
  }
}

function onMode(next: string | string[]) {
  if (typeof next === 'string' && PREVIEW_MODES.includes(next as PreviewMode)) {
    onviewchange({ ...view, mode: next as PreviewMode });
  }
}

let lastDiagnostics = $state<PlayerDiagnosticsEvent | null>(null);
let nodeErrors = $state<PlayerNodeError[]>([]);
const issues = $derived(previewIssues(lastDiagnostics, nodeErrors));
const summary = $derived(previewSummary(lastDiagnostics, issues.length));

// Each validation starts a fresh issue list; painter errors arrive after it.
function onDiagnostics(event: PlayerDiagnosticsEvent) {
  lastDiagnostics = event;
  nodeErrors = [];
}

function onNodeError(error: PlayerNodeError) {
  nodeErrors = [...nodeErrors, error];
}

// Selecting from an issue moves focus to the node's structure row, so the inspector is one Tab away.
async function select(path: number[]) {
  onselect(path);
  await tick();
  document.querySelector<HTMLElement>(`[data-builder-row="${path.join('.')}"]`)?.focus();
}
</script>

<!-- The real player paints the working draft: every edit is a live update (R20)
     through the blueprint prop, so loaded painters and the reader's place stay. -->
<div class="builder-preview" data-builder-preview data-builder-pane>
  <div class="builder-preview__bar">
    <h3 id="builder-preview-heading">Preview</h3>
    <div class="builder-preview__tools">
      <ToggleGroup type="single" value={view.width} onValueChange={onWidth} variant="outline" size="sm" aria-label="Preview width">
        {#each PREVIEW_WIDTHS as width (width)}
          <ToggleGroupItem value={width} aria-label={PREVIEW_WIDTH_LABELS[width]}>{width === 'mobile' ? 'Mobile' : width === 'tablet' ? 'Tablet' : 'Desktop'}</ToggleGroupItem>
        {/each}
      </ToggleGroup>
      <ToggleGroup type="single" value={view.mode} onValueChange={onMode} variant="outline" size="sm" aria-label="Preview color mode">
        <ToggleGroupItem value="light">Light</ToggleGroupItem>
        <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
      </ToggleGroup>
    </div>
  </div>
  <!-- A real container of the chosen width, scrolled when the pane is narrower; never scaled.
       The site theme id with the preview's own mode re-scopes every --tx-* token inside it. -->
  <div class="builder-preview__viewport" data-builder-preview-viewport>
  <div
    class={stageClass(view)}
    data-builder-preview-stage
    data-width={view.width}
    bind:this={stage}
    data-tx-theme={hostTheme}
    data-tx-mode={view.mode}
    style:inline-size={stageInlineSize(view.width)}
    style:color-scheme={view.mode}
  >
    <Player
      blueprint={tree}
      tier="untrusted"
      status="draft"
      invalidPolicy="preview"
      label="Untrusted draft preview"
      landmarks={false}
      loaders={PLAYER_LOADERS}
      loadTimeoutMs={PREVIEW_LOAD_TIMEOUT_MS}
      {onDiagnostics}
      {onNodeError}
    />
  </div>
  </div>
  <section class="builder-preview__issues" aria-labelledby="builder-issues-heading" data-builder-issues>
    <h3 id="builder-issues-heading">Draft issues</h3>
    <p class="builder-preview__summary" role="status" aria-live="polite">{summary}</p>
    {#if issues.length}
      <ul>
        {#each issues as issue (issue.key)}
          {@const path = issue.path}
          <li class="builder-preview__issue" data-severity={issue.severity} data-issue-code={issue.code}>
            <span class="builder-preview__severity">{issue.severity === 'error' ? 'Error' : 'Warning'}</span>
            <span>{issue.message}</span>
            {#if path}
              <button type="button" onclick={() => void select(path)}>
                Select {labelOf(path)}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .builder-preview { display: grid; gap: .75rem; margin-block-start: 1rem; }
  .builder-preview h3 { margin: 0; font-size: 1rem; }
  .builder-preview__issues h3 { font-size: .9rem; }
  .builder-preview__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; }
  .builder-preview__tools { display: flex; flex-wrap: wrap; gap: .5rem; }
  .builder-preview__viewport { overflow: auto; max-inline-size: 100%; }
  .builder-preview__stage { box-sizing: border-box; contain: layout paint; container-type: inline-size; color: var(--tx-foreground, CanvasText); background: var(--tx-background, Canvas); }
  .builder-preview__stage--mobile, .builder-preview__stage--tablet { margin-inline: auto; border: 1px dashed var(--tx-border, ButtonBorder); }
  .builder-preview__issues { display: grid; gap: .4rem; border-block-start: 1px solid var(--tx-border, ButtonBorder); padding-block-start: .75rem; }
  .builder-preview__summary { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: .875rem; }
  .builder-preview__issues ul { display: grid; gap: .4rem; margin: 0; padding: 0; list-style: none; }
  .builder-preview__issue { display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem; padding: .45rem .6rem; border-inline-start: .25rem solid var(--tx-destructive, #b42318); font-size: .85rem; overflow-wrap: anywhere; }
  .builder-preview__issue[data-severity='warning'] { border-inline-start-color: var(--tx-warning, #9a6700); }
  .builder-preview__severity { font-weight: 600; }
  .builder-preview__issue button { margin-inline-start: auto; }
</style>

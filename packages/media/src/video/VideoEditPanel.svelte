<script lang="ts">
import type { CaptionCue } from '../captions/model.ts';
import { createVideoEdit, type VideoEdit, type VideoEditIssue, validateVideoEdit } from './edit.ts';
import type { VideoEditPanelLabels } from './types.ts';

const DEFAULT_LABELS: VideoEditPanelLabels = {
  editor: 'Video edit',
  trim: 'Trim clip',
  trimStart: 'Trim start (seconds)',
  trimEnd: 'Trim end (seconds)',
  captions: 'Caption cues',
  addCue: 'Add caption cue',
  captionStart: 'Caption start {index} (seconds)',
  captionEnd: 'Caption end {index} (seconds)',
  captionText: 'Caption text {index}',
  removeCue: 'Remove caption cue {index}',
  invalid: 'This edit is invalid for the source duration.',
};

type Props = {
  durationMs: number;
  value?: unknown;
  labels?: Partial<VideoEditPanelLabels>;
  onchange?: (edit: VideoEdit) => void;
};

let { durationMs, value, labels: labelOverrides, onchange }: Props = $props();
const labels = $derived({ ...DEFAULT_LABELS, ...labelOverrides });
let edit = $state<VideoEdit>({ version: 1, trim: { startMs: 0, endMs: 0 }, captions: [] });
let errors = $state<readonly VideoEditIssue[]>([]);

$effect(() => {
  const checked =
    value === undefined
      ? { ok: true as const, edit: createVideoEdit(durationMs) }
      : validateVideoEdit(value, durationMs);
  if (checked.ok) {
    edit = checked.edit;
    errors = [];
  } else {
    errors = checked.errors;
  }
});

function commit(candidate: VideoEdit): void {
  const checked = validateVideoEdit(candidate, durationMs);
  if (!checked.ok) {
    errors = checked.errors;
    return;
  }
  edit = checked.edit;
  errors = [];
  onchange?.(checked.edit);
}

function setTrim(which: 'startMs' | 'endMs', valueText: string): void {
  const seconds = Number(valueText);
  if (!Number.isFinite(seconds)) return;
  commit({ ...edit, trim: { ...edit.trim, [which]: Math.round(seconds * 1000) } });
}

function updateCue(index: number, patch: Partial<CaptionCue>): void {
  commit({
    ...edit,
    captions: edit.captions.map((cue, cueIndex) =>
      cueIndex === index ? { ...cue, ...patch } : cue
    ),
  });
}

function addCue(): void {
  if (edit.captions.length >= 2_000 || durationMs <= 0) return;
  let number = edit.captions.length + 1;
  while (edit.captions.some((cue) => cue.id === `cue-${number}`)) number += 1;
  const start = Math.max(0, Math.min(edit.trim.startMs / 1000, durationMs / 1000 - 0.25));
  const end = Math.min(start + 1, durationMs / 1000);
  commit({
    ...edit,
    captions: [...edit.captions, { id: `cue-${number}`, start, end, text: '' }],
  });
}

function removeCue(index: number): void {
  commit({ ...edit, captions: edit.captions.filter((_, cueIndex) => cueIndex !== index) });
}

function cueLabel(template: string, index: number): string {
  return template.replace('{index}', String(index + 1));
}
</script>

<section class="tx-video-edit" aria-label={labels.editor} data-tx-video-edit>
  <fieldset>
    <legend>{labels.trim}</legend>
    <label>
      <span>{labels.trimStart}</span>
      <input
        type="number"
        min="0"
        max={durationMs / 1000}
        step="0.01"
        value={edit.trim.startMs / 1000}
        onchange={(event) => setTrim('startMs', event.currentTarget.value)}
      />
    </label>
    <label>
      <span>{labels.trimEnd}</span>
      <input
        type="number"
        min="0"
        max={durationMs / 1000}
        step="0.01"
        value={edit.trim.endMs / 1000}
        onchange={(event) => setTrim('endMs', event.currentTarget.value)}
      />
    </label>
  </fieldset>

  <fieldset>
    <legend>{labels.captions}</legend>
    {#each edit.captions as cue, index (cue.id)}
      <div class="tx-video-edit__cue">
        <label>
          <span>{cueLabel(labels.captionStart, index)}</span>
          <input
            type="number"
            min="0"
            max={durationMs / 1000}
            step="0.01"
            value={cue.start}
            onchange={(event) => updateCue(index, { start: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          <span>{cueLabel(labels.captionEnd, index)}</span>
          <input
            type="number"
            min="0"
            max={durationMs / 1000}
            step="0.01"
            value={cue.end}
            onchange={(event) => updateCue(index, { end: Number(event.currentTarget.value) })}
          />
        </label>
        <label class="tx-video-edit__text">
          <span>{cueLabel(labels.captionText, index)}</span>
          <textarea
            maxlength="500"
            value={cue.text}
            oninput={(event) => updateCue(index, { text: event.currentTarget.value })}
          ></textarea>
        </label>
        <button type="button" onclick={() => removeCue(index)}>
          {cueLabel(labels.removeCue, index)}
        </button>
      </div>
    {/each}
    <button
      type="button"
      onclick={addCue}
      disabled={durationMs <= 0 || edit.captions.length >= 2_000}
    >
      {labels.addCue}
    </button>
  </fieldset>

  {#if errors.length > 0}<p role="alert">{labels.invalid}</p>{/if}
</section>

<style>
  @layer tx.components {
    .tx-video-edit {
      display: grid;
      gap: var(--tx-space-4);
      inline-size: 100%;
      color: var(--tx-foreground, CanvasText);
      font: inherit;
    }

    .tx-video-edit fieldset {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
      gap: var(--tx-space-3);
      min-inline-size: 0;
      margin: 0;
      padding: var(--tx-space-4);
      border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder);
      border-radius: var(--tx-shape-radius-lg);
      background: var(--tx-surface, Canvas);
    }

    .tx-video-edit legend {
      padding-inline: calc(var(--tx-space-unit) * 1.4);
      font-weight: 650;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-video-edit label {
      display: grid;
      gap: calc(var(--tx-space-unit) * 1.4);
      min-inline-size: 0;
    }

    .tx-video-edit input,
    .tx-video-edit textarea,
    .tx-video-edit button {
      box-sizing: border-box;
      max-inline-size: 100%;
      min-block-size: 2.5rem;
      padding: var(--tx-space-2);
      color: inherit;
      font: inherit;
    }

    .tx-video-edit input,
    .tx-video-edit textarea {
      inline-size: 100%;
      border: var(--tx-border-width-thin) solid var(--tx-input, var(--tx-border, ButtonBorder));
      border-radius: calc(var(--tx-shape-radius-lg) * 0.6);
      background: var(--tx-background, Canvas);
      color: var(--tx-foreground, CanvasText);
    }

    .tx-video-edit textarea {
      min-block-size: 5rem;
      resize: vertical;
    }

    .tx-video-edit button {
      justify-self: start;
      border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder);
      border-radius: calc(var(--tx-shape-radius-lg) * 0.6);
      background: var(--tx-background, Canvas);
      color: var(--tx-foreground, CanvasText);
      cursor: pointer;
    }

    .tx-video-edit button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .tx-video-edit :is(input, textarea, button):focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: var(--tx-focus-ring-offset, 2px);
    }

    .tx-video-edit__cue {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
      align-items: end;
      gap: var(--tx-space-3);
      padding-block: var(--tx-space-2);
      border-block-end: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder);
    }

    .tx-video-edit__text {
      grid-column: 1 / -1;
    }

    .tx-video-edit [role='alert'] {
      margin: 0;
      color: var(--tx-destructive, Mark);
    }

    @media (forced-colors: active) {
      .tx-video-edit {
        color: CanvasText;
      }

      .tx-video-edit fieldset,
      .tx-video-edit input,
      .tx-video-edit textarea,
      .tx-video-edit button {
        border-color: ButtonText;
        background: Canvas;
        color: CanvasText;
      }

      .tx-video-edit :is(input, textarea, button):focus-visible {
        outline: 3px solid Highlight;
        outline-offset: 2px;
      }

      .tx-video-edit button:disabled {
        opacity: 1;
        color: GrayText;
        border-color: GrayText;
      }

      .tx-video-edit [role='alert'] {
        color: CanvasText;
        border: var(--tx-border-width-thick) solid CanvasText;
        padding: calc(var(--tx-space-unit) * 1.4) var(--tx-space-2);
        font-weight: 600;
      }
    }
  }
</style>

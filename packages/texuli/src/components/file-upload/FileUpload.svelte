<script lang="ts">
import { localizeLabels } from '@texuli/core/i18n';
import { safeImageSrc } from '@texuli/core/url-policy';
import {
  FileDrop,
  type FileDropRejection,
  type FileDropRejectReason,
} from '@texuli/primitives/file-drop';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { joinIds } from '../../internal/control-props.ts';
import { type ClassValue } from '../../internal/cx.ts';
import { chainHandlers } from '../../internal/handlers.ts';
import type { RefProp } from '../../internal/ref.ts';
import {
  DEFAULT_FILE_UPLOAD_LABELS,
  type FileUploadLabels,
  type FileUploadProgressMap,
} from './types.ts';
import { type FileUploadVariant, fileUploadClass } from './variants.ts';
import './file-upload.css';
import { designDefaults } from '../../internal/design-defaults.ts';

/**
 * Extra attributes land on the wrapper (`id`, `aria-*`, `data-*`, `onfocus` and
 * `onblur` on the file input, so `<label for>` and Field reach the focusable
 * control). Caller `onchange`, `ondrop` and drag handlers run on the wrapper as
 * the events bubble out of the drop zone: after the zone's own handling,
 * never instead of it.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'id'> & {
  /** The file input's id (`<label for>`, Field). Generated when omitted. */
  id?: string;
  /** Same as `id`; `inputId` wins when both are given. */
  inputId?: string;
  files?: File[];
  rejects?: FileDropRejection[];
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  variant?: FileUploadVariant;
  showPreviews?: boolean;
  progress?: FileUploadProgressMap;
  status?: Readonly<Record<string, 'pending' | 'uploading' | 'done' | 'error' | undefined>>;
  labels?: Partial<FileUploadLabels>;
  /**
   * Called once per pick or drop with the files it added (only accepted
   * files; rejected ones land in `rejects`). Not called for `files` the host
   * sets.
   */
  onFilesAdd?: (files: File[]) => void;
  /** Called with the file the person took out of the list with its remove button. */
  onFileRemove?: (file: File) => void;
  class?: ClassValue;
};

const txDefaults = designDefaults('file-upload');
let {
  files = $bindable<File[]>([]),
  rejects = $bindable<FileDropRejection[]>([]),
  accept,
  maxSize,
  maxFiles = Number.POSITIVE_INFINITY,
  multiple = true,
  disabled = false,
  required = false,
  name,
  variant = txDefaults().variant ?? 'default',
  showPreviews = true,
  progress = {},
  status = {},
  labels: labelOverrides,
  onFilesAdd,
  onFileRemove,
  class: className,
  id,
  inputId,
  onchange,
  ondrop,
  onchangecapture,
  ondropcapture,
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();
const msg = useMessages();

/** The list before a pick or drop reaches the zone (set in the capture phase). */
let before: File[] | null = null;

function snapshot(): void {
  before = files;
}

/** After the zone handled a pick or drop: report the files it added. */
function report(): void {
  const previous = before;
  before = null;
  if (previous === null || previous === files) return;
  const added = files.filter((file) => !previous.includes(file));
  if (added.length > 0) onFilesAdd?.(added);
}

function removeFromList(file: File, removeFile: (file: File) => void): void {
  const previous = files;
  removeFile(file);
  if (files !== previous && !files.includes(file)) onFileRemove?.(file);
}

const labels = $derived<FileUploadLabels>({
  ...localizeLabels(msg, 'texuli.file-upload', DEFAULT_FILE_UPLOAD_LABELS),
  ...labelOverrides,
});

const rootClass = $derived(
  fileUploadClass({
    variant,
    class: className,
  })
);

/** Object-URL map for image previews; keys match `fileKey`. Written only from the effect. */
let previewUrls = $state<Record<string, string>>({});

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function rejectMessage(rejection: FileDropRejection): string {
  const map: Record<FileDropRejectReason, string> = {
    type: labels.rejectType,
    size: labels.rejectSize,
    count: labels.rejectCount,
  };
  return map[rejection.reason] ?? rejection.reason;
}

function previewSrc(key: string): string | undefined {
  const raw = previewUrls[key];
  return raw ? safeImageSrc(raw, 'developer') : undefined;
}

function progressFillStyle(pct: number | null | undefined): string | undefined {
  if (typeof pct !== 'number') return undefined;
  const clamped = Math.min(100, Math.max(0, pct));
  return `--tx-file-upload-progress: ${clamped}%`;
}

/**
 * Build object URLs for image files. Capture `next` in cleanup only — never
 * read `previewUrls` here, or the write retriggers the effect forever.
 */
$effect(() => {
  const next: Record<string, string> = {};
  const canPreview =
    showPreviews && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  if (canPreview) {
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        next[fileKey(file)] = URL.createObjectURL(file);
      }
    }
  }
  previewUrls = next;
  return () => {
    for (const url of Object.values(next)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore revoke failures on already-released URLs
      }
    }
  };
});

function itemStatus(file: File): 'pending' | 'uploading' | 'done' | 'error' {
  const key = fileKey(file);
  const override = status[key];
  if (override) return override;
  const p = progress[key];
  if (p === null) return 'uploading';
  if (typeof p === 'number') {
    if (p >= 100) return 'done';
    if (p >= 0) return 'uploading';
  }
  return 'pending';
}

// aria-*, data-* and the focus handlers (focus does not bubble) name and
// wire the file input (the focusable control); other handlers and layout
// hooks stay on the drop-zone wrapper.
const toInput = (key: string) => /^(?:aria-|data-|onfocus$|onblur$)/.test(key);
const inputAttrs = $derived(
  Object.fromEntries(Object.entries(rest).filter(([key]) => toInput(key)))
);
const wrapperAttrs = $derived(
  Object.fromEntries(Object.entries(rest).filter(([key]) => !toInput(key)))
);

function itemProgress(file: File): number | null | undefined {
  return progress[fileKey(file)];
}
</script>

<div bind:this={ref}
  class={rootClass}
  data-tx-file-upload
  data-variant={variant}
  {...wrapperAttrs}
  onchangecapture={chainHandlers(onchangecapture, snapshot)}
  ondropcapture={chainHandlers(ondropcapture, snapshot)}
  onchange={chainHandlers(onchange, report)}
  ondrop={chainHandlers(ondrop, report)}
>
  <FileDrop.Root
    bind:files
    bind:rejects
    {accept}
    {maxSize}
    {maxFiles}
    {multiple}
    {disabled}
    {required}
    {name}
    {...(inputId ?? id) ? { inputId: inputId ?? id } : {}}
    label={labels.label}
    inputLabel={labels.inputLabel}
    browseLabel={labels.browse}
    description={labels.description}
    getRejectMessage={rejectMessage}
    class="tx-file-upload__zone"
    inputClass="tx-file-upload__input"
  >
    {#snippet child({ props })}
      <label class="tx-file-upload__browse" for={String(props.id)}>{labels.browse}</label>
      <input
        {...props}
        {...inputAttrs}
        aria-invalid={inputAttrs['aria-invalid'] ?? props['aria-invalid']}
        aria-describedby={joinIds(
          props['aria-describedby'] as string | undefined,
          inputAttrs['aria-describedby'] as string | undefined
        )}
        class="tx-file-upload__input"
      />
    {/snippet}

    {#snippet children({ files: selected, removeFile })}
      {#if selected.length === 0}
        <p class="tx-file-upload__hint" data-tx-file-upload-empty>{labels.empty}</p>
      {:else}
        <ul class="tx-file-upload__list" aria-label={labels.selectedList} data-tx-file-upload-list>
          {#each selected as file (fileKey(file))}
            {@const key = fileKey(file)}
            {@const st = itemStatus(file)}
            {@const pct = itemProgress(file)}
            {@const thumb = previewSrc(key)}
            <li class="tx-file-upload__item" data-status={st} data-file-key={key}>
              {#if thumb}
                <img class="tx-file-upload__preview" src={thumb} alt="" />
              {:else}
                <div class="tx-file-upload__preview tx-file-upload__preview--icon" aria-hidden="true">
                  {file.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}
                </div>
              {/if}
              <div class="tx-file-upload__meta">
                <p class="tx-file-upload__name">{file.name}</p>
                <p class="tx-file-upload__size">{formatBytes(file.size)}</p>
                {#if st === 'uploading' || typeof pct === 'number'}
                  <div
                    class="tx-file-upload__progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={typeof pct === 'number' ? Math.round(pct) : undefined}
                    aria-label={`${file.name} upload progress`}
                  >
                    <div class="tx-file-upload__progress-track">
                      <div
                        class="tx-file-upload__progress-fill"
                        data-indeterminate={pct === null || pct === undefined ? 'true' : undefined}
                        style={progressFillStyle(pct)}
                      ></div>
                    </div>
                  </div>
                {/if}
              </div>
              <button
                type="button"
                class="tx-file-upload__remove"
                disabled={disabled}
                aria-label={`${labels.remove} ${file.name}`}
                onclick={() => removeFromList(file, removeFile)}
              >
                ×
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/snippet}
  </FileDrop.Root>
</div>

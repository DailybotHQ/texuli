<script lang="ts">
import { useMessages } from '../i18n/use-messages.ts';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { validateFiles } from './accept.ts';
import type {
  FileDropChildren,
  FileDropChildState,
  FileDropInputProps,
  FileDropRejection,
  FileDropRootProps,
} from './types.ts';

type Props = RefProp & FileDropRootProps;

const uid = $props.id();
let {
  inputId: suppliedInputId,
  accept,
  maxSize,
  maxFiles = Number.POSITIVE_INFINITY,
  multiple = true,
  disabled = false,
  required = false,
  name,
  files = $bindable<File[]>([]),
  rejects = $bindable<FileDropRejection[]>([]),
  label: labelProp,
  inputLabel: inputLabelProp,
  browseLabel: browseLabelProp,
  description,
  inputClass,
  getRejectMessage,
  getAnnouncement,
  child,
  children,
  id,
  class: className,
  'aria-label': ariaLabel,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('primitives.file-drop.label', 'Upload files'));
const inputLabel = $derived(inputLabelProp ?? label);
const browseLabel = $derived(
  browseLabelProp ?? msg('primitives.file-drop.browse-label', 'Choose files')
);

const rootId = $derived(id ?? `file-drop-${uid}`);
// A consumer input id wins; the label, description and rejections follow it.
const inputId = $derived(suppliedInputId ?? `file-drop-input-${uid}`);
const descriptionId = $derived(`${inputId}-description`);
const rejectionId = $derived(`${inputId}-rejections`);
let dragging = $state<boolean>(false);
let announcement = $state<string>('');
const dropState = $derived<'disabled' | 'dragging' | 'idle'>(
  disabled ? 'disabled' : dragging ? 'dragging' : 'idle'
);
const inputDescription = $derived(
  [description ? descriptionId : undefined, rejects.length > 0 ? rejectionId : undefined]
    .filter((value): value is string => Boolean(value))
    .join(' ') || undefined
);

function defaultRejectMessage(rejection: FileDropRejection): string {
  if (rejection.reason === 'type') return `Unsupported file type (${accept || '*/*'}).`;
  if (rejection.reason === 'size') return 'File is too large.';
  return `File limit: ${multiple ? maxFiles : 1}.`;
}

function updateFiles(incoming: Iterable<File>): void {
  if (disabled) return;
  const result = validateFiles(incoming, {
    accept,
    maxSize,
    maxFiles,
    currentCount: files.length,
    multiple,
  });
  rejects = result.rejected;
  if (result.accepted.length > 0) {
    const next = multiple ? [...files, ...result.accepted] : result.accepted.slice(0, 1);
    files = next;
  }
  announcement =
    getAnnouncement?.(result.accepted, result.rejected) ??
    (result.accepted.length > 0
      ? 'Files added.'
      : result.rejected.length > 0
        ? 'Files rejected.'
        : '');
}

function handleInputChange(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  const selected = input.files ? Array.from(input.files) : [];
  input.value = '';
  updateFiles(selected);
}

function removeFile(file: File): void {
  if (disabled) return;
  const index = files.indexOf(file);
  if (index < 0) return;
  const next = files.slice();
  next.splice(index, 1);
  files = next;
}

const childState = $derived<FileDropChildState>({
  files,
  rejects,
  dragging,
  disabled,
  removeFile,
});

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function handleDragEnter(event: DragEvent): void {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  if (!disabled) dragging = true;
}

function handleDragOver(event: DragEvent): void {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
  if (!disabled) dragging = true;
}

function handleDragLeave(event: DragEvent): void {
  const root = event.currentTarget as HTMLElement;
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && root.contains(nextTarget)) return;
  dragging = false;
}

function handleDrop(event: DragEvent): void {
  const dropped = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
  if (carriesFiles(event) || dropped.length > 0) event.preventDefault();
  dragging = false;
  if (!disabled && dropped.length > 0) updateFiles(dropped);
}

const rootProps = $derived({
  ...rest,
  id: rootId,
  class: className,
  role: 'group' as const,
  'aria-label': ariaLabel ?? label,
  'data-state': dropState,
  ondragenter: handleDragEnter,
  ondragover: handleDragOver,
  ondragleave: handleDragLeave,
  ondrop: handleDrop,
});

const inputProps = $derived<FileDropInputProps>({
  id: inputId,
  type: 'file',
  accept,
  multiple: multiple || undefined,
  disabled: disabled || undefined,
  required: required || undefined,
  name,
  class: inputClass,
  'aria-label': inputLabel,
  'aria-describedby': inputDescription,
  'aria-invalid': rejects.length > 0 || undefined,
  onchange: handleInputChange,
});
</script>

<div bind:this={ref} {...rootProps}>
  {#if description}
    <p id={descriptionId}>{description}</p>
  {/if}
  <label for={inputId}>{browseLabel}</label>
  {#if child}
    {@render child({ props: inputProps })}
  {:else}
    <input {...inputProps} />
  {/if}
  {#if children}
    {@render children(childState)}
  {/if}
  {#if rejects.length > 0}
    <div id={rejectionId} role="alert">
      <ul>
        {#each rejects as rejection, index (`${rejection.file.name}-${rejection.reason}-${index}`)}
          <li>
            <span>{rejection.file.name}</span>
            — {getRejectMessage?.(rejection) ?? defaultRejectMessage(rejection)}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  <p role="status">{announcement}</p>
</div>

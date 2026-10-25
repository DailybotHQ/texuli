<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'accept',
      label: 'accept',
      options: ['any', 'text/plain,.md', 'image/*'],
      default: 'text/plain,.md',
    },
    { kind: 'number', name: 'maxFiles', label: 'maxFiles', min: 1, max: 5, step: 1, default: 3 },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['default', 'compact'],
      default: 'default',
    },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['Tab'], action: 'Move to the file input inside the drop zone' },
    { keys: ['Enter', ' '], action: 'Open the system file chooser from the input' },
  ],
  uncontrolled:
    'No binding: the zone keeps the chosen or dropped files itself and validates type, size and count.',
  controlled: 'bind:files keeps the list in your state, so code outside can add or clear files.',
  code: (v) => `<script lang="ts">
  import { FileDrop } from '@texuli/primitives/file-drop';
  let files = $state<File[]>([]);
${SCRIPT_END}

<FileDrop.Root bind:files label="Attach documents"${v.accept === 'any' ? '' : attr('accept', String(v.accept))}${attr('maxFiles', Number(v.maxFiles))}${attr('disabled', v.disabled === true, false)}>
  {#snippet children({ files, removeFile })}
    <ul>
      {#each files as file (file.name)}
        <li>{file.name} <button onclick={() => removeFile(file)}>Remove</button></li>
      {/each}
    </ul>
  {/snippet}
</FileDrop.Root>

${recipeLine('fileUploadClass', 'texuli/file-upload', { variant: v.variant ?? 'default' })}`,
  keyCheck: {
    focus: 'input[type="file"]',
    press: ' ',
    expect: { fileChooser: true },
  },
  controlCheck: {
    act: '[data-demo-act="add"]',
    expect: { selector: '[data-file-name="harbor-log.txt"]', count: 1 },
  },
};
</script>

<script lang="ts">
import { FileDrop, type FileDropChildState, type FileDropInputProps } from '@texuli/primitives/file-drop';
import { Button } from 'texuli/button';
import { fileUploadClass } from 'texuli/file-upload';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const acceptValue = $derived(str(values, 'accept', 'text/plain,.md'));
const accept = $derived(acceptValue === 'any' ? undefined : acceptValue);
const maxFiles = $derived(num(values, 'maxFiles', 3));
const variant = $derived(str(values, 'variant', 'default') === 'compact' ? 'compact' : 'default');
const disabled = $derived(bool(values, 'disabled'));
const rootClass = $derived(fileUploadClass({ variant }));

let files = $state<File[]>([]);
let added = 0;

function addSample(): void {
  added += 1;
  const name = added === 1 ? 'harbor-log.txt' : `harbor-log-${added}.txt`;
  files = [...files, new File(['Fictional harbor log entry.'], name, { type: 'text/plain' })];
}

function formatBytes(size: number): string {
  return size < 1024 ? `${size} B` : `${Math.round(size / 102.4) / 10} KB`;
}
</script>

{#snippet zone(label: string)}
  {#snippet child({ props }: { props: FileDropInputProps })}
    <label class="tx-file-upload__browse" for={String(props.id)}>Choose files</label>
    <input {...props} class="tx-file-upload__input" />
  {/snippet}
  {#snippet children({ files: selected, removeFile }: FileDropChildState)}
    {#if selected.length === 0}
      <p class="tx-file-upload__hint">Drop files here or choose them.</p>
    {:else}
      <ul class="tx-file-upload__list" aria-label="{label}: selected files">
        {#each selected as file, index (`${file.name}-${index}`)}
          <li class="tx-file-upload__item" data-file-name={file.name}>
            <div class="tx-file-upload__preview tx-file-upload__preview--icon" aria-hidden="true">
              {file.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}
            </div>
            <div class="tx-file-upload__meta">
              <p class="tx-file-upload__name">{file.name}</p>
              <p class="tx-file-upload__size">{formatBytes(file.size)}</p>
            </div>
            <button type="button" class="tx-file-upload__remove" {disabled} aria-label="Remove {file.name}" onclick={() => removeFile(file)}>
              ×
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}
  {#if mode === 'uncontrolled'}
    <FileDrop.Root {accept} {maxFiles} {disabled} {label} maxSize={1_000_000} class="tx-file-upload__zone" inputClass="tx-file-upload__input" data-demo-part="FileDrop.Root" {child} {children} />
  {:else}
    <FileDrop.Root bind:files {accept} {maxFiles} {disabled} {label} maxSize={1_000_000} class="tx-file-upload__zone" inputClass="tx-file-upload__input" data-demo-part="FileDrop.Root" {child} {children} />
  {/if}
{/snippet}

<div class={rootClass} data-tx-file-upload data-variant={variant}>
  {@render zone(mode === 'uncontrolled' ? 'Attach documents' : 'Attach logs')}
</div>
{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>files: {files.length ? files.map((file) => file.name).join(', ') : 'none'}</output>
    <Button size="sm" variant="outline" onclick={addSample} data-demo-act="add">Add harbor-log.txt</Button>
    <Button size="sm" variant="ghost" onclick={() => (files = [])}>Clear</Button>
  </div>
{/if}

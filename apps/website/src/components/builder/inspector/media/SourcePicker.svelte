<script lang="ts">
import {
  AVATAR_IDS,
  BLOCK_SOURCE_LABELS,
  type BlockSourceKind,
  blockSourceKindOf,
  dataUriOf,
  describeSource,
  EMBED_TYPES,
  MEDIA_DATA_URI_MAX_BYTES,
  readBlockSource,
  sourceKindsFor,
} from './model.ts';

/**
 * A `blocks-media` source: an avatar id, an embedded file (read locally into
 * a base64 data URI; nothing is uploaded) or a relative path. Remote URLs
 * are not offered because the block parser refuses them. Each value is
 * judged by the parser's own `classifyMediaSource`.
 */
let {
  media,
  label,
  value,
  required = false,
  issue,
  onchange,
}: {
  media: 'image' | 'video';
  label: string;
  value: unknown;
  required?: boolean;
  /** The block parser's message for this field, when it stopped here. */
  issue?: string;
  onchange: (next: string | undefined) => void;
} = $props();

const uid = $props.id();
let chosen = $state<BlockSourceKind | undefined>();
let fileMessage = $state('');
const kinds = $derived(sourceKindsFor(media));
const kind = $derived(chosen ?? blockSourceKindOf(value));
const text = $derived(typeof value === 'string' ? value : '');
const reading = $derived(readBlockSource(value, media));
const verdict = $derived(
  value === undefined || value === ''
    ? required
      ? 'Required: choose a source.'
      : 'Not set.'
    : reading.ok
      ? `Accepted by the block schema: ${BLOCK_SOURCE_LABELS[reading.kind].toLowerCase()}.`
      : `Refused by the block schema: ${reading.message}.`
);
const note = $derived(
  kind === 'avatar'
    ? 'Avatars paint only where the host supplies resolveAvatar; the player does not, so the preview shows the image as unavailable.'
    : kind === 'data'
      ? `Embedded in the blueprint: ${EMBED_TYPES[media].join(', ')}, at most ${MEDIA_DATA_URI_MAX_BYTES / 1024} KB.`
      : 'Resolved against the host page. The builder preview has no such files, so it shows the image as unavailable.'
);

function pick(next: BlockSourceKind) {
  chosen = next;
  fileMessage = '';
  if (next === 'avatar' && !text.startsWith('avatar:')) onchange(`avatar:${AVATAR_IDS[0]}`);
}

async function onfile(event: Event & { currentTarget: HTMLInputElement }) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = '';
  if (!file) return;
  if (!EMBED_TYPES[media].includes(file.type)) {
    fileMessage = `${file.type || 'This file type'} is not accepted: use ${EMBED_TYPES[media].join(', ')}.`;
    return;
  }
  if (file.size > MEDIA_DATA_URI_MAX_BYTES) {
    fileMessage = `The file is ${Math.ceil(file.size / 1024)} KB; embedded media must be at most ${MEDIA_DATA_URI_MAX_BYTES / 1024} KB.`;
    return;
  }
  fileMessage = '';
  onchange(dataUriOf(new Uint8Array(await file.arrayBuffer()), file.type));
}
</script>

<fieldset class="source" data-tx-media-source={label} data-kind={kind}>
  <legend>{label}{required ? ' · required' : ''}</legend>
  <div class="source__kinds">
    {#each kinds as option (option)}
      <label>
        <input type="radio" name={`${uid}-kind`} value={option} checked={kind === option} onchange={() => pick(option)} />
        {BLOCK_SOURCE_LABELS[option]}
      </label>
    {/each}
  </div>

  {#if kind === 'avatar'}
    <label class="source__field" for={`${uid}-avatar`}>
      <span>Avatar</span>
      <select
        id={`${uid}-avatar`}
        value={text.startsWith('avatar:') ? text.slice('avatar:'.length) : ''}
        aria-describedby={`${uid}-verdict ${uid}-note`}
        onchange={(event) => onchange(`avatar:${event.currentTarget.value}`)}
      >
        {#if !AVATAR_IDS.includes(text.slice('avatar:'.length))}<option value="" disabled>Choose…</option>{/if}
        {#each AVATAR_IDS as id (id)}<option value={id}>{id}</option>{/each}
      </select>
    </label>
  {:else if kind === 'data'}
    <label class="source__field" for={`${uid}-file`}>
      <span>File ({media})</span>
      <input
        id={`${uid}-file`}
        type="file"
        accept={EMBED_TYPES[media].join(',')}
        aria-describedby={`${uid}-verdict ${uid}-note`}
        onchange={onfile}
      />
    </label>
    {#if text.startsWith('data:')}<p class="source__note">Current: {describeSource(text)}</p>{/if}
  {:else}
    <label class="source__field" for={`${uid}-path`}>
      <span>Path</span>
      <input
        id={`${uid}-path`}
        type="text"
        spellcheck="false"
        autocomplete="off"
        placeholder={media === 'image' ? 'images/photo.png' : 'media/clip.mp4'}
        value={text.startsWith('data:') || text.startsWith('avatar:') ? '' : text}
        aria-invalid={value !== undefined && !reading.ok ? 'true' : undefined}
        aria-describedby={`${uid}-verdict ${uid}-note`}
        oninput={(event) => onchange(event.currentTarget.value || undefined)}
      />
    </label>
  {/if}
  {#if fileMessage}<p class="source__verdict" data-verdict="file">{fileMessage}</p>{/if}
  <p id={`${uid}-verdict`} class="source__verdict" data-verdict={reading.ok ? 'ok' : 'refused'}>
    {issue && reading.ok ? `Refused by the block schema: ${issue}.` : verdict}
  </p>
  <p id={`${uid}-note`} class="source__note">{note}</p>
  {#if value !== undefined && !required}
    <button type="button" class="source__button" onclick={() => { chosen = undefined; onchange(undefined); }}>Remove {label}</button>
  {/if}
</fieldset>

<style>
  .source {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0.5rem 0.65rem 0.65rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.45rem;
    min-inline-size: 0;
  }
  .source__kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .source__field {
    display: grid;
    gap: 0.25rem;
  }
  .source__field :is(input[type='text'], select) {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.45rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .source [aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .source__verdict {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .source__note {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
    overflow-wrap: anywhere;
  }
  .source__button {
    justify-self: start;
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.3rem 0.55rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
  .source :is(input, select, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>

<script lang="ts">
// Named versions: save the current state under a name, list the versions
// (newest first), show the changes since one (a disclosure), and restore
// one. Restoring emits new operations, so it reaches every collaborator
// and one undo brings the edits back.
import { getAnnouncer } from '@texuli/core/announcer';
import type { CollabVersion, DocumentChange } from '@texuli/document/collab';
import { type CollabLabels, DEFAULT_COLLAB_LABELS } from './labels.ts';
import type { CollabSession } from './session.svelte.ts';

interface Props {
  session: CollabSession;
  labels?: CollabLabels;
  /** Polite announcements. Default: `@texuli/core/announcer`. */
  announce?: (message: string) => void;
}

let { session, labels = DEFAULT_COLLAB_LABELS, announce }: Props = $props();

const uid = $props.id();
let name = $state('');
let open = $state<string | null>(null);
const versions = $derived([...session.versions].reverse());
const changes = $derived.by((): DocumentChange[] => {
  void session.revision;
  return open ? (session.compare(open) ?? []) : [];
});
const time = (iso: string | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

function say(message: string): void {
  if (announce) announce(message);
  else if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
}

function save(event: SubmitEvent): void {
  event.preventDefault();
  const trimmed = name.trim();
  if (!session.saveVersion(trimmed)) return;
  name = '';
  say(labels.versionSaved(trimmed));
}

function restore(version: CollabVersion): void {
  if (session.restoreVersion(version.id)) say(labels.versionRestored(version.name));
}
</script>

<section class="tx-pages-collab__panel" aria-labelledby={`${uid}-title`}>
  <h2 class="tx-pages-collab__heading" id={`${uid}-title`}>{labels.versions}</h2>
  <form class="tx-pages-collab__save" onsubmit={save}>
    <label class="tx-pages-collab__label" for={`${uid}-name`}>{labels.versionName}</label>
    <input id={`${uid}-name`} class="tx-pages-collab__input" maxlength="120" bind:value={name} />
    <button type="submit" class="tx-pages-action">{labels.saveVersion}</button>
  </form>
  {#if versions.length === 0}
    <p class="tx-pages-collab__empty">{labels.noVersions}</p>
  {:else}
    <ol class="tx-pages-collab__versions">
      {#each versions as version (version.id)}
        <li class="tx-pages-collab__version" data-version={version.id}>
          <span class="tx-pages-collab__version-name">{version.name}</span>
          <span class="tx-pages-collab__time">
            {labels.versionBy(version.author)}{#if version.created}, <time datetime={version.created}>{time(version.created)}</time>{/if}
          </span>
          <div class="tx-pages-collab__buttons">
            <button
              type="button"
              class="tx-pages-action"
              aria-expanded={open === version.id}
              aria-controls={`${uid}-${version.id.replace(/[^A-Za-z0-9_-]/g, '-')}`}
              onclick={() => (open = open === version.id ? null : version.id)}
            >{labels.compare} “{version.name}”</button>
            <button type="button" class="tx-pages-action" onclick={() => restore(version)}>{labels.restore(version.name)}</button>
          </div>
          <div
            class="tx-pages-collab__diff"
            id={`${uid}-${version.id.replace(/[^A-Za-z0-9_-]/g, '-')}`}
            hidden={open !== version.id}
          >
            {#if open === version.id}
              {#if changes.length === 0}
                <p class="tx-pages-collab__empty">{labels.noChanges}</p>
              {:else}
                <ul class="tx-pages-collab__changes">
                  {#each changes as change, i (i)}
                    <li class="tx-pages-collab__change" data-kind={change.kind}>{labels.change(change)}</li>
                  {/each}
                </ul>
              {/if}
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>

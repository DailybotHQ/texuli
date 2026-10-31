<script lang="ts">
// A live embed. Component and deck payloads are painted by `@texuli/player`
// (loaded on first use through the host's `loadPlayer`) at the untrusted
// tier: the player validates the one-node blueprint again and refuses it
// when it does not pass. Without a loader (G123) such an embed shows a
// notice instead. Sheets and canvases are typed references until their
// packages ship (planned).
import type { DocumentJson, EmbedBlock } from '@texuli/document/model';
import type { DeckPlayerHost, PlayerDiagnosticsEvent } from '@texuli/player';
import type { Component } from 'svelte';
import { type EmbedResolver, planEmbed } from './embeds.ts';
import type { PagesLabels } from './labels.ts';
import { type PagesPlayerLoader, resolvePlayer } from './player-loader.ts';

let {
  node,
  labels,
  resolveEmbed,
  deckHost = null,
  reducedMotion = false,
  loadPlayer = null,
  onrefused,
}: {
  node: EmbedBlock;
  labels: PagesLabels;
  resolveEmbed?: EmbedResolver | undefined;
  deckHost?: DeckPlayerHost | null | undefined;
  reducedMotion?: boolean;
  /** Loads the player; `null` turns live embeds off (G123). */
  loadPlayer?: PagesPlayerLoader | null | undefined;
  /** The embed was refused or is only a reference: a host takes it over (no notice shows). */
  onrefused?: (() => void) | undefined;
} = $props();

/** `undefined` while a host ref resolves. */
let payload = $state.raw<DocumentJson | null | undefined>(undefined);
// biome-ignore lint/suspicious/noExplicitAny: the player's props are checked where it is defined.
let Player = $state.raw<Component<any> | null>(null);
let playerFailed = $state(false);
let refused = $state(false);

$effect(() => {
  const { inline, ref, kind } = node;
  let live = true;
  refused = false;
  if (inline) payload = inline;
  else if (ref && resolveEmbed) {
    payload = undefined;
    Promise.resolve()
      .then(() => resolveEmbed({ kind, ref }))
      .then(
        (value) => {
          if (live) payload = value ?? null;
        },
        () => {
          if (live) payload = null;
        }
      );
  } else payload = null;
  return () => {
    live = false;
  };
});

const plan = $derived(payload === undefined ? null : planEmbed(node, payload));

/** The embed needs the player and the host gave no loader. */
const off = $derived(plan?.kind === 'player' && !loadPlayer);

$effect(() => {
  const load = loadPlayer;
  if (plan?.kind !== 'player' || Player || !load) return;
  let live = true;
  resolvePlayer(load).then(
    (component) => {
      if (live) Player = component;
    },
    () => {
      if (live) playerFailed = true;
    }
  );
  return () => {
    live = false;
  };
});

const title = $derived(node.title ?? '');
const status = $derived(
  plan === null
    ? 'loading'
    : plan.kind === 'refused' || refused || playerFailed
      ? 'refused'
      : plan.kind === 'reference'
        ? 'reference'
        : off
          ? 'off'
          : 'painted'
);

$effect(() => {
  if ((status === 'refused' || status === 'reference' || status === 'off') && onrefused)
    onrefused();
});

function ondiagnostics(event: PlayerDiagnosticsEvent): void {
  refused = event.surface === 'notice';
}
</script>

<figure class="tx-pages-embed" data-kind={node.kind} data-state={status}>
  <figcaption class="tx-pages-embed__caption">
    <span class="tx-pages-embed__title">{labels.embed(node.kind, title)}</span>
    <span class="tx-pages-badge">{labels.untrusted}</span>
  </figcaption>
  {#if plan === null}
    <p class="tx-pages-loading" aria-busy="true">{labels.embedLoading}</p>
  {:else if plan.kind === 'refused' || playerFailed}
    <p class="tx-pages-notice" role="note" data-refused="">{labels.refused}</p>
  {:else if plan.kind === 'reference'}
    <p class="tx-pages-notice" role="note">{labels.embedUnavailable(plan.embed)}</p>
  {:else if off}
    <p class="tx-pages-notice" role="note" data-player-off="">{labels.embedOff(node.kind)}</p>
  {:else if Player}
    <Player
      blueprint={plan.blueprint}
      label={labels.embed(node.kind, title)}
      tier="untrusted"
      chrome={false}
      landmarks={false}
      invalidPolicy="refuse"
      motion={reducedMotion ? 'reduce' : 'auto'}
      {deckHost}
      labels={{ invalidNotice: labels.refused }}
      onDiagnostics={ondiagnostics}
    />
  {:else}
    <p class="tx-pages-loading" aria-busy="true">{labels.embedLoading}</p>
  {/if}
</figure>

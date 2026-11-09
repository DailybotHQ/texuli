<script lang="ts">
/**
 * Small controls hydrate on visibility. "Render with the web player" imports
 * `@texuli/player` on request and paints the validated fixture, so the page itself carries
 * no player stylesheet until someone asks for the live render.
 */
import type { Component } from 'svelte';

type PlayerProps = {
  blueprint: unknown;
  tier: 'untrusted';
  status: 'draft';
  label: string;
  landmarks: boolean;
};

type Props = {
  blueprintJson: string;
  traceJson: string;
  specVersion: string;
};

let { blueprintJson, traceJson, specVersion }: Props = $props();
let jsonVisible = $state(false);
let traceVisible = $state(false);
let announcement = $state('');
let Player = $state<Component<PlayerProps> | null>(null);
let playerLoading = $state(false);
let playerFailed = $state(false);
const blueprint = $derived(JSON.parse(blueprintJson) as unknown);

async function renderWithPlayer(): Promise<void> {
  if (Player || playerLoading) return;
  playerLoading = true;
  announcement = 'Loading the web player…';
  try {
    const [module] = await Promise.all([
      import('@texuli/player'),
      import('@texuli/player/styles.css'),
    ]);
    Player = module.Player as unknown as Component<PlayerProps>;
    announcement = 'The web player painted the validated fixture.';
  } catch {
    playerFailed = true;
    announcement = 'The web player could not load. The outline above shows the same report.';
  } finally {
    playerLoading = false;
  }
}

$effect(() => {
  announcement = `Validated @texuli/spec ${specVersion} fixture ready.`;
});

async function copyBlueprint(): Promise<void> {
  try {
    await navigator.clipboard.writeText(blueprintJson);
    announcement = 'Validated blueprint JSON copied.';
  } catch {
    announcement = 'Clipboard access is unavailable. Open the JSON view to copy it manually.';
  }
}

function reset(): void {
  jsonVisible = false;
  traceVisible = false;
  Player = null;
  announcement = `Demo reset. Validated @texuli/spec ${specVersion} fixture ready.`;
}
</script>

<section class="native-demo-island" aria-label="Blueprint controls and evidence" data-tx-native-demo-island="">
  <div class="native-demo-island__controls" role="group" aria-label="Blueprint demo actions">
    <button type="button" onclick={renderWithPlayer} disabled={playerLoading || playerFailed}>
      {Player ? 'Rendered with the web player' : 'Render with the web player'}
    </button>
    <button type="button" onclick={copyBlueprint}>Copy validated JSON</button>
    <button type="button" aria-expanded={jsonVisible} onclick={() => (jsonVisible = !jsonVisible)}>
      {jsonVisible ? 'Hide JSON' : 'View JSON'}
    </button>
    <button type="button" aria-expanded={traceVisible} onclick={() => (traceVisible = !traceVisible)}>
      {traceVisible ? 'Hide Kotlin trace' : 'View Kotlin trace'}
    </button>
    <button type="button" onclick={reset}>Reset demo</button>
  </div>

  <p class="native-demo-island__status" role="status" aria-live="polite" aria-atomic="true">
    {announcement}
  </p>

  {#if Player}
    {@const WebPlayer = Player}
    <section class="native-demo-island__player" aria-label="Live web player rendering">
      <WebPlayer
        {blueprint}
        tier="untrusted"
        status="draft"
        label="Web rendering of the validated report blueprint"
        landmarks={false}
      />
    </section>
  {/if}

  {#if jsonVisible}
    <section class="native-demo-island__source" aria-label="Validated blueprint JSON">
      <h3>Validated blueprint JSON · @texuli/spec {specVersion}</h3>
      <textarea
        class="native-demo-island__text"
        readonly
        aria-label="Blueprint JSON text"
        rows="12"
        value={blueprintJson}
      ></textarea>
    </section>
  {/if}

  {#if traceVisible}
    <section class="native-demo-island__trace" aria-label="Recorded Compose Desktop semantic trace">
      <h3>Recorded Kotlin conformance trace</h3>
      <p>This is trace evidence from Compose Desktop conformance, not a native UI preview.</p>
      <textarea
        class="native-demo-island__text"
        readonly
        aria-label="Kotlin trace JSON text"
        rows="12"
        value={traceJson}
      ></textarea>
    </section>
  {/if}
</section>

<style>
  .native-demo-island {
    display: grid;
    gap: 0.8rem;
    min-inline-size: 0;
  }

  .native-demo-island__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }

  .native-demo-island button {
    min-block-size: 2.75rem;
    max-inline-size: 100%;
    padding-inline: 0.85rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-foreground, ButtonText);
    background: var(--tx-background, ButtonFace);
    font: inherit;
    cursor: pointer;
    touch-action: manipulation;
  }

  .native-demo-island button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .native-demo-island button:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .native-demo-island__status {
    min-block-size: 1.5em;
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.9rem;
  }

  .native-demo-island__player,
  .native-demo-island__source,
  .native-demo-island__trace {
    min-inline-size: 0;
  }

  .native-demo-island__text {
    box-sizing: border-box;
    inline-size: 100%;
    max-block-size: 24rem;
    overflow: auto;
    padding: 1rem;
    border: 1px solid var(--tx-border, GrayText);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-muted, Canvas);
    font-size: 0.8rem;
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    resize: vertical;
  }
</style>

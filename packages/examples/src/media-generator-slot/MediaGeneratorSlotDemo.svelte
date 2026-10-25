<script lang="ts">
import {
  type GeneratorRequest,
  GeneratorSlot,
  type MediaGenerator,
} from '@texuli/media/generator-slot';
import harbor from '../media-image/harbor.svg?url&no-inline';

/**
 * Demo host generator — in-memory only. Returns the local harbor SVG for any
 * image prompt; video requests return a blocked-style failure so the UI shows
 * honesty about missing clip hosts. No network.
 */
const mockGenerate: MediaGenerator = async (request: GeneratorRequest, signal: AbortSignal) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 120);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
  if (request.kind === 'video') {
    throw new Error('Demo host has no video model (simulated).');
  }
  if (request.prompt.toLowerCase().includes('unsafe')) {
    return { kind: 'image', src: 'javascript:alert(1)', alt: 'should not render' };
  }
  return {
    kind: 'image',
    src: harbor,
    alt: `Demo still for “${request.prompt}” (local SVG, not a real model)`,
  };
};

let prompt = $state('harbor boats at dusk');
</script>

<section data-example="media-generator-slot" aria-labelledby="media-gen-title">
  <h2 id="media-gen-title">Media generator slot</h2>
  <p>
    Host-provided <code>generate</code> only — Texuli ships no model and opens no network. The demo
    mock returns a local SVG under <code>trust="developer"</code>. Try “unsafe” in the prompt to see
    a blocked result, or switch to Video for a host error.
  </p>

  <h3>Default (mock host)</h3>
  <div data-axis="default">
    <GeneratorSlot bind:prompt generate={mockGenerate} trust="developer" />
  </div>

  <h3>No host generator</h3>
  <div data-axis="no-host">
    <GeneratorSlot prompt="unreachable" trust="developer" />
  </div>

  <h3>Dark</h3>
  <div data-axis="dark" data-tx-mode="dark" class="dark-panel">
    <GeneratorSlot
      prompt="night harbor"
      generate={mockGenerate}
      trust="developer"
      labels={{ idle: 'Dark demo — still no model inside Texuli.' }}
    />
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    max-inline-size: 40rem;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  code {
    font-size: 0.9em;
  }

  .dark-panel {
    padding: 1rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, #0a0a0a);
    color: var(--tx-foreground, #fafafa);
  }
</style>

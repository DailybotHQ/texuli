<script lang="ts">
import { EmbedBlockView } from '@texuli/blocks/embed/renderers';

const blocks = [
  {
    type: 'embed-app',
    title: 'Project status mini app',
    startLabel: 'Start preview',
    height: 'md',
    app: { kind: 'app', name: 'status-mini', data: { status: 'On track', tasks: 12 } },
  },
  {
    type: 'link-preview',
    title: 'Read the release notes',
    description:
      'A safe preview links to the public release notes without fetching remote metadata.',
    site: 'docs.example.com',
    href: 'https://docs.example.com/releases/1',
  },
] as const;

function mountEmbed(target: HTMLElement, app: Record<string, unknown>): () => void {
  const content = document.createElement('div');
  content.setAttribute('data-example-embedded-app', '');
  const title = document.createElement('h4');
  title.textContent = String(app.name ?? 'Embedded app');
  const status = document.createElement('p');
  const data = app.data;
  const statusText =
    data !== null && typeof data === 'object' && 'status' in data ? String(data.status) : 'Ready';
  status.textContent = `Status: ${statusText}`;
  content.append(title, status);
  target.append(content);
  return () => content.remove();
}
</script>

<article class="demo" data-example="blocks-embed" aria-label="Embedded app and link preview">
  {#each blocks as block, index (index)}
    <EmbedBlockView {block} {mountEmbed} />
  {/each}
</article>

<style>
  .demo { display: grid; gap: 1.5rem; max-inline-size: 42rem; padding: 1.5rem; }
  :global([data-example-embedded-app]) { display: grid; gap: 0.5rem; padding: 1rem; border-radius: 0.375rem; background: var(--tx-color-surface-raised, #f3f4f6); }
  :global([data-example-embedded-app] h4), :global([data-example-embedded-app] p) { margin: 0; }
</style>

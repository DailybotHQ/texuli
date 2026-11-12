<script lang="ts">
import { validateDraft } from '@texuli/catalog/validate';
import { ChatAttachment, type ChatAttachmentCheck } from '@texuli/chat';
import { createPlayerCatalog, Player } from '@texuli/player';
import { reportBlueprint } from '../player-blueprint-preview/blueprint.ts';

// The catalog the player paints with: an attachment is validated against the same ids.
const catalog = createPlayerCatalog();

function check(artifact: unknown): ChatAttachmentCheck {
  const result = validateDraft(artifact, { catalog, tier: 'untrusted' });
  if (result.ok && result.draft) {
    return {
      ok: true,
      value: result.draft,
      summary: `Validated at the untrusted tier (${result.roots.length} root).`,
    };
  }
  return {
    ok: false,
    reasons: result.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
  };
}

// A fictional agent reply that attached an unknown component: it must not paint.
const refusedBlueprint = {
  id: 'layout-doc',
  props: { title: 'Quarterly plan' },
  children: [{ id: 'fictional-widget', props: { label: 'Not in the catalog' } }],
};
</script>

<section class="demo" aria-labelledby="chat-attachment-title">
  <h2 id="chat-attachment-title">Blueprint attachments</h2>
  <p>An agent attached two blueprints. Each is validated before anything paints.</p>
  <ChatAttachment artifact={reportBlueprint} title="Lighthouse weekly report" {check}>
    {#snippet preview(value)}
      <Player blueprint={value} label="Lighthouse weekly report" />
    {/snippet}
  </ChatAttachment>
  <ChatAttachment artifact={refusedBlueprint} title="Quarterly plan" {check}>
    {#snippet preview(value)}
      <Player blueprint={value} label="Quarterly plan" />
    {/snippet}
  </ChatAttachment>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 48rem);
    color: var(--tx-foreground, CanvasText);
  }
</style>

<script lang="ts">
import { fromMarkdown } from '@texuli/core/editor-markdown';
import { RichTextEditor } from '@texuli/editor/editor';

// A deterministic 400-block handbook (fictional content).
const topics = ['Onboarding', 'Planning', 'Reviews', 'Releases', 'Support'];
const sections: string[] = [];
for (let index = 0; index < 100; index += 1) {
  const topic = topics[index % topics.length];
  sections.push(
    `### ${topic} note ${index + 1}`,
    `Entry ${index + 1} explains how the **${topic?.toLowerCase()}** routine works for the Northwind team.`,
    `- Owner: team ${String.fromCharCode(65 + (index % 26))}\n- Review every ${(index % 4) + 1} weeks`,
    `Follow-up for entry ${index + 1} is tracked in the *handbook*.`
  );
}
const { doc } = fromMarkdown(sections.join('\n\n'));
const blocks = doc.blocks.length;
</script>

<section class="demo" aria-labelledby="editor-long-title">
  <h2 id="editor-long-title">Team handbook</h2>
  <p class="hint">{blocks} top-level blocks, all in the document; scroll the editor to read them.</p>
  <div class="frame">
    <RichTextEditor value={doc} aria-labelledby="editor-long-title" toolbar={false} />
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 40rem);
    color: var(--tx-foreground, CanvasText);
  }

  h2,
  .hint {
    margin: 0;
  }

  h2 {
    font-size: 1.125rem;
  }

  .hint {
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }

  .frame {
    max-block-size: 24rem;
    overflow-y: auto;
    border-radius: var(--tx-radius, 0.5rem);
  }
</style>

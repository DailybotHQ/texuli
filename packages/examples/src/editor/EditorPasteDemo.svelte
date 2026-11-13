<script lang="ts">
import { EditorController } from '@texuli/editor/controller';
import { RichTextEditor } from '@texuli/editor/editor';
import { Button } from 'texuli/button';

/** Fictional clipboard contents: a web page fragment and Markdown text. */
// The script tag is split so this component's own <script> block stays well-formed.
const SCRIPT = 'scr' + 'ipt';
const HTML =
  '<p>From the call:</p><h2>Meeting notes</h2><p onclick="steal()">Agenda for <b>Monday</b> with a ' +
  '<a href="https://example.com/doc">doc</a> and a <a href="javascript:alert(1)">bad link</a>.</p>' +
  `<${SCRIPT}>steal()</${SCRIPT}><ul><li>Budget</li><li>Hiring</li></ul>`;
const MARKDOWN =
  'Sample text:\n\n## From Markdown\n\n- [x] **Parsed** as Markdown\n- [ ] Raw <b>HTML</b> stays text';

const controller = new EditorController({});
let last = $state('');

function show(result: { source: string; blocks: number; linksRemoved: number }) {
  last = `${result.source}: ${result.blocks} blocks, ${result.linksRemoved} links removed`;
}

function paste(data: Record<string, string>) {
  show(controller.paste({ getData: (type) => data[type] ?? '' }));
}

async function pasteMarkdown(text: string) {
  show(await controller.pasteMarkdown(text));
}
</script>

<section class="demo" aria-labelledby="editor-paste-title">
  <h2 id="editor-paste-title">Paste</h2>
  <p class="hint">
    Pasted HTML is read without a DOM: scripts, handlers and unsafe links are dropped. Plain text
    stays plain unless you choose Paste as Markdown (Mod+Alt+Shift+V).
  </p>
  <div class="actions">
    <Button size="sm" variant="outline" onclick={() => paste({ 'text/html': HTML })}>
      Paste sample HTML
    </Button>
    <Button size="sm" variant="outline" onclick={() => paste({ 'text/plain': MARKDOWN })}>
      Paste sample text
    </Button>
    <Button size="sm" variant="outline" onclick={() => pasteMarkdown(MARKDOWN)}>
      Paste sample as Markdown
    </Button>
  </div>
  <p class="hint" role="status">{last}</p>
  <RichTextEditor {controller} aria-labelledby="editor-paste-title" placeholder="Paste here…" />
</section>

<style>
  .demo {
    display: grid;
    gap: var(--tx-space-3);
    inline-size: min(100%, 44rem);
    color: var(--tx-foreground, CanvasText);
  }

  h2,
  .hint {
    margin: 0;
  }

  .hint {
    color: var(--tx-muted-foreground, GrayText);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tx-space-2);
  }
</style>

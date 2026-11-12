<script lang="ts">
import { fromMarkdown } from '@texuli/core/editor-markdown';
import { RichTextEditor } from '@texuli/editor/editor';

/**
 * A host lookup for the `:shortcode:` rule. This demo keeps a few entries; an app passes its
 * emoji catalog's lookup (for example `getEmoji` from `@texuli/emojis/catalog`).
 */
const SHORTCODES: Record<string, string> = {
  tada: '🎉',
  smile: '😄',
  rocket: '🚀',
  thumbs_up: '👍',
  heart: '❤️',
};
const shortcodes = (name: string) => SHORTCODES[name];

const initial = fromMarkdown('Shipped the **beta** today.').doc;
</script>

<section class="demo" aria-labelledby="editor-emoji-title">
  <h2 id="editor-emoji-title">Team update</h2>
  <p class="hint">
    Choose an emoji from the toolbar, or type a shortcode such as <code>:tada:</code> or
    <code>:rocket:</code>. Each insertion is one undo step.
  </p>
  <RichTextEditor value={initial} emoji {shortcodes} aria-labelledby="editor-emoji-title" />
</section>

<style>
  .demo {
    display: grid;
    gap: var(--tx-space-3, 0.75rem);
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
</style>

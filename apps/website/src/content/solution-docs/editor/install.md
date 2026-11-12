## Install and status

Install the published editor with `pnpm add @texuli/editor`. It is pre-1.0, so a new minor version may break the API. The editor surface, toolbar, link dialog, controller, Markdown codec and clipboard import are on npm.

Clipboard HTML through `@texuli/core/html`, Paste as Markdown, the block-type menu, the emoji button and the export to chat dialects were added after `0.17.4`. They are in this development branch and not in a published release yet. The editor ships no emoji data: the emoji picker comes from `texuli/emoji`, and the `:shortcode:` rule uses a lookup you pass.

```svelte
<script lang="ts">
import { RichTextEditor } from '@texuli/editor/editor';
</script>

<RichTextEditor label="Notes" placeholder="Write the update…" />
```

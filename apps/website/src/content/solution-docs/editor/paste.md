## Safe paste

Clipboard HTML is read without a DOM by `htmlToMarkdownTree` from `@texuli/core/html` at the untrusted tier, then mapped onto the editor vocabulary. In development: released in `0.18.0`.

- Scripts, styles, frames, SVG and other raw-text elements are dropped with their content, and every attribute but the few the editor maps is gone, event handlers included.
- A link the URL policy refuses, such as `javascript:`, keeps its text and counts in `linksRemoved`.
- Images become their alt text, and table cells become paragraphs.
- Plain text stays plain. Paste as Markdown is a separate command: Mod+Alt+Shift+V in the editor, or `controller.pasteMarkdown(text)`, which loads the Markdown codec on first use.

```ts
import { EditorController } from '@texuli/editor/controller';

const controller = new EditorController();
const result = controller.paste(event.clipboardData);
// result.linksRemoved: links refused by the URL policy
```

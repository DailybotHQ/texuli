## Emoji

Pass `emoji` to `RichTextEditor` or `EditorToolbar` for an emoji button, or use `EditorEmojiButton` from `@texuli/editor/emoji`. In development: added after `0.17.4`, not in a published release yet.

- The button opens `EmojiPicker` from `texuli/emoji` in a popover: search, a keyboard grid and skin tones, with recents kept by the host. The picker and its catalog load when the popover opens.
- A chosen emoji is one undo step, apart from typing, and focus returns to the text.
- A typed `:name:` becomes its emoji when you pass a `shortcodes` lookup; one undo restores the shortcode. It never runs inside code.
- `getEmoji` matches the catalog's canonical shortcodes, such as `:party_popper:`. To accept common aliases such as `:tada:` too, build a map from the aliases in `emojiCatalog.records`, as the demo on the landing does.

```ts
import { getEmoji } from '@texuli/emojis/catalog';
import { EditorController } from '@texuli/editor/controller';

const controller = new EditorController({
  shortcodes: (name) => getEmoji(`:${name}:`)?.unicode,
});
```

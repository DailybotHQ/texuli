# Editor emoji

`@texuli/editor/emoji` exports `EditorEmojiButton`: a button that opens
`EmojiPicker` from `texuli/emoji` (search, a keyboard grid, skin tones,
recents kept by the host) in a popover. `EditorToolbar` loads it on demand
with its `emoji` prop, and `RichTextEditor` passes `emoji` through; for
recents, translated strings or emoji art, render it yourself in the
toolbar's `end` snippet.

- The button is named by `labels.emoji`, has `aria-haspopup="dialog"` and is
  unavailable in a code block or on a void block.
- Choosing an emoji inserts it at the selection with
  `controller.insertEmoji` (its own undo step, not grouped with typing),
  closes the popover and returns focus to the text through `onCommand`.
- The picker and its catalog load only when the popover opens.

| Prop | Meaning |
| --- | --- |
| `controller` | The editor it inserts into |
| `onCommand` | Called after an insertion, so the host returns focus to the text |
| `disabled` | Disable the button |
| `toolbarItem` | Render the button as a toolbar item (default true); false for a standalone button |
| `recentIds` | Recently used emoji ids, kept by the host |
| `onRecentIdsChange` | Called with the new recents |
| `messages` | Picker strings (`EmojiPickerMessages` from `texuli/emoji`) |
| `artResolver` | Draw emoji with host art instead of system glyphs |
| `class` | Extra classes on the button |

## `:shortcode:` input rule

Typing `:name:` replaces it with the text the controller's `shortcodes`
lookup returns (an emoji), as an input rule: its own undo step, so one undo
restores the typed shortcode. It never runs inside code, after a word
character, a colon or a backslash, and a result must be 1–32 characters on
one line. The editor ships no emoji data: pass a catalog's lookup, for
example from `@texuli/emojis/catalog`:

```ts
import { getEmoji } from '@texuli/emojis/catalog';

const shortcodes = (name: string) => getEmoji(`:${name}:`)?.unicode;
// <RichTextEditor {shortcodes} emoji />, or new EditorController({ shortcodes })
```

`controller.setShortcodes(lookup)` swaps the lookup later (a catalog that
loads lazily), and `undefined` turns the rule off.

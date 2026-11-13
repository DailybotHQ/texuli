# Block-type menu

`@texuli/editor/block-menu` exports `BlockTypeMenu`. `EditorToolbar` loads it
on demand when its `blockMenu` prop is set; hosts can also place it
themselves.

`BlockTypeMenu` is an APG menu button (on `@texuli/primitives/menu`): the
button is named "Text style: <current kind>" and shows the kind's name; its
menu, labelled by the button, holds menu item radios for paragraph, headings
1–4, bulleted, numbered and check lists, quote and code block, with the kind
at the caret checked. Enter, Space and Down Arrow open it on the first item,
Up Arrow on the last; arrows, Home, End and typeahead move; Escape closes and
returns focus. Inside the toolbar the menu keeps Home, End and the
horizontal arrows (the toolbar moves only on keys pressed on its own items).
Choosing a kind runs `controller.setBlockKind` (one undo step,
announced) and then `onCommand`.

| Prop | Meaning |
| --- | --- |
| `controller` | The editor it drives |
| `onCommand` | Called after a choice, so the host returns focus to the text |
| `disabled` | Disable the button |
| `toolbarItem` | Render the button as a toolbar item (default true); false for a standalone button |
| `class` | Extra classes on the button |

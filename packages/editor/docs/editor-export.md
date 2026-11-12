# Export for chat

`@texuli/editor/export` exports `DialectExport`, its own subpath so editors
that never export do not carry the chat writers.

`DialectExport` writes the document for a chat platform with
[`documentToDialect`](editor-markdown.md): a format select (Slack, Discord,
WhatsApp, Telegram MarkdownV2 and HTML, Microsoft Teams, Google Chat,
Mattermost, plain text), the read-only text, a Copy button with a status
line, and a polite live list of what the format loses or changes (grouped,
with counts). Broadcast mentions are never written.

| Prop | Meaning |
| --- | --- |
| `controller` | The editor whose document is exported (its labels are used too) |
| `doc` | A document to export instead of a controller's |
| `dialect` | The chosen format, bindable. Default `slack` |
| `dialects` | The formats offered, in order. Default every format |
| `names` | Visible format names, to translate or rename |
| `trust` | URL policy tier links are checked at again. Default `untrusted` |
| `onCopy` | Replaces the Clipboard API: return or resolve `false` when copying failed |
| `class` | Extra classes on the panel |

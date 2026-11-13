## Export to chat

`documentToDialect` in `@texuli/editor/markdown` writes the document for Slack, Discord, WhatsApp, Telegram (MarkdownV2 or HTML), Microsoft Teams, Google Chat, Mattermost or plain text. `DialectExport` from `@texuli/editor/export` shows the text, a Copy button and the losses. In development: released in `0.18.0`.

- Every link is checked again by the URL policy, untrusted by default.
- Broadcast mentions are never written: `@everyone`, `@here` and `@channel` stay text.
- What a format cannot carry is returned in `losses`, grouped with a count. No chat format has checklists, so items keep their state as ☑ or ☐.
- Agents get the same conversion through the `md.convert` MCP operation.

```ts
import { documentToDialect } from '@texuli/editor/markdown';

const { value, losses } = documentToDialect(doc, 'slack');
```

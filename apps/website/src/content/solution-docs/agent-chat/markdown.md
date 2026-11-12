## Markdown, mentions and dialect export

Message text is read by the shared CommonMark inline parser and filtered down to the chat vocabulary: strong, emphasis, code, links, mentions (`@[Name](mention:id)`), dates (`[[date:ISO]]`) and status chips (`[[status:tone|Label]]`). Nothing becomes HTML. Links pass the untrusted URL policy, and a refused link stays as the text that was written.

To post a reply in another chat, read it with `parseMarkdown` from `@texuli/core/markdown` and write it with `writeMarkdownDialect` from `@texuli/core/markdown-dialects`. The writer supports Slack, Discord, WhatsApp, Telegram, Teams, Google Chat, Mattermost and plain text, and reports every construct it had to adapt.

```ts
import { parseMarkdown } from '@texuli/core/markdown';
import { writeMarkdownDialect } from '@texuli/core/markdown-dialects';

const { value, diagnostics } = writeMarkdownDialect(parseMarkdown(reply).tree, 'slack');
```

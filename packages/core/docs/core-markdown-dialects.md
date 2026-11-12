# Core Markdown chat dialects

`@texuli/core/markdown-dialects` reads and writes the framework-free `texuli-md/v1` AST. It supports
Slack mrkdwn, Discord, WhatsApp, Telegram MarkdownV2 and HTML, Teams bot Markdown, Google Chat
Markdown, Mattermost and plain text. Readers keep unrecognized syntax as text. Writers return
`dialect-loss` diagnostics when the target needs a fallback and apply `safeHref` at the `untrusted`
tier by default.

```ts
import { convertMarkdownDialect, readMarkdownDialect, writeMarkdownDialect } from '@texuli/core/markdown-dialects';

const parsed = readMarkdownDialect('*hello*', 'slack');
const discord = writeMarkdownDialect(parsed.tree, 'discord');
const plain = convertMarkdownDialect('*hello*', 'slack', 'plain-text');
```

`writeMarkdownDialect(tree, dialect, options?)` accepts `trust: 'developer' | 'untrusted'` and
`allowBroadcastMentions`. Broadcast mention nodes are downgraded to text unless explicitly enabled.
Literal text mention triggers are neutralized. `convertMarkdownDialect(source, from, to, options?)`
returns the serialized `value` and combined reader/writer `diagnostics`.

Exports: `MARKDOWN_DIALECTS`, `MarkdownDialect`, `MarkdownDialectWriteResult`,
`MarkdownDialectWriteOptions`, `readMarkdownDialect`, `writeMarkdownDialect`,
`convertMarkdownDialect`.

## Conversion matrix

Readers and writers share `texuli-md/v1`; conversions are `read(source, from)` followed by
`write(tree, to)`. Writers return `dialect-loss` diagnostics whenever they flatten or approximate a
construct. The matrix below lists target constructs that can be lost **when present in the AST**;
source readers may already preserve unsupported source syntax as literal text.

Abbreviations: **H** headings; **T** tables; **S** spoiler; **U** underline; **I** image; **F** footnote;
**L** labeled links; **M** mention identity. A `*` means target does not preserve that construct
natively. Every conversion may also report **M** when the target cannot preserve a platform ID.

| From ↓ / To → | Slack | Discord | WhatsApp | Telegram MDV2 | Telegram HTML | Teams | Google Chat | Mattermost | Plain text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Slack | — | H,T | H,T,S,U | H,T,U | H,T,U | S,U | H,T,S,U | S,U | H,T,S,U |
| Discord | H,T,S,U | — | H,T,S,U | H,T | H,T | S | H,T,S | S | H,T,S,U |
| WhatsApp | H,T,S,U | H,T | — | H,T | H,T | S | H,T,S | S | H,T,S,U |
| Telegram MDV2 | H,T,U | H,T | H,T,S,U | — | — | S,U | H,T,S,U | S,U | H,T,S,U |
| Telegram HTML | H,T,U | H,T | H,T,S,U | — | — | S,U | H,T,S,U | S,U | H,T,S,U |
| Teams | H,T,S,U | H,T,S | H,T,S,U | H,T,U | H,T,U | — | H,T,S,U | S,U | H,T,S,U |
| Google Chat | H,T,S,U | H,T,S | H,T,S,U | H,T | H,T | S,U | — | S,U | H,T,S,U |
| Mattermost | H,T,S,U | H,T | H,T,S,U | H,T | H,T | S,U | H,T,S,U | — | H,T,S,U |
| Plain text | H,T,S,U | H,T,S,U | H,T,S,U | H,T,S,U | H,T,S,U | H,T,S,U | H,T,S,U | H,T,S,U | — |

## Fallbacks and escaping

- **Headings:** readers recognize them in Discord and Mattermost; other writers retain heading text and
  report a loss.
- **Tables:** writers flatten rows to `cell | cell` lines and report a loss. No chat target has a
  portable table construct.
- **Spoiler / underline:** emitted natively only by Discord and Telegram (spoilers also Telegram HTML);
  otherwise children are retained and a loss is reported.
- **Images / footnotes / definitions / raw HTML:** images become alt text; footnotes and definitions
  become readable text; raw HTML is escaped as text. Each fallback reports a loss.
- **Links:** Slack and Google Chat use `<url|label>`, Telegram uses its MarkdownV2 or HTML form, and
  Discord, Teams and Mattermost use `[label](url)`. WhatsApp and plain text use `label (url)` and report
  a loss because they have no portable labeled-link syntax.
- **Mentions:** Slack/Discord IDs and Telegram user IDs are retained in native forms. Teams retains the
  visible label in `<at>`; Google Chat uses `<users/id>`. Other destinations fall back to `@label` and
  report loss of platform identity. WhatsApp `@name` is a picker action, not a parseable ID token.
- **Escaping:** Slack escapes literal `&<>` with entities. Telegram MarkdownV2 escapes all 18 reserved
  text characters, with separate code and URL contexts. Telegram HTML escapes `&<>`; supported tags
  are recognized without interpreting arbitrary markup. Other Markdown writers backslash-escape
  syntax punctuation. Plain text neutralizes platform mention triggers with a zero-width separator.

The dialect parsers intentionally implement the documented chat subset, not full platform API
validation. Teams means bot extended Markdown; Google Chat means Markdown mode. WhatsApp list, quote and
code-block syntax varies by client. Escaping and unsupported-feature tests live beside the AST fixtures.

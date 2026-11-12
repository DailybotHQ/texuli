# Markdown, HTML and chat dialects (agents)

> **Status: in development.** The parser, HTML codec and chat dialects
> landed in PLAN_023 (ADR-034). They are not yet in a published release.

Agents should call the operations, not import the texels, unless they are
writing app code:

| Operation | What it does |
| --- | --- |
| `md.convert` | Convert untrusted Markdown (`markdown` is GFM, `commonmark` is strict CommonMark 0.31.2), HTML or a chat dialect to another. URLs use the **untrusted** URL policy. Returns `{ value, diagnostics }`. |
| `md.render` | Parse untrusted Markdown (GFM unless `gfm: false`) and write a **safe HTML fragment**. Raw HTML is dropped; refused `javascript:` / `data:` links keep their text. Returns `{ html, diagnostics }`. |

Both are `edge` operations: they run on the local MCP (`npx -y @texuli/mcp`),
the remote `https://texuli.com/mcp`, and `texuli md convert` / `texuli md render`.
Input is capped at `MARKDOWN_LIMITS.source` (1,000,000 characters). The
handlers never throw.

## Library (app code)

| Need | Import |
| --- | --- |
| Parse Markdown (GFM or strict CommonMark) and write it back | `parseMarkdown`, `writeMarkdown` from `@texuli/core/markdown` |
| Tree → HTML | `markdownTreeToHtml` from `@texuli/core/markdown-html` |
| HTML → tree | `htmlToMarkdownTree` from `@texuli/core/html` |
| Chat dialects | `readMarkdownDialect`, `writeMarkdownDialect`, `convertMarkdownDialect` from `@texuli/core/markdown-dialects` |

Contracts: [core-markdown.md](core-markdown.md), [core-markdown-html.md](core-markdown-html.md),
[core-html.md](core-html.md),
[core-markdown-dialects.md](core-markdown-dialects.md).

Dialects today: `slack`, `discord`, `whatsapp`, `telegram-markdown-v2`,
`telegram-html`, `teams`, `google-chat`, `mattermost`, `plain-text`.

# EmojiParser.com

EmojiParser.com is an independent static product for searching Unicode emoji,
converting text and browsing stable emoji detail pages. It consumes
`@texuli/emojis` and `@texuli/core` from this workspace; it does not maintain a
forked catalog or conversion engine.

## Local development

After the workspace importer is added to `pnpm-lock.yaml`, install dependencies
from the repository root and run:

```sh
pnpm --filter @texuli/emojiparser dev
pnpm --filter @texuli/emojiparser build
pnpm --filter @texuli/emojiparser preview --host 127.0.0.1 --port 4876 --strictPort
pnpm exec playwright test --config apps/emojiparser/playwright.config.mjs --project chromium
```

The app builds fully static pages. Search data and conversion engines are loaded
on demand in the browser, and search and conversion do not send user text to a
server. Each catalog sequence has a generated detail page. Emoji are displayed
with the operating system's emoji font. No Texuli artwork is approved for this
product yet; see `/licensing/`.

## Pages

- `/` searches CLDR names and keywords.
- `/convert/` converts between canonical Texuli shortcodes and the legacy chat
  alias dialect, including unknown alias and conflict diagnostics.
- `/emoji/<id>/` gives each Unicode sequence a static detail page.
- `/docs/` covers installation and API use and links to the
  [universal-emoji-parser migration guide](https://github.com/DailybotHQ/texuli/blob/main/docs/emojis/MIGRATION.md).
- `/licensing/` records the current artwork status and proposed license.
- `/picker/` demonstrates the shared `EmojiPicker` from `texuli/emoji`,
  including search, category navigation, keyboard selection and host-controlled
  recent selections.

The footer, about and docs surfaces carry the “Powered by Texuli Emojis”
attribution. The product has its own name and visual identity.

## Content security and hosting

The build hashes any inline script or style content and adds a restrictive CSP
meta policy to every generated page. `dist/_headers` carries the matching
Cloudflare Pages response headers. `wrangler.toml` prepares the Pages project
name and output directory; no Cloudflare project, domain, deployment or
credentials were created or applied by this change.

---

Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-emojiparser).

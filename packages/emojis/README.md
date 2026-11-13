# @texuli/emojis

> **Status: in development (pre-1.0).** On npm as `0.18.0`, first published in
> `0.18.0`, with provenance (ADR-035). Under 0.x a new minor (`0.18.0`) may
> contain breaking changes, so pin the exact version or use `^0.18.0`,
> which accepts only 0.18.x.

The framework-free, dependency-free emoji catalog for Texuli, generated
from pinned Unicode Emoji 18.0 and CLDR 49 sources (SHA-256 locked in
`scripts/emojis/sources/sources.lock.json`): 3,963 fully-qualified
sequences with English names and keywords, categories, CLDR sort order,
emoji versions, shortcodes, qualification aliases and skin-tone
relationships, plus the compatibility aliases of the legacy
`universal-emoji-parser` catalog.

| Subpath | What it holds |
| --- | --- |
| `@texuli/emojis/catalog` | The catalog records (`texuli-emoji/v1`). |
| `@texuli/emojis` | Unicode tokenizer, UTF-16 matches/tokens and canonical shortcode conversion. It does not import catalog metadata or legacy aliases. |
| `@texuli/emojis/search` | Catalog lookup, deterministic search, listing and tone variants. |
| `@texuli/emojis/legacy-engine` | Explicitly loaded legacy alias conversion; strict conflicts are returned, permissive conflicts use the recorded CLDR precedence. |
| `@texuli/emojis/legacy` | Legacy shortcode aliases, kept apart so the catalog does not load them. |
| `@texuli/emojis/data` | Both, plus the schema types. |

The data is generated, never edited by hand:

```bash
pnpm exec tsx scripts/emojis/generate-catalog.ts          # regenerate
pnpm exec tsx scripts/emojis/generate-catalog.ts --check  # verify byte-identical output
```

The web components are `Emoji`, `EmojiText` and `EmojiPicker` in
`texuli/emoji` (released in `0.18.0`). Planned: original Texuli artwork
(see `@texuli/emoji-assets`) and native output.
No artwork ships yet: every record has `artAvailable: false`.

Licenses: Unicode data under the Unicode License v3 and the legacy alias
data under MIT; see `scripts/emojis/sources/NOTICE.md`.

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-emojis).

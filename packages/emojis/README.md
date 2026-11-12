# @texuli/emojis

> **Status: in development.** Not published on npm yet; it is private to the
> Texuli workspace until a release publishes it (ADR-035).

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

Planned (PLAN_023, in development): original Texuli artwork, web components
in `texuli/emoji`, and native output.
No artwork ships yet: every record has `artAvailable: false`.

Licenses: Unicode data under the Unicode License v3 and the legacy alias
data under MIT; see `scripts/emojis/sources/NOTICE.md`.

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-emojis).

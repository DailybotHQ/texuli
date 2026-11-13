# Migrating from universal-emoji-parser to @texuli/emojis

> **Status:** in development. `@texuli/emojis` is private `0.0.0` and is **not
> published** on npm (ADR-035). `universal-emoji-parser` 3.0.2 stays on npm;
> it is not deprecated in this work.

Texuli owns both packages. New code should import `@texuli/emojis`. Existing
`universal-emoji-parser` consumers can keep the same `parse` /
`parseToHtml` / `parseToUnicode` / `parseToShortcode` names on a **local**
branch (`texuli-bridge`) that forwards to the Texuli engine.

## What to import

| Need | Package |
| --- | --- |
| Canonical shortcodes (`:thumbs_up:`, `:rocket:`) | `@texuli/emojis` (`toUnicode`, `toShortcodes`, `findEmojis`) |
| Chat aliases (`:thumbsup:`, `:+1:`, `:heart:`) | `@texuli/emojis/legacy-engine` (`dialect: 'legacy'`) |
| Catalog search | `@texuli/emojis/search` |
| Old `uEmojiParser.parse(...)` | local `texuli-bridge` only (file: link to unpublished `@texuli/emojis`) |

Default Texuli shortcodes are CLDR-derived. Aliases from the 1,914-row
legacy catalog are **not** on the default entry.

## Mapping

| 3.0.2 | Texuli |
| --- | --- |
| `parseToUnicode(text)` | `toUnicode` plus `toUnicodeLegacy` for chat aliases |
| `parseToShortcode(text)` | `toShortcodes` (canonical) |
| `parseToHtml(text)` | tokens + escaped text; **no Twemoji CDN** unless you pass a safe `emojiCDN` |
| `parse(text)` default HTML | same as `parseToHtml` (escaped Unicode, no `<img>` by default) |
| `emojiLibJsonData` | `@texuli/emojis/catalog` (3,963 sequences) plus `/legacy` aliases |
| `emojiCDN` / jsDelivr `@latest` | opt-in only, https prefix checked; never applied by default |

## Intended differences

1. **No throw** on non-string input (returns `''`).
2. **No default Twemoji HTML.** `parseToHtml` escapes text. `<img class="emoji">` is
   emitted only when `emojiCDN` is a safe `https://` prefix.
3. **Longest-match sequences.** ZWJ families, flags, tones and keycaps stay one
   emoji; 3.0.2 often split them or dropped the tone.
4. **HTML is escaped.** `<script>` in the input cannot become markup.

## Compatibility bridge (planned)

A compatibility release of `universal-emoji-parser` that keeps its public API and forwards to
`@texuli/emojis` is prepared and checked against recorded 3.0.2 outputs, but it is **not
published**. It will depend on the published `@texuli/emojis` by version, and it ships only when
the parser's owner releases it; until then, keep using 3.0.2 or move to `@texuli/emojis`
directly with the mapping above.

Measured parity against 3.0.2 (196 comparisons over 28 inputs, including a DailyBot-style chat
fixture): 140 identical, 56 intended changes (no default Twemoji CDN, escaped HTML, kept skin
tones, longest-match sequences, readable keycap names), 0 unexpected.

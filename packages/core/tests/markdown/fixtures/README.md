# Markdown test fixtures

`commonmark-0.31.2.json` holds the 652 examples of the CommonMark Spec 0.31.2 (number, section,
Markdown and expected HTML), taken from <https://spec.commonmark.org/0.31.2/spec.json>. The
source file's SHA-256 is `d431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20`, and
only the `start_line` and `end_line` fields were dropped. The CommonMark Spec is by John MacFarlane
and is licensed under the Creative Commons Attribution-ShareAlike 4.0 license
(<https://creativecommons.org/licenses/by-sa/4.0/>). It is test data only and does not ship in any
package.

The HTML5 entity table in `src/markdown/entities.ts` comes from the WHATWG list
<https://html.spec.whatwg.org/entities.json> (SHA-256
`d741d877ac77c4194c4ad526b5b4a19aef8dfe411ab840a466891cdbb9f362e6`).

`gfm-0.29-spec.json` (672 examples) and `gfm-0.29-extensions.json` (30 examples) come from
cmark-gfm `0.29.0.gfm.13`: `test/spec.txt` (SHA-256
`7d8e5814befec287ac116786d81ff14e0adc9b13295b4494649e995408fd871c`) and `test/extensions.txt`
(SHA-256 `a2a45e98be9fca95f564f927265a0f63beea6cae5369d1cf4bde44caa51b2a3a`), from
<https://github.com/github/cmark-gfm>. Each example keeps its number, section, extension tag,
Markdown and expected HTML (`→` read as a tab). Both are licensed CC BY-SA 4.0, like the
CommonMark Spec, and are test data only.

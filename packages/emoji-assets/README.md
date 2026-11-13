# @texuli/emoji-assets

> **Status: in development.** Private and unreleased (not on npm); no artwork is approved for publication yet.

This package contains 72 original 64×64 Texuli SVG design candidates, their
manifest, and the measured Unicode-versus-art coverage report. Candidates are
not returned by `getTexuliEmojiAsset` until they are approved. The report
keeps Unicode support, reviewed candidates, approved art and missing art as
separate counts.

The proposed artwork license is **CC BY 4.0, pending owner sign-off**. The
package manifest's MIT license applies to the package code, not a grant of
rights in the art. Do not publish or redistribute this private candidate
pack as licensed art before the owner signs off.

```ts
import { getTexuliEmojiAsset } from '@texuli/emoji-assets';

const asset = getTexuliEmojiAsset('1f680');
// undefined until the matching asset has approved status
```

The seed SVG source drawings and file-by-file provenance live in
`artwork/emojis/originals/` and `artwork/emojis/provenance.json`. The
validator, allow-list sanitizer and deterministic optimizer are in
`scripts/emojis/art-svg.ts`; see [ART_DIRECTION.md](../../docs/emojis/ART_DIRECTION.md)
and [the coverage report](./data/art-coverage.json).

© Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-emoji-assets).

## License

MIT © Dailybot, Inc. for package code. Proposed art license: CC BY 4.0,
pending owner sign-off.

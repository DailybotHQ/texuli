# Emoji seed review — PLAN_023 T-emo-art-pipeline

Date: 2026-11-12. Reviewer: agent lane `local:wH:p2R` (author self-review).
Status: **reviewed candidates; not owner-approved**. This is a visual and
technical seed review, not license approval.

## Review method

Reviewed the 72 source drawings against `docs/emojis/ART_DIRECTION.md`, then
compared each source with its deterministic sanitized package SVG. The
review checks transparent 64×64 canvas, readable outer silhouette, sensible
palette, non-overlapping features, authored modifier layers, flag colors and
absence of references to third-party art. The test harness checks the exact
64 package files and their per-file provenance and hashes.

## Representative before/after checks

| Design | Before: authored source | After: deterministic package output | Review result |
| --- | --- | --- | --- |
| Grinning face | `artwork/emojis/originals/1f600.svg` | `packages/emoji-assets/assets/svg/1f600.svg` | Face silhouette, eyes and smile remain separate, readable shapes. |
| Medium-tone person | `artwork/emojis/originals/1f469-1f3fd.svg` | `packages/emoji-assets/assets/svg/1f469-1f3fd.svg` | Skin fill is limited to face/body shapes; clothing and hair keep their colors. |
| Rocket | `artwork/emojis/originals/1f680.svg` | `packages/emoji-assets/assets/svg/1f680.svg` | Body, window, fins and flame form a clear compact silhouette. |
| Woman technologist | `artwork/emojis/originals/1f469-200d-1f4bb.svg` | `packages/emoji-assets/assets/svg/1f469-200d-1f4bb.svg` | Person and screen are explicit vector shapes; no font or bitmap glyph. |
| United States flag | `artwork/emojis/originals/1f1fa-1f1f8.svg` | `packages/emoji-assets/assets/svg/1f1fa-1f1f8.svg` | Field stripes and canton colors are kept distinct. |
| England flag | `artwork/emojis/originals/1f3f4-e0067-e0062-e0065-e006e-e0067-e007f.svg` | `packages/emoji-assets/assets/svg/1f3f4-e0067-e0062-e0065-e006e-e0067-e007f.svg` | Cross field is drawn explicitly on the white flag field. |

The package output is a deterministic allow-list serialization of the source;
it does not perform a visual redesign. Both forms are linked above so later
reviewers can compare exact source and packaged output. The available
automated gate has not rendered an independent pixel contact sheet; approval
for art quality and licensing remains open.

## Inventory

- Source and package candidates: 72 SVGs, all in the manifest.
- Successfully sanitized/validated: recorded by `validate-art.ts` at run time.
- Approved artwork: 0 pending owner license and independent review.
- Unicode fully-qualified target: 3,963; missing approved art: 3,963.

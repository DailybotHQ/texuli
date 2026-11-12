# Emoji seed review — PLAN_023 T-emo-art-pipeline

Date: 2026-11-12. Reviewer: agent lane `local:wH:p2R` (author self-review).
Status: **reviewed candidates; not owner-approved**. This is a visual and
technical seed review, not license approval.

## Review method

Reviewed the 72 source drawings against `docs/emojis/ART_DIRECTION.md`, then
compared each source with its deterministic sanitized package SVG. R2 also
checks each CLDR name and its defining features against the rendered glyph.
The 72-candidate sheets were reviewed at 64 px and 24 px on both light and
dark grounds; the per-candidate results and required features are recorded in
`meaning-checklist.md` and `meaning-review.json`. Plan-only contact sheets are
under `analysis_results/emoji/seed-contact-sheet-r2-*.png`. The review also
checks transparent 64×64 canvas, readable outer silhouette, sensible palette,
non-overlapping features, authored modifier layers, accurate flag symbols and
absence of references to third-party art. The validation harness checks exact
source/package IDs, per-file provenance and hashes, and the meaning review's
CLDR identity, requirements, reviewer and passing verdict.

For the R3 thumbs-up correction, all five skin tones were also compared at
64 px and 24 px on light and dark grounds beside throwaway U+1F595 and U+261D
reference drawings under `tmp/emoji-art-r3-references/`. The reference art is
not a shipped input. The candidate thumb is shorter, broader, angled and
side-mounted; the references show long upright digits. Comparison notes are
stored per tone in `meaning-review.json` and `meaning-checklist.md`.

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
reviewers can compare exact source and packaged output. The R2 contact sheets
are review artifacts, not package inputs. This is an author self-review;
independent owner art review and license approval remain open.

## Inventory

- Source and package candidates: 72 SVGs, all in the manifest.
- Meaning checklist: 72 CLDR-linked candidate results pass this lane's self-review.
- Successfully sanitized/validated: recorded by `validate-art.ts` at run time.
- Approved artwork: 0 pending owner license and independent review.
- Unicode fully-qualified target: 3,963; missing approved art: 3,963.

# Emoji seed meaning checklist — R5

Reviewer: agent lane `local:wH:p2R` (author self-review). Date: 2026-11-12.
Review method: inspect all 72 candidates at 64 px and 24 px on light and dark grounds, comparing each rendered silhouette and its CLDR-defining features; the JSON checklist is enforced by `scripts/emojis/validate-art.ts`.
Status: all listed glyphs pass this lane review; independent owner review and CC BY 4.0 sign-off remain pending.

| ID | CLDR name | Defining features required | Comparison notes | Result — reviewer |
| --- | --- | --- | --- | --- |
| `1f600` | grinning face | Open toothy grin; rounded eyes; no tears or blush. | — | PASS — `local:wH:p2R` |
| `1f603` | grinning face with big eyes | Open toothy grin and visibly larger round eyes than other smiles. | — | PASS — `local:wH:p2R` |
| `1f604` | grinning face with smiling eyes | Gentle upward-arc smiling eyes and an open toothy grin. | Compared beside 1f606, 1f60a and 1f600 at 64 px and 24 px on light/dark grounds: gentle upward-arc eyes and an open toothy grin distinguish it from a closed-mouth smile, squeezed eyes or round open eyes. | PASS — `local:wH:p2R` |
| `1f606` | grinning squinting face | Tightly squeezed eyes and a broad open toothy grin. | Compared beside 1f604 and 1f600 at 64 px and 24 px on light/dark grounds: tight squeezed zigzag eyes and a broader open toothy grin are distinct from round eyes or gentle smiling arcs. | PASS — `local:wH:p2R` |
| `1f605` | grinning face with sweat | Recognizable grinning face with sweat silhouette with its defining subject and visible details. | — | PASS — `local:wH:p2R` |
| `1f642` | slightly smiling face | Small restrained closed smile; neutral open eyes. | — | PASS — `local:wH:p2R` |
| `1f60a` | smiling face with smiling eyes | Both eyes closed in upward arcs, gentle smile and two blush marks. | Compared beside 1f604 and 1f970 at 64 px and 24 px on light/dark grounds: closed upward-arc eyes, blush and a closed gentle smile distinguish it from open teeth or floating hearts. | PASS — `local:wH:p2R` |
| `1f607` | smiling face with halo | Recognizable smiling face with halo silhouette with its defining subject and visible details. | — | PASS — `local:wH:p2R` |
| `1f970` | smiling face with hearts | Normal smiling eyes, a gentle smiling mouth, blush and three small hearts floating around the head. | Compared beside 1f60d at 64 px and 24 px on light/dark grounds: eyes are normal smiling arcs with blush; three separate hearts float around the head, not in the eye sockets. | PASS — `local:wH:p2R` |
| `1f60d` | smiling face with heart-eyes | Two red heart-shaped eyes and a smiling mouth; hearts are the eyes, not floating around the head. | Compared beside 1f970 at 64 px and 24 px on light/dark grounds: two hearts occupy the eye positions; there are no floating hearts around the head. | PASS — `local:wH:p2R` |
| `1f929` | star-struck | Five-point star silhouette. | — | PASS — `local:wH:p2R` |
| `263a-fe0f` | smiling face | Closed smile with two blush marks; no open mouth or tears. | — | PASS — `local:wH:p2R` |
| `1f972` | smiling face with tear | Recognizable smiling face with tear silhouette with its defining subject and visible details. | — | PASS — `local:wH:p2R` |
| `1f917` | smiling face with open hands | One smiling face framed by two visible open hands reaching in to hug. | — | PASS — `local:wH:p2R` |
| `1f60e` | smiling face with sunglasses | Two dark sunglass lenses joined by a bridge above a smiling mouth. | — | PASS — `local:wH:p2R` |
| `1f914` | thinking face | Raised eyebrow and a hand resting at the chin. | — | PASS — `local:wH:p2R` |
| `1f928` | face with raised eyebrow | One eyebrow raised above a skeptical, slightly tilted smile. | — | PASS — `local:wH:p2R` |
| `1f622` | crying face | One blue tear and a downturned mouth. | — | PASS — `local:wH:p2R` |
| `1f62d` | loudly crying face | Wide open anguished mouth and two long blue tear streams. | — | PASS — `local:wH:p2R` |
| `1f620` | angry face | Brows slant down toward the center above a clear frown. | — | PASS — `local:wH:p2R` |
| `1f631` | face screaming in fear | Pale blue upper face, both hands pressed to the cheeks, wide eyes and an open vertical oval mouth. | Compared beside 1f62d at 64 px and 24 px on light/dark grounds: pale blue face, hands pressed to both cheeks and an open vertical oval mouth identify fear; it has no crying face tear streams. | PASS — `local:wH:p2R` |
| `1f47b` | ghost | Ghost silhouette with sheet-like lower edge and two eyes. | — | PASS — `local:wH:p2R` |
| `2764-fe0f` | red heart | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1fa77` | pink heart | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1f9e1` | orange heart | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1f49b` | yellow heart | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1f49a` | green heart | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1f499` | blue heart | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1f49c` | purple heart | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1f90d` | white heart | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1f680` | rocket | Rocket body, porthole, fins and flame. | — | PASS — `local:wH:p2R` |
| `1f337` | tulip | Cup-shaped bloom of overlapping petals on a straight stem with leaves. | Compared beside 1f33a at 64 px and 24 px on light/dark grounds: the tulip is a cup-shaped bloom of overlapping petals on a straight stem with leaves; it no longer uses the hibiscus radial bloom. | PASS — `local:wH:p2R` |
| `1f33b` | sunflower | Recognizable sunflower flower, with distinct petals, center and stem. | — | PASS — `local:wH:p2R` |
| `1f33a` | hibiscus | Open five-petal hibiscus bloom with a long visible central stamen, stem and leaves. | Compared beside 1f337 at 64 px and 24 px on light/dark grounds: the hibiscus is an open five-petal bloom with a visible projecting central stamen, distinct from the tulip cup. | PASS — `local:wH:p2R` |
| `1f4d5` | closed book | Recognizable closed book book shape; preserve its open or closed state. | — | PASS — `local:wH:p2R` |
| `1f4d6` | open book | Recognizable open book book shape; preserve its open or closed state. | — | PASS — `local:wH:p2R` |
| `2615` | hot beverage | Steaming cup with a visible handle. | — | PASS — `local:wH:p2R` |
| `1f355` | pizza | Triangular pizza slice with crust and visible toppings. | — | PASS — `local:wH:p2R` |
| `2600-fe0f` | sun | Round sun disc with visible rays. | — | PASS — `local:wH:p2R` |
| `1f319` | crescent moon | Crescent silhouette with an inward-facing hollow. | — | PASS — `local:wH:p2R` |
| `1f525` | fire | Flame silhouette with a smaller inner flame. | — | PASS — `local:wH:p2R` |
| `2b50` | star | Five-point star silhouette. | — | PASS — `local:wH:p2R` |
| `1f381` | wrapped gift | Gift box with lid, ribbon and bow. | — | PASS — `local:wH:p2R` |
| `1f9f8` | teddy bear | Bear head with round ears, muzzle and nose. | — | PASS — `local:wH:p2R` |
| `1f388` | balloon | Inflated balloon with a tied neck and string. | — | PASS — `local:wH:p2R` |
| `1f4f7` | camera | Camera body with lens and viewfinder detail. | — | PASS — `local:wH:p2R` |
| `1f3b5` | musical note | Single musical note with note head and stem. | — | PASS — `local:wH:p2R` |
| `1f44d-1f3fb` | thumbs up: light skin tone | Sideways closed fist with curled fingers visible as stacked bands; short, broad thumb rises from the side at a slight angle; preserve the thumbs up: light skin tone modifier. | Compared at 64 px and 24 px on light and dark grounds beside throwaway U+1F595 middle-finger and U+261D index-pointing-up references. This contour is one continuous rounded, slightly tapered and thicker side-mounted thumb lobe with no notch; both references retain long upright digits. | PASS — `local:wH:p2R` |
| `1f44d-1f3fc` | thumbs up: medium-light skin tone | Sideways closed fist with curled fingers visible as stacked bands; short, broad thumb rises from the side at a slight angle; preserve the thumbs up: medium-light skin tone modifier. | Compared at 64 px and 24 px on light and dark grounds beside throwaway U+1F595 middle-finger and U+261D index-pointing-up references. This contour is one continuous rounded, slightly tapered and thicker side-mounted thumb lobe with no notch; both references retain long upright digits. | PASS — `local:wH:p2R` |
| `1f44d-1f3fd` | thumbs up: medium skin tone | Sideways closed fist with curled fingers visible as stacked bands; short, broad thumb rises from the side at a slight angle; preserve the thumbs up: medium skin tone modifier. | Compared at 64 px and 24 px on light and dark grounds beside throwaway U+1F595 middle-finger and U+261D index-pointing-up references. This contour is one continuous rounded, slightly tapered and thicker side-mounted thumb lobe with no notch; both references retain long upright digits. | PASS — `local:wH:p2R` |
| `1f44d-1f3fe` | thumbs up: medium-dark skin tone | Sideways closed fist with curled fingers visible as stacked bands; short, broad thumb rises from the side at a slight angle; preserve the thumbs up: medium-dark skin tone modifier. | Compared at 64 px and 24 px on light and dark grounds beside throwaway U+1F595 middle-finger and U+261D index-pointing-up references. This contour is one continuous rounded, slightly tapered and thicker side-mounted thumb lobe with no notch; both references retain long upright digits. | PASS — `local:wH:p2R` |
| `1f44d-1f3ff` | thumbs up: dark skin tone | Sideways closed fist with curled fingers visible as stacked bands; short, broad thumb rises from the side at a slight angle; preserve the thumbs up: dark skin tone modifier. | Compared at 64 px and 24 px on light and dark grounds beside throwaway U+1F595 middle-finger and U+261D index-pointing-up references. This contour is one continuous rounded, slightly tapered and thicker side-mounted thumb lobe with no notch; both references retain long upright digits. | PASS — `local:wH:p2R` |
| `1f469` | woman | Recognizable woman silhouette with its defining subject and visible details. | — | PASS — `local:wH:p2R` |
| `1f469-1f3fb` | woman: light skin tone | Recognizable woman: light skin tone hand/person silhouette and the specified skin tone. | — | PASS — `local:wH:p2R` |
| `1f469-1f3fc` | woman: medium-light skin tone | Recognizable woman: medium-light skin tone hand/person silhouette and the specified skin tone. | — | PASS — `local:wH:p2R` |
| `1f469-1f3fd` | woman: medium skin tone | Recognizable woman: medium skin tone hand/person silhouette and the specified skin tone. | — | PASS — `local:wH:p2R` |
| `1f469-1f3fe` | woman: medium-dark skin tone | Recognizable woman: medium-dark skin tone hand/person silhouette and the specified skin tone. | — | PASS — `local:wH:p2R` |
| `1f469-1f3ff` | woman: dark skin tone | Recognizable woman: dark skin tone hand/person silhouette and the specified skin tone. | — | PASS — `local:wH:p2R` |
| `1f469-200d-1f4bb` | woman technologist | Exactly one woman seated at or working at a laptop. | — | PASS — `local:wH:p2R` |
| `1f468-200d-1f4bb` | man technologist | Exactly one man seated at or working at a laptop. | — | PASS — `local:wH:p2R` |
| `2764-fe0f-200d-1f525` | heart on fire | Recognizable heart silhouette and the color named by CLDR. | — | PASS — `local:wH:p2R` |
| `1f468-200d-1f469-200d-1f467` | family: man, woman, girl | Three distinct people in the family grouping named family: man, woman, girl. | — | PASS — `local:wH:p2R` |
| `1f3f3-fe0f-200d-1f308` | rainbow flag | Horizontal rainbow bands attached to one vertical flagpole; no easel or legs. | — | PASS — `local:wH:p2R` |
| `1f46b` | woman and man holding hands | Two distinct people visibly holding hands. | — | PASS — `local:wH:p2R` |
| `1f1fa-1f1f8` | flag: United States | Red-white stripes and blue canton with white stars. | — | PASS — `local:wH:p2R` |
| `1f1e8-1f1e6` | flag: Canada | Red-white-red vertical bands with a recognizable red maple leaf centered on white. | — | PASS — `local:wH:p2R` |
| `1f1ec-1f1e7` | flag: United Kingdom | Blue field with layered white and red diagonal and central crosses. | — | PASS — `local:wH:p2R` |
| `1f1ef-1f1f5` | flag: Japan | White field with one centered red disc. | — | PASS — `local:wH:p2R` |
| `1f1e7-1f1f7` | flag: Brazil | Green field, yellow diamond and centered blue globe. | — | PASS — `local:wH:p2R` |
| `1f1e9-1f1ea` | flag: Germany | Three horizontal black, red and gold bands. | — | PASS — `local:wH:p2R` |
| `1f1eb-1f1f7` | flag: France | Three vertical blue, white and red bands. | — | PASS — `local:wH:p2R` |
| `1f3f4-e0067-e0062-e0065-e006e-e0067-e007f` | flag: England | White field with a centered red St George cross. | — | PASS — `local:wH:p2R` |

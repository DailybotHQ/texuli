# Texuli Emoji Style v1

**Status:** working art direction for the private PLAN_023 seed. Artwork license
is proposed as CC BY 4.0 and remains pending owner sign-off. The current 72
images are reviewed candidates, not approved or publishable assets.

## Visual contract

- Use a 64×64 transparent SVG canvas. Keep the main silhouette inside a
  4-unit safe margin except where a flag's pole or a deliberate gesture
  needs the full edge.
- Draw a soft, compact 2.5D vector: rounded silhouettes, one clear light
  source from the upper left, restrained inner highlights and a quiet violet
  or warm brown shadow stroke. Keep small-size meaning in the silhouette;
  highlights are secondary.
- Preserve the conventional meaning and recognizable structure of each
  Unicode character. Colors can use Texuli's visual language but must not
  recolor national flags, skin or culturally meaningful objects.
- Keep objects optically centered. Use consistent 1.5–2.5 unit outlines for
  small shapes and 2–4 unit strokes for feature lines. Avoid hairline details
  that disappear below 20 CSS pixels.

## Palette and shapes

The working palette uses pearl `#fff9f1`, ink-violet `#4b355a`, soft violet
`#9474c9`, lilac `#c7b5eb`, warm orange `#f28c45`, and restrained gold
`#f4c94f`. Semantic colors (hearts, fire, plants and flags) retain their
recognizable hues. Backgrounds remain transparent; do not add a brand halo.

Prefer circles, rounded rectangles, simple closed paths and layered flat
fills. Use a maximum of three shading tones per major object. Gradients,
filters, masks, embedded images, font glyphs and text are outside this seed
style and are rejected by the current safe SVG vocabulary.

## Faces, people and modifiers

- Faces use a warm yellow base, clean high-contrast features, and distinct
  eye and mouth geometry for each expression. Tears, sweat, hearts and other
  symbols are separate shapes; do not encode them as an arbitrary filter.
- People use a consistent head scale and shoulder width. Hair, clothing and
  exposed skin are separate layers.
- Skin-tone variants alter only skin-colored face, hand and exposed-body
  shapes. Clothing, hair, outlines and props retain their authored colors.
  Use the five Unicode tone values as representative swatches and review each
  derived drawing separately; do not apply a whole-image tint.
- For ZWJ people or family designs, draw each person and relationship prop as
  an explicit layer. Do not create a composite by simply placing Unicode
  glyphs or third-party images on the canvas.

## Objects and flags

Objects keep their conventional silhouette first (for example, a cup has a
rim and handle, a book has a spine and pages, and a rocket has a body, window
and fins). Add only details that survive at 16–24 px.

Flags use accurate field colors, orientation, and major symbols. Simplifying
small detail is acceptable when it preserves the flag's identity. National
and subdivision flags receive a separate cultural accuracy review; no Texuli
palette tint is applied to flag colors.

## Accessibility and export

Every file is a monochrome-independent visual; contrast and silhouette must
remain distinguishable on white, dark violet and neutral gray backgrounds.
The host supplies the accessible name from CLDR metadata; SVG files contain
no text or ARIA strings. Render-review targets are 16, 20, 24, 32, 48 and 64
CSS px on light and dark surfaces. Preserve crisp edges at each size and do
not promise cross-platform pixel identity.

Canonical outputs use `viewBox="0 0 64 64"`, width/height 64, transparent
background, no scripts, events, CSS, external references or raster data.
`scripts/emojis/art-svg.ts` is the allow-list sanitizer, validator and
deterministic optimizer; its accepted elements and attributes are the actual
export contract.

## Originality and review

Drawings start from Unicode and CLDR semantic descriptions and original
geometric sketches authored for Texuli. Do not trace, recolor or use vendor
emoji images, glyph paths, screenshots or sprite sheets as reference art.
The provenance file identifies the authoring lane, date, method, source hash,
review status and proposed license for each source image.

The seed review records **before** (semantic silhouette sketch) and **after**
(sanitized, optimized SVG) checks for representative face, tone, object,
composition and flag images in `artwork/emojis/reviews/seed-review.md`. A
passing validator establishes file safety and determinism only; it is not
human approval of visual quality or license. Owner approval is required before
any candidate is marked approved or published.

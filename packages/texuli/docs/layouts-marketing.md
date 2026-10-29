# Marketing layouts

**Package:** `texuli` · **Import:** `texuli/layouts/marketing`

Landing, pricing and marketing section layouts. Each composition is a separate
lazy subpath. `MarketingLayout` registers with LayoutHost as `marketing`.

## Imports

| Subpath | Export |
| --- | --- |
| `texuli/layouts/marketing` | `MarketingLayout` (+ register) |
| `texuli/layouts/marketing/landing` | `LandingLayout` |
| `texuli/layouts/marketing/pricing` | `PricingLayout` |
| `texuli/layouts/marketing/section` | `MarketingSection`, `MarketingSectionHeader` |

## MarketingSectionHeader

`MarketingSection` is a labelled `<section>` with block padding. Inside a
section the page already labels, use `MarketingSectionHeader` instead: the
same eyebrow, heading and description type scale on a plain `div`, with no
landmark, no `aria-label` and no padding.

| Prop | Default | Notes |
| --- | --- | --- |
| `title` | (required) | The heading text |
| `level` | `2` | Heading level, `2` to `6` |
| `headingId` | — | The heading's `id`, for the section's `aria-labelledby` |
| `eyebrow`, `description` | — | Optional lines above and below the heading |
| `align` | `start` | `start` or `center` |
| `children` | — | Content after the description (actions, badges) |

Other attributes land on the root `div`, and `bind:ref` binds it.

```svelte
<section aria-labelledby="why">
  <MarketingSectionHeader title="Why teams switch" headingId="why" level={2} />
  …
</section>
```

## Notes

- Money is integer **cents** (`priceCents`).
- Nav and CTA `href` values go through `Button` / anchors; prefer app-authored
  relative or hash links.
- Logical CSS; pass `dir="rtl"` on a parent for RTL.
- Footer and header use safe-area insets.

**Pricing tiers** render as `div role="listitem"` inside the `role="list"`
grid: an `<article>` may not take the `listitem` role.

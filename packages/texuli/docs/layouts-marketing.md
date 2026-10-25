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
| `texuli/layouts/marketing/section` | `MarketingSection` |

## Notes

- Money is integer **cents** (`priceCents`).
- Nav and CTA `href` values go through `Button` / anchors; prefer app-authored
  relative or hash links.
- Logical CSS; pass `dir="rtl"` on a parent for RTL.
- Footer and header use safe-area insets.

**Pricing tiers** render as `div role="listitem"` inside the `role="list"`
grid: an `<article>` may not take the `listitem` role.

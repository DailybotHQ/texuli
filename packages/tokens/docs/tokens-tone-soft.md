# Soft tone roles (Alert / Callout)

**Package:** `@texuli/tokens`  
**Roles:** `primarySoft`, `primarySoftForeground`, `successSoft`, `successSoftForeground`, `warningSoft`, `warningSoftForeground`, `infoSoft`, `infoSoftForeground`, `destructiveSoft`, `destructiveSoftForeground`

## Why

Solid tone fills (`success` + `successForeground`) stay AA for Badge chips. Alert and Callout need a **pastel fill** with a **tonal title** and body text. CSS `color-mix` of the solid tone on transparent failed WCAG AA for titles. Soft roles are produced by the library port and seed generator so every theme guarantees:

| Pair | Minimum |
| --- | --- |
| `*SoftForeground` on `*Soft` | 4.5:1 (title / icon) |
| `foreground` on `*Soft` | 4.5:1 (body) |
| `*Foreground` on solid `*` | 4.5:1 (badge / toast icon) |

Gated in `THEME_CONTRAST_PAIRS` and `COMPONENT_CONTRAST_PAIRS` across all 210 library themes × light/dark.

## CSS

```css
background-color: var(--tx-warning-soft);
color: var(--tx-warning-soft-foreground); /* title */
/* body keeps var(--tx-foreground) */
```

Never invent per-theme patches; change the generator / library-port if a pair fails.

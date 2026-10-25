# Chart color scales

`@texuli/charts/colors` provides pure helpers that return CSS color expressions
backed by the active Texuli `--tx-chart-*` theme tokens. They can be used by
custom chart marks without importing a rendered chart family.

```ts
import { categoricalColor, divergingColor, sequentialColor } from '@texuli/charts/colors';

const seriesFill = categoricalColor(2);
const heatFill = sequentialColor(0.7);
const deviationFill = divergingColor(-0.4);
```

`categoricalColor(index)` selects one of eight categorical tokens and wraps
indices in either direction. Missing categorical tokens fall back to semantic
roles (`primary`, `success`, `info`, `warning`, `destructive`, `secondary`,
`accent`, `link`) and then `CanvasText`.

`sequentialColor(value)` clamps a finite value to 0–1, selects the nearest of
nine `--tx-chart-sequential-*` steps, and uses the framework-free primary-to-
background ramp as a CSS fallback. `divergingColor(value)` clamps to -1–1 and
selects one of nine `--tx-chart-diverging-*` steps; when that token is absent,
the center uses the theme background and the two sides mix destructive or
success into that background. Non-finite values resolve to the neutral/first
stop. All three helpers are deterministic and return CSS expressions rather
than reading theme state at runtime.

Matrix, part-whole, calendar, and geo families use the shared categorical or
sequential mapping for their default fills. Explicit point colors remain
untouched. Themes without the relevant chart ramps retain semantic fallbacks.

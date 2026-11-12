## Grid model

Each widget has a stable id and a position and size in grid units: `x`, `y`, `w`, and `h`. Optional `minW`, `minH`, `maxW`, `maxH`, and `locked` values constrain layout changes. The view renders widgets in row-then-column reading order.

## Layout engine

`@texuli/data/dashboard/engine` contains framework-free pure operations. `normalizeLayout` reads untrusted layouts, clamps values, resolves overlap deterministically, and returns issues. `moveItem`, `resizeItem`, `nudgeItem`, `compactLayout`, and `reflowLayout` return a new layout or a refusal; they do not mutate the input.

Breakpoints describe the available column count. `dashboardBreakpoints(12)` provides a twelve-column wide grid, up to six columns at medium widths, and one column on narrow containers. A missing breakpoint layout is reflowed from the nearest available layout.

## Persistence shape

`serializeDashboard` produces canonical JSON. Treat stored or shared data as untrusted and pass it to `parseDashboard` before restoring it. Parsing normalizes the layout and reports refused, dropped, or clamped entries instead of throwing.

The engine caps the input at 200 widgets, 24 columns, 8 breakpoints and 512 KiB of serialized state. See `packages/data/docs/data-dashboard-engine.md` for the complete types and limits.

# `@texuli/canvas/model`

The framework-free, DOM-free canvas model. Everything an editor, an agent
tool or a server needs: the format, its validator, geometry, routing,
operations and history. No Svelte, no DOM (an import-guard test enforces it).

> **Status: in development.** On npm from `0.8.0`, the package's first
> release (pre-1.0).

```ts
import { applyCanvasOps, createCanvas, moveOps, validateCanvas } from '@texuli/canvas/model';

const canvas = createCanvas({ title: 'Launch plan' });
const added = applyCanvasOps(canvas, [
  { op: 'add', shape: { id: 'a', type: 'sticky', x: 0, y: 0, width: 160, height: 160, text: 'Ship' } },
]);
if (added.ok) {
  const moved = applyCanvasOps(added.doc, moveOps(added.doc, ['a'], { x: 16, y: 0 }));
}
```

## The format

`CanvasDocument`: `{ format: 'texuli-canvas', formatVersion: 1, meta?,
grid?, shapes, connectors }` (`CANVAS_FORMAT`, `CANVAS_FORMAT_VERSION`;
`CanvasMeta` holds `title`, `locale` and `description`). Coordinates are
world units, absolute for every shape. Array order is z-order (first at the
bottom). `CanvasShape` is one of (`CanvasShapeType`, `SHAPE_TYPES`):

- `RectShape` (`rect`, `radius`, `text`), `EllipseShape` (`ellipse`),
  `DiamondShape` (`diamond`): boxed shapes with optional `text`.
- `LineShape` (`line`, `arrow`) and `PathShape` (`path`, `closed`): `points`
  (`CanvasPoint`, `[x, y]` relative to the shape's `x` and `y`).
- `TextShape` (`text`, `fontSize` `CanvasFontSize`, `align`
  `CanvasTextAlign`) and `StickyShape` (`sticky`, `color`).
- `ImageShape` (`image`): a host `ref` and a required `alt`.
- `FrameShape` (`frame`, `title`, `children`): a titled region that clips
  its children. `GroupShape` (`group`, `children`): moves, copies and
  deletes together; its box is its children's bounds.

Boxed shapes (`BoxedShape`: every type but `group`) carry `x`, `y`,
`width`, `height`, an optional `rotation` (degrees around the box center)
and an optional `CanvasPaint` (`fill`, `stroke`: a `CanvasColor` of the
closed palette or `none`; `strokeWidth`; `dash` `CanvasDash`; `opacity`).
`ContainerShape` is a frame or a group. Any shape may be `locked`.

`CanvasConnector`: `{ id, from, to, routing?, startCap?, endCap?, text?,
paint? }`. An end (`CanvasEndpoint`) is `{ shape, anchor? }`
(`CanvasAnchor`: `auto`, `center` or a side) or a free `{ x, y }`.
`CanvasRouting` is `straight`, `elbow` or `curved`; `CanvasCap` is `none`,
`arrow` or `dot`. `CanvasRect` and `CanvasXY` are plain world geometry.

Closed vocabularies: `CANVAS_COLORS`, `CANVAS_DASHES`, `CANVAS_FONT_SIZES`
(`FONT_SIZE_UNITS` in world units), `CANVAS_ALIGNS`, `CANVAS_ANCHORS`,
`CANVAS_ROUTINGS`, `CANVAS_CAPS`. Ids match `CANVAS_ID_PATTERN` (valid
sync node ids too) and avoid `RESERVED_IDS`; image refs match
`CANVAS_REF_PATTERN`; `meta.locale` matches `CANVAS_LANG_PATTERN`.

## Limits

`CANVAS_LIMITS`: 5,000 shapes (nested ones included), 5,000 connectors,
frames and groups nested 8 deep, 1,000 points per line or path, 200,000
points and 1,000,000 characters of text in a canvas, 5,000 characters per
text, coordinates within ±1,000,000, sizes up to 100,000, 8,000,000 bytes of
JSON text, 10,000 operations per batch and 200 undo steps.

## Validation

- `validateCanvas(input, options)` returns a `CanvasValidation`: every
  issue at once (`CanvasDiagnostic`, with `jsonPath` and RFC 6901
  `pointer`), a fresh copy when valid, never a throw. `ValidateCanvasOptions`:
  `trust` (default `untrusted`) and `maxIssues`. `isCanvas` is the boolean.
- `loadUntrustedCanvas(input, options)` (`LoadCanvasOptions`, `maxBytes`)
  size-checks JSON text before parsing, then validates.
- Rules beyond the schema kit's codes (`CANVAS_CODES`, `CanvasCode`): unique
  ids (`duplicate-id`), connector ends that name a shape other than a group
  (`unknown-endpoint`), the totals (`too-many-shapes`, `too-many-points`,
  `too-much-text`), closed shape types (`unknown-shape`) and image refs with
  a scheme that `safeImageSrc` refuses at the tier (`unsafe-url`). Text
  refuses control and bidi characters.
- `canvasSchema(trust)` is the schema; `canvasJsonSchema()` is its JSON
  Schema 2020-12 export, pinned by spec 0.8.0 as `schemas/canvas.schema.json`.

## Reading

`createCanvas(meta)`, `walkShapes(doc)` (`WalkEntry`: shape, parent, index,
depth; parents first), `indexShapes`, `siblingsOf`, `subtreeIds`,
`isContainer`. Geometry: `boxOf`, `shapeBounds` (rotation included; a
group's children's bounds), `canvasBounds`, `unionRects`, `rotatePoint`,
`hitShape` and `shapeAt` (the top-most shape under a point; frames resolve
to their children, groups to the group), `shapesInRect` (marquee, top level
and frame children). `readingOrder(doc, dir)` is the Tab order: rows top to
bottom, then the start edge in reading direction, children after their
container. `shapeName` is a shape's text, title or alt on one line.

## Connectors

`routeConnector(connector, shapes)` returns a `ConnectorRoute` (ends,
sides, a polyline, SVG path data and the label point) or `null` when an end
names no shape. `resolveEndpoint` places an end (`auto` faces the other
end; anchors turn with the shape), `facingSide` picks a side, `elbowPoints`
routes orthogonally, and `curved` uses `sideCurveControls` from
`@texuli/drag/graph`, the curve the workflow editor draws (`EdgeSide`).
`distanceToRoute` hit-tests a route.

## Freehand

`simplifyPath(points, tolerance)` reduces raw input to at most
`CANVAS_LIMITS.pathPoints` points in time linear in the input: a
radial-distance pass, thinning to `RDP_INPUT` points, then
Ramer–Douglas–Peucker. `pathFromPoints(id, points, options)` returns a
`path` shape whose box is the points' bounds.

## Operations and history

`CanvasOperation`: `add` (a shape with its children, under a parent at an
index), `remove` (a shape with its children, the connectors attached to
them and a group it leaves empty; or a connector), `update` (fields;
`null` clears; `CanvasPatch`), `move` (reparent and z-order), `connect`
and `meta`. `applyCanvasOps(doc, ops, options)` (`ApplyCanvasOptions`:
`trust`, `respectLocks`) applies a batch all or none to a copy, validates
the result and returns a `CanvasApplyResult` with the inverse batch, or a
`CanvasOpError` (`invalid-op`, `unknown-id`, `duplicate-id`, `cycle`,
`locked`, `limit`, `invalid-result`).

`createCanvasHistory(doc, options)` (`CanvasHistoryOptions`: `limit`,
`trust`) returns a `CanvasHistory`: `apply(ops, { label, merge })` records a
`CanvasStep` (consecutive steps with the same `merge` key, such as a run of
arrow-key nudges, become one), `undo()` applies the inverse, `redo()` the
operations again, and `reset(doc)` starts over.

## Editing helpers

Each returns operations; none throws, and locked shapes are skipped.

- `selectionRoots` (selected shapes not inside another selected one),
  `moveOps`, `snapMove` (`SnapOptions`: `grid`, `objects`, `threshold`;
  returns the adjusted delta and `SnapGuide`s to draw), `resizeOps` (a
  `ResizeHandle`, `ResizeOptions`: `keepAspect`, `grid`, `min`; lines and
  paths scale their points, groups their children, rotated shapes keep
  their fixed corner), `rotateOps` (with a `snap` step) and `angleTo` (the
  rotation a rotate handle points at).
- `alignOps` (`AlignMode`: `left`, `center`, `right`, `top`, `middle`,
  `bottom`), `distributeOps` (equal gaps), `reorderOps` (`ReorderMode`:
  `front`, `back`, `forward`, `backward`).
- `groupOps`, `ungroupOps`, `reparentOps` (into a frame or the top level)
  and `frameAt` (the frame that holds a rect).
- `deleteOps`, `textOps` (a shape's text, a frame's title, an image's alt or
  a connector label), `connectOps`, `createIdFactory`.
- Clipboard: `copyShapes` returns a `CanvasClipboard` (`CLIPBOARD_FORMAT`)
  with the connectors between the copied shapes; `serializeClipboard`;
  `parseClipboard(text, { trust })` validates untrusted text; `pasteOps`
  gives everything fresh ids and an offset; `duplicateOps` does both.

## Paint geometry

Shared by the editor, the viewer and the export, so all three draw the same
thing: `shapeOutline` (a `ShapeOutline`: rect, ellipse or path data),
`shapeTransform` (the rotation), `textLayout` (a `TextLayout`: lines, size,
baseline and anchor), `paintedText`, `resolvePaint` (a `ResolvedPaint` with
defaults) and `dashArray`. `PALETTE_TOKENS` maps palette names to `--tx-*`
tokens (themes, dark mode and forced colors follow); `EXPORT_PALETTE` holds
fixed colors for standalone files.

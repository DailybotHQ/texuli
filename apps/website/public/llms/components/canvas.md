# Canvas

> A whiteboard or diagram as data: shapes, sticky notes, text, frames, groups and connectors on an infinite canvas.

- **id:** `canvas`
- **package:** `@texuli/canvas`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `canvas`

### Use when

- Sketch a flow, a map of ideas, a retro board or an architecture diagram people can keep editing
- Lay out sticky notes in frames and connect shapes with arrows

### Don't use when

- A workflow with typed ports that runs: use workflow-graph
- A chart of data: use a chart family
- Prose: use document

### Accessibility

- Painted as an image named by the canvas title, with every shape and connector listed as text in reading order
- Text is data, never HTML; image refs pass the URL policy at the host tier
- Styles are a closed palette of theme tokens, never raw CSS

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `canvas` | object | yes | — | — | A Texuli canvas: { format: "texuli-canvas", formatVersion: 1, meta: { title }, shapes, connectors }. Shapes: rect, ellipse, diamond, line, arrow, path (points), text, sticky, image ({ ref, alt }), frame ({ title, children }) and group ({ children }), each with an id and x, y, width, height. Connectors: { id, from: { shape }, to: { shape }, routing: straight \| elbow \| curved, text }. |
| `label` | string | no | untrusted | — | Accessible name; defaults to the canvas title. |

### Examples

#### Decision flow (`decision`)

```json
{
  "canvas": {
    "format": "texuli-canvas",
    "formatVersion": 1,
    "meta": {
      "title": "Release decision"
    },
    "shapes": [
      {
        "id": "ask",
        "type": "ellipse",
        "x": 0,
        "y": 0,
        "width": 160,
        "height": 72,
        "text": "Ready to ship?"
      },
      {
        "id": "ship",
        "type": "rect",
        "x": 240,
        "y": 0,
        "width": 160,
        "height": 72,
        "text": "Ship on example.com"
      },
      {
        "id": "idea",
        "type": "sticky",
        "x": 0,
        "y": 120,
        "width": 160,
        "height": 120,
        "text": "Ask the beta testers",
        "color": "yellow"
      }
    ],
    "connectors": [
      {
        "id": "yes",
        "from": {
          "shape": "ask"
        },
        "to": {
          "shape": "ship"
        },
        "routing": "curved",
        "text": "yes"
      }
    ]
  }
}
```

### Related

- [`document`](document.md)
- [`workflow-graph`](workflow-graph.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._

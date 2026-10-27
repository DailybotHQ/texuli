# Map

> Places as markers on an offline vector basemap, clustered when close, with a place list beside it.

- **id:** `data-map`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Show where things are: stores, deliveries, sites

### Don't use when

- Values per region: use charts-geo-map
- One address: use text

### Accessibility

- Every marker is also an item in a labelled place list (the non-map path)
- The map pans and zooms by keyboard; selection is announced

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `markers` | array | yes | — | — | — |
| `listPlacement` | enum(side | below) | no | — | `"side"` | — |

### Examples

#### Sites (`sites`)

```json
{
  "label": "Warehouses",
  "markers": [
    {
      "id": "w1",
      "label": "North hub",
      "lat": 59.33,
      "lng": 18.07
    },
    {
      "id": "w2",
      "label": "South hub",
      "lat": 41.39,
      "lng": 2.17,
      "tone": "warning"
    }
  ]
}
```

### Related

- [`charts-geo-point-map`](charts-geo-point-map.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._

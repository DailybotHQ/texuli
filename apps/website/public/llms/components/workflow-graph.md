# Workflow graph

> A workflow of typed nodes and edges (automations, pipelines, approvals, state diagrams), read-only or editable.

- **id:** `workflow-graph`
- **package:** `@texuli/workflows`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `workflows`

### Use when

- Show how a process flows from step to step
- Let people build or change a workflow, bound to a workflow state variable

### Don't use when

- A static diagram in a document: use blocks-diagram
- Quantities flowing between stages: use charts-sankey

### Accessibility

- View mode: a figure whose nodes are a list that says where each one leads
- Edit mode: focusable nodes with spatial arrow keys, keyboard connect mode on ports, and a treegrid outline that edits without the canvas
- Labels are text; links and images pass the untrusted URL policy

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name. |
| `graph` | object | yes | — | — | A spec WorkflowGraph (version 1): nodeTypes, nodes, edges, groups, cycles. |
| `mode` | enum(view | edit) | no | — | `"view"` | — |
| `flow` | enum(LR | TB) | no | — | `"LR"` | — |

### Examples

#### Expense approval (`approval`)

```json
{
  "label": "Expense approval",
  "mode": "view",
  "graph": {
    "version": 1,
    "cycles": "forbid",
    "nodeTypes": [
      {
        "id": "step",
        "label": "Step",
        "ports": [
          {
            "id": "in",
            "direction": "in"
          },
          {
            "id": "out",
            "direction": "out",
            "multiple": true
          }
        ]
      }
    ],
    "nodes": [
      {
        "id": "ask",
        "type": "step",
        "label": "Request",
        "position": {
          "x": 0,
          "y": 0
        }
      },
      {
        "id": "review",
        "type": "step",
        "label": "Review",
        "position": {
          "x": 260,
          "y": 0
        }
      },
      {
        "id": "paid",
        "type": "step",
        "label": "Paid",
        "position": {
          "x": 520,
          "y": 0
        }
      }
    ],
    "edges": [
      {
        "id": "e1",
        "from": {
          "node": "ask",
          "port": "out"
        },
        "to": {
          "node": "review",
          "port": "in"
        }
      },
      {
        "id": "e2",
        "from": {
          "node": "review",
          "port": "out"
        },
        "to": {
          "node": "paid",
          "port": "in"
        }
      }
    ]
  }
}
```

### Related

- [`blocks-diagram`](blocks-diagram.md)
- [`charts-sankey`](charts-sankey.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._

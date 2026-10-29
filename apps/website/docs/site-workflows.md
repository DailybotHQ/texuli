# Workflows pages (texuli.com)

**App:** `apps/website`
**Paths:** `/workflows-page/` (editor and viewer) · `/workflows-page/json/` (JSON live preview)
**Package:** `@texuli/workflows` (in development, on npm as `0.5.0`)
**Tests:** `apps/website/tests/site-drag.test.ts`, `apps/website/tests/site-drag-json.test.ts`,
`tests/e2e/site-drag-workflows.spec.ts`

## `/workflows-page/`

- `WorkflowsEditorDemo.svelte`: the full `WorkflowEditor` (palette, canvas,
  toolbar with auto-layout, inspector, outline, minimap) on a fictional
  order-automation pipeline (`pipeline.ts`: a closed registry of seven node
  types and six steps on example.com). A right-to-left toggle and "Reset the
  sample"; edits stay in the page.
- `WorkflowsViewerDemo.svelte`: the read-only `WorkflowViewer`, the same graph
  laid out top to bottom by the layered auto-layout.
- Both islands mount with `client:visible`.

## `/workflows-page/json/`

The JSON live preview: edit a blueprint, see validator diagnostics with
their paths, and see it paint through `<Player>` at the `untrusted` tier.
Invalid JSON never paints. Details are in the island's sources
(`src/components/workflows-site/json/`).

## Validation

```bash
pnpm vitest run apps/website/tests/site-drag.test.ts apps/website/tests/site-drag-json.test.ts
pnpm build
pnpm --filter @texuli/website check:csp
TEXULI_E2E_PORT=4895 pnpm exec playwright test tests/e2e/site-drag-workflows.spec.ts --project chromium
```

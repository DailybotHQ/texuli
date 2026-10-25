# texuli.com: Texuli for agents

**App:** `apps/website`  
**Page:** `/agents-page/`  
**Components:** `src/components/agents-page/`  
**Tests:** `tests/e2e/site-agents-page.spec.ts`

## Goal

Explain how coding agents build with Texuli:

- Closed **catalog** and content-addressed JSON
- **Emit tiers** (developer vs untrusted / Tier U)
- **Sink-free renderer** (limits, placeholders, hostile corpus)
- **MCP** setup (local, read-only catalog tools)
- **CLI** (`texuli add`, llms generation, path containment)
- **Golden set** quality gates
- Same-origin links to **`/llms/llms.txt`**, **`/llms/llms-full.txt`**, **`/catalog/catalog.json`**

Static HTML after build. No runtime network. Axe WCAG 2.1 A/AA in light and dark on desktop and Pixel 7.

## Components

| File | Role |
| --- | --- |
| `agents.ts` | Topics, resources, setup steps |
| `AgentsHero.astro` | Title and CTAs to llms/catalog |
| `AgentsTopics.astro` | Six topic cards |
| `AgentsSetup.astro` | Ordered setup list |
| `AgentsResources.astro` | Resource cards linking to public files |

## Public assets

Generated into `apps/website/public/` (committed snapshots):

```bash
pnpm exec tsx packages/tools/src/llms/cli.ts --out apps/website/public/llms
pnpm exec tsx packages/catalog/src/build/cli.ts --out tmp/catalog
```

The second command writes `tmp/catalog/catalog-<sha256>.json`: copy it to
`public/catalog/catalog.json`, format it with `npx biome format --write`, and
put the new hash in `public/catalog/README.md`.
`scripts/tests/site-agents-snapshots.test.ts` fails when either snapshot no
longer matches the manifests.

| Path | Source |
| --- | --- |
| `/llms/*` | `@texuli/tools/llms` from live manifests |
| `/catalog/catalog.json` | `@texuli/catalog/build` |

## Validation

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=4930 pnpm exec playwright test tests/e2e/site-agents-page.spec.ts'
```

# llms.txt and agent docs bundle

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/llms`

Generate agent-facing documentation from catalog manifests:

| File | Role |
| --- | --- |
| `llms.txt` | Compact index (llmstxt.org-style) with links to component pages |
| `llms-full.txt` | Every component doc concatenated |
| `components/<id>.md` | Per-component Markdown (props, examples, use/don't-use, a11y) |

## Library

```ts
import { buildLlmsBundle, writeLlmsBundle } from '@texuli/tools/llms';
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';

const { catalog } = await buildCatalog(await discoverManifestGroups());
const bundle = buildLlmsBundle({
  catalog,
  title: 'Texuli',
  baseUrl: 'https://texuli.example/llms',
});
await writeLlmsBundle('apps/website/public/llms', bundle);
```

Or from a plain manifest list (tests / fixtures):

```ts
const bundle = buildLlmsBundle({ manifests: [cardManifest, buttonManifest] });
```

## CLI

```bash
pnpm exec tsx packages/tools/src/llms/cli.ts \
  --out apps/website/public/llms \
  --base-url https://texuli.example/llms \
  --json
```

| Flag | Meaning |
| --- | --- |
| `--out` | Output directory (default `dist/llms`) |
| `--base-url` | Absolute link prefix for component hrefs |
| `--title` | Project title in `llms.txt` |
| `--dry-run` | Plan paths only |
| `--json` | Machine-readable summary |

## Notes

- Content is plain Markdown (no HTML sinks).
- Agent-emittable vs chrome components are split in `llms.txt` by default.
- Regenerate after catalog manifest changes; do not hand-edit generated files.
- Writes use the shared path containment in `@texuli/tools` (`src/internal/paths.ts`):
  every path is resolved under `outDir`, `..` escapes are refused, and writes
  through symlinked files or parents are refused.

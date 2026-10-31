# llms.txt and agent docs bundle

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/llms`

Generate agent-facing documentation from catalog manifests:

| File | Role |
| --- | --- |
| `llms.txt` | Compact index (llmstxt.org-style) with links to component pages |
| `llms-full.txt` | Every component doc concatenated |
| `components/<id>.md` | Per-component Markdown (props, examples, use/don't-use, a11y) |

`llms.txt` and `llms-full.txt` also carry a "Blueprint envelope" section
(`LLMS_ENVELOPE_NOTES`): the envelope fields and, from spec 0.10.0 (in
development for `0.10.0`, not on npm), the envelope's `designSystem`
(`{ ref }` or `{ inline }`, what the player does with it and the
`design-system` validation codes).

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

## Whole-site llms.txt

`formatSiteLlmsTxt` renders the llmstxt.org convention for a caller-supplied
route map — an H1, a blockquote summary, then H2 sections of
`- [Title](href): one line` links. It takes no catalog input; the sections
come from the consumer (texuli.com derives them from its nav in
`apps/website/src/components/seo/llms-site.ts`). Text fields are collapsed to
one line, and whitespace, newlines and parentheses inside an href are
percent-encoded so no link can break its list item:

```ts
import { formatSiteLlmsTxt, type SiteLlmsSection } from '@texuli/tools/llms';

const body = formatSiteLlmsTxt({ title: 'Texuli', summary: '…', sections });
```

The website's committed copy is `apps/website/public/llms.txt`; regenerate it
with `pnpm exec tsx scripts/generate-site-llms.ts` after nav or route changes
(the `site-aeo` e2e spec fails on drift).

## Notes

- Content is plain Markdown (no HTML sinks).
- Agent-emittable vs chrome components are split in `llms.txt` by default.
- Regenerate after catalog manifest changes; do not hand-edit generated files.
- Writes use the shared path containment in `@texuli/tools` (`src/internal/paths.ts`):
  every path is resolved under `outDir`, `..` escapes are refused, and writes
  through symlinked files or parents are refused.

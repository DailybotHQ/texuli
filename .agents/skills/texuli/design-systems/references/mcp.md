# Design systems through the MCP

New in `0.10.0`, on `@texuli/mcp` and on `https://texuli.com/mcp` (every
tool but `ds.save`). The local
server is `npx -y @texuli/mcp` (see [`../../router/hosts.md`](../../router/hosts.md));
the same operations run from a shell as `texuli <group> <verb> --json
<object>`.

## Tools

Every tool but `ds.save` is pure compute and answers the same on the local
and the remote server. A refused document is a normal result with `valid:
false` and `errors` (codes in [`codes.md`](codes.md)), not a tool error.

| Tool | Input | Returns |
| --- | --- | --- |
| `ds.generate` | any combination of `brief`, `tokens`, `css`, `logoPixels`, `theme` | draft document or refusal, `report.losses`, automatic AA `report.repairs`, `report.guarantees` |
| `ds.validate` | `document`, `trust`, `variant`, `bases`; optional `full`, `report`, `strict`, `catalog`, `extensions`, `prototype` | Basic: `valid`, `codes`, `errors`, `warnings`, `hash`. Full: those plus `summary`, `findings`, `check`, optional prototype counts and `reportOnly`. |
| `ds.compile` | `document`, `format` (`json`, `css`, `tailwind`, `dtcg`, `tokens-studio`), `selector`, `dark`, `mode` | `content` (text), `mediaType`, `hash` |
| `ds.contrast` | `document`, `mode` | per mode `total`, `failing`, `pairs`; `adjustments` |
| `ds.suggest` | one of `seed`, `colors` (up to 3), `pixels` (RGBA) | `document`, `palette`, `roles` |
| `ds.import` | `from` (`brand`, `dtcg`, `tokens-studio`, `role-palette`, `theme`), `input` | `document`, `warnings` |
| `ds.diff` | `before`, `after` | `identical`, `summary`, `tokens`, `contrast`, `defaults`, `attrs` |
| `ds.preview` | `document`, `format` (`svg`, `html`) | `content` (escaped, deterministic) |
| `blueprint.theme` | `blueprint` (tree or envelope), `designSystem` (`ref` or `inline`) | `valid`, the themed `blueprint`, `diagnostics` |
| `ds.save` | `path`, `document`, `overwrite`, `dryRun` | `saved`, `path`, `bytes` (local server only; the remote one does not list it) |

`blueprint.validate` also checks an envelope's `designSystem`: an inline
document's codes come back under `$.designSystem`.

Set `full: true` to run the locked design-system validator. It checks the
document structure, `extends`, allow manifest and library entries, approval
hashes, contrast guarantees, data-viz palette, token completeness and
catalog extensions. Pass `prototype: { files, blueprints }` to scan source
text and blueprint trees against the allow manifest and locked CSS policy;
the operation is read-only and never executes source. `report: true` marks
the result as migration tracking only: findings are always returned and
`valid` remains the verdict. `strict: true` promotes warning-severity
findings to errors in that verdict. Optional `catalog` replaces the bundled
catalog; `extensions` supplies checked host catalog entries. MCP does not
launch a browser; use the local CLI `texuli ds validate … --locked
--render` for the catalog conformance sheet and consumer-owned browser tests
for a prototype's rendered page. Full codes and severities are documented
in `packages/tools/docs/ds-check.md` in the Texuli repository.

## Prompt

`create-design-system` (`brief`, optional `base` theme id and `contrast`
`AA` or `AAA`) returns the authoring loop: read the examples, propose inputs
from a brief, token file, stylesheet, logo pixels or Texuli theme with
`ds.generate`, inspect each loss and automatic AA repair, validate,
check contrast and preview, deliver a draft. Reference screenshots are
interpreted by the agent's own vision step and converted to proposed inputs;
the tool never silently imports screenshots, fetches inputs or saves the
generated document.

## Resources

`texuli://design-system/{id}`: the fictional examples (`acme`, every
section; `minimal`, the smallest; the brands `quillmark`, `ledgerline`,
`tumbletown`) are listed, and every library theme is readable as a
document by its theme id (complete `{id}`; one document per read).

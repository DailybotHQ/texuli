# Design-system codes and their fixes

Every refusal from `ds.validate`, `ds.compile`, `ds.contrast`,
`ds.preview`, `blueprint.theme` (under `$.designSystem…`) and `texuli ds
check` has a stable `code`, a `$`-rooted JSON `path`, a `message` and
often a `hint`. Repair from the code and the path; never loosen the
document's rules or switch the trust level to get past one.

The full locked validator (`ds.validate` with `full: true`, or
`texuli ds validate <file> --locked`) also emits findings for prototype
components, CSS policy, data-viz completeness, tokens, catalog extensions,
render checks and bounded-input limits. Those findings carry an `area`,
`severity` and `hint`; warning and info findings do not fail the full
verdict unless MCP `strict: true` promotes warnings. The complete full-mode
code/severity table and all exemptions are in
`packages/tools/docs/ds-check.md` in the Texuli repository.

| Code | Means | Fix |
| --- | --- | --- |
| `unknown-key` | A key outside a closed object (also `__proto__`, `constructor`, `prototype`) | Remove the key at the path; the hint lists the allowed keys |
| `invalid-type` | The wrong JSON type | Use the type the path expects |
| `invalid-value` | An enum, pattern, range or length failed; an `extends` nothing resolves; a variant the document does not declare | Fix the value; pass the base in `bases`, or use `texuli:<theme>`; name a declared variant |
| `required` | Missing identity (`id`, `version`, `name`) or `color.brand.seed` | Add it |
| `format-version` | `formatVersion` missing, not an integer, or newer than this Texuli | Use `1` |
| `extends-range` | `extends` or `ref` looks like a range (`^1.0.0`, `acme@2`) | An exact `id@x.y.z`, or `texuli:<theme>` |
| `extends-cycle` | The chain comes back to a document already seen | Break the loop |
| `extends-depth` | More than 4 hops of `extends` | Flatten the chain |
| `url-refused` | A remote URL or scheme, `//`, `..`, SVG outside a relative path, a wrong media type, or any `data:` URL from an agent | A same-origin relative path such as `brand/logo.svg` |
| `inline-bytes` | A `data:` URL over its cap (host documents only) | A relative path, or a smaller file |
| `aa-text` | A text pair below the target (4.5:1 AA, 7:1 AAA), or a strong border or input below 3:1, that only pinned colors can fix; from spec 0.11.0 also a product token's on-color at `$.extensions.<name>.on.<mode>` | Remove the pin at the path (or one the hint names) so the solver can move it, or choose a darker or lighter pin; for a product token, drop that mode from `on` so the compiler derives it |
| `aa-focus` | The focus ring below 3:1, or `focusWidth` under 2 | Unpin `ring`, or set `accessibility.focusWidth` to 2 or more |
| `target-size` | A pinned component size below `accessibility.targetMin` | A size step at or above the target, or remove the pin |
| `aa-non-text` | From spec 0.12.0 (`ds.validate`, `texuli ds check`): the sidebar's active fill below 3:1 on the sidebar, at `$.vars.<mode>["--tx-sidebar-primary"]`; the compiled `warnings` name the pinned path (and list `primary` on `background` below 3:1, advisory) | Remove `color.roles.<mode>.sidebarPrimary` so the compiler derives it, or pin a `sidebarPrimary` or `sidebar` that reaches 3:1 |

Importers add `invalid-input` (not JSON or the wrong shape),
`input-limit` (over 1 MiB, 50,000 values or 4096 × 4096 pixels) and, for
`ds.import` from a theme id, `not-found`. `ds.diff` tags each error with
`source: "before"` or `"after"`; `ds.save` adds the write policy's
`outside-working-directory`, `symlink` and `exists`, plus `path-extension`
(the path must end in `.json`) and `path-reserved` (a dot segment such as
`.github/`, a `node_modules` segment or a `package.json` file).

A typical repair takes two or three rounds: the spec's codes come first,
and the guarantee codes (`aa-text`, `aa-focus`, `target-size`, `aa-non-text`) appear once
the document is well formed and compiles.

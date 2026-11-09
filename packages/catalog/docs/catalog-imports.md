# Catalog imports

**Package:** `@texuli/catalog`  
**Tests:** `packages/catalog/tests/catalog-imports.test.ts`

A catalog id lists the public **imports** that belong to it: `{ module, exports }`
for the package subpath and, when the same names are re-exported, the root
barrel. Compound parts (`CardHeader`, `SelectItem`) sit on the parent id
(`card`, `select`). A static checker maps `import { CardHeader } from 'texuli'`
to `card` from the catalog alone.

`manifestData` fills `imports` from `IMPORTS_BY_ID` when a manifest omits the
field. Helpers, types, class functions, engines and kit chrome that are not a
catalog component are listed in `NON_COMPONENT_IMPORTS`. The gate fails when
any export of `texuli/*`, `@texuli/charts/*`, `@texuli/data/*`,
`@texuli/media/*`, `@texuli/chat/*` or `@texuli/blocks/*` has two owners or
none.

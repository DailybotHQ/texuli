## Untrusted sheets

A sheet from an agent, a file or a share link is untrusted data. Use `loadUntrustedSheet` from `@texuli/sheets/model` before any deep work. `validateSheet` and `checkSheetDraft` return diagnostics instead of throwing.

## Catalog and skill

Agents emit a `spreadsheet` catalog node (blueprint spec `0.8.0`). `@texuli/player` paints it through `createSheetPlayerHost`. The Texuli skill covers the package under `skills/texuli/build-ui/SKILL.md`.

Do not invent a hosted runner or an MCP operation that is not in `@texuli/tools`. Formulas stay in the closed language; they never reach the host except `TODAY` and `NOW` through the clock the host passes.

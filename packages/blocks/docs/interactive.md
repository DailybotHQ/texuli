# Interactive blocks

**Package:** `@texuli/blocks`  
**Import:** `import { loadInteractiveFamily, checkInteractiveBlock } from '@texuli/blocks/interactive'`  
**Renderers:** `@texuli/blocks/interactive/renderers`  
**Tests:** `packages/blocks/tests/interactive.test.ts`  
**Example:** `blocks-interactive`

## Types

| Type | Role |
| --- | --- |
| `poll` | Question + options; single or multi vote; local results |
| `quiz` | Questions with `correctId` and optional explanation |
| `calculator` | Named numeric inputs + closed formula AST |
| `checklist` | Toggleable items with progress |

All data is validated through `safeParseBlock` / `checkInteractiveBlock`. Hostile
text (bidi overrides, empty options, unknown formula variables) is rejected.

## Lazy load

```ts
const { default: InteractiveBlockView } = await loadInteractiveFamily();
```

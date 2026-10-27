# Recipe helpers import their CSS

Exported class recipes (`buttonVariants`, `badgeClass`, `fieldVariants`, …)
**side-import** their component stylesheet. Using the recipe on a custom
element or `<a>` without mounting the Svelte component still gets the chrome.

```ts
import { buttonVariants } from 'texuli/button';
// pulls button.css (package.json sideEffects: ['**/*.css'])

const className = buttonVariants({ variant: 'outline', size: 'sm' });
```

Gate: `pnpm vitest run packages/texuli/tests/contracts.test.ts`

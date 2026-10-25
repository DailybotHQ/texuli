# Texel: focus scope and trap

**Package:** `@texuli/core` · **Path:** `src/focus-scope/` · **Task:** T-core-focus-scope

`createFocusScope` owns keyboard focus behavior for a mounted container. It is
framework-free, imports no DOM framework, and does not access a document at
module load. It builds on the package's owned tabbable query.

## API

```ts
import { createFocusScope } from '@texuli/core';

const scope = createFocusScope(dialogElement, {
  initialFocus: () => dialogElement.querySelector<HTMLElement>('[data-autofocus]'),
  onBeforeRestoreFocus(event) {
    if (shouldKeepFocusInDialog()) event.preventDefault();
  },
});

scope.activate();
// when the dialog closes:
scope.deactivate();
```

Options:

| Option | Behavior |
| --- | --- |
| `initialFocus` | Optional element or getter. A focusable element inside the scope takes precedence. |
| `onBeforeRestoreFocus` | Runs before focus returns to the element active at activation; `preventDefault()` cancels restoration. |

Initial focus follows this order: valid explicit target, first focusable
`[autofocus]` descendant, first tabbable descendant in sequential Tab order,
then the container. The container receives a temporary `tabindex="-1"` only
when needed for fallback focus, and that temporary attribute is removed
immediately.

Tab and Shift+Tab are trapped at the two ends of the current tabbable list.
The list is queried again for every key event, so changes to disabled,
hidden, inert and inserted controls are reflected. With no tabbable
descendants, Tab is prevented and focus remains on the container.

Scopes are ordered per owner document. Only the most recently activated scope
handles Tab. Deactivating a nested scope restores focus to its opener inside
the parent; deactivating the parent then restores focus to its own opener.
Activation and deactivation are idempotent. Create the scope after the
container has an owner document, activate it when mounted, and deactivate it
when it closes or unmounts.

## Testing

```bash
pnpm vitest run packages/core/tests/focus-scope.test.ts
```

Tests cover initial-focus precedence, Tab wrapping in both directions,
empty scopes, nested scopes, preventable focus restoration, and reactivation.

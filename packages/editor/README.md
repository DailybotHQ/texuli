# @texuli/editor

Rich text editor surface built on the `@texuli/core` editor texels:
the closed document model, pure transforms, snapshot history, keyboard
map and the Markdown codec, bound to an owned, sink-free Svelte 5
rendering (no `{@html}`, no `innerHTML`, links through the URL policy).

**Status: in development — skeleton only.** This package is private and
excluded from packing until its own release; nothing here is published.
The architecture contract is
[ADR-003](../../docs/DECISIONS.md) and
[EDITOR_ARCHITECTURE](../../docs/EDITOR_ARCHITECTURE.md); the core texels
live in [`@texuli/core`](../core) (editor subpaths).

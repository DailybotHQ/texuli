## Status

Slides is **in development**. `@texuli/slides` and `@texuli/deck` are on npm as `0.17.1`. Under 0.x a new minor may break. Native rendering is planned, not built.

## Not built

- A presenter screen on another device
- A server-side PDF or image renderer
- Deck video export
- Inline `$…$` math inside text blocks
- A hosted editor or deck storage (the host keeps the data)

Model v1 decks still parse; `migrateDeck` and the stage migrate them. `@texuli/slides@0.3.0` is the previous stage. The upgrade path is in the package migration guide.

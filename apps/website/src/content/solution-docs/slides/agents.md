## Untrusted decks

A deck from an agent, a paste or a share link is untrusted data. Use `loadUntrustedDeck` from `@texuli/deck/model` before any deep work. `DeckStage` validates at the `untrusted` tier by default, so an agent-written deck is safe to pass as data. There is no HTML sink: the stage paints the model.

## Markdown and JSON

Agents can emit JSON (`formatVersion: 2`) or the closed Markdown dialect. `parseDeck` and `parseDeckMarkdown` return diagnostics instead of throwing. Hostile HTML in Markdown is refused.

The catalog can describe slide-renderable components; the stage loads only those renderers. Do not invent APIs or a hosted generation service. The live generation page on this site is a recorded replay, not a deployed agent.

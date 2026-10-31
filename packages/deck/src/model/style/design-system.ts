/**
 * The design system a deck follows (ADR-024, the 0.10.0 design-system
 * wave): `designSystem` at the deck's top level, the same shape as a
 * blueprint envelope's `designSystem` (`$defs.designSystemReference` in
 * `@texuli/spec`) and a document's:
 *
 * - `{ ref: "acme@2.1.0" }`: an exact `id@x.y.z` the host resolves, or
 *   `texuli:<theme>` (a library theme);
 * - `{ inline: { format: "texuli/design-system", … } }`: a whole document.
 *
 * This L0 module checks the shape only: exactly one of `ref` and `inline`,
 * the `ref` grammar (never a range, a URL or a path) and bounded,
 * single-line JSON for `inline`. The design-system rules themselves (AA
 * contrast, URL tiers, the closed vocabulary) run where it is compiled: the
 * slides stage (`designSystems` on `DeckStage`) validates and compiles the
 * document with `@texuli/tokens` before it applies it, and a host may run
 * `checkDesignSystemReference` from `@texuli/spec` ahead of time.
 *
 * `designSystem` and `style.theme` combine: the theme paints first, and the
 * design system's tokens apply over it on the stage root.
 */
import { type Infer, t } from '../../schema/index.ts';

/**
 * The `ref` grammar: `texuli:<theme>` or an exact `id@x.y.z` (an optional
 * prerelease), the same as the blueprint's `$defs.designSystemReference.ref`
 * (`tests/model-design-system.test.ts` compares them).
 */
export const DECK_DESIGN_SYSTEM_REF_PATTERN =
  '^(?:texuli:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][a-z0-9]*(?:-[a-z0-9]+)*@(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?)$';

/** Bounds for an inline document (the blueprint and document caps). */
export const DECK_DESIGN_SYSTEM_LIMITS = Object.freeze({
  refLength: 200,
  depth: 16,
  maxKeys: 200,
  maxItems: 64,
  maxString: 360_000,
});

export const DESIGN_SYSTEM_CODES = Object.freeze({
  designSystem: 'design-system',
} as const);

const L = DECK_DESIGN_SYSTEM_LIMITS;

const inlineDocument = t.refine(
  t.json({
    depth: L.depth,
    maxKeys: L.maxKeys,
    maxItems: L.maxItems,
    maxString: L.maxString,
    text: 'line',
  }),
  {
    code: DESIGN_SYSTEM_CODES.designSystem,
    check(value, context) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        context.issue({ message: 'An inline design system is an object.' });
      }
    },
  }
);

/** `designSystem`: exactly one of `ref` and `inline`. */
export const deckDesignSystem = t.refine(
  t.object({
    ref: t.optional(
      t.string({ min: 1, max: L.refLength, pattern: DECK_DESIGN_SYSTEM_REF_PATTERN })
    ),
    inline: t.optional(inlineDocument),
  }),
  {
    code: DESIGN_SYSTEM_CODES.designSystem,
    description:
      'The design system: exactly one of ref (id@x.y.z or texuli:<theme>) and inline (a document).',
    check(value, context) {
      if ((value.ref === undefined) === (value.inline === undefined)) {
        context.issue({ message: 'Set exactly one of ref and inline.' });
      }
    },
  }
);
export type DeckDesignSystem = Infer<typeof deckDesignSystem>;

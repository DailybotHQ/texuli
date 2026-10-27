/**
 * The /native/ why-KMP section's copy, citations and code excerpts (T-46,
 * narrative blueprint §5 "Native landing" s2). Kept out of the .astro so the
 * unit test can pin every claim against the file it is cited from: the guide
 * (`/guides/why-svelte-kotlin/`), `native/README.md` and the Kotlin sources.
 *
 * The rule the module enforces on itself: a claim's `sources` phrases appear
 * word for word in both the cited repository file and in this module's copy.
 * Nothing here is invented; the status stays "in development, conformance-
 * tested, not published" — the honesty placement the blueprint requires.
 */

export interface CitedPhrase {
  /** Repository-relative path of the cited file. */
  file: string;
  /** The exact phrase (whitespace-normalized) the file and the copy share. */
  phrase: string;
}

/** A piece of section copy plus the sources every phrase of it rests on. */
export interface WhyKmpPiece {
  text: string;
  sources: CitedPhrase[];
}

/** One "why Kotlin" claim: a bolded title, the body, and its citations. */
export interface WhyKmpClaim {
  title: string;
  body: string;
  sources: CitedPhrase[];
}

/** One pipeline step; `code` is the optional leading code name. */
export interface WhyKmpStep {
  code?: string;
  rest: string;
  sources: CitedPhrase[];
}

/** A verbatim repository excerpt shown in the section. */
export interface WhyKmpExcerpt {
  /** Repository-relative path, shown as the citation. */
  file: string;
  label: string;
  code: string;
}

const GUIDE = 'apps/website/src/pages/guides/why-svelte-kotlin/index.astro';
const NATIVE_README = 'native/README.md';
const THEME_SOURCE =
  'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/TexuliTheme.kt';
const BLUEPRINT_VIEW =
  'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/BlueprintView.kt';
const REGISTRY = 'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/Registry.kt';

/** Depth link: the full technical argument, in the guide. */
export const WHY_KMP_GUIDE_HREF = '/guides/why-svelte-kotlin/';
/** Cross-link: the architecture page that owns the spec-seam story. */
export const WHY_KMP_ARCHITECTURE_HREF = '/web-and-native/';

/** Section lede: what exists, what is being built, and the framing sentence the guide uses. */
export const WHY_KMP_LEDE: WhyKmpPiece = {
  text: 'The web runtime ships today with Svelte 5. The native renderer is in development, and its foundation is a deliberate choice: Android applications, Compose surfaces, iOS sharing and desktop tooling live in a world where a JavaScript bundle is the guest, not the host.',
  sources: [
    {
      file: GUIDE,
      phrase:
        'Android applications, Compose surfaces, iOS sharing and desktop tooling live in a world where a JavaScript bundle is the guest, not the host',
    },
  ],
};

/** The "why" column: the guide's argument, customer-voiced, claim by claim. */
export const WHY_KMP_CLAIMS: WhyKmpClaim[] = [
  {
    title: 'One language across the native side',
    body: 'Shared data models, validation and catalog logic compile once per platform instead of being re-written per target.',
    sources: [
      {
        file: GUIDE,
        phrase:
          'Shared data models, validation and catalog logic compile once per platform instead of being re-written per target',
      },
    ],
  },
  {
    title: 'Compose paints the interface',
    body: 'The renderer paints with Compose Multiplatform, the declarative toolkit the catalog ladder maps onto directly. Compose for the web is not a target, because the web stays Svelte.',
    sources: [
      {
        file: NATIVE_README,
        phrase: 'the web is not a target, because the web stays Svelte',
      },
    ],
  },
  {
    title: 'First-class tooling',
    body: 'Static typing, multiplatform libraries and IDE support keep the native half held to the same bar as the web half.',
    sources: [
      {
        file: GUIDE,
        phrase:
          'Static typing, multiplatform libraries and IDE support keep the native half held to the same bar as the web half',
      },
    ],
  },
  {
    title: 'It consumes the contract, not the web code',
    body: 'Kotlin never imports Svelte packages; it reads the generated spec. The layer graph stays one-directional.',
    sources: [
      { file: GUIDE, phrase: 'Kotlin never imports Svelte packages' },
      { file: GUIDE, phrase: 'The layer graph stays one-directional' },
    ],
  },
];

/** The "how" column intro: the seam and the one native pipeline. */
export const WHY_KMP_HOW_INTRO: WhyKmpPiece = {
  text: "The seam between the runtimes is the catalog contract: every Texuli component's props, kinds, enums and tiers are declared once in the manifests, generated for TypeScript and Kotlin. On the native side, one pipeline turns a blueprint into painted UI:",
  sources: [
    {
      file: GUIDE,
      phrase:
        "every Texuli component's props, kinds, enums and tiers are declared once in the manifests",
    },
  ],
};

/** The render pipeline, step for step from the native README (design §4). */
export const WHY_KMP_STEPS: WhyKmpStep[] = [
  {
    code: 'loadBlueprint',
    rest: 'parses and decodes the blueprint into the generated models.',
    sources: [
      {
        file: NATIVE_README,
        phrase: 'loadBlueprint parses and decodes the blueprint into the generated models',
      },
    ],
  },
  {
    rest: 'It validates against the spec vocabulary. Invalid structure is refused, never repaired.',
    sources: [{ file: NATIVE_README, phrase: 'Invalid structure is refused, never repaired' }],
  },
  {
    rest: 'It normalizes the result to a render plan: extension props are dropped, and unknown ids become visible placeholders.',
    sources: [
      {
        file: NATIVE_README,
        phrase:
          'It normalizes the result to a render plan: extension props are dropped, and unknown ids become visible placeholders',
      },
    ],
  },
  {
    code: 'BlueprintView',
    rest: 'paints the plan under TexuliTheme and reports intents to the host.',
    sources: [
      {
        file: NATIVE_README,
        phrase: 'paints the plan under TexuliTheme and reports intents to the host',
      },
    ],
  },
];

/** The token-engine note: what the native theme is today, stated honestly. */
export const WHY_KMP_TOKEN_NOTE: WhyKmpPiece = {
  text: "The theme story is honest too: TexuliTheme is a minimal token theme until texuli-tokens is generated from the spec's token roles (design §3). The values mirror the default Texuli theme's neutral roles, while the engine behind the web's --tx-* contract remains the implemented one.",
  sources: [
    {
      file: THEME_SOURCE,
      phrase:
        "minimal token theme until texuli-tokens is generated from the spec's token roles (design §3)",
    },
    {
      file: THEME_SOURCE,
      phrase: "The values mirror the default Texuli theme's neutral roles",
    },
  ],
};

/** The status line: in development, conformance-tested here, not published. */
export const WHY_KMP_STATUS: WhyKmpPiece = {
  text: 'In development. The renderer is conformance-tested inside this repository — GoldenConformanceTest loads each golden with loadBlueprint, traces the plan, and must equal the web trace. Nothing is published to Maven Central yet: both modules carry their planned coordinates and are consumed in place (ADR-005).',
  sources: [
    {
      file: NATIVE_README,
      phrase:
        'GoldenConformanceTest loads each golden with loadBlueprint, traces the plan, and must equal the web trace',
    },
    {
      file: NATIVE_README,
      phrase:
        'Nothing is published to Maven Central yet: both modules carry their planned coordinates',
    },
  ],
};

/** Verbatim Kotlin, quoted with its repository path — the proof the section shows. */
export const WHY_KMP_EXCERPTS: WhyKmpExcerpt[] = [
  {
    file: BLUEPRINT_VIEW,
    label: "The renderer's entry point, quoted verbatim",
    code: `/**
 * Paint a validated render plan (design §4, step 5). Each id resolves through
 * [NativeRegistry]; anything else paints a visible placeholder. Text is shown
 * as text: nothing in a blueprint is executed or interpreted as markup.
 */
@Composable
fun BlueprintView(plan: List<PlanNode>, onIntent: (TexuliIntent) -> Unit = {}) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        plan.forEachIndexed { index, node -> PlanNodeView(node, "$index", onIntent) }
    }
}`,
  },
  {
    file: REGISTRY,
    label: 'The honest coverage registry, quoted verbatim',
    code: `/**
 * The native side of the translation dictionary (design §5): catalog id to
 * native binding. Coverage is reported per id; an id without a binding paints
 * a visible placeholder. A binding never promotes an id to portable core:
 * that needs the audit and passing cross-target conformance.
 */
enum class BindingStatus { IMPLEMENTED, PLACEHOLDER }`,
  },
];

/**
 * /web-and-native/ — the layer-graph and texel-ladder data (PLAN_006 T-49).
 *
 * Single source for both diagram components (`LayerGraph.astro` and
 * `TexelLadder.astro`) and their unit tests. The layer list, package roles
 * and workspace-dependency edges are transcribed from the layer table in
 * `docs/ARCHITECTURE.md` (the source of truth); the unit test re-parses that
 * table and fails on any drift, and cross-checks every package's layer
 * number against `LAYERS` in `scripts/check-layers.ts`, so this module can
 * only say what the repository declares and enforces.
 */

/** A workspace package on a layer, with the lower layers it may depend on. */
export interface LayerPackage {
  /** Package name as declared in its manifest. */
  readonly name: string;
  /** What the package holds — the architecture doc's words for this row. */
  readonly role: string;
  /** Workspace dependencies, spelled as the doc's dependency column spells them. */
  readonly dependsOn: readonly string[];
}

/** One floor of the layer graph, lowest (L0) first. */
export interface ArchLayer {
  /** Layer number, 0–8. */
  readonly level: number;
  /** Label as the doc prints it, for example `L0`. */
  readonly label: string;
  readonly packages: readonly LayerPackage[];
}

/**
 * The layer graph, transcribed from `docs/ARCHITECTURE.md` ("The layer
 * graph"): L0 at the bottom, L8 at the top, dependencies point down only.
 * Each `role` is the doc's "What it holds" cell (backticks stripped, since
 * the site renders it as plain text).
 */
export const ARCH_LAYERS: readonly ArchLayer[] = [
  {
    level: 0,
    label: 'L0',
    packages: [
      {
        name: '@texuli/core',
        role: 'Texels: ids, keyboard intents, roving focus and typeahead, focus scope, inert, dismissable layers, layer stack, overlay engine, portal, positioning (math + DOM), presence, scroll lock, tabbable, form bridge, announcer, direction and locale, the URL policy',
        dependsOn: [],
      },
      {
        name: '@texuli/spec',
        role: 'Framework-free blueprint contract and code generation',
        dependsOn: [],
      },
    ],
  },
  {
    level: 1,
    label: 'L1',
    packages: [
      {
        name: '@texuli/primitives',
        role: '41 owned headless primitives, one subpath each (accordion … tree), held to the WAI-ARIA APG patterns',
        dependsOn: ['core'],
      },
    ],
  },
  {
    level: 2,
    label: 'L2',
    packages: [
      {
        name: '@texuli/tokens',
        role: 'The OKLCH theme engine, the --tx-* token contract, 200+ themes, compiled CSS, forced colors, the AA gate, the Tailwind preset',
        dependsOn: [],
      },
    ],
  },
  {
    level: 3,
    label: 'L3',
    packages: [
      {
        name: 'texuli',
        role: 'Styled components (Button … Tree), the class helpers (cx, variants), icons, layouts and app shells',
        dependsOn: ['core', 'primitives', 'tokens'],
      },
    ],
  },
  {
    level: 4,
    label: 'L4',
    packages: [
      {
        name: '@texuli/charts',
        role: 'Chart math and every chart family, one lazy subpath per family',
        dependsOn: ['core', 'primitives', 'tokens', 'texuli'],
      },
      {
        name: '@texuli/data',
        role: 'Data views: grid (core, columns, editing, virtual), tree, board, calendar, timeline, map, activity, files, virtual list',
        dependsOn: ['core', 'primitives', 'tokens', 'texuli'],
      },
      {
        name: '@texuli/media',
        role: 'Image, gallery, video, audio, captions, image editor, compositions, animation, export',
        dependsOn: ['core', 'primitives', 'tokens', 'texuli'],
      },
      {
        name: '@texuli/chat',
        role: 'Thread, message list, composer, typing indicator',
        dependsOn: ['core', 'primitives', 'tokens', 'texuli'],
      },
      {
        name: '@texuli/editor',
        role: 'Rich text editor surface, toolbar, link dialog, headless controller, clipboard import',
        dependsOn: ['core', 'primitives', 'tokens', 'texuli'],
      },
    ],
  },
  {
    level: 5,
    label: 'L5',
    packages: [
      {
        name: '@texuli/blocks',
        role: 'Content blocks (text, code, data, diagram, embed, interactive, map, media, structure): closed vocabulary, untrusted guard, formula AST',
        dependsOn: ['core', 'tokens', 'texuli', 'charts', 'data', 'media'],
      },
    ],
  },
  {
    level: 6,
    label: 'L6',
    packages: [
      {
        name: '@texuli/catalog',
        role: 'The agent catalog (manifests per group, build) and the renderer with no HTML sinks',
        dependsOn: ['core', 'texuli', 'charts', 'data', 'blocks', 'media'],
      },
    ],
  },
  {
    level: 7,
    label: 'L7',
    packages: [
      {
        name: '@texuli/slides',
        role: 'Slide model, grammar, export and stage runtime',
        dependsOn: ['blocks', 'catalog', 'media', 'tokens'],
      },
      {
        name: '@texuli/player',
        role: 'Blueprint player runtime and styles',
        dependsOn: ['blocks', 'catalog', 'charts', 'media'],
      },
    ],
  },
  {
    level: 8,
    label: 'L8',
    packages: [
      {
        name: '@texuli/tools',
        role: 'Copy-in CLI (texuli-add, texuli-init, texuli-update), texuli-llms, A2UI adapter, custom elements and the golden set',
        dependsOn: ['core', 'tokens', 'catalog', 'blocks', 'charts', 'media'],
      },
      {
        name: '@texuli/astro',
        role: 'Astro integration, site helpers and content layouts',
        dependsOn: ['blocks', 'core', 'tokens'],
      },
    ],
  },
];

/** The same layers, top floor first — the order the diagram bands render in. */
export const ARCH_LAYERS_DESCENDING: readonly ArchLayer[] = [...ARCH_LAYERS].reverse();

/** `@texuli/core` → `core`; `texuli` stays `texuli` — the doc's spelling. */
export function shortName(name: string): string {
  return name.startsWith('@texuli/') ? name.slice('@texuli/'.length) : name;
}

/** Human line for a band's dependency note: "none" or the doc's short names. */
export function dependencySummary(layer: ArchLayer): string {
  const unique = [...new Set(layer.packages.flatMap((pkg) => pkg.dependsOn))];
  return unique.length > 0 ? `depends on ${unique.join(', ')}` : 'no workspace dependencies';
}

/** A deduplicated, layer-level edge list derived from the package rows. */
export interface LayerEdge {
  readonly from: number;
  readonly to: number;
}

export const LAYER_EDGES: readonly LayerEdge[] = (() => {
  const layerOf = new Map<string, number>();
  for (const layer of ARCH_LAYERS) {
    for (const pkg of layer.packages) layerOf.set(pkg.name, layer.level);
  }
  const seen = new Set<string>();
  const edges: LayerEdge[] = [];
  for (const layer of ARCH_LAYERS) {
    for (const pkg of layer.packages) {
      for (const dep of pkg.dependsOn) {
        const target = layerOf.get(dep === 'texuli' ? 'texuli' : `@texuli/${dep}`);
        if (target === undefined) continue;
        const key = `${layer.level}->${target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: layer.level, to: target });
      }
    }
  }
  return edges;
})();

/** A repository file plus the exact phrase the copy shares with it. */
export interface CitedPhrase {
  /** Repository-relative path of the cited file. */
  readonly file: string;
  /** The exact phrase (whitespace-normalized) the file and the copy share. */
  readonly phrase: string;
}

/** The texel composition ladder: three rungs, the grammar on both runtimes. */
export interface LadderStage {
  readonly name: string;
  readonly role: string;
  /** The package the rung lives in. */
  readonly home: string;
  /** The layer label of `home`, tying the ladder back to the graph. */
  readonly layer: string;
  readonly runtimes: {
    readonly web: { readonly text: string; readonly sources: readonly CitedPhrase[] };
    readonly native: { readonly text: string; readonly sources: readonly CitedPhrase[] };
  };
}

const NATIVE_README = 'native/README.md';
const SEMANTICS = 'native/conformance/semantics.json';
const GUIDE = 'apps/website/src/pages/guides/why-svelte-kotlin/index.astro';

export const LADDER_STAGES: readonly LadderStage[] = [
  {
    name: 'texels',
    role: 'Framework-free behavior and policy: ids, keyboard intents, focus, the overlay engine, positioning, scroll lock and the URL policy — no Svelte, no DOM framework.',
    home: '@texuli/core',
    layer: 'L0',
    runtimes: {
      web: {
        text: 'Runs in the web runtime today, under every component.',
        sources: [],
      },
      native: {
        text: 'Texels do not cross: nothing in the native renderer ports @texuli/core. What both sides share is the semantic trace — the web trace and the native trace apply these rules to a validated render tree.',
        sources: [{ file: SEMANTICS, phrase: 'apply these rules to a validated render tree' }],
      },
    },
  },
  {
    name: 'primitives',
    role: 'Headless parts bound to texels and held to the WAI-ARIA Authoring Practices patterns — 41 owned headless primitives, one subpath each.',
    home: '@texuli/primitives',
    layer: 'L1',
    runtimes: {
      web: {
        text: 'Headless Svelte 5 parts; composition is left to the caller.',
        sources: [],
      },
      native: {
        text: 'No direct port: Kotlin never imports Svelte packages, so the contract carries the parts’ semantics instead.',
        sources: [{ file: GUIDE, phrase: 'Kotlin never imports Svelte packages' }],
      },
    },
  },
  {
    name: 'components',
    role: 'Styled components, icons, layouts and app shells on the OKLCH theme engine — the rung visitors actually see.',
    home: 'texuli',
    layer: 'L3',
    runtimes: {
      web: {
        text: 'Ships: styled components are published on npm as 0.1.0-next.3.',
        sources: [],
      },
      native: {
        text: 'The Compose renderer (Status: in development) paints a documented slice; app-shell layouts and other chart families remain visible placeholders.',
        sources: [
          { file: NATIVE_README, phrase: 'Status: in development' },
          { file: NATIVE_README, phrase: 'remain visible placeholders' },
        ],
      },
    },
  },
];

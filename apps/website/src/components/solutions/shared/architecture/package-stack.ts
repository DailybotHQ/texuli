/**
 * The layer and the direct Texuli dependencies of every package a Solution can draw in
 * its "Built from Texuli" diagram. Layers follow docs/ARCHITECTURE.md (L0 … L9, pointing
 * down only); dependencies are the `@texuli/*` and `texuli` entries of each
 * `packages/<dir>/package.json` (`dependencies` plus `peerDependencies`).
 * `tests/solutions/block-architecture.test.ts` checks both against those files.
 */
export interface StackPackage {
  readonly layer: number;
  /** One short phrase for the diagram. */
  readonly label: string;
  readonly dependsOn: readonly string[];
}

export const PACKAGE_STACK: Readonly<Record<string, StackPackage>> = {
  '@texuli/core': { layer: 0, label: 'Texels and the URL policy', dependsOn: [] },
  '@texuli/date': { layer: 0, label: 'Date arithmetic', dependsOn: [] },
  '@texuli/deck': { layer: 0, label: 'Deck model and engine', dependsOn: [] },
  '@texuli/drag': { layer: 0, label: 'Drag engine', dependsOn: [] },
  '@texuli/spec': { layer: 0, label: 'Blueprint contract', dependsOn: [] },
  '@texuli/primitives': {
    layer: 1,
    label: 'Headless primitives',
    dependsOn: ['@texuli/core', '@texuli/date', '@texuli/drag'],
  },
  '@texuli/document': {
    layer: 1,
    label: 'Document engine',
    dependsOn: ['@texuli/core', '@texuli/deck'],
  },
  '@texuli/tokens': { layer: 2, label: 'Theme tokens', dependsOn: ['@texuli/spec'] },
  texuli: {
    layer: 3,
    label: 'Styled components',
    dependsOn: ['@texuli/core', '@texuli/primitives', '@texuli/tokens', '@texuli/spec'],
  },
  '@texuli/charts': {
    layer: 4,
    label: 'Charts',
    dependsOn: ['@texuli/core', '@texuli/primitives', '@texuli/tokens', 'texuli'],
  },
  '@texuli/data': {
    layer: 4,
    label: 'Data views',
    dependsOn: ['@texuli/core', '@texuli/drag', '@texuli/primitives', '@texuli/tokens', 'texuli'],
  },
  '@texuli/media': {
    layer: 4,
    label: 'Media',
    dependsOn: ['@texuli/core', '@texuli/primitives', '@texuli/tokens', 'texuli'],
  },
  '@texuli/editor': {
    layer: 4,
    label: 'Rich text editor',
    dependsOn: ['@texuli/core', '@texuli/primitives', '@texuli/tokens', 'texuli'],
  },
  '@texuli/workflows': {
    layer: 4,
    label: 'Workflow graphs',
    dependsOn: ['@texuli/core', '@texuli/drag', '@texuli/primitives', '@texuli/tokens', 'texuli'],
  },
  '@texuli/canvas': {
    layer: 4,
    label: 'Infinite canvas',
    dependsOn: ['@texuli/core', '@texuli/deck', '@texuli/document', '@texuli/drag', 'texuli'],
  },
  '@texuli/blocks': {
    layer: 5,
    label: 'Content blocks',
    dependsOn: [
      '@texuli/core',
      '@texuli/tokens',
      'texuli',
      '@texuli/charts',
      '@texuli/data',
      '@texuli/media',
    ],
  },
  '@texuli/sheets': {
    layer: 5,
    label: 'Spreadsheets',
    dependsOn: ['@texuli/core', '@texuli/date', '@texuli/data', 'texuli'],
  },
  '@texuli/catalog': {
    layer: 6,
    label: 'Agent catalog',
    dependsOn: [
      '@texuli/core',
      '@texuli/spec',
      'texuli',
      '@texuli/charts',
      '@texuli/data',
      '@texuli/blocks',
      '@texuli/media',
    ],
  },
  '@texuli/player': {
    layer: 7,
    label: 'Blueprint player',
    dependsOn: [
      '@texuli/blocks',
      '@texuli/catalog',
      '@texuli/charts',
      '@texuli/chat',
      '@texuli/core',
      '@texuli/data',
      '@texuli/media',
      '@texuli/primitives',
      '@texuli/spec',
      'texuli',
      '@texuli/workflows',
    ],
  },
  '@texuli/slides': {
    layer: 8,
    label: 'Presentation stage',
    dependsOn: [
      '@texuli/blocks',
      '@texuli/catalog',
      '@texuli/core',
      '@texuli/deck',
      '@texuli/media',
      '@texuli/player',
      '@texuli/tokens',
    ],
  },
  '@texuli/pages': {
    layer: 8,
    label: 'Document editor and reader',
    dependsOn: [
      '@texuli/blocks',
      '@texuli/core',
      '@texuli/document',
      '@texuli/drag',
      '@texuli/editor',
      '@texuli/player',
      '@texuli/primitives',
      '@texuli/tokens',
      'texuli',
    ],
  },
};

import type { SolutionEntry } from '../schema.ts';

/** Design systems: one closed brand document, compiled and applied across Texuli. */
export const designSystems: SolutionEntry = {
  slug: 'design-systems',
  name: 'Design systems',
  status: 'available',
  tagline: 'Carry one brand document across Texuli surfaces.',
  summary:
    'Author, validate, compile, apply and distribute a closed design-system document, with color, typography, shape, spacing, motion and component rules governed by the same contract.',
  route: '/solutions/design-systems/',
  docs: '/guides/solutions/design-systems/',
  packages: [
    {
      name: '@texuli/spec',
      subpaths: ['./design-system'],
      role: 'The design-system document, schemas and validation contract',
    },
    {
      name: '@texuli/tokens',
      subpaths: [
        './design-system/compile',
        './design-system/generate',
        './design-system/import',
        './design-system/apply',
        './design-system/emit',
      ],
      role: 'Compile, generate, import, apply and emit design-system documents',
    },
    {
      name: 'texuli',
      subpaths: ['./design-system', './ds-kit'],
      role: 'Svelte provider and the Ledgerline design-system kit',
    },
    {
      name: '@texuli/tools',
      subpaths: ['.'],
      role: 'The texuli ds command-line tools',
    },
  ],
  capabilities: [
    {
      id: 'brand-document',
      title: 'One brand document',
      summary: 'Describe the brand in a closed, validated JSON document.',
      status: 'available',
    },
    {
      id: 'compile-and-apply',
      title: 'Compile and apply',
      summary: 'Compile design tokens and scope them to a provider or host element.',
      status: 'available',
    },
    {
      id: 'import-and-generate',
      title: 'Import and generate',
      summary: 'Import supported token sources or generate a draft with a loss report.',
      status: 'available',
    },
    {
      id: 'locked-allow',
      title: 'Govern components',
      summary: 'Declare which catalog components and axes a locked system allows.',
      status: 'available',
    },
  ],
  platforms: [
    { platform: 'web', status: 'available', evidence: [] },
    {
      platform: 'compose-desktop',
      status: 'in development',
      evidence: [
        'native/docs/parity.json',
        'native/texuli-spec/src/commonMain/kotlin/com/texuli/spec/tokens/DesignTokens.kt',
        'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/DesignSystemFixtureTest.kt',
        'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/DesignTokensConformanceTest.kt',
      ],
    },
    { platform: 'android', status: 'planned', evidence: [] },
    { platform: 'ios', status: 'planned', evidence: [] },
  ],
  demo: {
    id: 'design-systems',
    title: 'Ledgerline reference kit',
    scenarios: ['ledgerline'],
    limits: [
      'The reference hub shows static example brand surfaces; this landing placeholder does not offer interactive generation.',
    ],
  },
  art: { hero: { slot: 'solution-design-systems-hero', variant: 'plate' } },
  limits: [
    'The design-system document and compiler are available in the 0.16.1 line, which is pre-1.0.',
    'Compose Desktop decodes documents and uses token sets compiled on the web side; it does not compile arbitrary brand documents in Kotlin yet.',
    'Android and iOS targets are planned.',
    'Generation produces a draft that needs review before approval.',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/design-systems/' },
    { label: 'Design systems reference', href: '/design-systems/' },
    { label: 'Ledgerline kit', href: '/design-systems/kit/' },
    { label: 'Design System Studio', href: '/theme-studio/' },
  ],
};

/**
 * The unified landing's agents + closing CTA section: copy, citations,
 * agent surfaces and the install block (PLAN_006 T-43; narrative blueprint
 * §2 pillar 3, §5 s6 "Agents strip" and s8 "Closing CTA band").
 *
 * Kept out of the .astro so the unit test
 * (`apps/website/tests/section-contracts.test.ts`) can pin every claim against
 * the repository file it cites: a claim's `sources` phrases appear word for
 * word in both the cited file and this module's copy. Every agent surface
 * is a real file or page served by this site, and the install line states
 * the release truth from `docs/RELEASE.md`: 0.9.0 is out (`latest` and
 * `next` both name it), it is pre-1.0, and nothing stable is yet.
 */

/** Repository-relative path of the cited file. */
export interface CitedPhrase {
  file: string;
  /** The exact phrase (whitespace-normalized) the file and the copy share. */
  phrase: string;
}

/** A piece of section copy plus the sources it rests on. */
export interface AgentsPiece {
  text: string;
  sources: CitedPhrase[];
}

/** One step of the agent story. */
export interface AgentsStep {
  title: string;
  body: string;
  sources: CitedPhrase[];
}

/** One served agent surface; an on-site path, developer trust tier. */
export interface AgentsSurface {
  href: string;
  label: string;
  description: string;
}

/** A closing call to action; app-authored site links, developer trust tier. */
export interface AgentsCtaLink {
  href: string;
  label: string;
  role: 'primary' | 'secondary';
}

const README = 'README.md';
const PRODUCT_SPEC = 'docs/PRODUCT_SPEC.md';
const CATALOG_README = 'packages/catalog/README.md';
const SECURITY = 'docs/SECURITY.md';

/** Heading ids: the component wires `aria-labelledby` from these. */
export const WEB_AGENTS_IDS = {
  section: 'web-agents-title',
  story: 'web-agents-story',
  surfaces: 'web-agents-surfaces',
  install: 'web-agents-install',
} as const;

export const WEB_AGENTS_TITLE = 'Built for agents, too';

export const WEB_AGENTS_LEDE: AgentsPiece = {
  text:
    'Agents get a catalog whose output renders through a sink-free renderer, so the same ' +
    'pieces people build with are safe to hand to a machine.',
  sources: [
    {
      file: README,
      phrase: 'Agents get a catalog whose output renders through a sink-free renderer',
    },
  ],
};

/** The agents strip: catalog, safe renderer, any interface. */
export const WEB_AGENTS_STEPS: readonly AgentsStep[] = [
  {
    title: 'A closed catalog',
    body:
      'A closed catalog with authored manifests: every component an agent ' +
      'can name is declared, typed and documented.',
    sources: [{ file: PRODUCT_SPEC, phrase: 'A closed catalog with authored manifests' }],
  },
  {
    title: 'A sink-free renderer',
    body:
      'The sink-free renderer that turns untrusted agent trees into safe render trees never ' +
      'emits markup from data: unknown components become placeholders and links pass the ' +
      'URL policy.',
    sources: [
      {
        file: CATALOG_README,
        phrase: 'sink-free renderer that turns untrusted agent trees into safe render trees',
      },
    ],
  },
  {
    title: 'Any interface',
    body:
      'One tree paints any interface the catalog covers, and the renderer is tested against ' +
      'a hostile corpus of agent output.',
    sources: [{ file: SECURITY, phrase: 'hostile corpus' }],
  },
];

/** The served agent surfaces, each a real file or page on this site. */
export const WEB_AGENTS_SURFACES: readonly AgentsSurface[] = [
  {
    href: '/llms.txt',
    label: 'llms.txt',
    description: 'The site index for language models: what Texuli is and where to read.',
  },
  {
    href: '/llms/components/badge.md',
    label: 'Markdown twins',
    description: 'Component docs as plain Markdown, like this twin of the badge page.',
  },
  {
    href: '/.well-known/ai-catalog.json',
    label: 'AI catalog',
    description: 'A machine-readable list of the agent resources this site serves.',
  },
  {
    href: '/.well-known/mcp/server-card.json',
    label: 'MCP server card',
    description:
      'Describes the read-only Texuli MCP server: local over stdio (npx -y @texuli/mcp) and ' +
      'hosted at https://texuli.com/mcp, both new in 0.9.0.',
  },
  {
    href: '/skill/',
    label: 'Agent skill',
    description: 'The distributable skill that teaches coding agents to build with Texuli.',
  },
];

/** The install block: the real install command and the release truth. */
export const WEB_AGENTS_INSTALL = {
  command: 'pnpm add texuli',
  note:
    'Installs 0.9.0, a pre-1.0 release: under 0.x a new minor may contain breaking ' +
    'changes, so pin the version. 1.0.0 will be the first stable release.',
} as const;

/** Blueprint s8: one platform, two runtimes, start today. */
export const WEB_AGENTS_CLOSING = 'One platform, two runtimes. Start today.';

/** The closing CTA hierarchy: the agents story leads to the playground first. */
export const WEB_AGENTS_CTA_LINKS: readonly AgentsCtaLink[] = [
  { href: '/playground/', label: 'Open the playground', role: 'primary' },
  { href: '/guides/getting-started/', label: 'Start building', role: 'secondary' },
  { href: '/native/', label: 'See the native story', role: 'secondary' },
];

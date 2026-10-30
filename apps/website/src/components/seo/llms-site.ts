/**
 * The whole-site `llms.txt` route map (T-22): sections derived from the site
 * navigation — the same data the sidebar renders — plus one authored,
 * factual line per section. No marketing fluff, no invented features, no
 * volatile counts. The content is formatted by `@texuli/tools/llms`
 * (`formatSiteLlmsTxt`) at generation time; `public/llms.txt` is the
 * committed result and the site-aeo spec proves it has not drifted.
 *
 * This module is data only (loaded outside Vite by the generator script and
 * the spec), so it never imports `constances.ts` — the base URL is always a
 * parameter.
 */

import { COMPONENT_FAMILIES } from '../foundation/nav-data.ts';
import { DOCS_HOME, GET_STARTED, NAV_GROUPS, type NavLink } from '../foundation/site.ts';
import { GUIDES_SECTIONS } from '../guides/nav.ts';

export interface SiteLlmsLink {
  title: string;
  href: string;
  description?: string;
}

export interface SiteLlmsSection {
  name: string;
  description?: string;
  links: readonly SiteLlmsLink[];
}

/** Site-absolute nav links with a title, in the given group's raw order. */
function groupLinks(groupId: string): SiteLlmsLink[] {
  const group = NAV_GROUPS.find((entry) => entry.id === groupId);
  if (!group) throw new Error(`unknown nav group: ${groupId}`);
  return group.links
    .filter((link): link is NavLink & { href: string } => Boolean(link.href))
    .map((link) => ({ title: link.label, href: link.href }));
}

/**
 * The sections for `siteUrl` (origin, no trailing slash). Guides expand to
 * every guide in reading order; components stay at area level (families and
 * landings — the per-component docs live in the `/llms/` catalog bundle,
 * linked in the last section).
 */
export function siteLlmsSections(siteUrl: string): SiteLlmsSection[] {
  const abs = (href: string) => `${siteUrl}${href}`;
  const nav = (groupId: string) =>
    groupLinks(groupId).map((link) => ({ ...link, href: abs(link.href) }));
  const families = COMPONENT_FAMILIES.filter((family): family is typeof family & { href: string } =>
    Boolean(family.href)
  ).map((family) => ({ title: family.label, href: abs(family.href) }));

  return [
    {
      name: 'Start here',
      description: 'What Texuli is and where to begin.',
      links: [
        { title: 'Texuli', href: abs('/'), description: 'The product landing.' },
        {
          title: 'Introduction',
          href: abs(DOCS_HOME),
          description: 'The docs home and reading order.',
        },
        { title: 'Getting started', href: abs(GET_STARTED) },
        {
          title: 'What’s new',
          href: abs('/whats-new/'),
          description:
            'Every package and capability of 0.6.0, 0.7.0 and 0.8.0 (all on npm; 0.8.0 is current), with demos.',
        },
        {
          title: 'Skill',
          href: abs('/skill/'),
          description: 'The distributable agent skill for building with Texuli.',
        },
      ],
    },
    {
      name: 'Platform',
      description: 'The two-runtimes story: the architecture page and the native landing.',
      links: nav('platform'),
    },
    {
      name: 'Guides',
      description: 'Task-first guides, in reading order.',
      links: GUIDES_SECTIONS.flatMap((section) => section.items)
        .filter((item) => item.href !== DOCS_HOME)
        .map((item) => ({ title: item.label, href: abs(item.href) })),
    },
    {
      name: 'Components',
      description:
        'Every styled component with live examples; each page documents props, behavior and accessibility.',
      links: [...nav('components'), ...families],
    },
    {
      name: 'Primitives',
      description:
        'The headless, APG-aligned primitives beneath the styled components; every primitive has its own page.',
      links: nav('primitives'),
    },
    {
      name: 'Themes',
      description: 'The OKLCH theme engine and the interactive theme tools.',
      links: nav('themes'),
    },
    {
      name: 'Agents',
      description:
        'The agent catalog, the sink-free renderer, streaming generation and the agent surfaces.',
      links: nav('agents'),
    },
    {
      name: 'Project',
      description: 'Brand, foundation, evidence, performance and the changelog.',
      links: nav('project'),
    },
    {
      name: 'For agents',
      description: 'Machine-readable documentation served as static files.',
      links: [
        {
          title: 'Catalog llms.txt',
          href: abs('/llms/llms.txt'),
          description: 'The agent-facing component index.',
        },
        {
          title: 'Catalog llms-full.txt',
          href: abs('/llms/llms-full.txt'),
          description: 'Every component doc in one file.',
        },
        {
          title: 'Catalog JSON',
          href: abs('/catalog/catalog.json'),
          description: 'The full catalog manifest as JSON.',
        },
        {
          title: 'OpenAPI description',
          href: abs('/openapi.json'),
          description:
            'OpenAPI 3.1 for the read-only JSON API under /api/v1/ and POST /mcp (in development until 0.9.0).',
        },
        {
          title: 'API index',
          href: abs('/api/v1/index.json'),
          description:
            'Every JSON endpoint with its operationId, the limits and the versioning policy.',
        },
      ],
    },
  ];
}

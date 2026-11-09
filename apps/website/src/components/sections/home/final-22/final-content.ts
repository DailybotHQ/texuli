/**
 * Home 2.2 closing band (storyboard band 9, "Build your next interface."): two paths.
 *
 * - **Integrate a Solution:** the open-source packages on npm, through the Solutions
 *   catalog and the getting-started guide.
 * - **Prototype with Protoyard:** a product built with Texuli, with its own domain. The
 *   status comes from the `PROTOYARD` record (the open-source local version); Protoyard
 *   Cloud is planned and is not offered here.
 *
 * Every internal link is kept only when its page exists; the external product site comes
 * from the record's domain and passes the URL policy in the component.
 */
import { PROTOYARD } from '../../../../data/products/index.ts';
import type { ProductStatus } from '../../../../data/products/schema.ts';
import { siteRouteExists } from '../../../foundation/nav-data.ts';

export type RouteExists = (route: string) => boolean;

export interface FinalLink {
  readonly label: string;
  readonly href: string;
  readonly role: 'primary' | 'secondary' | 'text';
  readonly external?: boolean;
}

export interface FinalPath {
  readonly id: 'integrate' | 'prototype';
  readonly title: string;
  readonly body: string;
  /** Status shown on the path, when it describes a product with a status. */
  readonly status?: Readonly<{ label: string; status: ProductStatus }>;
  readonly links: readonly FinalLink[];
}

const local = PROTOYARD.offerings.find((offering) => offering.id === 'open-source-local');
if (!local) throw new Error('home final: the Protoyard open-source local offering is missing');

export const FINAL_22_COPY = {
  id: 'home-final-22-title',
  title: 'Build your next interface.',
  sub: 'Two ways in: embed a complete system in your own app, or prototype a product first.',
  art: 'home-final',
} as const;

export const FINAL_22_PATHS: readonly FinalPath[] = [
  {
    id: 'integrate',
    title: 'Integrate a Solution',
    body: 'Install the open-source packages from npm and embed slides, documents, workflows, canvases or sheets in your app.',
    links: [
      { label: 'Explore solutions', href: '/solutions/', role: 'primary' },
      { label: 'Start building', href: '/guides/getting-started/', role: 'text' },
    ],
  },
  {
    id: 'prototype',
    title: 'Prototype with Protoyard',
    body: 'Protoyard is a prototyping product built with Texuli: turn a brief into a prototype you can click through, review and export, locally.',
    status: { label: local.label, status: local.status },
    links: [
      {
        label: 'Read the Protoyard story',
        href: `/built-with/${PROTOYARD.id}/`,
        role: 'secondary',
      },
      {
        label: PROTOYARD.domain ?? 'Protoyard',
        href: `https://${PROTOYARD.domain}`,
        role: 'text',
        external: true,
      },
    ],
  },
];

/** The paths with internal links whose page does not exist dropped. */
export function finalPaths(exists: RouteExists = siteRouteExists): FinalPath[] {
  return FINAL_22_PATHS.map((path) => ({
    ...path,
    links: path.links.filter((link) => link.external === true || exists(link.href)),
  }));
}

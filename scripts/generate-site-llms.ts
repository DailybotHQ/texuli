/**
 * Generate the whole-site `public/llms.txt` (T-22): the website's route map
 * (src/components/seo/llms-site.ts) formatted by `@texuli/tools/llms`.
 *
 * The file is committed and served verbatim (zero redirects, the llms.txt
 * convention expects the root); the site-aeo spec proves it has not drifted
 * from these inputs. Regenerate after route or nav changes:
 *
 *     pnpm exec tsx scripts/generate-site-llms.ts
 *
 * Importing the module writes nothing: `SITE_LLMS_CONFIG` and
 * `buildSiteLlmsTxt` are the one source the site-aeo spec compares against.
 */
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteLlmsSections } from '../apps/website/src/components/seo/llms-site.ts';
import { formatSiteLlmsTxt } from '../packages/tools/src/llms/site.ts';
import { toolsLlmsSection } from './agent-surfaces.ts';

export const SITE_URL = 'https://texuli.com';

/** The hand-written head of the site llms.txt; the sections come from the nav. */
export const SITE_LLMS_CONFIG = {
  title: 'Texuli',
  summary:
    'Interfaces from texels. Owned, accessible Svelte 5 components that people and agents can build anything with.',
  intro:
    'Texuli is an open-source (MIT) Svelte 5 component system built from scratch: framework-free texels compose into headless primitives, the token engine styles them, and a closed agent catalog renders agent output with no HTML sinks. A Kotlin Multiplatform renderer for the same interfaces is in development.',
} as const;

/**
 * The llms.txt body the generator writes, for a site origin: the nav
 * sections, then the "Tools" section generated from the operations registry
 * (`scripts/agent-surfaces.ts`; `pnpm check:surfaces` checks it too).
 */
export function buildSiteLlmsTxt(siteUrl: string = SITE_URL): string {
  return formatSiteLlmsTxt({
    ...SITE_LLMS_CONFIG,
    sections: [...siteLlmsSections(siteUrl), toolsLlmsSection(siteUrl)],
  });
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const out = join(import.meta.dirname, '../apps/website/public/llms.txt');
  const body = buildSiteLlmsTxt();
  await writeFile(out, body, 'utf8');
  console.log(`llms.txt written (${body.split('\n').length} lines) -> ${out}`);
}

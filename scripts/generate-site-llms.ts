/**
 * Generate the whole-site `public/llms.txt` (T-22): the website's route map
 * (src/components/seo/llms-site.ts) formatted by `@texuli/tools/llms`.
 *
 * The file is committed and served verbatim (zero redirects, the llms.txt
 * convention expects the root); the site-aeo spec proves it has not drifted
 * from these inputs. Regenerate after route or nav changes:
 *
 *     pnpm exec tsx scripts/generate-site-llms.ts
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { siteLlmsSections } from '../apps/website/src/components/seo/llms-site.ts';
import { formatSiteLlmsTxt } from '../packages/tools/src/llms/site.ts';

const SITE_URL = 'https://texuli.com';
const OUT = join(import.meta.dirname, '../apps/website/public/llms.txt');

const body = formatSiteLlmsTxt({
  title: 'Texuli',
  summary:
    'Interfaces from texels. Owned, accessible Svelte 5 components that people and agents can build anything with.',
  intro:
    'Texuli is an open-source (MIT) Svelte 5 component system built from scratch: framework-free texels compose into headless primitives, the token engine styles them, and a closed agent catalog renders agent output with no HTML sinks. A Kotlin Multiplatform renderer for the same interfaces is in development.',
  sections: siteLlmsSections(SITE_URL),
});

await writeFile(OUT, body, 'utf8');
console.log(`llms.txt written (${body.split('\n').length} lines) -> ${OUT}`);

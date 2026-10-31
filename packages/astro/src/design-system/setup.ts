/**
 * The Node-only half of `texuli({ designSystem })`, loaded by the
 * integration's `astro:config:setup` hook only when the option is set: it
 * writes the generated middleware to Astro's codegen directory, registers
 * it, and adds the style's hash to Astro's CSP when that is on.
 */
import { writeFile } from 'node:fs/promises';
import type { HookParameters } from 'astro';
import {
  designSystemInlineStyle,
  designSystemMiddlewareSource,
  type TexuliAstroDesignSystem,
} from './index.ts';

export async function setupDesignSystem(
  params: Pick<
    HookParameters<'astro:config:setup'>,
    'addMiddleware' | 'createCodegenDir' | 'updateConfig' | 'config'
  >,
  designSystem: TexuliAstroDesignSystem
): Promise<void> {
  const { css, hash } = await designSystemInlineStyle(designSystem);
  const entrypoint = new URL('design-system-style.mjs', params.createCodegenDir());
  await writeFile(entrypoint, designSystemMiddlewareSource(css));
  params.addMiddleware({ order: 'pre', entrypoint });
  const csp = params.config.security?.csp;
  if (csp) {
    const algorithm = csp === true ? 'SHA-256' : csp.algorithm;
    params.updateConfig({ security: { csp: { algorithm, styleDirective: { hashes: [hash] } } } });
  }
}

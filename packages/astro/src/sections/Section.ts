import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

// Astro's compiler resolves this source component when consuming the packed wrapper.
// @ts-expect-error Astro files are handled by Astro rather than TypeScript's resolver.
import SectionSource from './Section.astro';

export default SectionSource as AstroComponentFactory;

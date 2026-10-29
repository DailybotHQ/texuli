/**
 * @texuli/pages/paged: the paged view and print (ADR-011). `PagedView`
 * lays a document out on real pages with `@texuli/document/paged`
 * (measured in the DOM), paints headers and footers, and prints one sheet
 * per page through named `@page` rules, isolated to the mounted view.
 */
export { DEFAULT_PAGED_LABELS, type PagedLabels, resolvePagedLabels } from './labels.ts';
export { ATOMIC_SELECTOR, lineBottoms, measureUnit, splitPoints } from './measure.ts';
export { default as PagedView } from './PagedView.svelte';
export { adoptCustomPage, customPageRule, pageName } from './page-style.ts';

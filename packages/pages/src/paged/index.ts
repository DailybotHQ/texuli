/**
 * @texuli/pages/paged: the paged view and print (ADR-011). `PagedView`
 * lays a document out on real pages with `@texuli/document/paged`
 * (measured in the DOM), paints headers and footers, and prints one sheet
 * per page through named `@page` rules, isolated to the mounted view.
 */
export * from './core.ts';
export { default as PagedView } from './PagedView.svelte';

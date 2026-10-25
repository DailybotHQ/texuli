import Ellipsis from './Ellipsis.svelte';
import NextButton from './NextButton.svelte';
import Page from './Page.svelte';
import PreviousButton from './PreviousButton.svelte';
import Root from './Root.svelte';

export const Pagination = { Root, Page, PreviousButton, NextButton, Ellipsis };

export { getPageCount, getPageTokens, type PageToken } from './pages.ts';
export type {
  PaginationClickEvent,
  PaginationNavigationButtonProps,
  PaginationPageProps,
  PaginationRootProps,
  PaginationSnippetProps,
} from './types.ts';

import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { PageToken } from './pages.ts';

export interface PaginationSnippetProps {
  page: number;
  pageCount: number;
  pages: PageToken[];
  previousLabel: string;
  nextLabel: string;
  getPageLabel(page: number): string;
}

export type PaginationRootProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  page?: number;
  pageCount?: number;
  total?: number;
  pageSize?: number;
  siblings?: number;
  boundaries?: number;
  disabled?: boolean;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  getPageLabel?: (page: number) => string;
  onPageChange?: (page: number) => void;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet<[PaginationSnippetProps]>;
};

export type PaginationPageProps = Omit<HTMLButtonAttributes, 'children' | 'type'> & {
  page: number;
  label?: string;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

export type PaginationNavigationButtonProps = Omit<
  HTMLButtonAttributes,
  'children' | 'type' | 'disabled'
> & {
  disabled?: boolean;
  label?: string;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

export type PaginationClickEvent = Parameters<NonNullable<HTMLButtonAttributes['onclick']>>[0];

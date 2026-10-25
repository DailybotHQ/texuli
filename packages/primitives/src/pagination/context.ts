import { createPrimitiveContext } from '../internal/context.ts';

export interface PaginationContext {
  readonly page: () => number;
  readonly pageCount: () => number;
  readonly disabled: () => boolean;
  goToPage(page: number): void;
}

export const paginationContext = createPrimitiveContext<PaginationContext>('Pagination.Root');

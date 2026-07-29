import { PaginatedResult } from '../interfaces/paginated-result.interface';

export function buildPaginatedResult<T>(
  items: T[],
  totalItems: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
  };
}

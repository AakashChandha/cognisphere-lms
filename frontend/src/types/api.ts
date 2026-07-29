/**
 * Mirrors the backend's global response envelope (see
 * `backend/src/common/interceptors/response.interceptor.ts`). Every API call
 * resolves to this shape, so all typed API functions unwrap `data` from it.
 */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: string[] | null;
  pagination: PaginationMeta | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors: string[] | null;

  constructor(message: string, status: number, errors: string[] | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

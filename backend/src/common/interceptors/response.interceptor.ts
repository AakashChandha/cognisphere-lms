import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '../interfaces/paginated-result.interface';

export interface ApiEnvelope<T> {
  success: true;
  message: string;
  data: T | null;
  errors: null;
  pagination: PaginatedResult<unknown>['meta'] | null;
}

function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    'meta' in value &&
    Array.isArray((value as PaginatedResult<unknown>).items)
  );
}

/**
 * Wraps every successful controller response in the standard envelope so
 * consumers never have to guess the response shape. Controllers can either
 * return raw data, or `{ message, data }` / `PaginatedResult` to customize
 * the message or expose pagination metadata.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((result) => {
        if (isPaginatedResult(result)) {
          return {
            success: true,
            message: 'Request completed successfully',
            data: result.items as unknown as T,
            errors: null,
            pagination: result.meta,
          };
        }

        if (
          result &&
          typeof result === 'object' &&
          'message' in result &&
          'data' in result
        ) {
          const { message, data } = result as { message: string; data: T };
          return { success: true, message, data, errors: null, pagination: null };
        }

        return {
          success: true,
          message: 'Request completed successfully',
          data: result ?? null,
          errors: null,
          pagination: null,
        };
      }),
    );
  }
}

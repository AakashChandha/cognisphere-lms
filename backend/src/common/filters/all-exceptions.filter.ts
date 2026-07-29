import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface NormalizedError {
  status: number;
  message: string;
  errors: string[] | null;
}

/**
 * Single, global exception handler. Guarantees every error response (thrown
 * `HttpException`s, validation failures, Prisma errors, or unexpected bugs)
 * is shaped identically: `{ success, message, data, errors, pagination }`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalized = this.normalize(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${normalized.status}: ${normalized.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${normalized.status}: ${normalized.message}`);
    }

    response.status(normalized.status).json({
      success: false,
      message: normalized.message,
      data: null,
      errors: normalized.errors,
      pagination: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { status, message: payload, errors: null };
      }

      const body = payload as { message?: string | string[]; error?: string };
      const message = Array.isArray(body.message)
        ? (body.error ?? 'Validation failed')
        : (body.message ?? exception.message);
      const errors = Array.isArray(body.message) ? body.message : null;

      return { status, message, errors };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.normalizePrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred. Please try again later.',
      errors: null,
    };
  }

  private normalizePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): NormalizedError {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${(exception.meta?.target as string[])?.join(', ') ?? 'value'} already exists.`,
          errors: null,
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'The requested resource was not found.',
          errors: null,
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'This operation violates a data relationship constraint.',
          errors: null,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred.',
          errors: null,
        };
    }
  }
}

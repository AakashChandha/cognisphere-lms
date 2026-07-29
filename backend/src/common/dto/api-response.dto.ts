import { ApiProperty } from '@nestjs/swagger';

/**
 * Documents the consistent response envelope every endpoint returns. Actual
 * responses are produced by `ResponseInterceptor` / `AllExceptionsFilter`;
 * this class exists purely so Swagger renders an accurate response shape.
 */
export class ApiResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Request completed successfully' })
  message: string;

  @ApiProperty({ nullable: true })
  data: T | null;

  @ApiProperty({ type: [String], nullable: true, example: null })
  errors: string[] | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: { page: 1, pageSize: 10, totalItems: 42, totalPages: 5 },
  })
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  } | null;
}

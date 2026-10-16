import * as Joi from 'joi';

/**
 * Centralized environment validation. The application refuses to boot if any
 * required variable is missing or malformed, surfacing configuration errors
 * immediately instead of failing unpredictably at runtime.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  BACKEND_PORT: Joi.number().default(5000),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().default('*'),

  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_ROOT: Joi.string().default('storage'),
  // Course material includes video, so the default allows 2 GB per file.
  // Uploads are streamed to disk by Multer, never buffered in memory.
  MAX_FILE_SIZE_BYTES: Joi.number().default(2 * 1024 * 1024 * 1024),
  STREAM_URL_TTL_SECONDS: Joi.number().default(3600),

  THROTTLE_TTL_SECONDS: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(120),

  // `{ tlds: { allow: false } }` because local/dev deployments intentionally
  // seed an internal address like `master@cgslms.local`, which Joi's default
  // TLD allow-list would otherwise reject.
  MASTER_SEED_EMAIL: Joi.string().email({ tlds: { allow: false } }).optional(),
  MASTER_SEED_PASSWORD: Joi.string().optional(),
});

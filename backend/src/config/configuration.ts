export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[] | string;
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  storage: {
    driver: 'local' | 's3';
    localRoot: string;
    maxFileSizeBytes: number;
    /** Lifetime of signed stream URLs handed to the browser for inline playback. */
    streamUrlTtlSeconds: number;
  };
  throttle: {
    ttlSeconds: number;
    limit: number;
  };
  masterSeed: {
    email?: string;
    password?: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.BACKEND_PORT ?? 5000),
  corsOrigins:
    process.env.CORS_ORIGINS && process.env.CORS_ORIGINS !== '*'
      ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
      : '*',
  database: {
    url: process.env.DATABASE_URL as string,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER as 'local' | 's3') ?? 'local',
    localRoot: process.env.STORAGE_LOCAL_ROOT ?? 'storage',
    maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES ?? 2 * 1024 * 1024 * 1024),
    streamUrlTtlSeconds: Number(process.env.STREAM_URL_TTL_SECONDS ?? 3600),
  },
  throttle: {
    ttlSeconds: Number(process.env.THROTTLE_TTL_SECONDS ?? 60),
    limit: Number(process.env.THROTTLE_LIMIT ?? 120),
  },
  masterSeed: {
    email: process.env.MASTER_SEED_EMAIL,
    password: process.env.MASTER_SEED_PASSWORD,
  },
});

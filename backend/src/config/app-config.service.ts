import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';

/**
 * Thin typed facade over `ConfigService` so the rest of the codebase never
 * touches raw `process.env` or untyped config keys. This is the single
 * source of truth for configuration access (centralized configuration).
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  get nodeEnv(): string {
    return this.configService.get('nodeEnv', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.configService.get('port', { infer: true });
  }

  get corsOrigins(): string[] | string {
    return this.configService.get('corsOrigins', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.get('database', { infer: true }).url;
  }

  get jwt(): AppConfig['jwt'] {
    return this.configService.get('jwt', { infer: true });
  }

  get storage(): AppConfig['storage'] {
    return this.configService.get('storage', { infer: true });
  }

  get throttle(): AppConfig['throttle'] {
    return this.configService.get('throttle', { infer: true });
  }

  get masterSeed(): AppConfig['masterSeed'] {
    return this.configService.get('masterSeed', { infer: true });
  }
}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LocalStorageService } from './local-storage.service';
import { StreamTokenService } from './stream-token.service';
import { STORAGE_SERVICE } from './storage.interface';

/**
 * Binds the `STORAGE_SERVICE` token to the active driver. Swapping to S3 in
 * the future is a one-line change here (`useClass: S3StorageService`).
 */
@Module({
  // Signs the short-lived stream tokens; the secret is chosen per call.
  imports: [JwtModule.register({})],
  providers: [
    LocalStorageService,
    StreamTokenService,
    {
      provide: STORAGE_SERVICE,
      useExisting: LocalStorageService,
    },
  ],
  exports: [STORAGE_SERVICE, LocalStorageService, StreamTokenService],
})
export class StorageModule {}

import { Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

/**
 * Binds the `STORAGE_SERVICE` token to the active driver. Swapping to S3 in
 * the future is a one-line change here (`useClass: S3StorageService`).
 */
@Module({
  providers: [
    LocalStorageService,
    {
      provide: STORAGE_SERVICE,
      useExisting: LocalStorageService,
    },
  ],
  exports: [STORAGE_SERVICE, LocalStorageService],
})
export class StorageModule {}

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { IStorageService, StoredFileRef, UploadFileInput } from './storage.interface';

/**
 * Local filesystem implementation of `IStorageService`, used for on-prem/VPS
 * deployment today. `storageKey` is a relative path under the configured
 * storage root, e.g. `courses/{courseId}/{uuid}.pdf`.
 */
@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;

  constructor(private readonly config: AppConfigService) {
    this.root = this.config.storage.localRoot;
  }

  async upload(input: UploadFileInput): Promise<StoredFileRef> {
    const folderPath = join(this.root, input.folder);
    await fs.mkdir(folderPath, { recursive: true });

    const fileName = `${randomUUID()}${extname(input.originalName)}`;
    const storageKey = join(input.folder, fileName).split('\\').join('/');
    const absolutePath = join(this.root, storageKey);

    await fs.writeFile(absolutePath, input.buffer);
    this.logger.debug(`Stored file at ${absolutePath}`);

    return { storageKey };
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    // Local files are served through the CourseFiles controller's download
    // endpoint rather than a direct URL. This method exists so callers have
    // a stable interface identical to what the future S3 implementation
    // (pre-signed URLs) will provide.
    return `/api/tutor/files/${encodeURIComponent(storageKey)}/stream`;
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = join(this.root, storageKey);
    await fs.rm(absolutePath, { force: true });
  }

  resolveAbsolutePath(storageKey: string): string {
    return join(this.root, storageKey);
  }
}

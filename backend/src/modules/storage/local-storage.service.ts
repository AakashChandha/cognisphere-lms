import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join, extname, resolve } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { IStorageService, StoredFileRef, UploadFileInput } from './storage.interface';

/**
 * Local filesystem implementation of `IStorageService`, used for the
 * single-instance VPS deployment. `storageKey` is a relative path under the
 * configured storage root, e.g. `courses/{courseId}/{uuid}.mp4`.
 *
 * Uploads arrive already on disk (Multer `diskStorage` writes them to
 * `tempDir`), so storing a file is a rename on the same volume: a 1 GB video
 * never passes through Node's heap.
 */
@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;

  constructor(private readonly config: AppConfigService) {
    // Express `res.sendFile` requires an absolute path. Resolve relative
    // roots (e.g. `storage`) against the process working directory so
    // Docker (`/app/storage`) and local runs both work.
    this.root = resolve(this.config.storage.localRoot);
  }

  /** Directory Multer streams incoming uploads into before they are claimed. */
  get tempDir(): string {
    return join(this.root, 'tmp');
  }

  async upload(input: UploadFileInput): Promise<StoredFileRef> {
    const folderPath = join(this.root, input.folder);
    await fs.mkdir(folderPath, { recursive: true });

    const fileName = `${randomUUID()}${extname(input.originalName)}`;
    const storageKey = join(input.folder, fileName).split('\\').join('/');
    const absolutePath = join(this.root, storageKey);

    try {
      await fs.rename(input.tempPath, absolutePath);
    } catch (error) {
      // `tmp` and the final folder normally share a volume; fall back to a
      // streamed copy if they ever do not (EXDEV).
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await fs.copyFile(input.tempPath, absolutePath);
      await fs.rm(input.tempPath, { force: true });
    }

    this.logger.debug(`Stored file at ${absolutePath}`);
    return { storageKey };
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    // Local files are served through the authenticated file controllers and
    // the signed `/api/files/stream/:id` route rather than a direct URL. This
    // method exists so callers have a stable interface identical to what an
    // S3 implementation (pre-signed URLs) would provide.
    return `/api/tutor/files/${encodeURIComponent(storageKey)}/stream`;
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = join(this.root, storageKey);
    await fs.rm(absolutePath, { force: true });
  }

  /** Remove an upload Multer wrote to `tempDir` that will not be kept. */
  async discardTemp(tempPath: string | undefined): Promise<void> {
    if (!tempPath) return;
    await fs.rm(tempPath, { force: true });
  }

  resolveAbsolutePath(storageKey: string): string {
    return join(this.root, storageKey);
  }
}

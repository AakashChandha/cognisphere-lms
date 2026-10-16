export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StoredFileRef {
  /** Opaque key identifying the file within the storage backend. */
  storageKey: string;
}

export interface UploadFileInput {
  /**
   * Absolute path of the file Multer already streamed to disk. The storage
   * backend takes ownership of it (moves or uploads, then removes it).
   */
  tempPath: string;
  originalName: string;
  mimeType: string;
  /** Logical folder/prefix, e.g. `courses/{courseId}`. */
  folder: string;
}

/**
 * Storage abstraction so the business logic (CourseFiles module) never talks
 * to a concrete backend directly. Today `LocalStorageService` implements
 * this against the local filesystem; swapping to AWS S3 later only requires
 * providing an `S3StorageService` behind this same token - no controller,
 * service or DTO changes required elsewhere in the codebase.
 */
export interface IStorageService {
  upload(input: UploadFileInput): Promise<StoredFileRef>;
  getDownloadUrl(storageKey: string): Promise<string>;
  delete(storageKey: string): Promise<void>;
}

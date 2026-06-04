/**
 * Storage Adapters
 *
 * Abstracted file storage — implement StorageAdapter for S3, GCS, etc.
 * LocalStorageAdapter is the default for development/self-hosted.
 */

import path from "path";
import fs from "fs/promises";

/** Storage adapter interface — implement this for S3, GCS, etc. */
export interface StorageAdapter {
  /** Save a file and return its public URL. filepath is storage-relative. */
  save(filepath: string, buffer: Buffer): Promise<string>;
  /** Delete a file by its storage-relative filepath. */
  delete(filepath: string): Promise<void>;
  /** Get the public URL for a storage-relative filepath. */
  getUrl(filepath: string): string;
}

export class LocalStorageAdapter implements StorageAdapter {
  private resolvedUploadDir: string;

  constructor(
    uploadDir: string,
    private baseUrl: string = "/uploads"
  ) {
    this.resolvedUploadDir = path.resolve(uploadDir);
  }

  /**
   * Resolve a filepath safely, preventing path traversal.
   * Throws if the resolved path escapes the upload directory.
   */
  private resolveSafe(filepath: string): string {
    const fullPath = path.resolve(this.resolvedUploadDir, filepath);
    if (!fullPath.startsWith(this.resolvedUploadDir + path.sep) && fullPath !== this.resolvedUploadDir) {
      throw new Error("Path traversal detected — filepath escapes upload directory");
    }
    return fullPath;
  }

  async save(filepath: string, buffer: Buffer): Promise<string> {
    const fullPath = this.resolveSafe(filepath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return this.getUrl(filepath);
  }

  async delete(filepath: string): Promise<void> {
    try {
      const fullPath = this.resolveSafe(filepath);
      await fs.unlink(fullPath);
    } catch {
      // File already gone or path invalid — safe to ignore
    }
  }

  getUrl(filepath: string): string {
    return `${this.baseUrl}/${filepath}`;
  }
}

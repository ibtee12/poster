import fs from "fs/promises";
import path from "path";

export interface PosterStorageService {
  saveFile(relativePath: string, buffer: Buffer, mimeType?: string): Promise<string>;
  getFile(relativePath: string): Promise<Buffer | null>;
  deleteFile(relativePath: string): Promise<boolean>;
  getPublicUrl(relativePath: string): string;
}

const POSTERS_DIR = path.join(process.cwd(), "data", "posters");

export class LocalDiskPosterStorage implements PosterStorageService {
  private baseDir: string;

  constructor(baseDir = POSTERS_DIR) {
    this.baseDir = baseDir;
  }

  private async ensureDir(targetPath: string): Promise<void> {
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });
  }

  getPublicUrl(relativePath: string): string {
    const clean = relativePath.replace(/^\/+/, "");
    return `/api/posters/files/${clean}`;
  }

  async saveFile(relativePath: string, buffer: Buffer, mimeType?: string): Promise<string> {
    const clean = relativePath.replace(/^\/+/, "");
    const fullPath = path.join(this.baseDir, clean);
    await this.ensureDir(fullPath);
    await fs.writeFile(fullPath, buffer);
    return this.getPublicUrl(clean);
  }

  async getFile(relativePath: string): Promise<Buffer | null> {
    try {
      const clean = relativePath.replace(/^\/+/, "");
      const fullPath = path.join(this.baseDir, clean);
      return await fs.readFile(fullPath);
    } catch (err: any) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  async deleteFile(relativePath: string): Promise<boolean> {
    try {
      const clean = relativePath.replace(/^\/+/, "");
      const fullPath = path.join(this.baseDir, clean);
      await fs.unlink(fullPath);
      return true;
    } catch (err: any) {
      if (err.code === "ENOENT") return false;
      throw err;
    }
  }
}

export const posterStorage: PosterStorageService = new LocalDiskPosterStorage();

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from '../types';

export interface FileUpload {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StoredFile {
  fileName: string;
  filePath: string;
  url: string;
}

export class FileStorageService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  async storeFile(file: FileUpload, documentId: UUID): Promise<StoredFile> {
    const fileExtension = this.getFileExtension(file.originalName);
    const fileName = `${uuidv4()}${fileExtension}`;
    const documentDir = path.join(this.uploadDir, 'documents', documentId);
    const filePath = path.join(documentDir, fileName);

    // Ensure document directory exists
    await this.ensureDirectoryExists(documentDir);

    // Write file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    return {
      fileName,
      filePath: path.relative(this.uploadDir, filePath),
      url: `${this.baseUrl}/uploads/documents/${documentId}/${fileName}`
    };
  }

  async storeImage(file: FileUpload, documentId: UUID): Promise<StoredFile> {
    // Validate image type
    if (!this.isImageFile(file.mimeType)) {
      throw new Error('File must be an image');
    }

    const fileExtension = this.getFileExtension(file.originalName);
    const fileName = `img_${uuidv4()}${fileExtension}`;
    const documentDir = path.join(this.uploadDir, 'documents', documentId, 'images');
    const filePath = path.join(documentDir, fileName);

    // Ensure document directory exists
    await this.ensureDirectoryExists(documentDir);

    // Write file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    return {
      fileName,
      filePath: path.relative(this.uploadDir, filePath),
      url: `${this.baseUrl}/uploads/documents/${documentId}/images/${fileName}`
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    
    try {
      await fs.promises.unlink(fullPath);
    } catch (error) {
      // File might not exist, which is okay
      console.warn(`Failed to delete file ${fullPath}:`, error);
    }
  }

  async getFile(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.uploadDir, filePath);
    return fs.promises.readFile(fullPath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.uploadDir, filePath);
    
    try {
      await fs.promises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  getFileUrl(filePath: string): string {
    return `${this.baseUrl}/uploads/${filePath}`;
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.promises.access(this.uploadDir);
    } catch {
      await fs.promises.mkdir(this.uploadDir, { recursive: true });
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.access(dirPath);
    } catch {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.substring(lastDot) : '';
  }

  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  validateFileSize(size: number, maxSizeMB: number = 10): void {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (size > maxSizeBytes) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
    }
  }

  validateFileType(mimeType: string, allowedTypes: string[]): void {
    if (!allowedTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
  }
}
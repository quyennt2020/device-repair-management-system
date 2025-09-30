import * as fs from 'fs';
import * as path from 'path';
import { FileStorageService, FileUpload } from '../services/file-storage.service';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

// Mock path module
jest.mock('path');

describe('FileStorageService', () => {
  let fileStorageService: FileStorageService;
  let mockFs: jest.Mocked<typeof fs>;
  let mockPath: jest.Mocked<typeof path>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.UPLOAD_DIR = './test-uploads';
    process.env.BASE_URL = 'http://localhost:3000';
    
    fileStorageService = new FileStorageService();
    mockFs = fs as jest.Mocked<typeof fs>;
    mockPath = path as jest.Mocked<typeof path>;
    
    // Mock path methods
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.relative.mockImplementation((from, to) => to.replace(from + '/', ''));
  });

  describe('storeFile', () => {
    it('should store file successfully', async () => {
      const file: FileUpload = {
        buffer: Buffer.from('test file content'),
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024
      };

      const documentId = 'doc-123';

      // Mock fs operations
      mockFs.promises.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      mockFs.promises.writeFile.mockResolvedValue();

      const result = await fileStorageService.storeFile(file, documentId);

      expect(result).toMatchObject({
        fileName: expect.stringMatching(/^[0-9a-f-]+\.pdf$/),
        filePath: expect.stringContaining('documents/doc-123'),
        url: expect.stringContaining('http://localhost:3000/uploads/documents/doc-123')
      });

      expect(mockFs.promises.mkdir).toHaveBeenCalled();
      expect(mockFs.promises.writeFile).toHaveBeenCalled();
    });

    it('should handle files without extension', async () => {
      const file: FileUpload = {
        buffer: Buffer.from('test content'),
        originalName: 'testfile',
        mimeType: 'text/plain',
        size: 512
      };

      const documentId = 'doc-123';

      mockFs.promises.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      mockFs.promises.writeFile.mockResolvedValue();

      const result = await fileStorageService.storeFile(file, documentId);

      expect(result.fileName).toMatch(/^[0-9a-f-]+$/); // No extension
    });
  });

  describe('storeImage', () => {
    it('should store image successfully', async () => {
      const file: FileUpload = {
        buffer: Buffer.from('image data'),
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 2048
      };

      const documentId = 'doc-123';

      mockFs.promises.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      mockFs.promises.writeFile.mockResolvedValue();

      const result = await fileStorageService.storeImage(file, documentId);

      expect(result).toMatchObject({
        fileName: expect.stringMatching(/^img_[0-9a-f-]+\.jpg$/),
        filePath: expect.stringContaining('documents/doc-123/images'),
        url: expect.stringContaining('http://localhost:3000/uploads/documents/doc-123/images')
      });
    });

    it('should throw error for non-image files', async () => {
      const file: FileUpload = {
        buffer: Buffer.from('not an image'),
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024
      };

      const documentId = 'doc-123';

      await expect(fileStorageService.storeImage(file, documentId))
        .rejects.toThrow('File must be an image');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const filePath = 'documents/doc-123/test.pdf';

      mockFs.promises.unlink.mockResolvedValue();

      await fileStorageService.deleteFile(filePath);

      expect(mockFs.promises.unlink).toHaveBeenCalledWith(
        expect.stringContaining(filePath)
      );
    });

    it('should handle file deletion errors gracefully', async () => {
      const filePath = 'documents/doc-123/nonexistent.pdf';

      mockFs.promises.unlink.mockRejectedValue(new Error('File not found'));

      // Should not throw error
      await expect(fileStorageService.deleteFile(filePath)).resolves.toBeUndefined();
    });
  });

  describe('getFile', () => {
    it('should read file successfully', async () => {
      const filePath = 'documents/doc-123/test.pdf';
      const fileContent = Buffer.from('file content');

      mockFs.promises.readFile.mockResolvedValue(fileContent);

      const result = await fileStorageService.getFile(filePath);

      expect(result).toEqual(fileContent);
      expect(mockFs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining(filePath)
      );
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const filePath = 'documents/doc-123/test.pdf';

      mockFs.promises.access.mockResolvedValue();

      const result = await fileStorageService.fileExists(filePath);

      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const filePath = 'documents/doc-123/nonexistent.pdf';

      mockFs.promises.access.mockRejectedValue(new Error('File not found'));

      const result = await fileStorageService.fileExists(filePath);

      expect(result).toBe(false);
    });
  });

  describe('validation methods', () => {
    describe('validateFileSize', () => {
      it('should pass for files within size limit', () => {
        expect(() => fileStorageService.validateFileSize(5 * 1024 * 1024, 10))
          .not.toThrow();
      });

      it('should throw error for files exceeding size limit', () => {
        expect(() => fileStorageService.validateFileSize(15 * 1024 * 1024, 10))
          .toThrow('File size exceeds maximum allowed size of 10MB');
      });
    });

    describe('validateFileType', () => {
      it('should pass for allowed file types', () => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        
        expect(() => fileStorageService.validateFileType('image/jpeg', allowedTypes))
          .not.toThrow();
      });

      it('should throw error for disallowed file types', () => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        
        expect(() => fileStorageService.validateFileType('application/pdf', allowedTypes))
          .toThrow('File type application/pdf is not allowed');
      });
    });
  });

  describe('getFileUrl', () => {
    it('should generate correct file URL', () => {
      const filePath = 'documents/doc-123/test.pdf';
      
      const url = fileStorageService.getFileUrl(filePath);
      
      expect(url).toBe('http://localhost:3000/uploads/documents/doc-123/test.pdf');
    });
  });
});
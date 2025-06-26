import type { FastifyRequest, FastifyReply } from 'fastify';
import { SupabaseService } from '../services/supabase';
import { createContextualLogger, logError } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as path from 'path';

interface AuthenticatedRequest extends FastifyRequest {
  tenantId: string;
  userId: string;
  companyId: string;
}

interface UploadFileRequest extends AuthenticatedRequest {
  body: {
    filename: string;
    content: string; // Base64 encoded content
    mimeType?: string;
  };
}

interface DeleteFileRequest extends AuthenticatedRequest {
  params: {
    fileId: string;
  };
}

interface GetFileRequest extends AuthenticatedRequest {
  params: {
    fileId: string;
  };
}

export class FileController {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  public uploadFile = async (
    request: UploadFileRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `upload_file_${Date.now()}`
    });

    try {
      const companyId = request.companyId; // Keep as string since Supabase expects UUID
      const userId = request.userId; // Keep as string since Supabase expects UUID
      const body = request.body as { filename: string; content: string; mimeType?: string };

      if (!body.filename || !body.content) {
        reply.code(400).send({
          success: false,
          error: 'Filename and content are required',
          timestamp: Date.now()
        });
        return;
      }

      // Decode base64 content
      const buffer = Buffer.from(body.content, 'base64');
      
      // Generate unique filename
      const fileExtension = path.extname(body.filename);
      const baseName = path.basename(body.filename, fileExtension);
      const uniqueFilename = `${baseName}-${uuidv4()}${fileExtension}`;

      // Generate content hash for deduplication
      const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

      logger.info({ 
        originalFilename: body.filename, 
        fileSize: buffer.length,
        mimeType: body.mimeType
      }, 'Uploading file');

      // First upload to storage
      const filePath = `${companyId}/${uniqueFilename}`;
      const storagePath = await this.supabaseService.uploadFileToStorage(
        'knowledge-base',
        filePath,
        buffer,
        { contentType: body.mimeType }
      );

      if (!storagePath) {
        reply.code(500).send({
          success: false,
          error: 'Failed to upload file to storage',
          timestamp: Date.now()
        });
        return;
      }

      // Then create database record
      const file = await this.supabaseService.uploadFile(
        {
          filename: uniqueFilename,
          originalFilename: body.filename,
          fileSize: buffer.length,
          mimeType: body.mimeType,
          filePath: storagePath,
          contentHash: contentHash,
          contentPreview: buffer.toString('utf8').substring(0, 500)
        },
        companyId,
        userId
      );

      if (!file) {
        reply.code(500).send({
          success: false,
          error: 'Failed to upload file',
          timestamp: Date.now()
        });
        return;
      }

      logger.info({ 
        fileId: file.id, 
        filename: file.originalFilename,
        size: file.fileSize 
      }, 'File uploaded successfully');

      reply.code(201).send({
        success: true,
        data: {
          id: file.id,
          filename: file.originalFilename,
          size: file.fileSize,
          mimeType: file.mimeType,
          status: file.processingStatus,
          uploadedAt: file.createdAt
        },
        message: 'File uploaded successfully'
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'upload_file' }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to upload file',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public listFiles = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `list_files_${Date.now()}`
    });

    try {
      const companyId = request.companyId; // Keep as string

      logger.info('Listing knowledge base files');

      const files = await this.supabaseService.getFiles(companyId);

      const formattedFiles = files.map(file => ({
        id: file.id,
        filename: file.originalFilename,
        size: file.fileSize,
        mimeType: file.mimeType,
        status: file.processingStatus,
        uploadedAt: file.createdAt,
        updatedAt: file.updatedAt
      }));

      reply.send({
        success: true,
        data: formattedFiles,
        count: formattedFiles.length
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'list_files' }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to list files',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public getFile = async (
    request: GetFileRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `get_file_${Date.now()}`
    });

    try {
      const params = request.params as { fileId: string };
      const { fileId } = params;
      const companyId = request.companyId; // Keep as string

      logger.info({ fileId }, 'Retrieving file');

      const file = await this.supabaseService.getFileById(
        fileId,
        companyId
      );

      if (!file) {
        reply.code(404).send({
          success: false,
          error: 'File not found',
          timestamp: Date.now()
        });
        return;
      }

      reply.send({
        success: true,
        data: {
          id: file.id,
          filename: file.originalFilename,
          size: file.fileSize,
          mimeType: file.mimeType,
          status: file.processingStatus,
          uploadedAt: file.createdAt,
          updatedAt: file.updatedAt
        }
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'get_file', fileId: (request.params as any).fileId }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve file',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public deleteFile = async (
    request: DeleteFileRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `delete_file_${Date.now()}`
    });

    try {
      const params = request.params as { fileId: string };
      const { fileId } = params;
      const companyId = request.companyId; // Keep as string

      logger.info({ fileId }, 'Deleting file');

      const success = await this.supabaseService.deleteFile(
        fileId,
        companyId
      );

      if (!success) {
        reply.code(404).send({
          success: false,
          error: 'File not found or delete failed',
          timestamp: Date.now()
        });
        return;
      }

      logger.info({ fileId }, 'File deleted successfully');

      reply.send({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'delete_file', fileId: (request.params as any).fileId }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to delete file',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };
} 
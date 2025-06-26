import type { FastifyRequest, FastifyReply } from 'fastify';
interface AuthenticatedRequest extends FastifyRequest {
    tenantId: string;
    userId: string;
    companyId: string;
}
interface UploadFileRequest extends AuthenticatedRequest {
    body: {
        filename: string;
        content: string;
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
export declare class FileController {
    private supabaseService;
    constructor();
    uploadFile: (request: UploadFileRequest, reply: FastifyReply) => Promise<void>;
    listFiles: (request: AuthenticatedRequest, reply: FastifyReply) => Promise<void>;
    getFile: (request: GetFileRequest, reply: FastifyReply) => Promise<void>;
    deleteFile: (request: DeleteFileRequest, reply: FastifyReply) => Promise<void>;
}
export {};
//# sourceMappingURL=fileController.d.ts.map
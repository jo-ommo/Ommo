import type { AudioChunk, TranscriptionResult } from '../types';
import type { LogContext } from '../utils/logger';
export declare class ASRService {
    private deepgramClient;
    private deepgramApiKey;
    constructor();
    transcribeAudio(audioChunk: AudioChunk, context: LogContext, options?: {
        language?: string;
        model?: string;
        interimResults?: boolean;
    }): Promise<TranscriptionResult>;
    createLiveConnection(context: LogContext, onTranscription: (result: TranscriptionResult) => void, options?: {
        language?: string;
        model?: string;
        interimResults?: boolean;
        smartFormat?: boolean;
        punctuate?: boolean;
    }): any;
    checkConnection(): Promise<boolean>;
}
//# sourceMappingURL=asr.d.ts.map
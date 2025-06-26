import type { TTSResponse } from '../types';
import type { LogContext } from '../utils/logger';
export declare class TTSService {
    private cartesiaApiKey;
    private baseUrl;
    constructor();
    synthesizeSpeech(text: string, context: LogContext, options?: {
        voice?: string;
        language?: string;
        speed?: number;
        format?: string;
    }): Promise<TTSResponse>;
    streamSynthesis(text: string, context: LogContext, onAudioChunk: (chunk: Buffer) => void, options?: {
        voice?: string;
        language?: string;
        speed?: number;
        format?: string;
    }): Promise<TTSResponse>;
    checkConnection(): Promise<boolean>;
    getSupportedVoices(): string[];
    getSupportedFormats(): string[];
    estimateDuration(text: string, speed?: number): number;
}
//# sourceMappingURL=tts.d.ts.map
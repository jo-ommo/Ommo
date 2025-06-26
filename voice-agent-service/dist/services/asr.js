"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASRService = void 0;
const sdk_1 = require("@deepgram/sdk");
class ASRService {
    constructor() {
        this.deepgramApiKey = process.env.DEEPGRAM_API_KEY || '';
        if (!this.deepgramApiKey) {
            throw new Error('DEEPGRAM_API_KEY environment variable is required');
        }
        this.deepgramClient = (0, sdk_1.createClient)(this.deepgramApiKey);
    }
    async transcribeAudio(audioChunk, context, options = {}) {
        try {
            const { language = 'en-US', model = 'nova-2', interimResults = true } = options;
            // Use the new prerecorded transcription API
            const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(audioChunk.data, {
                model,
                language,
                smart_format: true,
                punctuate: true
            });
            if (error) {
                throw new Error(`Deepgram transcription failed: ${error}`);
            }
            const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
            const confidence = result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
            return {
                text: transcript,
                confidence,
                isFinal: true,
                timestampMs: Date.now()
            };
        }
        catch (error) {
            throw new Error(`ASR transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    createLiveConnection(context, onTranscription, options = {}) {
        try {
            const { language = 'en-US', model = 'nova-2', interimResults = true, smartFormat = true, punctuate = true } = options;
            // Create live connection using the new SDK
            const dgConnection = this.deepgramClient.listen.live({
                model,
                language,
                smart_format: smartFormat,
                interim_results: interimResults,
                utterance_end_ms: 1000,
                vad_events: true,
                endpointing: 300,
                punctuate
            });
            // Set up event handlers
            dgConnection.on(sdk_1.LiveTranscriptionEvents.Open, () => {
                console.log('Deepgram connection opened');
            });
            dgConnection.on(sdk_1.LiveTranscriptionEvents.Transcript, (data) => {
                const transcript = data.channel?.alternatives?.[0]?.transcript || '';
                const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
                if (transcript.length > 0) {
                    onTranscription({
                        text: transcript,
                        confidence,
                        isFinal: data.is_final || false,
                        timestampMs: Date.now()
                    });
                }
            });
            dgConnection.on(sdk_1.LiveTranscriptionEvents.UtteranceEnd, (data) => {
                console.log('Utterance ended');
            });
            dgConnection.on(sdk_1.LiveTranscriptionEvents.SpeechStarted, () => {
                console.log('Speech started');
            });
            dgConnection.on(sdk_1.LiveTranscriptionEvents.Error, (error) => {
                console.error('Deepgram error:', error);
            });
            dgConnection.on(sdk_1.LiveTranscriptionEvents.Close, () => {
                console.log('Deepgram connection closed');
            });
            return dgConnection;
        }
        catch (error) {
            throw new Error(`Failed to create Deepgram live connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async checkConnection() {
        try {
            // Test connection with a simple API call
            const { result, error } = await this.deepgramClient.manage.getProjects();
            return !error && !!result;
        }
        catch (error) {
            return false;
        }
    }
}
exports.ASRService = ASRService;
//# sourceMappingURL=asr.js.map
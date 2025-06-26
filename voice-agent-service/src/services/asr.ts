import type { AudioChunk, TranscriptionResult } from '../types';
import type { LogContext } from '../utils/logger';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export class ASRService {
  private deepgramClient: any;
  private deepgramApiKey: string;

  constructor() {
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY || '';
    
    if (!this.deepgramApiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required');
    }

    this.deepgramClient = createClient(this.deepgramApiKey);
  }

  public async transcribeAudio(
    audioChunk: AudioChunk,
    context: LogContext,
    options: {
      language?: string;
      model?: string;
      interimResults?: boolean;
    } = {}
  ): Promise<TranscriptionResult> {
    try {
      const {
        language = 'en-US',
        model = 'nova-2',
        interimResults = true
      } = options;

      // Use the new prerecorded transcription API
      const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(
        audioChunk.data,
        {
          model,
          language,
          smart_format: true,
          punctuate: true
        }
      );

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
    } catch (error) {
      throw new Error(`ASR transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public createLiveConnection(
    context: LogContext,
    onTranscription: (result: TranscriptionResult) => void,
    options: {
      language?: string;
      model?: string;
      interimResults?: boolean;
      smartFormat?: boolean;
      punctuate?: boolean;
    } = {}
  ): any {
    try {
      const {
        language = 'en-US',
        model = 'nova-2',
        interimResults = true,
        smartFormat = true,
        punctuate = true
      } = options;

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
      dgConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened');
      });

      dgConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
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

      dgConnection.on(LiveTranscriptionEvents.UtteranceEnd, (data: any) => {
        console.log('Utterance ended');
      });

      dgConnection.on(LiveTranscriptionEvents.SpeechStarted, () => {
        console.log('Speech started');
      });

      dgConnection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error('Deepgram error:', error);
      });

      dgConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
      });

      return dgConnection;
    } catch (error) {
      throw new Error(`Failed to create Deepgram live connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async checkConnection(): Promise<boolean> {
    try {
      // Test connection with a simple API call
      const { result, error } = await this.deepgramClient.manage.getProjects();
      return !error && !!result;
    } catch (error) {
      return false;
    }
  }
} 
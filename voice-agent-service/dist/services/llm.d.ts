import OpenAI from 'openai';
import type { LLMResponse, VoiceAgentConfig } from '../types';
import type { LogContext } from '../utils/logger';
export declare class LLMService {
    private openaiClient;
    constructor();
    generateResponse(message: string, agentConfig: VoiceAgentConfig, context: LogContext, conversationHistory?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>): Promise<LLMResponse>;
    streamResponse(message: string, agentConfig: VoiceAgentConfig, context: LogContext, onChunk: (chunk: string) => void, conversationHistory?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>): Promise<LLMResponse>;
    createStreamingRunner(message: string, agentConfig: VoiceAgentConfig, context: LogContext, conversationHistory?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>): Promise<any>;
    checkConnection(): Promise<boolean>;
    estimateTokens(text: string): number;
    validateModel(model: string): boolean;
    generateWithFunctions(message: string, agentConfig: VoiceAgentConfig, context: LogContext, tools: OpenAI.Chat.Completions.ChatCompletionTool[], conversationHistory?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>): Promise<LLMResponse>;
}
//# sourceMappingURL=llm.d.ts.map
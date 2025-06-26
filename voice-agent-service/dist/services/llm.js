"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const openai_1 = __importDefault(require("openai"));
class LLMService {
    constructor() {
        const openaiApiKey = process.env.OPENAI_API_KEY || '';
        if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }
        this.openaiClient = new openai_1.default({
            apiKey: openaiApiKey,
        });
    }
    async generateResponse(message, agentConfig, context, conversationHistory = []) {
        try {
            const messages = [
                ...(agentConfig.systemPrompt ? [{ role: 'system', content: agentConfig.systemPrompt }] : []),
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                { role: 'user', content: message }
            ];
            const completion = await this.openaiClient.chat.completions.create({
                model: agentConfig.model,
                messages,
                temperature: agentConfig.temperature || 0.7,
                max_tokens: agentConfig.maxTokens || 1000,
            });
            const responseMessage = completion.choices[0]?.message?.content || '';
            const usage = completion.usage;
            return {
                text: responseMessage,
                usage: {
                    promptTokens: usage?.prompt_tokens || 0,
                    completionTokens: usage?.completion_tokens || 0,
                    totalTokens: usage?.total_tokens || 0
                },
                finishReason: completion.choices[0]?.finish_reason || undefined
            };
        }
        catch (error) {
            throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async streamResponse(message, agentConfig, context, onChunk, conversationHistory = []) {
        try {
            const messages = [
                ...(agentConfig.systemPrompt ? [{ role: 'system', content: agentConfig.systemPrompt }] : []),
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                { role: 'user', content: message }
            ];
            const stream = await this.openaiClient.chat.completions.create({
                model: agentConfig.model,
                messages,
                temperature: agentConfig.temperature || 0.7,
                max_tokens: agentConfig.maxTokens || 1000,
                stream: true,
            });
            let fullResponse = '';
            let usage = null;
            let finishReason = undefined;
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullResponse += content;
                // Track usage and finish reason from the final chunk
                if (chunk.usage) {
                    usage = chunk.usage;
                }
                if (chunk.choices[0]?.finish_reason) {
                    finishReason = chunk.choices[0].finish_reason;
                }
            }
            return {
                text: fullResponse,
                usage,
                finishReason: finishReason || undefined
            };
        }
        catch (error) {
            throw new Error(`LLM streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    createStreamingRunner(message, agentConfig, context, conversationHistory = []) {
        try {
            const messages = [
                ...(agentConfig.systemPrompt ? [{ role: 'system', content: agentConfig.systemPrompt }] : []),
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                { role: 'user', content: message }
            ];
            // Return the streaming promise directly
            return this.openaiClient.chat.completions.create({
                model: agentConfig.model,
                messages,
                temperature: agentConfig.temperature || 0.7,
                max_tokens: agentConfig.maxTokens || 1000,
                stream: true,
            });
        }
        catch (error) {
            throw new Error(`Failed to create streaming runner: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async checkConnection() {
        try {
            // Test connection with a simple API call
            const models = await this.openaiClient.models.list();
            return !!models.data;
        }
        catch (error) {
            return false;
        }
    }
    estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters for English text
        return Math.ceil(text.length / 4);
    }
    validateModel(model) {
        const supportedModels = ['gpt-4o', 'gpt-3.5-turbo', 'gpt-4o-mini'];
        return supportedModels.includes(model);
    }
    async generateWithFunctions(message, agentConfig, context, tools, conversationHistory = []) {
        try {
            const messages = [
                ...(agentConfig.systemPrompt ? [{ role: 'system', content: agentConfig.systemPrompt }] : []),
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                { role: 'user', content: message }
            ];
            const completion = await this.openaiClient.chat.completions.create({
                model: agentConfig.model,
                messages,
                tools,
                temperature: agentConfig.temperature || 0.7,
                max_tokens: agentConfig.maxTokens || 1000,
            });
            const responseMessage = completion.choices[0]?.message?.content || '';
            const usage = completion.usage;
            return {
                text: responseMessage,
                usage: {
                    promptTokens: usage?.prompt_tokens || 0,
                    completionTokens: usage?.completion_tokens || 0,
                    totalTokens: usage?.total_tokens || 0
                },
                finishReason: completion.choices[0]?.finish_reason || undefined
            };
        }
        catch (error) {
            throw new Error(`LLM function generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.LLMService = LLMService;
//# sourceMappingURL=llm.js.map
import OpenAI from 'openai';
import type { LLMResponse, VoiceAgentConfig } from '../types';
import type { LogContext } from '../utils/logger';

export class LLMService {
  private openaiClient: OpenAI;

  constructor() {
    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openaiClient = new OpenAI({
      apiKey: openaiApiKey,
    });
  }

  public async generateResponse(
    message: string,
    agentConfig: VoiceAgentConfig,
    context: LogContext,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
  ): Promise<LLMResponse> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...(agentConfig.systemPrompt ? [{ role: 'system' as const, content: agentConfig.systemPrompt }] : []),
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })),
        { role: 'user' as const, content: message }
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
    } catch (error) {
      throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async streamResponse(
    message: string,
    agentConfig: VoiceAgentConfig,
    context: LogContext,
    onChunk: (chunk: string) => void,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
  ): Promise<LLMResponse> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...(agentConfig.systemPrompt ? [{ role: 'system' as const, content: agentConfig.systemPrompt }] : []),
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })),
        { role: 'user' as const, content: message }
      ];

      const stream = await this.openaiClient.chat.completions.create({
        model: agentConfig.model,
        messages,
        temperature: agentConfig.temperature || 0.7,
        max_tokens: agentConfig.maxTokens || 1000,
        stream: true,
      });

      let fullResponse = '';
      let usage: any = null;
      let finishReason: string | undefined = undefined;

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
    } catch (error) {
      throw new Error(`LLM streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public createStreamingRunner(
    message: string,
    agentConfig: VoiceAgentConfig,
    context: LogContext,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
  ): Promise<any> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...(agentConfig.systemPrompt ? [{ role: 'system' as const, content: agentConfig.systemPrompt }] : []),
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })),
        { role: 'user' as const, content: message }
      ];

      // Return the streaming promise directly
      return this.openaiClient.chat.completions.create({
        model: agentConfig.model,
        messages,
        temperature: agentConfig.temperature || 0.7,
        max_tokens: agentConfig.maxTokens || 1000,
        stream: true,
      });
    } catch (error) {
      throw new Error(`Failed to create streaming runner: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async checkConnection(): Promise<boolean> {
    try {
      // Test connection with a simple API call
      const models = await this.openaiClient.models.list();
      return !!models.data;
    } catch (error) {
      return false;
    }
  }

  public estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  public validateModel(model: string): boolean {
    const supportedModels = ['gpt-4o', 'gpt-3.5-turbo', 'gpt-4o-mini'];
    return supportedModels.includes(model);
  }

  public async generateWithFunctions(
    message: string,
    agentConfig: VoiceAgentConfig,
    context: LogContext,
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
  ): Promise<LLMResponse> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...(agentConfig.systemPrompt ? [{ role: 'system' as const, content: agentConfig.systemPrompt }] : []),
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })),
        { role: 'user' as const, content: message }
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
    } catch (error) {
      throw new Error(`LLM function generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 
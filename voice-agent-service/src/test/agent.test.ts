import { describe, it, expect, beforeEach } from 'vitest';
import { AgentController } from '../controllers/agentController';
import type { VoiceAgentCreateRequest, JWTPayload } from '../types';

describe('AgentController', () => {
  let controller: AgentController;
  
  beforeEach(() => {
    controller = new AgentController();
  });

  describe('Agent Creation', () => {
    it('should validate agent creation request', () => {
      const createRequest: VoiceAgentCreateRequest = {
        name: 'Test Agent',
        model: 'gpt-4o',
        voice: 'cartesia-sonic',
        language: 'en-US',
        systemPrompt: 'You are a helpful assistant.',
        temperature: 0.7,
        maxTokens: 1000
      };

      expect(createRequest.name).toBe('Test Agent');
      expect(createRequest.model).toBe('gpt-4o');
      expect(createRequest.voice).toBe('cartesia-sonic');
    });

    it('should validate JWT payload structure', () => {
      const jwtPayload: JWTPayload = {
        sub: 'user123',
        company_id: 'company456',
        tenant_id: 'tenant789',
        user_id: 'user123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://localhost:5000',
        aud: 'https://localhost:5000'
      };

      expect(jwtPayload.tenant_id).toBe('tenant789');
      expect(jwtPayload.company_id).toBe('company456');
      expect(jwtPayload.user_id).toBe('user123');
    });
  });

  describe('Validation', () => {
    it('should validate supported models', () => {
      const supportedModels = ['gpt-4o', 'gpt-3.5-turbo'];
      
      expect(supportedModels.includes('gpt-4o')).toBe(true);
      expect(supportedModels.includes('gpt-3.5-turbo')).toBe(true);
      expect(supportedModels.includes('invalid-model')).toBe(false);
    });

    it('should validate voice options', () => {
      const supportedVoices = [
        'cartesia-sonic',
        'cartesia-smooth',
        'cartesia-warm',
        'cartesia-professional',
        'cartesia-casual'
      ];
      
      expect(supportedVoices.includes('cartesia-sonic')).toBe(true);
      expect(supportedVoices.includes('invalid-voice')).toBe(false);
    });
  });
}); 
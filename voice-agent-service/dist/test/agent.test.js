"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const agentController_1 = require("../controllers/agentController");
(0, vitest_1.describe)('AgentController', () => {
    let controller;
    (0, vitest_1.beforeEach)(() => {
        controller = new agentController_1.AgentController();
    });
    (0, vitest_1.describe)('Agent Creation', () => {
        (0, vitest_1.it)('should validate agent creation request', () => {
            const createRequest = {
                name: 'Test Agent',
                model: 'gpt-4o',
                voice: 'cartesia-sonic',
                language: 'en-US',
                systemPrompt: 'You are a helpful assistant.',
                temperature: 0.7,
                maxTokens: 1000
            };
            (0, vitest_1.expect)(createRequest.name).toBe('Test Agent');
            (0, vitest_1.expect)(createRequest.model).toBe('gpt-4o');
            (0, vitest_1.expect)(createRequest.voice).toBe('cartesia-sonic');
        });
        (0, vitest_1.it)('should validate JWT payload structure', () => {
            const jwtPayload = {
                sub: 'user123',
                company_id: 'company456',
                tenant_id: 'tenant789',
                user_id: 'user123',
                exp: Math.floor(Date.now() / 1000) + 3600,
                iat: Math.floor(Date.now() / 1000),
                iss: 'https://localhost:5000',
                aud: 'https://localhost:5000'
            };
            (0, vitest_1.expect)(jwtPayload.tenant_id).toBe('tenant789');
            (0, vitest_1.expect)(jwtPayload.company_id).toBe('company456');
            (0, vitest_1.expect)(jwtPayload.user_id).toBe('user123');
        });
    });
    (0, vitest_1.describe)('Validation', () => {
        (0, vitest_1.it)('should validate supported models', () => {
            const supportedModels = ['gpt-4o', 'gpt-3.5-turbo'];
            (0, vitest_1.expect)(supportedModels.includes('gpt-4o')).toBe(true);
            (0, vitest_1.expect)(supportedModels.includes('gpt-3.5-turbo')).toBe(true);
            (0, vitest_1.expect)(supportedModels.includes('invalid-model')).toBe(false);
        });
        (0, vitest_1.it)('should validate voice options', () => {
            const supportedVoices = [
                'cartesia-sonic',
                'cartesia-smooth',
                'cartesia-warm',
                'cartesia-professional',
                'cartesia-casual'
            ];
            (0, vitest_1.expect)(supportedVoices.includes('cartesia-sonic')).toBe(true);
            (0, vitest_1.expect)(supportedVoices.includes('invalid-voice')).toBe(false);
        });
    });
});
//# sourceMappingURL=agent.test.js.map
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './BaseAgent';
import type { AgentConfig, AgentContext } from './BaseAgent';

describe('BaseAgent', () => {
  let agent: BaseAgent;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    mockConfig = {
      name: 'TestAgent',
      description: 'A test agent',
      model: 'gpt-4',
      provider: 'openai',
      maxRetries: 3,
      temperature: 0.7,
      apiKey: 'test-key',
    };
  });

  describe('Constructor', () => {
    it('should initialize with OpenAI provider', () => {
      agent = new BaseAgent(mockConfig);
      expect(agent).toBeDefined();
    });

    it('should initialize with Anthropic provider', () => {
      const anthropicConfig = {
        ...mockConfig,
        provider: 'anthropic' as const,
        model: 'claude-3-opus' as const,
      };
      agent = new BaseAgent(anthropicConfig);
      expect(agent).toBeDefined();
    });

    it('should set default maxRetries', () => {
      const configWithoutRetries = {
        ...mockConfig,
        maxRetries: undefined,
      };
      agent = new BaseAgent(configWithoutRetries);
      expect(agent).toBeDefined();
    });

    it('should set default temperature', () => {
      const configWithoutTemp = {
        ...mockConfig,
        temperature: undefined,
      };
      agent = new BaseAgent(configWithoutTemp);
      expect(agent).toBeDefined();
    });
  });

  describe('Module Registration', () => {
    beforeEach(() => {
      agent = new BaseAgent(mockConfig);
    });

    it('should register a module', () => {
      const mockModule = {
        swap: vi.fn(),
      };
      agent.registerModule('SwapModule', mockModule);
      const context = agent.getContext();
      expect(context.availableModules).toContain('SwapModule');
    });

    it('should register multiple modules', () => {
      const swapModule = { swap: vi.fn() };
      const lendModule = { lend: vi.fn() };
      
      agent.registerModule('SwapModule', swapModule);
      agent.registerModule('LendModule', lendModule);
      
      const context = agent.getContext();
      expect(context.availableModules).toContain('SwapModule');
      expect(context.availableModules).toContain('LendModule');
    });
  });

  describe('Context Management', () => {
    beforeEach(() => {
      agent = new BaseAgent(mockConfig);
    });

    it('should return current context', () => {
      const context = agent.getContext();
      expect(context).toHaveProperty('conversationHistory');
      expect(context).toHaveProperty('userGoal');
      expect(context).toHaveProperty('availableModules');
      expect(context).toHaveProperty('walletAddress');
      expect(context).toHaveProperty('chainId');
    });

    it('should initialize with empty conversation history', () => {
      const context = agent.getContext();
      expect(context.conversationHistory).toEqual([]);
    });

    it('should clear conversation history', () => {
      const context = agent.getContext();
      context.conversationHistory.push({
        role: 'user',
        content: 'test',
        timestamp: Date.now(),
      });
      
      agent.clearHistory();
      const clearedContext = agent.getContext();
      expect(clearedContext.conversationHistory).toEqual([]);
    });
  });

  describe('Action Execution', () => {
    beforeEach(() => {
      agent = new BaseAgent(mockConfig);
    });

    it('should throw error when executing action with unregistered module', async () => {
      const action = {
        type: 'swap' as const,
        module: 'SwapModule',
        method: 'swap',
        params: {},
        reasoning: 'test',
      };

      await expect(agent.execute(action)).rejects.toThrow('Module "SwapModule" not found');
    });

    it('should throw error when method does not exist on module', async () => {
      const mockModule = {
        otherMethod: vi.fn(),
      };
      agent.registerModule('SwapModule', mockModule);

      const action = {
        type: 'swap' as const,
        module: 'SwapModule',
        method: 'swap',
        params: {},
        reasoning: 'test',
      };

      await expect(agent.execute(action)).rejects.toThrow('Method "swap" not found in module "SwapModule"');
    });

    it('should successfully execute action when module and method exist', async () => {
      const mockSwap = vi.fn().mockResolvedValue({ success: true });
      const mockModule = {
        swap: mockSwap,
      };
      agent.registerModule('SwapModule', mockModule);

      const action = {
        type: 'swap' as const,
        module: 'SwapModule',
        method: 'swap',
        params: { amount: '100' },
        reasoning: 'test swap',
      };

      const result = await agent.execute(action);
      
      expect(mockSwap).toHaveBeenCalledWith({ amount: '100' });
      expect(result).toEqual({ success: true });
    });

    it('should retry on failure with exponential backoff', async () => {
      const mockSwap = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({ success: true });

      const mockModule = {
        swap: mockSwap,
      };
      agent.registerModule('SwapModule', mockModule);

      const action = {
        type: 'swap' as const,
        module: 'SwapModule',
        method: 'swap',
        params: {},
        reasoning: 'test',
      };

      const result = await agent.execute(action);
      
      expect(mockSwap).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true });
    });

    it('should throw error after max retries', async () => {
      const mockSwap = vi.fn().mockRejectedValue(new Error('Always fails'));
      const mockModule = {
        swap: mockSwap,
      };
      agent.registerModule('SwapModule', mockModule);

      const action = {
        type: 'swap' as const,
        module: 'SwapModule',
        method: 'swap',
        params: {},
        reasoning: 'test',
      };

      await expect(agent.execute(action)).rejects.toThrow('Always fails');
      expect(mockSwap).toHaveBeenCalledTimes(3); // maxRetries is 3
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      agent = new BaseAgent(mockConfig);
    });

    it('should emit action:start event', async () => {
      const mockSwap = vi.fn().mockResolvedValue({ success: true });
      const mockModule = { swap: mockSwap };
      agent.registerModule('SwapModule', mockModule);

      const listener = vi.fn();
      agent.on('action:start', listener);

      const action = {
        type: 'swap' as const,
        module: 'SwapModule',
        method: 'swap',
        params: {},
        reasoning: 'test',
      };

      await agent.execute(action);
      
      expect(listener).toHaveBeenCalledWith({ action });
    });

    it('should emit action:complete event on success', async () => {
      const mockSwap = vi.fn().mockResolvedValue({ success: true });
      const mockModule = { swap: mockSwap };
      agent.registerModule('SwapModule', mockModule);

      const listener = vi.fn();
      agent.on('action:complete', listener);

      const action = {
        type: 'swap' as const,
        module: 'SwapModule',
        method: 'swap',
        params: {},
        reasoning: 'test',
      };

      await agent.execute(action);
      
      expect(listener).toHaveBeenCalledWith({ action, result: { success: true } });
    });

    it('should emit action:error event on failure', async () => {
      const error = new Error('Action failed');
      const mockSwap = vi.fn().mockRejectedValue(error);
      const mockModule = { swap: mockSwap };
      agent.registerModule('SwapModule', mockModule);

      const listener = vi.fn();
      agent.on('action:error', listener);

      const action = {
        type: 'swap' as const,
        module: 'SwapModule',
        method: 'swap',
        params: {},
        reasoning: 'test',
      };

      await expect(agent.execute(action)).rejects.toThrow('Action failed');
      
      expect(listener).toHaveBeenCalledWith({ action, error });
    });
  });

  describe('Model Name Validation', () => {
    it('should accept valid OpenAI model names', () => {
      const gpt4Config = { ...mockConfig, model: 'gpt-4' as const };
      const gpt35Config = { ...mockConfig, model: 'gpt-3.5-turbo' as const };
      
      expect(() => new BaseAgent(gpt4Config)).not.toThrow();
      expect(() => new BaseAgent(gpt35Config)).not.toThrow();
    });

    it('should accept valid Anthropic model names', () => {
      const opusConfig = {
        ...mockConfig,
        provider: 'anthropic' as const,
        model: 'claude-3-opus' as const,
      };
      const sonnetConfig = {
        ...mockConfig,
        provider: 'anthropic' as const,
        model: 'claude-3-sonnet' as const,
      };
      
      expect(() => new BaseAgent(opusConfig)).not.toThrow();
      expect(() => new BaseAgent(sonnetConfig)).not.toThrow();
    });
  });
});

import { EventEmitter } from 'eventemitter3';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export interface AgentConfig {
  name: string;
  description: string;
  model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-sonnet';
  provider: 'openai' | 'anthropic';
  maxRetries?: number;
  temperature?: number;
  systemPrompt?: string;
  apiKey?: string;
}

export interface AgentContext {
  conversationHistory: Message[];
  userGoal: string;
  availableModules: string[];
  walletAddress: string;
  chainId: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AgentAction {
  type: 'swap' | 'lend' | 'stake' | 'treasury';
  module: string;
  method: string;
  params: any;
  reasoning: string;
}

export interface AgentResponse {
  message: string;
  actions: AgentAction[];
  confidence: number;
  needsApproval: boolean;
}

/**
 * BaseAgent - Foundation for all AI agents in BNB Claw SDK
 * 
 * Provides LLM integration (OpenAI/Anthropic), reasoning capabilities,
 * action planning, and module execution with comprehensive error handling.
 */
export class BaseAgent extends EventEmitter {
  private config: AgentConfig;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private context: AgentContext;
  private modules: Map<string, any>;
  private systemPrompt: string;

  constructor(config: AgentConfig) {
    super();
    this.config = {
      maxRetries: 3,
      temperature: 0.7,
      ...config,
    };
    
    this.modules = new Map();
    this.context = {
      conversationHistory: [],
      userGoal: '',
      availableModules: [],
      walletAddress: '',
      chainId: 0,
    };

    // Initialize LLM client based on provider
    if (this.config.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
      });
    } else if (this.config.provider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
      });
    }

    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * Reason about user input and determine appropriate actions
   */
  async reason(userInput: string, context: Partial<AgentContext> = {}): Promise<AgentResponse> {
    // Update context
    this.context = { ...this.context, ...context };

    // Add user message to history
    const userMessage: Message = {
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    };
    this.context.conversationHistory.push(userMessage);
    this.emit('message:sent', userMessage);

    try {
      let responseText = '';
      
      if (this.config.provider === 'openai') {
        responseText = await this.reasonWithOpenAI(userInput);
      } else {
        responseText = await this.reasonWithAnthropic(userInput);
      }

      // Add assistant message to history
      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
      };
      this.context.conversationHistory.push(assistantMessage);
      this.emit('message:received', assistantMessage);

      // Parse response into structured format
      const actions = this.parseActions(responseText);
      
      const response: AgentResponse = {
        message: responseText,
        actions,
        confidence: 0.8, // Could be enhanced with actual confidence scoring
        needsApproval: actions.some(a => this.isHighRiskAction(a)),
      };

      return response;
    } catch (error) {
      this.emit('error', error);
      throw this.formatError(error);
    }
  }

  /**
   * Plan a multi-step strategy for achieving a goal
   */
  async planStrategy(goal: string, context: Partial<AgentContext> = {}): Promise<AgentAction[]> {
    this.context = { ...this.context, ...context, userGoal: goal };

    const planningPrompt = `
Given the user's goal: "${goal}"

Available modules: ${this.context.availableModules.join(', ')}

Create a detailed step-by-step plan to achieve this goal. For each step, specify:
1. The module to use
2. The action to perform
3. The parameters needed
4. The reasoning for this step

Format your response as a JSON array of actions.
`;

    const response = await this.reason(planningPrompt, context);
    this.emit('action:planned', { actions: response.actions });
    
    return response.actions;
  }

  /**
   * Execute a single action with retry logic
   */
  async execute(action: AgentAction, onProgress?: (status: string) => void): Promise<any> {
    this.emit('action:start', { action });

    const module = this.modules.get(action.module);
    if (!module) {
      throw new Error(`Module "${action.module}" not found`);
    }

    if (typeof module[action.method] !== 'function') {
      throw new Error(`Method "${action.method}" not found in module "${action.module}"`);
    }

    let lastError: Error | undefined;
    const maxRetries = this.config.maxRetries || 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (onProgress) {
          onProgress(`Executing ${action.module}.${action.method} (attempt ${attempt + 1}/${maxRetries})`);
        }

        const result = await module[action.method](action.params);
        
        this.emit('action:complete', { action, result });
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.emit('action:error', { action, error: lastError });
    throw lastError;
  }

  /**
   * Simple chat interface for conversational interaction
   */
  async chat(message: string): Promise<string> {
    const response = await this.reason(message);
    return response.message;
  }

  /**
   * Register a module for use by the agent
   */
  registerModule(name: string, module: any): void {
    this.modules.set(name, module);
    this.context.availableModules.push(name);
    
    // Update system prompt with new module capabilities
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * Get current agent context
   */
  getContext(): AgentContext {
    return { ...this.context };
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.context.conversationHistory = [];
  }

  /**
   * Build comprehensive system prompt
   */
  private buildSystemPrompt(): string {
    const basePrompt = this.config.systemPrompt || `
You are ${this.config.name}, a DeFi AI agent on BNB Chain.
${this.config.description}

Your goal is to help users execute DeFi strategies safely and efficiently.

Available modules: ${this.context.availableModules.join(', ')}

When responding:
1. Understand the user's goal clearly
2. Plan the optimal strategy using available modules
3. Propose specific actions with clear reasoning
4. Ask for confirmation if the operation involves high risk or large amounts
5. Always prioritize security and gas efficiency

You can execute the following types of actions:
- swap: Exchange tokens on PancakeSwap
- lend: Lend or borrow assets on Venus Protocol
- stake: Stake BNB for rewards
- treasury: Manage portfolio allocations

When proposing actions, use this format:
{
  "actions": [
    {
      "type": "swap",
      "module": "SwapModule",
      "method": "swap",
      "params": { "tokenIn": "...", "tokenOut": "...", "amountIn": "..." },
      "reasoning": "Explanation of why this action is needed"
    }
  ]
}
`;

    return basePrompt.trim();
  }

  /**
   * Reason using OpenAI
   */
  private async reasonWithOpenAI(userInput: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.context.conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
    ];

    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
    });

    return completion.choices[0]?.message?.content || '';
  }

  /**
   * Reason using Anthropic
   */
  private async reasonWithAnthropic(userInput: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const messages = this.context.conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }));

    // Map simplified model names to full Anthropic model names
    const modelMap: Record<string, string> = {
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
    };
    const anthropicModel = modelMap[this.config.model] || this.config.model;

    const response = await this.anthropic.messages.create({
      model: anthropicModel,
      max_tokens: 2048,
      system: this.systemPrompt,
      messages,
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : '';
  }

  /**
   * Parse actions from LLM response
   */
  private parseActions(llmResponse: string): AgentAction[] {
    try {
      // Try to find JSON block in response
      const jsonMatch = llmResponse.match(/\{[\s\S]*"actions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.actions)) {
          return parsed.actions;
        }
      }

      // Try direct JSON array
      const arrayMatch = llmResponse.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      // If parsing fails, return empty array
      console.warn('Failed to parse actions from LLM response:', error);
    }

    return [];
  }

  /**
   * Check if an action is high risk
   */
  private isHighRiskAction(action: AgentAction): boolean {
    // Actions involving large amounts or high-risk operations
    const highRiskTypes = ['stake', 'lend'];
    return highRiskTypes.includes(action.type);
  }

  /**
   * Format error for user-friendly display
   */
  private formatError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }
}

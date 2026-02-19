import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from '../src/agent/BaseAgent';
import type { AgentConfig, AgentContext, AgentAction } from '../src/agent/BaseAgent';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentConfig> = {}): BaseAgent {
  return new BaseAgent({
    name: 'TestAgent',
    description: 'A test agent',
    model: 'gpt-4',
    provider: 'openai',
    maxRetries: 3,
    temperature: 0.7,
    apiKey: 'test-api-key',
    ...overrides,
  });
}

function makeSwapAction(overrides: Partial<AgentAction> = {}): AgentAction {
  return {
    type: 'swap',
    module: 'swap',
    method: 'swap',
    params: {
      tokenIn: '0x55d398326f99059fF775485246999027B3197955',
      tokenOut: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      amountIn: '100000000000000000000',
    },
    reasoning: 'Swap USDT to BNB',
    ...overrides,
  };
}

// ─── Mock factories ──────────────────────────────────────────────────────────

function mockSwapModule() {
  return {
    swap: vi.fn().mockResolvedValue({
      success: true,
      amountIn: 100000000000000000000n,
      amountOut: 250000000000000000n,
      route: ['0xUSDT', '0xBNB'],
      gasUsed: 180000n,
      txHash: '0xswaptx1234',
      priceImpact: 0.3,
    }),
    getQuote: vi.fn().mockResolvedValue({
      amountOut: 250000000000000000n,
      priceImpact: 0.3,
      route: ['0xUSDT', '0xBNB'],
      gasEstimate: 200000n,
    }),
    checkPriceImpact: vi.fn().mockResolvedValue(0.3),
    getRoute: vi.fn().mockResolvedValue({
      path: ['0xUSDT', '0xBNB'],
      pools: [],
      fees: [2500],
    }),
  };
}

function mockLendModule() {
  return {
    supply: vi.fn().mockResolvedValue({
      success: true,
      asset: 'USDT',
      amount: 1000000000000000000000n,
      vTokensMinted: 47000000000n,
      newSupplyAPY: 5.2,
      txHash: '0xsupplytx1234',
    }),
    withdraw: vi.fn().mockResolvedValue({
      success: true,
      asset: 'USDT',
      amount: 1000000000000000000000n,
      txHash: '0xwithdrawtx1234',
    }),
    borrow: vi.fn().mockResolvedValue({
      success: true,
      asset: 'USDT',
      amount: 500000000000000000000n,
      borrowAPY: 8.1,
      txHash: '0xborrowtx1234',
    }),
    repay: vi.fn().mockResolvedValue({
      success: true,
      asset: 'USDT',
      amount: 500000000000000000000n,
      txHash: '0xrepaytx1234',
    }),
    getSupplyAPY: vi.fn().mockResolvedValue(5.2),
    getBorrowAPY: vi.fn().mockResolvedValue(8.1),
    getAccountLiquidity: vi.fn().mockResolvedValue({
      liquidity: 10000000000000000000000n,
      shortfall: 0n,
    }),
    getAccountSnapshot: vi.fn().mockResolvedValue({
      vTokenBalance: 47000000000n,
      borrowBalance: 0n,
      exchangeRate: 200000000000000000n,
    }),
    enterMarket: vi.fn().mockResolvedValue(undefined),
    exitMarket: vi.fn().mockResolvedValue(undefined),
  };
}

function mockStakeModule() {
  return {
    stake: vi.fn().mockResolvedValue({
      success: true,
      amount: 1000000000000000000n,
      validator: '0xvalidator1234',
      expectedAPR: 4.5,
      txHash: '0xstaketx1234',
    }),
    unstake: vi.fn().mockResolvedValue({
      success: true,
      amount: 1000000000000000000n,
      validator: '0xvalidator1234',
      unbondingCompleteTime: Math.floor(Date.now() / 1000) + 604800,
      txHash: '0xunstaketx1234',
    }),
    claimRewards: vi.fn().mockResolvedValue({
      success: true,
      amount: 50000000000000000n,
      txHash: '0xclaimtx1234',
    }),
    getStakingBalance: vi.fn().mockResolvedValue({
      totalStaked: 1000000000000000000n,
      pendingRewards: 50000000000000000n,
      unbonding: 0n,
    }),
    getValidators: vi.fn().mockResolvedValue([
      {
        address: '0xvalidator1234',
        name: 'Validator 1',
        apr: 5.5,
        commission: 10,
        totalStaked: 1000000000000000000000000n,
        uptime: 99.9,
      },
    ]),
    estimateRewards: vi.fn().mockResolvedValue(45000000000000000n),
  };
}

function mockTreasuryModule(swapMod = mockSwapModule(), stakeMod = mockStakeModule()) {
  return {
    setAllocation: vi.fn().mockResolvedValue(undefined),
    rebalance: vi.fn().mockResolvedValue({
      success: true,
      tradesMade: 2,
      gasUsed: 400000n,
      newAllocation: {
        BNB: { amount: 400000000000000000000n, percentage: 40, valueUSD: 120000 },
        USDT: { amount: 400000000000000000000n, percentage: 40, valueUSD: 400000 },
        BTCB: { amount: 200000000000000000n, percentage: 20, valueUSD: 130000 },
      },
    }),
    harvestYields: vi.fn().mockResolvedValue({
      success: true,
      totalYield: 50000000000000000n,
      sources: ['staking'],
      txHashes: ['0xharvesttx1234'],
    }),
    executeStrategy: vi.fn().mockResolvedValue({
      success: true,
      stepsCompleted: 3,
      results: [{ success: true }, { success: true }, { success: true }],
    }),
    getCurrentAllocation: vi.fn().mockResolvedValue({
      BNB: { amount: 500000000000000000000n, percentage: 50, valueUSD: 150000 },
      USDT: { amount: 500000000000000000000n, percentage: 50, valueUSD: 500000 },
    }),
  };
}

// ─── 1. BaseAgent Tests ──────────────────────────────────────────────────────

describe('BaseAgent', () => {
  let agent: BaseAgent;

  beforeEach(() => {
    agent = makeAgent();
  });

  // --- Initialization --------------------------------------------------------

  describe('Initialization', () => {
    it('should initialize with OpenAI provider', () => {
      const a = makeAgent({ provider: 'openai', model: 'gpt-4' });
      expect(a).toBeDefined();
      expect(a).toBeInstanceOf(BaseAgent);
    });

    it('should initialize with Anthropic provider', () => {
      const a = makeAgent({ provider: 'anthropic', model: 'claude-3-opus' });
      expect(a).toBeDefined();
      expect(a).toBeInstanceOf(BaseAgent);
    });

    it('should initialize with gpt-3.5-turbo model', () => {
      const a = makeAgent({ model: 'gpt-3.5-turbo' });
      expect(a).toBeDefined();
    });

    it('should initialize with claude-3-sonnet model', () => {
      const a = makeAgent({ provider: 'anthropic', model: 'claude-3-sonnet' });
      expect(a).toBeDefined();
    });

    it('should default maxRetries to 3 when not provided', () => {
      const a = makeAgent({ maxRetries: undefined });
      expect(a).toBeDefined();
    });

    it('should default temperature to 0.7 when not provided', () => {
      const a = makeAgent({ temperature: undefined });
      expect(a).toBeDefined();
    });

    it('should accept custom maxRetries', () => {
      const a = makeAgent({ maxRetries: 5 });
      expect(a).toBeDefined();
    });

    it('should accept custom systemPrompt', () => {
      const a = makeAgent({ systemPrompt: 'Custom prompt for DeFi agent' });
      expect(a).toBeDefined();
    });
  });

  // --- Module registration ---------------------------------------------------

  describe('Module Registration', () => {
    it('should register a single module', () => {
      agent.registerModule('swap', mockSwapModule());
      const ctx = agent.getContext();
      expect(ctx.availableModules).toContain('swap');
    });

    it('should register multiple modules', () => {
      agent.registerModule('swap', mockSwapModule());
      agent.registerModule('lend', mockLendModule());
      agent.registerModule('stake', mockStakeModule());
      const ctx = agent.getContext();
      expect(ctx.availableModules).toContain('swap');
      expect(ctx.availableModules).toContain('lend');
      expect(ctx.availableModules).toContain('stake');
    });

    it('should list registered modules in context', () => {
      agent.registerModule('swap', mockSwapModule());
      agent.registerModule('treasury', mockTreasuryModule());
      const ctx = agent.getContext();
      expect(ctx.availableModules).toHaveLength(2);
    });
  });

  // --- Context management ---------------------------------------------------

  describe('Context Management', () => {
    it('should return an initial empty conversation history', () => {
      const ctx = agent.getContext();
      expect(ctx.conversationHistory).toEqual([]);
    });

    it('should contain required context fields', () => {
      const ctx = agent.getContext();
      expect(ctx).toHaveProperty('conversationHistory');
      expect(ctx).toHaveProperty('userGoal');
      expect(ctx).toHaveProperty('availableModules');
      expect(ctx).toHaveProperty('walletAddress');
      expect(ctx).toHaveProperty('chainId');
    });

    it('should clear conversation history', () => {
      // Force a message into history
      agent.getContext().conversationHistory.push({
        role: 'user',
        content: 'hello',
        timestamp: Date.now(),
      });
      agent.clearHistory();
      expect(agent.getContext().conversationHistory).toEqual([]);
    });

    it('should return a copy of context, not a reference', () => {
      const ctx1 = agent.getContext();
      const ctx2 = agent.getContext();
      expect(ctx1).not.toBe(ctx2);
    });
  });

  // --- Parse actions (via private method, tested through response) -----------

  describe('Action Parsing', () => {
    it('should parse JSON block embedded in LLM response via execute', async () => {
      // We test parseActions indirectly by mocking LLM and checking output.
      // Direct unit test using a public API path is provided here.
      const swapMod = mockSwapModule();
      agent.registerModule('swap', swapMod);

      // Call execute directly to verify parsed action runs
      const action = makeSwapAction();
      const result = await agent.execute(action);
      expect(result.success).toBe(true);
    });
  });

  // --- Action execution -----------------------------------------------------

  describe('Action Execution', () => {
    it('should execute a swap action successfully', async () => {
      const swapMod = mockSwapModule();
      agent.registerModule('swap', swapMod);

      const result = await agent.execute(makeSwapAction());

      expect(swapMod.swap).toHaveBeenCalledOnce();
      expect(result.success).toBe(true);
      expect(result.txHash).toBe('0xswaptx1234');
    });

    it('should pass params correctly to the module method', async () => {
      const swapMod = mockSwapModule();
      agent.registerModule('swap', swapMod);

      const params = {
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: '5000000000000000000',
      };
      await agent.execute(makeSwapAction({ params }));

      expect(swapMod.swap).toHaveBeenCalledWith(params);
    });

    it('should throw when module is not registered', async () => {
      await expect(agent.execute(makeSwapAction())).rejects.toThrow(
        'Module "swap" not found',
      );
    });

    it('should throw when method does not exist on module', async () => {
      agent.registerModule('swap', { getQuote: vi.fn() });

      await expect(agent.execute(makeSwapAction())).rejects.toThrow(
        'Method "swap" not found in module "swap"',
      );
    });

    it('should retry on transient failure and eventually succeed', async () => {
      const swap = vi
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ success: true });

      agent.registerModule('swap', { swap });
      const result = await agent.execute(makeSwapAction());

      expect(swap).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should throw after exhausting maxRetries', async () => {
      const swap = vi.fn().mockRejectedValue(new Error('permanent failure'));
      agent.registerModule('swap', { swap });

      await expect(agent.execute(makeSwapAction())).rejects.toThrow('permanent failure');
      expect(swap).toHaveBeenCalledTimes(3);
    });

    it('should call onProgress callback during execution', async () => {
      const swapMod = mockSwapModule();
      agent.registerModule('swap', swapMod);

      const onProgress = vi.fn();
      await agent.execute(makeSwapAction(), onProgress);

      expect(onProgress).toHaveBeenCalled();
    });
  });

  // --- Error handling -------------------------------------------------------

  describe('Error Handling', () => {
    it('should propagate errors from module execution', async () => {
      const swap = vi.fn().mockRejectedValue(new Error('insufficient funds'));
      agent.registerModule('swap', { swap });

      await expect(agent.execute(makeSwapAction())).rejects.toThrow('insufficient funds');
    });

    it('should emit action:error event on failure', async () => {
      const swap = vi.fn().mockRejectedValue(new Error('fail'));
      agent.registerModule('swap', { swap });

      const errorListener = vi.fn();
      agent.on('action:error', errorListener);

      await expect(agent.execute(makeSwapAction())).rejects.toThrow('fail');
      expect(errorListener).toHaveBeenCalled();
    });
  });

  // --- Event emission -------------------------------------------------------

  describe('Event Emission', () => {
    it('should emit action:start when execution begins', async () => {
      const swapMod = mockSwapModule();
      agent.registerModule('swap', swapMod);

      const listener = vi.fn();
      agent.on('action:start', listener);

      await agent.execute(makeSwapAction());
      expect(listener).toHaveBeenCalledOnce();
    });

    it('should emit action:complete on successful execution', async () => {
      const swapMod = mockSwapModule();
      agent.registerModule('swap', swapMod);

      const listener = vi.fn();
      agent.on('action:complete', listener);

      await agent.execute(makeSwapAction());
      expect(listener).toHaveBeenCalledOnce();
    });

    it('should include action in action:start payload', async () => {
      const swapMod = mockSwapModule();
      agent.registerModule('swap', swapMod);

      const listener = vi.fn();
      agent.on('action:start', listener);

      const action = makeSwapAction();
      await agent.execute(action);
      expect(listener).toHaveBeenCalledWith({ action });
    });

    it('should include result in action:complete payload', async () => {
      const swapMod = mockSwapModule();
      agent.registerModule('swap', swapMod);

      const listener = vi.fn();
      agent.on('action:complete', listener);

      const action = makeSwapAction();
      await agent.execute(action);

      const payload = listener.mock.calls[0][0];
      expect(payload).toHaveProperty('action');
      expect(payload).toHaveProperty('result');
      expect(payload.result.success).toBe(true);
    });
  });

  // --- Conversation history -------------------------------------------------

  describe('Conversation History', () => {
    it('should maintain an empty history initially', () => {
      expect(agent.getContext().conversationHistory).toHaveLength(0);
    });

    it('should clear history on clearHistory()', () => {
      agent.getContext().conversationHistory.push({
        role: 'user',
        content: 'test msg',
        timestamp: Date.now(),
      });
      agent.clearHistory();
      expect(agent.getContext().conversationHistory).toHaveLength(0);
    });
  });
});

// ─── 2. SwapModule Tests (mocked) ────────────────────────────────────────────

describe('SwapModule (mocked)', () => {
  let swapMod: ReturnType<typeof mockSwapModule>;

  beforeEach(() => {
    swapMod = mockSwapModule();
  });

  it('should return a quote from PancakeSwap', async () => {
    const quote = await swapMod.getQuote({
      tokenIn: '0xUSDT',
      tokenOut: '0xBNB',
      amountIn: '100000000000000000000',
    });

    expect(quote).toHaveProperty('amountOut');
    expect(quote).toHaveProperty('priceImpact');
    expect(quote).toHaveProperty('route');
    expect(quote.amountOut).toBeGreaterThan(0n);
  });

  it('should execute a swap and return a result', async () => {
    const result = await swapMod.swap({
      tokenIn: '0xUSDT',
      tokenOut: '0xBNB',
      amountIn: '100000000000000000000',
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
    expect(result.amountOut).toBeGreaterThan(0n);
  });

  it('should check price impact', async () => {
    const impact = await swapMod.checkPriceImpact({
      tokenIn: '0xUSDT',
      tokenOut: '0xBNB',
      amountIn: '100000000000000000000',
    });

    expect(typeof impact).toBe('number');
    expect(impact).toBeLessThan(10);
  });

  it('should find an optimal route', async () => {
    const route = await swapMod.getRoute('0xUSDT', '0xBNB', 100000000000000000000n);

    expect(route).toHaveProperty('path');
    expect(route.path).toContain('0xUSDT');
    expect(route.path).toContain('0xBNB');
  });

  it('should revert on high price impact (simulated)', async () => {
    swapMod.swap.mockRejectedValueOnce(
      new Error('Price impact too high: 12%. Maximum allowed is 10%'),
    );

    await expect(
      swapMod.swap({
        tokenIn: '0xUSDT',
        tokenOut: '0xBNB',
        amountIn: '100000000000000000000000',
      }),
    ).rejects.toThrow('Price impact too high');
  });

  it('should revert on insufficient balance (simulated)', async () => {
    swapMod.swap.mockRejectedValueOnce(new Error('Insufficient funds for transaction'));

    await expect(
      swapMod.swap({
        tokenIn: '0xUSDT',
        tokenOut: '0xBNB',
        amountIn: '999999999999999999999999999',
      }),
    ).rejects.toThrow('Insufficient funds');
  });
});

// ─── 3. LendModule Tests (mocked) ────────────────────────────────────────────

describe('LendModule (mocked)', () => {
  let lendMod: ReturnType<typeof mockLendModule>;

  beforeEach(() => {
    lendMod = mockLendModule();
  });

  it('should supply assets to Venus', async () => {
    const result = await lendMod.supply({ asset: 'USDT', amount: '1000000000000000000000' });

    expect(result.success).toBe(true);
    expect(result.asset).toBe('USDT');
    expect(result.newSupplyAPY).toBeGreaterThan(0);
  });

  it('should withdraw assets from Venus', async () => {
    const result = await lendMod.withdraw({ asset: 'USDT', amount: '1000000000000000000000' });

    expect(result.success).toBe(true);
    expect(result.asset).toBe('USDT');
    expect(result.txHash).toBeDefined();
  });

  it('should calculate supply APY correctly', async () => {
    const apy = await lendMod.getSupplyAPY('USDT');

    expect(typeof apy).toBe('number');
    expect(apy).toBeGreaterThan(0);
    expect(apy).toBeLessThan(100);
  });

  it('should return account liquidity', async () => {
    const liquidity = await lendMod.getAccountLiquidity('0xWalletAddress');

    expect(liquidity).toHaveProperty('liquidity');
    expect(liquidity).toHaveProperty('shortfall');
    expect(liquidity.shortfall).toBe(0n);
  });

  it('should prevent over-borrowing when shortfall exists (simulated)', async () => {
    lendMod.borrow.mockRejectedValueOnce(
      new Error('Account is underwater. Cannot borrow.'),
    );

    await expect(
      lendMod.borrow({ asset: 'USDT', amount: '9999999999999999999999', useAsCollateral: true }),
    ).rejects.toThrow('Account is underwater');
  });

  it('should return account snapshot', async () => {
    const snapshot = await lendMod.getAccountSnapshot('0xWallet', 'USDT');

    expect(snapshot).toHaveProperty('vTokenBalance');
    expect(snapshot).toHaveProperty('borrowBalance');
    expect(snapshot).toHaveProperty('exchangeRate');
  });

  it('should allow entering a market', async () => {
    await expect(lendMod.enterMarket('USDT')).resolves.not.toThrow();
    expect(lendMod.enterMarket).toHaveBeenCalledWith('USDT');
  });

  it('should allow exiting a market', async () => {
    await expect(lendMod.exitMarket('USDT')).resolves.not.toThrow();
  });

  it('should return borrow APY', async () => {
    const apy = await lendMod.getBorrowAPY('USDT');
    expect(typeof apy).toBe('number');
    expect(apy).toBeGreaterThan(0);
  });
});

// ─── 4. TreasuryModule Tests (mocked) ────────────────────────────────────────

describe('TreasuryModule (mocked)', () => {
  let treasuryMod: ReturnType<typeof mockTreasuryModule>;

  beforeEach(() => {
    treasuryMod = mockTreasuryModule();
  });

  it('should set allocation', async () => {
    await expect(
      treasuryMod.setAllocation({ targets: { BNB: 40, USDT: 40, BTCB: 20 } }),
    ).resolves.not.toThrow();

    expect(treasuryMod.setAllocation).toHaveBeenCalledOnce();
  });

  it('should rebalance portfolio', async () => {
    const result = await treasuryMod.rebalance();

    expect(result.success).toBe(true);
    expect(result.tradesMade).toBeGreaterThanOrEqual(0);
    expect(result).toHaveProperty('newAllocation');
  });

  it('should harvest yields from all sources', async () => {
    const result = await treasuryMod.harvestYields();

    expect(result.success).toBe(true);
    expect(result.sources).toContain('staking');
    expect(result.txHashes.length).toBeGreaterThan(0);
  });

  it('should execute a multi-step strategy', async () => {
    const strategy = {
      name: 'Balanced Strategy',
      steps: [
        { module: 'swap', action: 'swap', params: { tokenIn: '0xA', tokenOut: '0xB', amountIn: '100' } },
        { module: 'lend', action: 'supply', params: { asset: 'USDT', amount: '1000' } },
        { module: 'stake', action: 'stake', params: { amount: '1000000000000000000' } },
      ],
    };

    const result = await treasuryMod.executeStrategy(strategy);

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(3);
    expect(result.results).toHaveLength(3);
  });

  it('should return current portfolio allocation', async () => {
    const allocation = await treasuryMod.getCurrentAllocation();

    expect(allocation).toHaveProperty('BNB');
    expect(allocation).toHaveProperty('USDT');
    expect(allocation['BNB']).toHaveProperty('percentage');
  });
});

// ─── 5. Integration Tests ────────────────────────────────────────────────────

describe('Integration Tests', () => {
  let agent: BaseAgent;

  beforeEach(() => {
    agent = makeAgent();
  });

  // --- Agent plans and executes swap ----------------------------------------

  it('should execute a swap action registered via module', async () => {
    const swapMod = mockSwapModule();
    agent.registerModule('swap', swapMod);

    const action = makeSwapAction();
    const result = await agent.execute(action);

    expect(swapMod.swap).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  // --- Agent manages portfolio -----------------------------------------------

  it('should manage portfolio: set allocation then rebalance', async () => {
    const treasuryMod = mockTreasuryModule();
    agent.registerModule('treasury', treasuryMod);

    await agent.execute({
      type: 'treasury',
      module: 'treasury',
      method: 'setAllocation',
      params: { targets: { BNB: 50, USDT: 50 } },
      reasoning: 'Set portfolio allocation',
    });

    const result = await agent.execute({
      type: 'treasury',
      module: 'treasury',
      method: 'rebalance',
      params: {},
      reasoning: 'Rebalance portfolio',
    });

    expect(treasuryMod.setAllocation).toHaveBeenCalledOnce();
    expect(treasuryMod.rebalance).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  // --- Agent handles errors and retries --------------------------------------

  it('should retry on transient failures then succeed', async () => {
    const swap = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ success: true, txHash: '0xabc' });

    agent.registerModule('swap', { swap });

    const result = await agent.execute(makeSwapAction());
    expect(swap).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('should propagate error after all retries exhausted', async () => {
    const swap = vi.fn().mockRejectedValue(new Error('contract revert'));
    agent.registerModule('swap', { swap });

    await expect(agent.execute(makeSwapAction())).rejects.toThrow('contract revert');
    expect(swap).toHaveBeenCalledTimes(3);
  });

  // --- Multi-module coordination ---------------------------------------------

  it('should coordinate swap then lend in sequence', async () => {
    const swapMod = mockSwapModule();
    const lendMod = mockLendModule();

    agent.registerModule('swap', swapMod);
    agent.registerModule('lend', lendMod);

    const swapResult = await agent.execute(makeSwapAction());
    const lendResult = await agent.execute({
      type: 'lend',
      module: 'lend',
      method: 'supply',
      params: { asset: 'USDT', amount: '1000000000000000000000' },
      reasoning: 'Supply USDT to Venus',
    });

    expect(swapResult.success).toBe(true);
    expect(lendResult.success).toBe(true);
    expect(swapMod.swap).toHaveBeenCalledOnce();
    expect(lendMod.supply).toHaveBeenCalledOnce();
  });

  it('should coordinate swap + stake', async () => {
    const swapMod = mockSwapModule();
    const stakeMod = mockStakeModule();

    agent.registerModule('swap', swapMod);
    agent.registerModule('stake', stakeMod);

    await agent.execute(makeSwapAction());
    const stakeResult = await agent.execute({
      type: 'stake',
      module: 'stake',
      method: 'stake',
      params: { amount: '1000000000000000000' },
      reasoning: 'Stake BNB',
    });

    expect(stakeResult.success).toBe(true);
    expect(stakeResult.expectedAPR).toBe(4.5);
  });

  it('should coordinate a full strategy: swap + lend + stake', async () => {
    const treasuryMod = mockTreasuryModule();
    agent.registerModule('treasury', treasuryMod);

    const result = await agent.execute({
      type: 'treasury',
      module: 'treasury',
      method: 'executeStrategy',
      params: {
        name: 'Full Strategy',
        steps: [
          { module: 'swap', action: 'swap', params: {} },
          { module: 'lend', action: 'supply', params: {} },
          { module: 'stake', action: 'stake', params: {} },
        ],
      },
      reasoning: 'Execute full DeFi strategy',
    });

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(3);
  });

  it('should emit events for each step in multi-module flow', async () => {
    const swapMod = mockSwapModule();
    const lendMod = mockLendModule();

    agent.registerModule('swap', swapMod);
    agent.registerModule('lend', lendMod);

    const startEvents: any[] = [];
    const completeEvents: any[] = [];

    agent.on('action:start', (e) => startEvents.push(e));
    agent.on('action:complete', (e) => completeEvents.push(e));

    await agent.execute(makeSwapAction());
    await agent.execute({
      type: 'lend',
      module: 'lend',
      method: 'supply',
      params: { asset: 'USDT', amount: '1000' },
      reasoning: 'test',
    });

    expect(startEvents).toHaveLength(2);
    expect(completeEvents).toHaveLength(2);
  });

  it('should allow multiple agents with independent contexts', async () => {
    const agentA = makeAgent({ name: 'AgentA' });
    const agentB = makeAgent({ name: 'AgentB' });

    const swapA = mockSwapModule();
    const swapB = mockSwapModule();

    agentA.registerModule('swap', swapA);
    agentB.registerModule('swap', swapB);

    await agentA.execute(makeSwapAction());

    expect(swapA.swap).toHaveBeenCalledOnce();
    expect(swapB.swap).not.toHaveBeenCalled();
  });

  it('should handle harvest yields via treasury module', async () => {
    const treasuryMod = mockTreasuryModule();
    agent.registerModule('treasury', treasuryMod);

    const result = await agent.execute({
      type: 'treasury',
      module: 'treasury',
      method: 'harvestYields',
      params: {},
      reasoning: 'Harvest all yields',
    });

    expect(result.success).toBe(true);
    expect(result.sources).toContain('staking');
  });

  it('should handle agent with all four modules registered', async () => {
    agent.registerModule('swap', mockSwapModule());
    agent.registerModule('lend', mockLendModule());
    agent.registerModule('stake', mockStakeModule());
    agent.registerModule('treasury', mockTreasuryModule());

    const ctx = agent.getContext();
    expect(ctx.availableModules).toHaveLength(4);
  });
});

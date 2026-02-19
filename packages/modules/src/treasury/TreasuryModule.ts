import { Module, ModuleConfig, ModuleMetadata } from '@bnb-claw/core';
import { z } from 'zod';
import { SwapModule } from '../swap/SwapModule';
import { LendModule } from '../lend/LendModule';
import { StakeModule } from '../stake/StakeModule';

export interface TreasuryConfig extends ModuleConfig {
  swapModule: SwapModule;
  lendModule: LendModule;
  stakeModule: StakeModule;
  rebalanceThreshold: number; // percentage deviation to trigger rebalance
}

// Validation schemas
const AllocationParamsSchema = z.object({
  targets: z.record(z.number().min(0).max(100)),
});

const DCAParamsSchema = z.object({
  asset: z.string(),
  amount: z.string(),
  frequency: z.number(), // seconds
});

export type AllocationParams = z.infer<typeof AllocationParamsSchema>;
export type DCAParams = z.infer<typeof DCAParamsSchema>;

export interface Allocation {
  [asset: string]: {
    amount: bigint;
    percentage: number;
    valueUSD: number;
  };
}

export interface RebalanceResult {
  success: boolean;
  tradesMade: number;
  gasUsed: bigint;
  newAllocation: Allocation;
}

export interface HarvestResult {
  success: boolean;
  totalYield: bigint;
  sources: string[];
  txHashes: string[];
}

export interface DCAResult {
  success: boolean;
  asset: string;
  amountBought: bigint;
  nextExecutionTime: number;
  txHash: string;
}

export interface Strategy {
  name: string;
  steps: StrategyStep[];
}

export interface StrategyStep {
  module: string;
  action: string;
  params: any;
}

export interface StrategyResult {
  success: boolean;
  stepsCompleted: number;
  results: any[];
}

/**
 * TreasuryModule - Portfolio management and multi-module orchestration
 * 
 * Combines Swap, Lend, and Stake modules to execute complex DeFi strategies.
 */
export class TreasuryModule extends Module {
  private treasuryConfig: TreasuryConfig;
  private targetAllocation: Record<string, number> = {};

  constructor(config: TreasuryConfig) {
    super(config);
    this.treasuryConfig = config;
  }

  /**
   * Get module metadata
   */
  getMetadata(): ModuleMetadata {
    return {
      name: 'TreasuryModule',
      description: 'Portfolio management and rebalancing',
      version: '0.1.0',
      capabilities: [
        {
          name: 'setAllocation',
          description: 'Set target portfolio allocation',
          inputSchema: AllocationParamsSchema,
          outputSchema: z.any(),
          gasEstimate: 0,
          riskLevel: 'low',
        },
        {
          name: 'rebalance',
          description: 'Rebalance portfolio to target allocation',
          inputSchema: z.object({}),
          outputSchema: z.any(),
          gasEstimate: 500000,
          riskLevel: 'medium',
        },
      ],
      requiredPermissions: ['swap', 'lend', 'stake', 'treasury'],
    };
  }

  /**
   * Set target allocation
   */
  async setAllocation(params: AllocationParams): Promise<void> {
    const validated = await this.validateInput(AllocationParamsSchema, params);

    // Validate targets sum to 100%
    const total = Object.values(validated.targets).reduce((sum, pct) => sum + pct, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Target allocation must sum to 100%. Current sum: ${total}%`);
    }

    this.targetAllocation = validated.targets;
    this.emit('treasury:allocation-updated', { targets: validated.targets });
  }

  /**
   * Rebalance portfolio to target allocation
   */
  async rebalance(): Promise<RebalanceResult> {
    if (Object.keys(this.targetAllocation).length === 0) {
      throw new Error('No target allocation set. Call setAllocation() first.');
    }

    this.emit('treasury:rebalance:start');

    try {
      const currentAllocation = await this.getCurrentAllocation();
      const trades = this.calculateRebalanceTrades(currentAllocation);

      let totalGasUsed = 0n;
      let tradesMade = 0;

      // Execute trades via SwapModule
      for (const trade of trades) {
        const result = await this.treasuryConfig.swapModule.swap({
          tokenIn: trade.from,
          tokenOut: trade.to,
          amountIn: trade.amount.toString(),
        });

        totalGasUsed += result.gasUsed;
        tradesMade++;
      }

      const newAllocation = await this.getCurrentAllocation();

      const result: RebalanceResult = {
        success: true,
        tradesMade,
        gasUsed: totalGasUsed,
        newAllocation,
      };

      this.emit('treasury:rebalance:complete', { result });
      return result;
    } catch (error) {
      this.emit('treasury:rebalance:error', { error });
      throw this.formatError(error);
    }
  }

  /**
   * Get current portfolio allocation
   */
  async getCurrentAllocation(): Promise<Allocation> {
    if (!this.signer) {
      throw new Error('Signer required to get allocation');
    }

    const address = await this.signer.getAddress();
    
    // Mock implementation - would query balances from multiple sources
    const allocation: Allocation = {
      'BNB': {
        amount: 0n,
        percentage: 0,
        valueUSD: 0,
      },
    };

    return allocation;
  }

  /**
   * Harvest yields from all modules
   */
  async harvestYields(): Promise<HarvestResult> {
    const txHashes: string[] = [];
    const sources: string[] = [];
    let totalYield = 0n;

    try {
      // Claim staking rewards
      if (this.signer) {
        const stakingResult = await this.treasuryConfig.stakeModule.claimRewards();
        totalYield += stakingResult.amount;
        txHashes.push(stakingResult.txHash);
        sources.push('staking');
      }

      // Could also withdraw accrued lending interest, etc.

      const result: HarvestResult = {
        success: true,
        totalYield,
        sources,
        txHashes,
      };

      this.emit('treasury:harvest:complete', { result });
      return result;
    } catch (error) {
      this.emit('treasury:harvest:error', { error });
      throw this.formatError(error);
    }
  }

  /**
   * Execute dollar-cost averaging strategy
   */
  async executeDCA(params: DCAParams): Promise<DCAResult> {
    const validated = await this.validateInput(DCAParamsSchema, params);

    // Execute buy via SwapModule
    // For simplicity, assuming we're buying with a stablecoin
    const stablecoin = '0x55d398326f99059fF775485246999027B3197955'; // USDT on BSC

    const swapResult = await this.treasuryConfig.swapModule.swap({
      tokenIn: stablecoin,
      tokenOut: validated.asset,
      amountIn: validated.amount,
    });

    const nextExecutionTime = Math.floor(Date.now() / 1000) + validated.frequency;

    const result: DCAResult = {
      success: true,
      asset: validated.asset,
      amountBought: swapResult.amountOut,
      nextExecutionTime,
      txHash: swapResult.txHash,
    };

    return result;
  }

  /**
   * Execute a complex multi-step strategy
   */
  async executeStrategy(strategy: Strategy): Promise<StrategyResult> {
    this.emit('treasury:strategy:start', { strategy });

    const results: any[] = [];
    let stepsCompleted = 0;

    try {
      for (const step of strategy.steps) {
        let module: any;
        
        switch (step.module) {
          case 'swap':
            module = this.treasuryConfig.swapModule;
            break;
          case 'lend':
            module = this.treasuryConfig.lendModule;
            break;
          case 'stake':
            module = this.treasuryConfig.stakeModule;
            break;
          default:
            throw new Error(`Unknown module: ${step.module}`);
        }

        const result = await module[step.action](step.params);
        results.push(result);
        stepsCompleted++;
      }

      const strategyResult: StrategyResult = {
        success: true,
        stepsCompleted,
        results,
      };

      this.emit('treasury:strategy:complete', { result: strategyResult });
      return strategyResult;
    } catch (error) {
      this.emit('treasury:strategy:error', { error, stepsCompleted });
      throw this.formatError(error);
    }
  }

  /**
   * Calculate trades needed to rebalance
   */
  private calculateRebalanceTrades(currentAllocation: Allocation): Array<{ from: string; to: string; amount: bigint }> {
    const trades: Array<{ from: string; to: string; amount: bigint }> = [];
    
    // Simplified logic - in production would be more sophisticated
    for (const [asset, target] of Object.entries(this.targetAllocation)) {
      const current = currentAllocation[asset]?.percentage || 0;
      const deviation = Math.abs(current - target);
      
      if (deviation > this.treasuryConfig.rebalanceThreshold) {
        // Would calculate actual trade amounts and pairs
        console.log(`Rebalance needed for ${asset}: ${current}% -> ${target}%`);
      }
    }

    return trades;
  }
}

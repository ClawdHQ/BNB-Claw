import { Module, ModuleConfig, ModuleMetadata } from '@bnb-claw/core';
import { ethers } from 'ethers';
import { z } from 'zod';

export interface StakeConfig extends ModuleConfig {
  stakingContract: string;
  minStakeAmount: bigint;
  unbondingPeriod: number; // seconds
}

// Validation schemas
const StakeParamsSchema = z.object({
  amount: z.string().min(1, 'Amount required'),
  validator: z.string().optional(),
});

const UnstakeParamsSchema = z.object({
  amount: z.string().min(1, 'Amount required'),
  validator: z.string().optional(),
});

export type StakeParams = z.infer<typeof StakeParamsSchema>;
export type UnstakeParams = z.infer<typeof UnstakeParamsSchema>;

export interface StakeResult {
  success: boolean;
  amount: bigint;
  validator: string;
  expectedAPR: number;
  txHash: string;
}

export interface UnstakeResult {
  success: boolean;
  amount: bigint;
  validator: string;
  unbondingCompleteTime: number;
  txHash: string;
}

export interface ClaimResult {
  success: boolean;
  amount: bigint;
  txHash: string;
}

export interface StakingBalance {
  totalStaked: bigint;
  pendingRewards: bigint;
  unbonding: bigint;
  unbondingCompleteTime?: number;
}

export interface Validator {
  address: string;
  name: string;
  apr: number;
  commission: number;
  totalStaked: bigint;
  uptime: number; // percentage
}

/**
 * StakeModule - BNB Chain native staking integration
 * 
 * Enables AI agents to stake BNB for rewards via validators.
 */
export class StakeModule extends Module {
  private stakeConfig: StakeConfig;
  
  private stakingABI = [
    'function delegate(address validator) payable',
    'function undelegate(address validator, uint256 amount)',
    'function claimRewards(address validator) returns (uint256)',
    'function getDelegatorStake(address delegator, address validator) view returns (uint256)',
    'function getPendingRewards(address delegator, address validator) view returns (uint256)',
  ];

  constructor(config: StakeConfig) {
    super(config);
    this.stakeConfig = config;
  }

  /**
   * Get module metadata
   */
  getMetadata(): ModuleMetadata {
    return {
      name: 'StakeModule',
      description: 'BNB Chain native staking',
      version: '0.1.0',
      capabilities: [
        {
          name: 'stake',
          description: 'Stake BNB to validators for rewards',
          inputSchema: StakeParamsSchema,
          outputSchema: z.any(),
          gasEstimate: 150000,
          riskLevel: 'medium',
        },
        {
          name: 'unstake',
          description: 'Unstake BNB from validators',
          inputSchema: UnstakeParamsSchema,
          outputSchema: z.any(),
          gasEstimate: 150000,
          riskLevel: 'medium',
        },
      ],
      requiredPermissions: ['stake'],
    };
  }

  /**
   * Stake BNB to a validator
   */
  async stake(params: StakeParams): Promise<StakeResult> {
    const validated = await this.validateInput(StakeParamsSchema, params);
    
    if (!this.signer) {
      throw new Error('Signer required for staking');
    }

    const amount = BigInt(validated.amount);
    
    // Check minimum stake amount
    if (amount < this.stakeConfig.minStakeAmount) {
      throw new Error(`Amount below minimum stake: ${this.formatUnits(this.stakeConfig.minStakeAmount, 18)} BNB`);
    }

    // Select validator
    const validator = validated.validator || await this.selectBestValidator();

    this.emit('stake:start', { amount, validator });

    try {
      const stakingContract = this.getContract(this.stakeConfig.stakingContract, this.stakingABI);
      
      const tx = await stakingContract.delegate(validator, { value: amount });
      const receipt = await tx.wait();

      const apr = await this.getValidatorAPR(validator);

      const result: StakeResult = {
        success: true,
        amount,
        validator,
        expectedAPR: apr,
        txHash: receipt.hash,
      };

      this.emit('stake:complete', { result });
      return result;
    } catch (error) {
      this.emit('stake:error', { error });
      throw this.formatError(error);
    }
  }

  /**
   * Unstake BNB from a validator
   */
  async unstake(params: UnstakeParams): Promise<UnstakeResult> {
    const validated = await this.validateInput(UnstakeParamsSchema, params);
    
    if (!this.signer) {
      throw new Error('Signer required for unstaking');
    }

    const amount = BigInt(validated.amount);
    const validator = validated.validator || ''; // Would need to query current validators

    const stakingContract = this.getContract(this.stakeConfig.stakingContract, this.stakingABI);
    
    const tx = await stakingContract.undelegate(validator, amount);
    const receipt = await tx.wait();

    const unbondingCompleteTime = Math.floor(Date.now() / 1000) + this.stakeConfig.unbondingPeriod;

    const result: UnstakeResult = {
      success: true,
      amount,
      validator,
      unbondingCompleteTime,
      txHash: receipt.hash,
    };

    this.emit('stake:unstake:complete', { result });
    return result;
  }

  /**
   * Claim staking rewards
   */
  async claimRewards(validator?: string): Promise<ClaimResult> {
    if (!this.signer) {
      throw new Error('Signer required for claiming rewards');
    }

    const validatorAddress = validator || ''; // Would need default validator

    const stakingContract = this.getContract(this.stakeConfig.stakingContract, this.stakingABI);
    
    const tx = await stakingContract.claimRewards(validatorAddress);
    const receipt = await tx.wait();

    const result: ClaimResult = {
      success: true,
      amount: 0n, // Would parse from logs
      txHash: receipt.hash,
    };

    return result;
  }

  /**
   * Get staking balance for an account
   */
  async getStakingBalance(account: string): Promise<StakingBalance> {
    const stakingContract = this.getContract(this.stakeConfig.stakingContract, this.stakingABI);

    // Simplified - would need to iterate over all validators
    const validator = ''; // Default validator
    const totalStaked = await stakingContract.getDelegatorStake(account, validator);
    const pendingRewards = await stakingContract.getPendingRewards(account, validator);

    return {
      totalStaked,
      pendingRewards,
      unbonding: 0n,
    };
  }

  /**
   * Get list of validators
   */
  async getValidators(): Promise<Validator[]> {
    // Mock implementation - would query from chain
    const validators: Validator[] = [
      {
        address: '0x0000000000000000000000000000000000001000',
        name: 'Validator 1',
        apr: 5.5,
        commission: 10,
        totalStaked: ethers.parseEther('1000000'),
        uptime: 99.9,
      },
    ];

    return validators.sort((a, b) => b.apr - a.apr);
  }

  /**
   * Get validator APR
   */
  async getValidatorAPR(validator: string): Promise<number> {
    // Simplified calculation
    const baseAPR = 5; // percentage
    const commission = 0.1; // 10%
    const validatorAPR = baseAPR * (1 - commission);
    
    return validatorAPR;
  }

  /**
   * Estimate rewards for staking
   */
  async estimateRewards(amount: bigint, duration: number): Promise<bigint> {
    const validators = await this.getValidators();
    const avgAPR = validators.reduce((sum, v) => sum + v.apr, 0) / validators.length;
    
    const yearlyRewards = (amount * BigInt(Math.floor(avgAPR * 100))) / 10000n;
    const durationYears = duration / (365 * 24 * 60 * 60);
    const estimatedRewards = (yearlyRewards * BigInt(Math.floor(durationYears * 1000))) / 1000n;

    return estimatedRewards;
  }

  /**
   * Select best validator based on APR and uptime
   */
  private async selectBestValidator(): Promise<string> {
    const validators = await this.getValidators();
    
    // Filter by good uptime
    const goodValidators = validators.filter(v => v.uptime > 95);
    
    // Sort by APR
    goodValidators.sort((a, b) => b.apr - a.apr);
    
    if (goodValidators.length === 0) {
      throw new Error('No suitable validators found');
    }

    return goodValidators[0].address;
  }
}

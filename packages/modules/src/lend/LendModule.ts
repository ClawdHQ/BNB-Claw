import { Module, ModuleConfig, ModuleMetadata } from '@bnb-claw/core';
import { ethers } from 'ethers';
import { z } from 'zod';

export interface LendConfig extends ModuleConfig {
  comptrollerAddress: string;
  vTokens: Record<string, string>; // e.g., { USDT: vUSDT_address }
}

// Validation schemas
const SupplyParamsSchema = z.object({
  asset: z.string().min(1, 'Asset required'),
  amount: z.string().min(1, 'Amount required'),
});

const WithdrawParamsSchema = z.object({
  asset: z.string().min(1, 'Asset required'),
  amount: z.string().min(1, 'Amount required'),
});

const BorrowParamsSchema = z.object({
  asset: z.string().min(1, 'Asset required'),
  amount: z.string().min(1, 'Amount required'),
  useAsCollateral: z.boolean().default(true),
});

const RepayParamsSchema = z.object({
  asset: z.string().min(1, 'Asset required'),
  amount: z.string().min(1, 'Amount required'),
});

export type SupplyParams = z.infer<typeof SupplyParamsSchema>;
export type WithdrawParams = z.infer<typeof WithdrawParamsSchema>;
export type BorrowParams = z.infer<typeof BorrowParamsSchema>;
export type RepayParams = z.infer<typeof RepayParamsSchema>;

export interface SupplyResult {
  success: boolean;
  asset: string;
  amount: bigint;
  vTokensMinted: bigint;
  newSupplyAPY: number;
  txHash: string;
}

export interface WithdrawResult {
  success: boolean;
  asset: string;
  amount: bigint;
  txHash: string;
}

export interface BorrowResult {
  success: boolean;
  asset: string;
  amount: bigint;
  borrowAPY: number;
  txHash: string;
}

export interface RepayResult {
  success: boolean;
  asset: string;
  amount: bigint;
  txHash: string;
}

export interface AccountLiquidity {
  liquidity: bigint; // Available to borrow
  shortfall: bigint; // Underwater amount
}

export interface AccountSnapshot {
  vTokenBalance: bigint;
  borrowBalance: bigint;
  exchangeRate: bigint;
}

/**
 * LendModule - Venus Protocol integration for lending and borrowing
 * 
 * Enables AI agents to supply assets, borrow against collateral,
 * and earn interest on supplied assets.
 */
export class LendModule extends Module {
  private lendConfig: LendConfig;
  
  private vTokenABI = [
    'function mint(uint256 mintAmount) returns (uint256)',
    'function redeem(uint256 redeemTokens) returns (uint256)',
    'function redeemUnderlying(uint256 redeemAmount) returns (uint256)',
    'function borrow(uint256 borrowAmount) returns (uint256)',
    'function repayBorrow(uint256 repayAmount) returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function borrowBalanceCurrent(address account) returns (uint256)',
    'function getAccountSnapshot(address account) view returns (uint256, uint256, uint256, uint256)',
    'function supplyRatePerBlock() view returns (uint256)',
    'function borrowRatePerBlock() view returns (uint256)',
    'function exchangeRateCurrent() returns (uint256)',
  ];

  private comptrollerABI = [
    'function enterMarkets(address[] calldata vTokens) returns (uint256[] memory)',
    'function exitMarket(address vToken) returns (uint256)',
    'function getAccountLiquidity(address account) view returns (uint256, uint256, uint256)',
  ];

  constructor(config: LendConfig) {
    super(config);
    this.lendConfig = config;
  }

  /**
   * Get module metadata
   */
  getMetadata(): ModuleMetadata {
    return {
      name: 'LendModule',
      description: 'Lending and borrowing on Venus Protocol',
      version: '0.1.0',
      capabilities: [
        {
          name: 'supply',
          description: 'Supply assets to earn interest',
          inputSchema: SupplyParamsSchema,
          outputSchema: z.any(),
          gasEstimate: 250000,
          riskLevel: 'low',
        },
        {
          name: 'borrow',
          description: 'Borrow assets against collateral',
          inputSchema: BorrowParamsSchema,
          outputSchema: z.any(),
          gasEstimate: 300000,
          riskLevel: 'high',
        },
      ],
      requiredPermissions: ['token-approval', 'lend', 'borrow'],
    };
  }

  /**
   * Supply assets to Venus
   */
  async supply(params: SupplyParams): Promise<SupplyResult> {
    const validated = await this.validateInput(SupplyParamsSchema, params);
    
    if (!this.signer) {
      throw new Error('Signer required for supply');
    }

    const vTokenAddress = this.lendConfig.vTokens[validated.asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${validated.asset}`);
    }

    const amount = BigInt(validated.amount);
    
    this.emit('lend:supply:start', { params: validated });

    try {
      // Get underlying token address (simplified - would need to query vToken)
      // Approve underlying token
      // await this.approveToken(underlyingToken, vTokenAddress, amount);

      // Mint vTokens
      const vToken = this.getContract(vTokenAddress, this.vTokenABI);
      const tx = await vToken.mint(amount);
      const receipt = await tx.wait();

      // Get APY
      const apy = await this.getSupplyAPY(validated.asset);

      const result: SupplyResult = {
        success: true,
        asset: validated.asset,
        amount,
        vTokensMinted: 0n, // Would parse from logs
        newSupplyAPY: apy,
        txHash: receipt.hash,
      };

      this.emit('lend:supply:complete', { result });
      return result;
    } catch (error) {
      this.emit('lend:supply:error', { error });
      throw this.formatError(error);
    }
  }

  /**
   * Withdraw supplied assets
   */
  async withdraw(params: WithdrawParams): Promise<WithdrawResult> {
    const validated = await this.validateInput(WithdrawParamsSchema, params);
    
    const vTokenAddress = this.lendConfig.vTokens[validated.asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${validated.asset}`);
    }

    const amount = BigInt(validated.amount);
    
    const vToken = this.getContract(vTokenAddress, this.vTokenABI);
    const tx = await vToken.redeemUnderlying(amount);
    const receipt = await tx.wait();

    const result: WithdrawResult = {
      success: true,
      asset: validated.asset,
      amount,
      txHash: receipt.hash,
    };

    return result;
  }

  /**
   * Borrow assets against collateral
   */
  async borrow(params: BorrowParams): Promise<BorrowResult> {
    const validated = await this.validateInput(BorrowParamsSchema, params);
    
    if (!this.signer) {
      throw new Error('Signer required for borrow');
    }

    const vTokenAddress = this.lendConfig.vTokens[validated.asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${validated.asset}`);
    }

    const amount = BigInt(validated.amount);

    // Check account liquidity
    const liquidity = await this.getAccountLiquidity(await this.signer.getAddress());
    if (liquidity.shortfall > 0n) {
      throw new Error('Account is underwater. Cannot borrow.');
    }

    // Enter market if needed
    if (validated.useAsCollateral) {
      await this.enterMarket(validated.asset);
    }

    // Borrow
    const vToken = this.getContract(vTokenAddress, this.vTokenABI);
    const tx = await vToken.borrow(amount);
    const receipt = await tx.wait();

    const apy = await this.getBorrowAPY(validated.asset);

    const result: BorrowResult = {
      success: true,
      asset: validated.asset,
      amount,
      borrowAPY: apy,
      txHash: receipt.hash,
    };

    return result;
  }

  /**
   * Repay borrowed assets
   */
  async repay(params: RepayParams): Promise<RepayResult> {
    const validated = await this.validateInput(RepayParamsSchema, params);
    
    const vTokenAddress = this.lendConfig.vTokens[validated.asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${validated.asset}`);
    }

    const amount = BigInt(validated.amount);

    // Approve and repay
    const vToken = this.getContract(vTokenAddress, this.vTokenABI);
    const tx = await vToken.repayBorrow(amount);
    const receipt = await tx.wait();

    const result: RepayResult = {
      success: true,
      asset: validated.asset,
      amount,
      txHash: receipt.hash,
    };

    return result;
  }

  /**
   * Get account liquidity
   */
  async getAccountLiquidity(account: string): Promise<AccountLiquidity> {
    const comptroller = this.getContract(this.lendConfig.comptrollerAddress, this.comptrollerABI);
    const [, liquidity, shortfall] = await comptroller.getAccountLiquidity(account);

    return {
      liquidity,
      shortfall,
    };
  }

  /**
   * Get supply APY for an asset
   */
  async getSupplyAPY(asset: string): Promise<number> {
    const vTokenAddress = this.lendConfig.vTokens[asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${asset}`);
    }

    const vToken = this.getContract(vTokenAddress, this.vTokenABI);
    const ratePerBlock = await vToken.supplyRatePerBlock();

    return this.calculateAPY(ratePerBlock);
  }

  /**
   * Get borrow APY for an asset
   */
  async getBorrowAPY(asset: string): Promise<number> {
    const vTokenAddress = this.lendConfig.vTokens[asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${asset}`);
    }

    const vToken = this.getContract(vTokenAddress, this.vTokenABI);
    const ratePerBlock = await vToken.borrowRatePerBlock();

    return this.calculateAPY(ratePerBlock);
  }

  /**
   * Get account snapshot
   */
  async getAccountSnapshot(account: string, asset: string): Promise<AccountSnapshot> {
    const vTokenAddress = this.lendConfig.vTokens[asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${asset}`);
    }

    const vToken = this.getContract(vTokenAddress, this.vTokenABI);
    const [, vTokenBalance, borrowBalance, exchangeRate] = await vToken.getAccountSnapshot(account);

    return {
      vTokenBalance,
      borrowBalance,
      exchangeRate,
    };
  }

  /**
   * Enter market (enable asset as collateral)
   */
  async enterMarket(asset: string): Promise<void> {
    const vTokenAddress = this.lendConfig.vTokens[asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${asset}`);
    }

    const comptroller = this.getContract(this.lendConfig.comptrollerAddress, this.comptrollerABI);
    const tx = await comptroller.enterMarkets([vTokenAddress]);
    await tx.wait();
  }

  /**
   * Exit market (disable asset as collateral)
   */
  async exitMarket(asset: string): Promise<void> {
    const vTokenAddress = this.lendConfig.vTokens[asset];
    if (!vTokenAddress) {
      throw new Error(`vToken not configured for asset: ${asset}`);
    }

    const comptroller = this.getContract(this.lendConfig.comptrollerAddress, this.comptrollerABI);
    const tx = await comptroller.exitMarket(vTokenAddress);
    await tx.wait();
  }

  /**
   * Calculate APY from per-block rate
   * BSC has ~3 second blocks (28,800 blocks/day)
   */
  private calculateAPY(ratePerBlock: bigint): number {
    const blocksPerDay = 28800;
    const daysPerYear = 365;

    const dailyRate = Number(ratePerBlock) * blocksPerDay / 1e18;
    const apy = (Math.pow(1 + dailyRate, daysPerYear) - 1) * 100;

    return apy;
  }
}

import { EventEmitter } from 'eventemitter3';
import { ethers } from 'ethers';
import { z } from 'zod';

export interface ModuleConfig {
  name: string;
  description: string;
  version: string;
  chainId: number;
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

export interface ModuleCapability {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  gasEstimate: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ModuleMetadata {
  name: string;
  description: string;
  version: string;
  capabilities: ModuleCapability[];
  requiredPermissions: string[];
}

/**
 * Module - Base class for all DeFi modules
 * 
 * Provides common functionality for executing on-chain operations,
 * validating inputs, estimating gas, and handling approvals.
 */
export abstract class Module extends EventEmitter {
  protected config: ModuleConfig;
  protected provider: ethers.Provider;
  protected signer?: ethers.Signer;

  constructor(config: ModuleConfig) {
    super();
    this.config = config;
    this.provider = config.provider;
    this.signer = config.signer;
  }

  /**
   * Get module metadata including capabilities
   * Must be implemented by subclasses
   */
  abstract getMetadata(): ModuleMetadata;

  /**
   * Validate input data against Zod schema
   */
  async validateInput<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
    try {
      return await schema.parseAsync(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Validation error: ${messages}`);
      }
      throw error;
    }
  }

  /**
   * Estimate gas for a specific method call
   */
  async estimateGas(method: string, params: any): Promise<bigint> {
    // Default implementation - should be overridden for accurate estimates
    const baseGas = 100000n;
    const buffer = (baseGas * 20n) / 100n; // 20% buffer
    return baseGas + buffer;
  }

  /**
   * Check if token allowance is sufficient
   */
  async checkAllowance(token: string, spender: string, amount: bigint): Promise<boolean> {
    if (!this.signer) {
      throw new Error('Signer required for allowance check');
    }

    const tokenContract = this.getContract(token, [
      'function allowance(address owner, address spender) view returns (uint256)',
    ]);

    const owner = await this.signer.getAddress();
    const allowance = await tokenContract.allowance(owner, spender);
    
    return allowance >= amount;
  }

  /**
   * Approve token spending
   */
  async approveToken(token: string, spender: string, amount: bigint): Promise<void> {
    if (!this.signer) {
      throw new Error('Signer required for token approval');
    }

    const tokenContract = this.getContract(token, [
      'function approve(address spender, uint256 amount) returns (bool)',
    ]);

    this.emit('approval:start', { token, spender, amount });

    const tx = await tokenContract.approve(spender, amount);
    const receipt = await tx.wait();

    this.emit('approval:complete', { token, spender, amount, txHash: receipt.hash });
  }

  /**
   * Execute a transaction with error handling
   */
  protected async executeTransaction(tx: ethers.TransactionRequest): Promise<ethers.TransactionReceipt> {
    if (!this.signer) {
      throw new Error('Signer required for transaction execution');
    }

    try {
      const response = await this.signer.sendTransaction(tx);
      this.emit('transaction:sent', { hash: response.hash, method: 'execute' });

      const receipt = await response.wait(1);
      
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      if (receipt.status === 0) {
        throw new Error('Transaction reverted');
      }

      this.emit('transaction:confirmed', { hash: receipt.hash, receipt });
      return receipt;
    } catch (error) {
      const formattedError = this.formatError(error);
      this.emit('transaction:failed', { error: formattedError });
      throw formattedError;
    }
  }

  /**
   * Get a contract instance
   */
  protected getContract(address: string, abi: any): ethers.Contract {
    return new ethers.Contract(address, abi, this.signer || this.provider);
  }

  /**
   * Format units for display
   */
  protected formatUnits(value: bigint, decimals: number): string {
    return ethers.formatUnits(value, decimals);
  }

  /**
   * Parse units from string
   */
  protected parseUnits(value: string, decimals: number): bigint {
    return ethers.parseUnits(value, decimals);
  }

  /**
   * Format error for user-friendly display
   */
  protected formatError(error: any): Error {
    if (error instanceof Error) {
      // Parse ethers.js specific errors
      if (error.message.includes('insufficient funds')) {
        return new Error('Insufficient funds for transaction');
      }
      if (error.message.includes('user rejected')) {
        return new Error('Transaction rejected by user');
      }
      if (error.message.includes('nonce')) {
        return new Error('Transaction nonce error. Please try again.');
      }
      if (error.message.includes('gas')) {
        return new Error('Gas estimation failed. Transaction may fail.');
      }
      
      return error;
    }
    
    return new Error(String(error));
  }
}

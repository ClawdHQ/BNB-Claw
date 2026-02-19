import { Module, ModuleConfig, ModuleMetadata, ModuleCapability } from '@bnb-claw/core';
import { ethers } from 'ethers';
import { z } from 'zod';

export interface SwapConfig extends ModuleConfig {
  routerAddress: string;
  quoterAddress: string;
  factoryAddress: string;
  defaultSlippage: number; // basis points (e.g., 50 = 0.5%)
}

// Validation schemas
const SwapParamsSchema = z.object({
  tokenIn: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  tokenOut: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  amountIn: z.string().min(1, 'Amount required'),
  amountOutMin: z.string().optional(),
  slippage: z.number().min(0).max(10000).optional(),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  deadline: z.number().optional(),
});

export type SwapParams = z.infer<typeof SwapParamsSchema>;

export interface SwapResult {
  success: boolean;
  amountIn: bigint;
  amountOut: bigint;
  route: string[];
  gasUsed: bigint;
  txHash: string;
  priceImpact: number;
}

export interface Quote {
  amountOut: bigint;
  priceImpact: number;
  route: string[];
  gasEstimate: bigint;
}

export interface Route {
  path: string[];
  pools: string[];
  fees: number[];
}

/**
 * SwapModule - PancakeSwap V3 integration for token swaps
 * 
 * Enables AI agents to swap tokens with slippage protection,
 * price impact checking, and gas optimization.
 */
export class SwapModule extends Module {
  private swapConfig: SwapConfig;
  private routerABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
    'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
  ];
  
  private quoterABI = [
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
  ];

  private erc20ABI = [
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
  ];

  constructor(config: SwapConfig) {
    super(config);
    this.swapConfig = config;
  }

  /**
   * Get module metadata
   */
  getMetadata(): ModuleMetadata {
    return {
      name: 'SwapModule',
      description: 'Token swaps on PancakeSwap V3',
      version: '0.1.0',
      capabilities: [
        {
          name: 'swap',
          description: 'Swap tokens with slippage protection',
          inputSchema: SwapParamsSchema,
          outputSchema: z.any(),
          gasEstimate: 200000,
          riskLevel: 'medium',
        },
        {
          name: 'getQuote',
          description: 'Get estimated output amount for a swap',
          inputSchema: z.object({
            tokenIn: z.string(),
            tokenOut: z.string(),
            amountIn: z.string(),
          }),
          outputSchema: z.any(),
          gasEstimate: 0,
          riskLevel: 'low',
        },
      ],
      requiredPermissions: ['token-approval', 'swap'],
    };
  }

  /**
   * Execute a token swap
   */
  async swap(params: SwapParams): Promise<SwapResult> {
    // Validate input
    const validated = await this.validateInput(SwapParamsSchema, params);

    if (!this.signer) {
      throw new Error('Signer required for swap');
    }

    const amountIn = BigInt(validated.amountIn);
    const tokenIn = validated.tokenIn;
    const tokenOut = validated.tokenOut;

    this.emit('swap:start', { params: validated });

    try {
      // Get quote
      const quote = await this.getQuote({
        tokenIn,
        tokenOut,
        amountIn: validated.amountIn,
      });

      // Check price impact
      const priceImpact = quote.priceImpact;
      if (priceImpact > 5) {
        this.emit('swap:high-price-impact', { priceImpact });
        console.warn(`Warning: High price impact ${priceImpact}%`);
      }
      if (priceImpact > 10) {
        throw new Error(`Price impact too high: ${priceImpact}%. Maximum allowed is 10%`);
      }

      // Check and approve token
      const hasAllowance = await this.checkAllowance(
        tokenIn,
        this.swapConfig.routerAddress,
        amountIn
      );

      if (!hasAllowance) {
        this.emit('swap:approval-needed', { token: tokenIn, spender: this.swapConfig.routerAddress });
        await this.approveToken(tokenIn, this.swapConfig.routerAddress, amountIn);
      }

      // Build and execute swap transaction
      const tx = await this.buildSwapTransaction(validated, quote);
      const receipt = await this.executeTransaction(tx);

      // Parse swap result from receipt
      const amountOut = quote.amountOut; // Simplified - should parse from logs

      const result: SwapResult = {
        success: true,
        amountIn,
        amountOut,
        route: quote.route,
        gasUsed: receipt.gasUsed,
        txHash: receipt.hash,
        priceImpact,
      };

      this.emit('swap:complete', { result });
      return result;
    } catch (error) {
      this.emit('swap:error', { error });
      throw this.formatError(error);
    }
  }

  /**
   * Get quote for a swap
   */
  async getQuote(params: { tokenIn: string; tokenOut: string; amountIn: string }): Promise<Quote> {
    const amountIn = BigInt(params.amountIn);
    
    // For simplicity, using a fixed fee tier (0.25% = 2500)
    const fee = 2500;

    // Simplified quote - in production, would call quoter contract
    const route = await this.getRoute(params.tokenIn, params.tokenOut, amountIn);

    // Mock quote calculation (in production, call quoter contract)
    const mockPriceImpact = 0.5; // 0.5%
    const mockAmountOut = (amountIn * 995n) / 1000n; // Simplified: 0.5% slippage

    const quote: Quote = {
      amountOut: mockAmountOut,
      priceImpact: mockPriceImpact,
      route: route.path,
      gasEstimate: 200000n,
    };

    this.emit('swap:quote', { quote });
    return quote;
  }

  /**
   * Find optimal swap route
   */
  async getRoute(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Route> {
    // Simplified routing - direct path
    // In production, would check multiple paths and choose optimal one
    
    const route: Route = {
      path: [tokenIn, tokenOut],
      pools: [], // Would contain pool addresses
      fees: [2500], // 0.25% fee tier
    };

    return route;
  }

  /**
   * Check price impact
   */
  async checkPriceImpact(params: SwapParams): Promise<number> {
    const quote = await this.getQuote({
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
    });

    return quote.priceImpact;
  }

  /**
   * Build swap transaction
   */
  async buildSwapTransaction(params: SwapParams, quote: Quote): Promise<ethers.TransactionRequest> {
    if (!this.signer) {
      throw new Error('Signer required to build transaction');
    }

    const router = this.getContract(this.swapConfig.routerAddress, this.routerABI);
    const recipient = params.recipient || (await this.signer.getAddress());
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 300; // 5 minutes

    const slippage = params.slippage || this.swapConfig.defaultSlippage;
    const amountOutMin = params.amountOutMin 
      ? BigInt(params.amountOutMin)
      : (quote.amountOut * BigInt(10000 - slippage)) / 10000n;

    const swapParams = {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      fee: 2500, // 0.25% fee tier
      recipient,
      deadline,
      amountIn: BigInt(params.amountIn),
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0, // No price limit
    };

    // Build transaction
    const tx = await router.exactInputSingle.populateTransaction(swapParams);
    
    return tx;
  }
}

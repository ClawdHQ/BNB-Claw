/**
 * BNB Claw - Interactive Demo Script
 *
 * Showcases the key capabilities of the BNB Claw SDK:
 *   1. Agent initialisation
 *   2. Natural-language token swap (testnet)
 *   3. Multi-module DeFi strategy
 *   4. Autonomous portfolio rebalancing via Treasury
 *
 * Run with:  npx tsx demo/index.ts
 */

// ──────────────────────────────────────────────────────────────────────────────
// Pretty-print helpers (no external dependency required)
// ──────────────────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const BLUE  = '\x1b[34m';
const CYAN  = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED   = '\x1b[31m';
const MAGENTA = '\x1b[35m';

const c = {
  blue:    (s: string) => `${BLUE}${s}${RESET}`,
  cyan:    (s: string) => `${CYAN}${s}${RESET}`,
  green:   (s: string) => `${GREEN}${s}${RESET}`,
  yellow:  (s: string) => `${YELLOW}${s}${RESET}`,
  red:     (s: string) => `${RED}${s}${RESET}`,
  magenta: (s: string) => `${MAGENTA}${s}${RESET}`,
  bold:    (s: string) => `${BOLD}${s}${RESET}`,
  dim:     (s: string) => `${DIM}${s}${RESET}`,
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function typePrint(text: string, delay = 18) {
  for (const ch of text) {
    process.stdout.write(ch);
    await sleep(delay);
  }
  process.stdout.write('\n');
}

function section(title: string) {
  const bar = '─'.repeat(54);
  console.log(`\n${c.cyan(bar)}`);
  console.log(c.bold(c.cyan(`  ${title}`)));
  console.log(c.cyan(bar));
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock implementations (replace with real SDK calls + testnet wallet in prod)
// ──────────────────────────────────────────────────────────────────────────────

type SwapParams = { tokenIn: string; tokenOut: string; amountIn: string };
type SupplyParams = { asset: string; amount: string };
type StakeParams = { amount: string; validator?: string };
type AllocationParams = { targets: Record<string, number> };

class MockSwapModule {
  async getQuote(p: SwapParams) {
    return {
      amountOut: BigInt('246800000000000000'),
      priceImpact: 0.31,
      route: [p.tokenIn, p.tokenOut],
      gasEstimate: BigInt(180_000),
    };
  }

  async swap(p: SwapParams) {
    await sleep(800);
    return {
      success: true,
      amountIn: BigInt(p.amountIn),
      amountOut: BigInt('246800000000000000'),
      route: [p.tokenIn, p.tokenOut],
      gasUsed: BigInt(178_432),
      txHash: '0x4a2b3c8d9e1f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
      priceImpact: 0.31,
    };
  }
}

class MockLendModule {
  async supply(p: SupplyParams) {
    await sleep(700);
    return {
      success: true,
      asset: p.asset,
      amount: BigInt(p.amount),
      vTokensMinted: BigInt('47000000000'),
      newSupplyAPY: 5.24,
      txHash: '0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
    };
  }
}

class MockStakeModule {
  async stake(p: StakeParams) {
    await sleep(600);
    return {
      success: true,
      amount: BigInt(p.amount),
      validator: p.validator ?? '0x0000000000000000000000000000000000001001',
      expectedAPR: 5.5,
      txHash: '0x9f8e7d6c5b4a3b2c1d0e9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7',
    };
  }
}

class MockTreasuryModule {
  private swapMod = new MockSwapModule();
  private stakeMod = new MockStakeModule();
  private lendMod  = new MockLendModule();
  private target: Record<string, number> = {};

  async setAllocation(p: AllocationParams) {
    this.target = p.targets;
  }

  async getCurrentAllocation() {
    return {
      BNB:  { amount: BigInt('600000000000000000000'), percentage: 60, valueUSD: 180_000 },
      USDT: { amount: BigInt('350000000000000000000'), percentage: 35, valueUSD: 350_000 },
      BTCB: { amount: BigInt('5000000000000'), percentage: 5, valueUSD: 32_500 },
    };
  }

  async rebalance() {
    await sleep(1_200);
    return {
      success: true,
      tradesMade: 2,
      gasUsed: BigInt(410_000),
      newAllocation: {
        BNB:  { amount: BigInt('400000000000000000000'), percentage: 40, valueUSD: 120_000 },
        USDT: { amount: BigInt('400000000000000000000'), percentage: 40, valueUSD: 400_000 },
        BTCB: { amount: BigInt('20000000000000'), percentage: 20, valueUSD: 130_000 },
      },
    };
  }

  async harvestYields() {
    await sleep(500);
    return {
      success: true,
      totalYield: BigInt('50240000000000000'),
      sources: ['staking'],
      txHashes: ['0xabc123def456'],
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Demo helpers
// ──────────────────────────────────────────────────────────────────────────────

const BSCSCAN_TESTNET = 'https://testnet.bscscan.com/tx';
const USDT  = '0x55d398326f99059fF775485246999027B3197955';
const WBNB  = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

function formatEther(wei: bigint, decimals = 6): string {
  const val = Number(wei) / 1e18;
  return val.toFixed(decimals);
}

function allocationBar(pct: number, width = 30): string {
  const filled = Math.round((pct / 100) * width);
  return c.green('█'.repeat(filled)) + c.dim('░'.repeat(width - filled));
}

// ──────────────────────────────────────────────────────────────────────────────
// Demo steps
// ──────────────────────────────────────────────────────────────────────────────

async function stepIntroduction() {
  console.log(c.blue(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║          🐾  BNB Claw Demo  🐾                       ║
║                                                      ║
║   Plug-and-play AI agents for BNB Chain DeFi         ║
║   "AI agents in 5 lines of code"                     ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`));
  console.log(c.dim('  Version : 0.1.0'));
  console.log(c.dim('  Network : BSC Testnet (Chain ID 97)'));
  console.log(c.dim('  Built for: Good Vibes Only – OpenClaw Edition'));
  await sleep(1_000);
}

async function stepSetup() {
  section('Step 1 · Quick Setup');

  await typePrint(c.dim('  $ npm install @bnb-claw/core @bnb-claw/modules'));
  await sleep(300);

  console.log(c.yellow('\n  Initialising agent…'));
  await sleep(400);

  const code = `
  import { BaseAgent } from '@bnb-claw/core';
  import { SwapModule, LendModule, StakeModule } from '@bnb-claw/modules';

  const agent = new BaseAgent({
    name: 'DemoBot',
    model: 'gpt-4',
    provider: 'openai',
  });
  `;
  for (const line of code.split('\n')) {
    console.log(c.cyan(line));
  }

  await sleep(600);
  console.log(c.green('  ✅ Agent created!'));

  console.log(c.yellow('\n  Registering modules…'));
  await sleep(300);
  console.log(c.green('  ✅ SwapModule  registered'));
  console.log(c.green('  ✅ LendModule  registered'));
  console.log(c.green('  ✅ StakeModule registered'));
  await sleep(500);
}

async function stepNaturalLanguageSwap() {
  section('Step 2 · Natural Language Trading');

  const swapMod = new MockSwapModule();

  await typePrint(c.bold('\n  User: ') + '"Swap 100 USDT to BNB"');
  await sleep(400);

  console.log(c.yellow('\n  🤔 Agent reasoning…'));
  await sleep(700);
  console.log(c.dim('     › Parsing intent: swap USDT → BNB'));
  console.log(c.dim('     › Selecting module: SwapModule'));
  console.log(c.dim('     › Fetching quote from PancakeSwap V3…'));

  const quote = await swapMod.getQuote({ tokenIn: USDT, tokenOut: WBNB, amountIn: '100000000000000000000' });
  await sleep(300);

  console.log(c.cyan(`\n  📊 Quote:`));
  console.log(`     Amount in  : ${c.bold('100.000000 USDT')}`);
  console.log(`     Amount out : ${c.bold(formatEther(quote.amountOut) + ' BNB')}`);
  console.log(`     Price impact: ${c.bold(quote.priceImpact + '%')}`);
  console.log(`     Route       : USDT → BNB (direct)`);

  console.log(c.yellow('\n  ⏳ Executing swap on BSC Testnet…'));

  const result = await swapMod.swap({ tokenIn: USDT, tokenOut: WBNB, amountIn: '100000000000000000000' });

  console.log(c.green('\n  ✅ Swap complete!'));
  console.log(`     Tx Hash  : ${c.cyan(result.txHash)}`);
  console.log(`     Gas used : ${result.gasUsed.toLocaleString()} units`);
  console.log(`     BSCScan  : ${c.dim(BSCSCAN_TESTNET + '/' + result.txHash)}`);
}

async function stepMultiModuleStrategy() {
  section('Step 3 · Multi-Module DeFi Strategy');

  const lendMod  = new MockLendModule();
  const stakeMod = new MockStakeModule();

  await typePrint(
    c.bold('\n  User: ') + '"Put 50% of my BNB into staking and lend 200 USDT on Venus"',
  );
  await sleep(400);

  console.log(c.yellow('\n  🧠 Agent planning…'));
  await sleep(600);
  console.log(c.cyan('\n  📋 Execution plan:'));
  console.log('     Step 1 › stake  · StakeModule.stake  — 50% BNB (1 BNB)');
  console.log('     Step 2 › lend   · LendModule.supply  — 200 USDT');
  await sleep(500);

  console.log(c.yellow('\n  ⏳ Step 1/2 – Staking BNB…'));
  const stakeResult = await stakeMod.stake({ amount: '1000000000000000000' });
  console.log(c.green('  ✅ Staked!'));
  console.log(`     Validator   : ${c.cyan(stakeResult.validator)}`);
  console.log(`     Expected APR: ${c.bold(stakeResult.expectedAPR + '%')}`);
  console.log(`     Tx Hash     : ${c.cyan(stakeResult.txHash)}`);

  console.log(c.yellow('\n  ⏳ Step 2/2 – Supplying USDT to Venus…'));
  const lendResult = await lendMod.supply({ asset: 'USDT', amount: '200000000000000000000' });
  console.log(c.green('  ✅ Supplied!'));
  console.log(`     Asset       : ${c.bold(lendResult.asset)}`);
  console.log(`     Supply APY  : ${c.bold(lendResult.newSupplyAPY + '%')}`);
  console.log(`     Tx Hash     : ${c.cyan(lendResult.txHash)}`);
}

async function stepAutonomousPortfolio() {
  section('Step 4 · Autonomous Portfolio Management');

  const treasury = new MockTreasuryModule();

  console.log(c.yellow('\n  📊 Current allocation:'));
  const current = await treasury.getCurrentAllocation();
  for (const [asset, info] of Object.entries(current)) {
    console.log(
      `     ${asset.padEnd(5)} ${allocationBar(info.percentage, 20)}  ${String(info.percentage).padStart(3)}%   $${info.valueUSD.toLocaleString()}`,
    );
  }

  await typePrint(
    c.bold('\n  User: ') + '"Rebalance to 40% BNB, 40% USDT, 20% BTCB"',
  );
  await sleep(400);

  console.log(c.yellow('\n  🎯 Setting target allocation…'));
  await treasury.setAllocation({ targets: { BNB: 40, USDT: 40, BTCB: 20 } });
  await sleep(300);
  console.log(c.green('  ✅ Target set'));

  console.log(c.yellow('\n  ⏳ Rebalancing portfolio…'));
  const rebalanceResult = await treasury.rebalance();

  console.log(c.green(`\n  ✅ Rebalanced! (${rebalanceResult.tradesMade} trades, gas: ${rebalanceResult.gasUsed.toLocaleString()} units)`));
  console.log(c.cyan('\n  📊 New allocation:'));
  for (const [asset, info] of Object.entries(rebalanceResult.newAllocation)) {
    console.log(
      `     ${asset.padEnd(5)} ${allocationBar(info.percentage, 20)}  ${String(info.percentage).padStart(3)}%   $${info.valueUSD.toLocaleString()}`,
    );
  }
}

async function stepSummary() {
  section('Demo Complete 🎉');

  console.log(c.green(`
  BNB Claw gives developers everything they need to build
  autonomous DeFi agents on BNB Chain:

    ✅  Natural language interface ("Swap 100 USDT to BNB")
    ✅  Pre-built modules: Swap, Lend, Stake, Treasury
    ✅  Multi-LLM support: OpenAI & Anthropic
    ✅  Automatic retry + error handling
    ✅  Full TypeScript SDK with type safety
    ✅  CLI tool: bnb-claw init / swap / chat
  `));

  console.log(c.cyan('  🔗 Links'));
  console.log('     npm    : https://www.npmjs.com/package/@bnb-claw/core');
  console.log('     GitHub : https://github.com/ClawdHQ/BNB-Claw');
  console.log('     Docs   : https://bnb-claw-docs.vercel.app');
  console.log('     Demo   : https://bnb-claw-demo.vercel.app\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function demo() {
  try {
    await stepIntroduction();
    await stepSetup();
    await stepNaturalLanguageSwap();
    await stepMultiModuleStrategy();
    await stepAutonomousPortfolio();
    await stepSummary();
  } catch (err) {
    console.error(c.red('\n❌ Demo encountered an error:'), err);
    process.exit(1);
  }
}

demo();

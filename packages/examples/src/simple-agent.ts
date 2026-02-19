/**
 * Simple BNB Claw Agent Example
 * 
 * Demonstrates how to create an AI agent with DeFi capabilities
 */

import { BaseAgent } from '@bnb-claw/core';
import { SwapModule, LendModule, StakeModule } from '@bnb-claw/modules';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🤖 BNB Claw Agent Example\n');

  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider(
    process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/'
  );

  const signer = process.env.PRIVATE_KEY
    ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : undefined;

  if (!signer) {
    console.log('⚠️  No private key provided. Agent will run in read-only mode.\n');
  } else {
    const address = await signer.getAddress();
    console.log(`📍 Wallet Address: ${address}\n`);
  }

  // Create AI agent
  const agent = new BaseAgent({
    name: 'DeFi Assistant',
    description: 'A helpful AI agent for BNB Chain DeFi operations',
    model: 'gpt-4',
    provider: 'openai',
    temperature: 0.7,
  });

  // Initialize modules
  const swapModule = new SwapModule({
    name: 'SwapModule',
    description: 'PancakeSwap V3 integration',
    version: '0.1.0',
    chainId: 97, // BSC Testnet
    provider,
    signer,
    routerAddress: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', // Example address
    quoterAddress: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    factoryAddress: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    defaultSlippage: 50, // 0.5%
  });

  const lendModule = new LendModule({
    name: 'LendModule',
    description: 'Venus Protocol integration',
    version: '0.1.0',
    chainId: 97,
    provider,
    signer,
    comptrollerAddress: '0xfD36E2c2a6789Db23113685031d7F16329158384',
    vTokens: {
      USDT: '0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c',
      BNB: '0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c',
    },
  });

  const stakeModule = new StakeModule({
    name: 'StakeModule',
    description: 'BNB Chain staking',
    version: '0.1.0',
    chainId: 97,
    provider,
    signer,
    stakingContract: '0x0000000000000000000000000000000000002001',
    minStakeAmount: ethers.parseEther('0.1'),
    unbondingPeriod: 7 * 24 * 60 * 60, // 7 days
  });

  // Register modules with agent
  agent.registerModule('SwapModule', swapModule);
  agent.registerModule('LendModule', lendModule);
  agent.registerModule('StakeModule', stakeModule);

  console.log('✅ Agent initialized with modules:\n');
  console.log('   - SwapModule (PancakeSwap V3)');
  console.log('   - LendModule (Venus Protocol)');
  console.log('   - StakeModule (BNB Staking)\n');

  // Listen to agent events
  agent.on('message:sent', (msg) => {
    console.log(`👤 User: ${msg.content}`);
  });

  agent.on('message:received', (msg) => {
    console.log(`🤖 Agent: ${msg.content}\n`);
  });

  agent.on('action:planned', (data) => {
    console.log(`📋 Planned ${data.actions.length} action(s)`);
  });

  agent.on('action:start', (data) => {
    console.log(`⚙️  Executing: ${data.action.module}.${data.action.method}`);
  });

  agent.on('action:complete', (data) => {
    console.log(`✅ Completed: ${data.action.module}.${data.action.method}\n`);
  });

  // Example interactions (commented out to avoid API calls without keys)
  
  /*
  // Simple chat
  const response1 = await agent.chat('What can you help me with?');
  console.log(`Agent: ${response1}\n`);

  // Plan a strategy
  const actions = await agent.planStrategy(
    'I want to stake 1 BNB for rewards',
    {
      walletAddress: await signer.getAddress(),
      chainId: 97,
      availableModules: ['SwapModule', 'LendModule', 'StakeModule'],
    }
  );

  console.log(`Planned ${actions.length} actions:`);
  actions.forEach((action, i) => {
    console.log(`${i + 1}. ${action.module}.${action.method}`);
    console.log(`   Reasoning: ${action.reasoning}\n`);
  });
  */

  console.log('📝 Example agent is ready!');
  console.log('💡 Uncomment the code above to test agent interactions.\n');
  console.log('⚠️  Make sure to set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env file.\n');
}

main().catch(console.error);

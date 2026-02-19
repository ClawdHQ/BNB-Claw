/**
 * Init Command
 * 
 * Initializes a new BNB Claw agent project with:
 * - Project structure
 * - Configuration files
 * - Dependencies
 * - Example agent
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

interface InitOptions {
  name?: string;
  directory?: string;
  skipInstall?: boolean;
}

export async function initCommand(options: InitOptions) {
  console.log(chalk.bold.cyan('\n🐾 BNB Claw Project Initializer\n'));

  // Gather information via prompts if not provided
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: options.name || 'my-bnb-agent',
      when: !options.name,
    },
    {
      type: 'input',
      name: 'directory',
      message: 'Directory:',
      default: (answers: any) => `./${answers.projectName || options.name}`,
      when: !options.directory,
    },
    {
      type: 'list',
      name: 'packageManager',
      message: 'Package manager:',
      choices: ['pnpm', 'npm', 'yarn'],
      default: 'pnpm',
    },
    {
      type: 'checkbox',
      name: 'modules',
      message: 'Select modules to include:',
      choices: [
        { name: 'SwapModule (PancakeSwap)', value: 'swap', checked: true },
        { name: 'LendModule (Venus Protocol)', value: 'lend', checked: true },
        { name: 'StakeModule (BNB Staking)', value: 'stake', checked: true },
        { name: 'TreasuryModule (Portfolio Management)', value: 'treasury', checked: false },
      ],
    },
    {
      type: 'list',
      name: 'aiProvider',
      message: 'AI provider:',
      choices: ['openai', 'anthropic'],
      default: 'openai',
    },
    {
      type: 'list',
      name: 'network',
      message: 'Default network:',
      choices: [
        { name: 'BSC Testnet', value: 'testnet' },
        { name: 'BSC Mainnet', value: 'mainnet' },
      ],
      default: 'testnet',
    },
  ]);

  const projectName = options.name || answers.projectName;
  const targetDir = path.resolve(options.directory || answers.directory || `./${projectName}`);
  const packageManager = answers.packageManager;
  const selectedModules = answers.modules;
  const aiProvider = answers.aiProvider;
  const network = answers.network;

  // Check if directory exists
  if (fs.existsSync(targetDir)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory ${chalk.cyan(targetDir)} already exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('\n❌ Project initialization cancelled.\n'));
      process.exit(0);
    }

    fs.removeSync(targetDir);
  }

  // Create project structure
  const spinner = ora('Creating project structure...').start();

  try {
    // Create directories
    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });

    // Create package.json
    const packageJson = {
      name: projectName,
      version: '0.1.0',
      description: 'BNB Claw AI agent project',
      type: 'module',
      main: './src/index.ts',
      scripts: {
        dev: 'tsx src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
      },
      dependencies: {
        '@bnb-claw/core': '^0.1.0',
        '@bnb-claw/modules': '^0.1.0',
        ethers: '^6.10.0',
        dotenv: '^16.4.0',
      },
      devDependencies: {
        typescript: '^5.3.3',
        tsx: '^4.7.0',
        '@types/node': '^20.11.0',
      },
    };

    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        lib: ['ES2022'],
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        outDir: './dist',
        rootDir: './src',
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    };

    fs.writeFileSync(
      path.join(targetDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // Create .env file
    const envContent = generateEnvFile(network, aiProvider);
    fs.writeFileSync(path.join(targetDir, '.env'), envContent);

    // Create .gitignore
    const gitignoreContent = `node_modules/
dist/
.env
*.log
.DS_Store
`;
    fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignoreContent);

    // Create README.md
    const readmeContent = generateReadme(projectName, selectedModules, packageManager);
    fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent);

    // Create main agent file
    const agentCode = generateAgentCode(selectedModules, network);
    fs.writeFileSync(path.join(targetDir, 'src', 'index.ts'), agentCode);

    spinner.succeed('Project structure created!');

    // Install dependencies
    if (!options.skipInstall) {
      const installSpinner = ora('Installing dependencies...').start();

      try {
        const installCmd = packageManager === 'npm' 
          ? 'npm install' 
          : packageManager === 'yarn' 
          ? 'yarn install' 
          : 'pnpm install';

        execSync(installCmd, { cwd: targetDir, stdio: 'ignore' });
        installSpinner.succeed('Dependencies installed!');
      } catch (error) {
        installSpinner.fail('Failed to install dependencies');
        console.log(chalk.yellow(`\n⚠️  You can install them manually by running:`));
        console.log(chalk.cyan(`   cd ${projectName} && ${packageManager} install\n`));
      }
    }

    // Success message
    console.log(chalk.green.bold('\n✅ Project initialized successfully!\n'));
    console.log(chalk.bold('Next steps:\n'));
    console.log(chalk.cyan(`  1. cd ${projectName}`));
    console.log(chalk.cyan(`  2. Edit .env file with your API keys and private key`));
    console.log(chalk.cyan(`  3. ${packageManager} run dev\n`));
    console.log(chalk.gray('📚 Learn more: https://github.com/ClawdHQ/BNB-Claw\n'));

  } catch (error) {
    spinner.fail('Failed to create project');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

function generateEnvFile(network: string, aiProvider: string): string {
  const rpcUrl = network === 'testnet' 
    ? 'https://data-seed-prebsc-1-s1.binance.org:8545/'
    : 'https://bsc-dataseed.binance.org/';

  return `# BNB Chain Configuration
BSC_RPC=${rpcUrl}
PRIVATE_KEY=your_private_key_here

# AI Provider
${aiProvider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'}=your_api_key_here

# Agent Configuration
DEFAULT_AGENT_MODEL=${aiProvider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229'}
MAX_RETRIES=3
TRANSACTION_TIMEOUT=30000
`;
}

function generateReadme(projectName: string, modules: string[], packageManager: string): string {
  const modulesText = modules.map(m => `- ${m.charAt(0).toUpperCase() + m.slice(1)}Module`).join('\n');
  
  return `# ${projectName}

BNB Claw AI agent project

## Setup

1. Install dependencies:
\`\`\`bash
${packageManager} install
\`\`\`

2. Configure environment variables in \`.env\`:
   - Add your AI provider API key
   - Add your BNB Chain RPC endpoint
   - Add your private key (for transactions)

3. Run the agent:
\`\`\`bash
${packageManager} run dev
\`\`\`

## Included Modules

${modulesText}

## Learn More

- [BNB Claw Documentation](https://github.com/ClawdHQ/BNB-Claw)
- [BNB Chain](https://www.bnbchain.org/)
`;
}

function generateAgentCode(modules: string[], network: string): string {
  const chainId = network === 'testnet' ? 97 : 56;
  const imports: string[] = ['BaseAgent'];
  const moduleInits: string[] = [];
  const moduleRegistrations: string[] = [];

  if (modules.includes('swap')) {
    imports.push('SwapModule');
    moduleInits.push(`  // Initialize SwapModule
  const swapModule = new SwapModule({
    name: 'SwapModule',
    description: 'PancakeSwap V3 integration',
    version: '0.1.0',
    chainId: ${chainId},
    provider,
    signer,
    routerAddress: '${chainId === 97 ? '0x1b81D678ffb9C0263b24A97847620C99d213eB14' : '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4'}',
    quoterAddress: '${chainId === 97 ? '0x1b81D678ffb9C0263b24A97847620C99d213eB14' : '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997'}',
    factoryAddress: '${chainId === 97 ? '0x1b81D678ffb9C0263b24A97847620C99d213eB14' : '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'}',
    defaultSlippage: 50, // 0.5%
  });`);
    moduleRegistrations.push(`  agent.registerModule('SwapModule', swapModule);`);
  }

  if (modules.includes('lend')) {
    imports.push('LendModule');
    moduleInits.push(`  // Initialize LendModule
  const lendModule = new LendModule({
    name: 'LendModule',
    description: 'Venus Protocol integration',
    version: '0.1.0',
    chainId: ${chainId},
    provider,
    signer,
    comptrollerAddress: '0xfD36E2c2a6789Db23113685031d7F16329158384',
    vTokens: {
      USDT: '0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c',
      BNB: '0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c',
    },
  });`);
    moduleRegistrations.push(`  agent.registerModule('LendModule', lendModule);`);
  }

  if (modules.includes('stake')) {
    imports.push('StakeModule');
    moduleInits.push(`  // Initialize StakeModule
  const stakeModule = new StakeModule({
    name: 'StakeModule',
    description: 'BNB Chain staking',
    version: '0.1.0',
    chainId: ${chainId},
    provider,
    signer,
    stakingContract: '0x0000000000000000000000000000000000002001',
    minStakeAmount: ethers.parseEther('0.1'),
    unbondingPeriod: 7 * 24 * 60 * 60, // 7 days
  });`);
    moduleRegistrations.push(`  agent.registerModule('StakeModule', stakeModule);`);
  }

  if (modules.includes('treasury')) {
    imports.push('TreasuryModule');
    moduleInits.push(`  // Initialize TreasuryModule
  const treasuryModule = new TreasuryModule({
    name: 'TreasuryModule',
    description: 'Portfolio management',
    version: '0.1.0',
    chainId: ${chainId},
    provider,
    signer,
    modules: [], // Will be populated with other modules
    rebalanceThreshold: 5, // 5% deviation triggers rebalance
  });`);
    moduleRegistrations.push(`  agent.registerModule('TreasuryModule', treasuryModule);`);
  }

  const importsList = imports.length > 1 ? `{ ${imports.join(', ')} }` : 'BaseAgent';
  const modulesImport = imports.length > 1 ? `import { ${imports.slice(1).join(', ')} } from '@bnb-claw/modules';` : '';

  return `/**
 * BNB Claw AI Agent
 * 
 * Auto-generated agent configuration
 */

import { ${imports[0]} } from '@bnb-claw/core';
${modulesImport}
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🐾 Starting BNB Claw Agent...\\n');

  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider(
    process.env.BSC_RPC || '${network === 'testnet' ? 'https://data-seed-prebsc-1-s1.binance.org:8545/' : 'https://bsc-dataseed.binance.org/'}'
  );

  const signer = process.env.PRIVATE_KEY
    ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : undefined;

  if (!signer) {
    console.error('❌ No private key provided in .env file');
    process.exit(1);
  }

  const address = await signer.getAddress();
  console.log(\`📍 Wallet: \${address}\\n\`);

  // Create AI agent
  const agent = new ${imports[0]}({
    name: 'My DeFi Agent',
    description: 'AI-powered DeFi agent for BNB Chain',
    model: process.env.DEFAULT_AGENT_MODEL || 'gpt-4',
    provider: '${network === 'testnet' ? 'openai' : 'openai'}',
  });

${moduleInits.join('\n\n')}

  // Register modules
${moduleRegistrations.join('\n')}

  console.log('✅ Agent initialized!\\n');

  // Listen to events
  agent.on('message:sent', (msg) => {
    console.log(\`👤 User: \${msg.content}\`);
  });

  agent.on('message:received', (msg) => {
    console.log(\`🤖 Agent: \${msg.content}\\n\`);
  });

  // Example interaction
  try {
    const response = await agent.chat('What modules do you have available?');
    console.log(\`\\n🤖 Response: \${response}\\n\`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
`;
}

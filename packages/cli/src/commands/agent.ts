/**
 * Agent Command
 * 
 * Create and configure agent files
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';

interface AgentOptions {
  name?: string;
  model?: string;
  provider?: string;
  modules?: string[];
}

export async function agentCommand(options: AgentOptions) {
  console.log(chalk.bold.cyan('\n🤖 BNB Claw Agent Creator\n'));

  // Check if we're in a BNB Claw project
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log(chalk.red('❌ No package.json found. Are you in a project directory?\n'));
    console.log(chalk.yellow('💡 Run "bnb-claw init" to create a new project first.\n'));
    process.exit(1);
  }

  // Gather information via prompts
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'agentName',
      message: 'Agent name:',
      default: options.name || 'MyAgent',
      when: !options.name,
    },
    {
      type: 'list',
      name: 'provider',
      message: 'AI provider:',
      choices: ['openai', 'anthropic'],
      default: options.provider || 'openai',
      when: !options.provider,
    },
    {
      type: 'list',
      name: 'model',
      message: 'AI model:',
      choices: (answers: any) => {
        const provider = options.provider || answers.provider;
        if (provider === 'openai') {
          return ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo-preview'];
        } else {
          return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
        }
      },
      default: (answers: any) => {
        const provider = options.provider || answers.provider;
        return provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229';
      },
      when: !options.model,
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
      when: !options.modules || options.modules.length === 0,
    },
    {
      type: 'input',
      name: 'description',
      message: 'Agent description:',
      default: 'AI-powered DeFi agent for BNB Chain',
    },
    {
      type: 'number',
      name: 'temperature',
      message: 'Temperature (0.0 - 1.0):',
      default: 0.7,
      validate: (value: number) => {
        if (value >= 0 && value <= 1) {
          return true;
        }
        return 'Temperature must be between 0.0 and 1.0';
      },
    },
  ]);

  const agentName = options.name || answers.agentName;
  const provider = options.provider || answers.provider;
  const model = options.model || answers.model;
  const modules = options.modules || answers.modules;
  const description = answers.description;
  const temperature = answers.temperature;

  const spinner = ora('Creating agent configuration...').start();

  try {
    // Create agents directory if it doesn't exist
    const agentsDir = path.join(process.cwd(), 'src', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    // Generate agent file
    const agentFileName = agentName.toLowerCase().replace(/\s+/g, '-') + '.ts';
    const agentFilePath = path.join(agentsDir, agentFileName);

    if (fs.existsSync(agentFilePath)) {
      spinner.stop();
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Agent file ${chalk.cyan(agentFileName)} already exists. Overwrite?`,
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('\n❌ Agent creation cancelled.\n'));
        process.exit(0);
      }
      spinner.start();
    }

    const agentCode = generateAgentFile(agentName, provider, model, modules, description, temperature);
    fs.writeFileSync(agentFilePath, agentCode);

    spinner.succeed('Agent configuration created!');

    // Success message
    console.log(chalk.green.bold('\n✅ Agent created successfully!\n'));
    console.log(chalk.bold('Agent details:\n'));
    console.log(chalk.cyan(`  Name: ${agentName}`));
    console.log(chalk.cyan(`  Provider: ${provider}`));
    console.log(chalk.cyan(`  Model: ${model}`));
    console.log(chalk.cyan(`  Modules: ${modules.join(', ')}`));
    console.log(chalk.cyan(`  File: ${agentFilePath}\n`));
    console.log(chalk.bold('Next steps:\n'));
    console.log(chalk.gray(`  1. Import the agent in your main file:`));
    console.log(chalk.gray(`     import { create${agentName} } from './agents/${agentFileName.replace('.ts', '')}';`));
    console.log(chalk.gray(`  2. Create an instance:`));
    console.log(chalk.gray(`     const agent = await create${agentName}(provider, signer);\n`));

  } catch (error) {
    spinner.fail('Failed to create agent');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

/**
 * Generate agent configuration TypeScript code
 * 
 * @param name - The agent name
 * @param provider - The AI provider (openai or anthropic)
 * @param model - The AI model to use
 * @param modules - Array of module names to include
 * @param description - Description of the agent
 * @param temperature - AI temperature setting (0.0-1.0)
 * @returns TypeScript code for the agent configuration file
 */
function generateAgentFile(
  name: string,
  provider: string,
  model: string,
  modules: string[],
  description: string,
  temperature: number
): string {
  const imports: string[] = ['BaseAgent'];
  const moduleImports: string[] = [];
  const moduleInits: string[] = [];
  const moduleParams: string[] = [];

  if (modules.includes('swap')) {
    moduleImports.push('SwapModule');
    moduleParams.push('swapConfig');
    moduleInits.push(`  const swapModule = new SwapModule(swapConfig);
  agent.registerModule('SwapModule', swapModule);`);
  }

  if (modules.includes('lend')) {
    moduleImports.push('LendModule');
    moduleParams.push('lendConfig');
    moduleInits.push(`  const lendModule = new LendModule(lendConfig);
  agent.registerModule('LendModule', lendModule);`);
  }

  if (modules.includes('stake')) {
    moduleImports.push('StakeModule');
    moduleParams.push('stakeConfig');
    moduleInits.push(`  const stakeModule = new StakeModule(stakeConfig);
  agent.registerModule('StakeModule', stakeModule);`);
  }

  if (modules.includes('treasury')) {
    moduleImports.push('TreasuryModule');
    moduleParams.push('treasuryConfig');
    moduleInits.push(`  const treasuryModule = new TreasuryModule(treasuryConfig);
  agent.registerModule('TreasuryModule', treasuryModule);`);
  }

  const moduleImportStr = moduleImports.length > 0 
    ? `import { ${moduleImports.join(', ')} } from '@bnb-claw/modules';` 
    : '';

  const configParams = moduleParams.length > 0
    ? moduleParams.map(p => `  ${p}: any;`).join('\n')
    : '  // Add module configurations here';

  return `/**
 * ${name} Agent Configuration
 * 
 * Generated by BNB Claw CLI
 */

import { BaseAgent } from '@bnb-claw/core';
${moduleImportStr}
import { ethers } from 'ethers';

export interface ${name}Config {
${configParams}
}

/**
 * Create a new ${name} agent
 * 
 * @param provider - Ethereum provider
 * @param signer - Ethereum signer
 * @param config - Module configurations
 * @returns Configured ${name} agent
 */
export async function create${name}(
  provider: ethers.Provider,
  signer: ethers.Signer,
  config: ${name}Config
): Promise<BaseAgent> {
  // Create agent instance
  const agent = new BaseAgent({
    name: '${name}',
    description: '${description}',
    model: '${model}',
    provider: '${provider}',
    temperature: ${temperature},
  });

${moduleInits.join('\n\n')}

  return agent;
}
`;
}

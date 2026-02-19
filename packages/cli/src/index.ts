#!/usr/bin/env node
/**
 * BNB Claw CLI Tool
 * 
 * Developer-friendly CLI for:
 * - Initializing new agent projects
 * - Testing modules interactively
 * - Deploying agents
 * - Managing configurations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { agentCommand } from './commands/agent.js';

const program = new Command();

program
  .name('bnb-claw')
  .description('CLI tool for BNB Claw - Build AI agents for BNB Chain')
  .version('0.1.0');

// bnb-claw init command
program
  .command('init')
  .description('Initialize a new BNB Claw agent project')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --directory <path>', 'Target directory')
  .option('--skip-install', 'Skip dependency installation')
  .action(initCommand);

// bnb-claw agent command group
const agent = program
  .command('agent')
  .description('Manage agents');

agent
  .command('create')
  .description('Create a new agent configuration')
  .option('-n, --name <name>', 'Agent name')
  .option('-m, --model <model>', 'AI model (gpt-4, gpt-3.5-turbo, claude-3-opus)')
  .option('-p, --provider <provider>', 'AI provider (openai, anthropic)')
  .option('--modules <modules...>', 'Modules to include (swap, lend, stake, treasury)')
  .action(agentCommand);

program.parse();

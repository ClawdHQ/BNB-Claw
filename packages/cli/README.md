# @bnb-claw/cli

Command-line tools for BNB Claw - the plug-and-play AI agent SDK for BNB Chain.

## Features

- 🚀 **Quick Project Setup** - Initialize new agent projects with a single command
- 🤖 **Agent Generator** - Create agent configurations interactively
- 📦 **Module Selection** - Choose from pre-built DeFi modules (Swap, Lend, Stake, Treasury)
- ⚙️ **Configuration Management** - Set up environment and dependencies automatically
- 🎨 **Beautiful CLI** - Interactive prompts with colorful output

## Installation

```bash
# Clone the BNB Claw repository
git clone https://github.com/ClawdHQ/BNB-Claw.git
cd BNB-Claw

# Install dependencies
pnpm install

# Build all packages
pnpm build

# The CLI is now available at packages/cli/dist/index.mjs
```

## Usage

### Initialize a New Project

Create a new BNB Claw agent project:

```bash
node packages/cli/dist/index.mjs init
```

The interactive wizard will guide you through:
- **Project name** - Choose a name for your project
- **Directory** - Select where to create the project
- **Package manager** - Choose between pnpm, npm, or yarn
- **Modules** - Select which DeFi modules to include:
  - SwapModule (PancakeSwap V3)
  - LendModule (Venus Protocol)
  - StakeModule (BNB Staking)
  - TreasuryModule (Portfolio Management)
- **AI provider** - Choose between OpenAI or Anthropic
- **Network** - Select BSC Testnet or Mainnet

#### Options

```bash
node packages/cli/dist/index.mjs init [options]
```

- `-n, --name <name>` - Project name
- `-d, --directory <path>` - Target directory
- `--skip-install` - Skip dependency installation

#### Example

```bash
node packages/cli/dist/index.mjs init --name my-trading-bot --skip-install
```

### Create an Agent

Generate a new agent configuration file:

```bash
node packages/cli/dist/index.mjs agent create
```

The wizard will ask for:
- **Agent name** - Name for your agent
- **AI provider** - OpenAI or Anthropic
- **AI model** - Specific model to use (e.g., gpt-4, claude-3-opus)
- **Modules** - Which modules to include
- **Description** - Brief description of the agent
- **Temperature** - AI temperature setting (0.0 - 1.0)

#### Options

```bash
node packages/cli/dist/index.mjs agent create [options]
```

- `-n, --name <name>` - Agent name
- `-m, --model <model>` - AI model (gpt-4, gpt-3.5-turbo, claude-3-opus)
- `-p, --provider <provider>` - AI provider (openai, anthropic)
- `--modules <modules...>` - Modules to include (swap, lend, stake, treasury)

#### Example

```bash
node packages/cli/dist/index.mjs agent create \
  --name TradingAgent \
  --model gpt-4 \
  --provider openai \
  --modules swap lend
```

## What Gets Generated

### Project Structure

When you run `bnb-claw init`, the CLI creates:

```
my-project/
├── src/
│   └── index.ts          # Main agent file with module initialization
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env                  # Environment variables template
├── .gitignore           # Git ignore file
└── README.md            # Project documentation
```

### Agent Files

When you run `bnb-claw agent create`, the CLI generates:

```
src/
└── agents/
    └── my-agent.ts      # Agent configuration factory function
```

Each agent file includes:
- Typed configuration interface
- Factory function to create the agent
- Pre-configured modules based on your selections
- TypeScript types and documentation

## Project Configuration

The generated `.env` file includes:

```bash
# BNB Chain Configuration
BSC_RPC=<rpc-endpoint>
PRIVATE_KEY=your_private_key_here

# AI Provider
OPENAI_API_KEY=your_api_key_here
# or
ANTHROPIC_API_KEY=your_api_key_here

# Agent Configuration
DEFAULT_AGENT_MODEL=gpt-4
MAX_RETRIES=3
TRANSACTION_TIMEOUT=30000
```

## Development

### Building the CLI

```bash
cd packages/cli
pnpm build
```

### Testing the CLI

```bash
# Show help
node dist/index.mjs --help

# Test init command
node dist/index.mjs init --help

# Test agent command
node dist/index.mjs agent --help
```

## Dependencies

- **commander** - CLI framework
- **inquirer** - Interactive prompts
- **chalk** - Terminal styling
- **ora** - Loading spinners
- **fs-extra** - File system utilities
- **ethers** - Ethereum library

## License

MIT

## Learn More

- [BNB Claw Documentation](https://github.com/ClawdHQ/BNB-Claw)
- [Core Package](../core)
- [Modules Package](../modules)
- [Examples](../examples)

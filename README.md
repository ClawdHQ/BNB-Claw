# 🐾 BNB Claw

> **OpenClaw for BNB Chain** - Build AI agents in minutes, not months

BNB Claw is a plug-and-play AI agent SDK for BNB Chain that enables developers to build autonomous agents with pre-built DeFi modules (Swap, Lend, Stake, Treasury).

## 🎯 Features

- **🤖 AI-Powered Agents**: Built-in OpenAI and Anthropic support for intelligent decision making
- **🔌 Plug-and-Play Modules**: Pre-built integrations for PancakeSwap, Venus Protocol, and BNB Staking
- **🛡️ Type-Safe**: Written in TypeScript with comprehensive type definitions
- **⚡ Fast & Efficient**: Optimized for performance with gas-efficient transactions
- **📦 Monorepo Structure**: Clean separation of concerns with pnpm workspaces

## 📦 Packages

### Core Packages
- **[@bnb-claw/core](./packages/core)** - Base agent framework and module system
- **[@bnb-claw/modules](./packages/modules)** - DeFi protocol integrations (Swap, Lend, Stake, Treasury)
- **[@bnb-claw/cli](./packages/cli)** - Command-line tools for initializing projects and managing agents

### Examples
- **[@bnb-claw/examples](./packages/examples)** - Example implementations and usage patterns

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

### Installation

#### Option 1: Use the CLI (Recommended)

The easiest way to get started is using the BNB Claw CLI:

```bash
# Clone the repository
git clone https://github.com/ClawdHQ/BNB-Claw.git
cd BNB-Claw

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Initialize a new agent project
cd packages/cli
node dist/index.mjs init

# Follow the interactive prompts to configure your project
```

#### Option 2: Manual Setup

```bash
# Clone the repository
git clone https://github.com/ClawdHQ/BNB-Claw.git
cd BNB-Claw

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Environment Setup

Create a `.env` file in the root directory:

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
# - Add your OpenAI or Anthropic API key
# - Add your BNB Chain RPC endpoint
# - Add your private key (for transactions)
```

### Run Example

```bash
cd packages/examples
pnpm dev
```

## 💡 Usage Example

```typescript
import { BaseAgent } from '@bnb-claw/core';
import { SwapModule, LendModule, StakeModule } from '@bnb-claw/modules';
import { ethers } from 'ethers';

// Setup provider and signer
const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Create AI agent
const agent = new BaseAgent({
  name: 'DeFi Assistant',
  description: 'A helpful AI agent for BNB Chain DeFi',
  model: 'gpt-4',
  provider: 'openai',
});

// Initialize and register modules
const swapModule = new SwapModule({
  name: 'SwapModule',
  description: 'PancakeSwap V3 integration',
  version: '0.1.0',
  chainId: 56,
  provider,
  signer,
  routerAddress: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
  quoterAddress: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
  factoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
  defaultSlippage: 50, // 0.5%
});

agent.registerModule('SwapModule', swapModule);

// Chat with the agent
const response = await agent.chat('Help me swap 1 BNB for USDT');
console.log(response);

// Plan and execute a strategy
const actions = await agent.planStrategy('Stake 50% of my BNB and swap the rest to USDT');
for (const action of actions) {
  await agent.execute(action);
}
```

## 🛠️ CLI Tools

BNB Claw provides a comprehensive CLI for managing agent projects:

### Initialize a New Project

Create a new BNB Claw agent project with the interactive setup wizard:

```bash
bnb-claw init
```

Options:
- `-n, --name <name>` - Project name
- `-d, --directory <path>` - Target directory
- `--skip-install` - Skip dependency installation

The CLI will guide you through:
- Project configuration
- Module selection (Swap, Lend, Stake, Treasury)
- AI provider setup (OpenAI, Anthropic)
- Network selection (Testnet, Mainnet)

### Create a New Agent

Generate a new agent configuration file:

```bash
bnb-claw agent create
```

Options:
- `-n, --name <name>` - Agent name
- `-m, --model <model>` - AI model (gpt-4, gpt-3.5-turbo, claude-3-opus)
- `-p, --provider <provider>` - AI provider (openai, anthropic)
- `--modules <modules...>` - Modules to include (swap, lend, stake, treasury)

Example:
```bash
bnb-claw agent create \
  --name TradingAgent \
  --model gpt-4 \
  --provider openai \
  --modules swap lend
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           BNB Claw SDK                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐      ┌──────────────┐   │
│  │BaseAgent │─────▶│ LLM Provider │   │
│  └──────────┘      │ (OpenAI/     │   │
│       │            │  Anthropic)  │   │
│       │            └──────────────┘   │
│       ▼                                │
│  ┌──────────────────────────────┐     │
│  │        Modules               │     │
│  ├──────────────────────────────┤     │
│  │ • SwapModule (PancakeSwap)   │     │
│  │ • LendModule (Venus)         │     │
│  │ • StakeModule (BNB Staking)  │     │
│  │ • TreasuryModule (Portfolio) │     │
│  └──────────────────────────────┘     │
│       │                                │
│       ▼                                │
│  ┌──────────────────────────────┐     │
│  │      BNB Chain (BSC)         │     │
│  └──────────────────────────────┘     │
└─────────────────────────────────────────┘
```

## 🧩 Modules

### SwapModule
- Token swaps on PancakeSwap V3
- Slippage protection
- Price impact checking
- Multi-hop routing

### LendModule
- Supply assets to Venus Protocol
- Borrow against collateral
- APY calculations
- Account liquidity monitoring

### StakeModule
- BNB Chain native staking
- Validator selection
- Reward claiming
- Unbonding management

### TreasuryModule
- Portfolio allocation
- Automatic rebalancing
- Yield harvesting
- DCA strategies

## 📚 Documentation

- [Getting Started Guide](./docs/guides/getting-started.md) *(coming soon)*
- [API Reference](./docs/api/README.md) *(coming soon)*
- [Module Development](./docs/guides/module-development.md) *(coming soon)*
- [Examples](./packages/examples) *(available)*

## 🛠️ Development

### Scripts

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Clean build artifacts
pnpm clean

# Watch mode (development)
pnpm dev
```

### Project Structure

```
bnb-claw/
├── packages/
│   ├── core/           # Core agent framework
│   ├── modules/        # DeFi protocol modules
│   ├── cli/            # CLI tools
│   ├── agents/         # Pre-built agent templates (planned)
│   └── examples/       # Usage examples
├── docs/               # Documentation
├── scripts/            # Build and utility scripts
└── package.json        # Root package configuration
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the BNB Chain hackathon
- Inspired by OpenClaw framework
- Powered by OpenAI and Anthropic

## 🔗 Links

- [BNB Chain](https://www.bnbchain.org/)
- [PancakeSwap](https://pancakeswap.finance/)
- [Venus Protocol](https://venus.io/)

---

**Made with ❤️ for BNB Chain**

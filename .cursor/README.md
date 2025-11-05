# NEAR Intents Simulator - Cursor Rules

This directory contains Cursor AI rules to guide development of the NEAR Intents Simulator. These rules help maintain code quality, provide architectural guidance, and ensure consistent development practices.

## Available Rules

### Core Rules (Always Apply)

#### [`near-intents-simulator-guide.mdc`](rules/near-intents-simulator-guide.mdc)
**Purpose**: Master navigation and project overview
**When to use**: Always - this is your primary guide
**Covers**:
- Project structure and architecture
- Current implementation status
- Quick reference commands
- Data models and interfaces
- Development phases and roadmap

#### [`near-intents-architecture.mdc`](rules/near-intents-architecture.mdc)
**Purpose**: NEAR Intents Protocol implementation patterns
**When to use**: When working on simulator logic, quote calculation, routing
**Covers**:
- Quote calculation flow and patterns
- Fee models and slippage handling
- Route generation for cross-chain swaps
- Asset registry management
- Execution simulation patterns

#### [`adapter-implementation.mdc`](rules/adapter-implementation.mdc)
**Purpose**: Implementation guidance for NearExecutionAdapter and CrossChainAdapter
**When to use**: When creating or modifying adapters
**Covers**:
- NearExecutionAdapter implementations (localnet, testnet, mock)
- CrossChainAdapter implementations (Chain Signatures, Rainbow Bridge, mock)
- Error handling and connection management
- Testing adapter integrations

### Development Rules (Request as Needed)

#### [`testing-development.mdc`](rules/testing-development.mdc)
**Purpose**: Testing strategies, debugging techniques, and development workflows
**When to use**: When writing tests, debugging issues, or adding new features
**Covers**:
- Unit and integration testing patterns
- Mock implementation strategies
- Debugging techniques and logging analysis
- Performance testing and optimization
- Development workflows for new features

#### [`code-quality.mdc`](rules/code-quality.mdc)
**Purpose**: TypeScript best practices and code quality standards
**When to use**: During code reviews, refactoring, or when establishing coding standards
**Covers**:
- TypeScript type safety patterns
- Interface design and composition
- Error handling strategies
- Code organization and performance
- Documentation and testing standards

## How to Use These Rules

### For New Development

1. **Start with the project guide** (`near-intents-simulator-guide.mdc`)
   - Understand current implementation status
   - Review project structure and data models
   - Check quick reference commands

2. **Choose the appropriate specialized rule**:
   - **Adding simulator logic** → `near-intents-architecture.mdc`
   - **Implementing adapters** → `adapter-implementation.mdc`
   - **Writing tests** → `testing-development.mdc`
   - **Code quality review** → `code-quality.mdc`

### For Debugging

1. **Check logging patterns** in `testing-development.mdc`
2. **Review adapter implementations** in `adapter-implementation.mdc`
3. **Examine error handling** in `code-quality.mdc`

### For Code Reviews

1. **Type safety** → `code-quality.mdc`
2. **Testing coverage** → `testing-development.mdc`
3. **Architecture compliance** → `near-intents-architecture.mdc`

## Rule Activation

Rules are configured with different activation levels:

- **`alwaysApply: true`** - Loaded automatically by Cursor
- **`alwaysApply: false`** - Must be requested manually

### Requesting Rules

To load a specific rule, mention it in your query:

```
"Show me adapter implementation patterns" → loads `adapter-implementation.mdc`
"How should I test this feature?" → loads `testing-development.mdc`
"What are the code quality standards?" → loads `code-quality.mdc`
```

## Project Context

### What the Simulator Does

The NEAR Intents Simulator provides a **production-equivalent localnet** development environment for NEAR's 1Click API (Intents Protocol). It enables:

- **Quote Generation**: Calculate swap quotes with fees and slippage
- **Cross-Chain Routing**: Generate routes via Rainbow Bridge, etc.
- **Real NEAR Execution**: Actual on-chain transactions on localnet
- **Real MPC Integration**: Genuine Chain Signatures via [NEAR MPC](https://github.com/near/mpc)

### Architecture: Real Infrastructure Over Mocks

**Critical Distinction**: This simulator runs against **real blockchain infrastructure**, not mocks:

✅ **Real Components**:
- NEAR localnet blockchain (via `@near-sandbox/cross-chain-simulator`)
- Real MPC nodes (3-8 nodes) for Chain Signatures
- Real smart contracts (`v1.signer-dev.testnet`)
- Real NEAR RPC calls and transactions

🔧 **Simulated Components** (only external chains):
- Destination chain transactions (Ethereum, Bitcoin, etc. aren't running locally)
- External APIs (price feeds, analytics)
- Non-critical development tooling

### Current Implementation Status

✅ **Completed (Phase 1)**:
- Core simulator with quote/execution logic
- Asset registry (NEAR, Ethereum, Bitcoin, Dogecoin)
- Mock and real NEAR execution adapters
- Cross-chain address derivation
- Comprehensive TypeScript types
- Factory pattern for environment selection

🚧 **Planned (Phase 2+)**:
- Production 1Click API client
- Comprehensive test suite
- Usage examples and documentation
- Enhanced asset support
- Performance optimizations

## Key Concepts

### Adapters Pattern

The simulator uses dependency injection with two main adapter interfaces:

```typescript
interface NearExecutionAdapter {
  sendNearTransfer(sender: string, encryptedKey: string, recipient: string, amountNear: string):
    Promise<{ txHash: string; blockHeight: number }>;
}

interface CrossChainAdapter {
  deriveAddress(nearAccount: string, chain: string):
    Promise<{ address: string; publicKey: string }>;
  simulateDestinationTx(params: { chain: string; correlateTo: string }):
    Promise<string>;
}
```

### Quote Flow

1. **Request Validation** → Ensure required fields and valid formats
2. **Asset Resolution** → Look up decimals and symbols from registry
3. **Fee Calculation** → Apply 0.3% fee, then slippage tolerance
4. **Route Generation** → Create steps based on chain relationships
5. **Quote Response** → Return structured quote with metadata

### Execution Flow

1. **Status Update** → Set to PROCESSING
2. **NEAR Transfer** → Execute via adapter (real or mock)
3. **Cross-Chain** → Simulate destination transaction if needed
4. **Completion** → Update status and store transaction details

## Development Workflow

### Adding New Features

1. **Plan** → Use project guide to understand current state
2. **Design** → Reference architecture patterns
3. **Implement** → Follow TypeScript best practices
4. **Test** → Write comprehensive unit and integration tests
5. **Document** → Add JSDoc and update examples

### Common Tasks

- **New Asset Support** → Update registries in `near-intents-architecture.mdc`
- **Adapter Implementation** → Follow patterns in `adapter-implementation.mdc`
- **Testing Strategy** → Use examples in `testing-development.mdc`
- **Code Review** → Check standards in `code-quality.mdc`

## Getting Help

If you need assistance with any aspect of the simulator:

1. **Check the relevant rule** first
2. **Look at existing code** for implementation examples
3. **Review the README.md** in the project root
4. **Check the package.json** for available scripts

These rules are designed to evolve with the project. As new patterns emerge or requirements change, update the relevant rules to maintain consistency across the codebase.

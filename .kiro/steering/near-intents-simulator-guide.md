---
inclusion: always
---

# NEAR Intents Simulator Project Guide

**Master navigation rule for NEAR Intents Simulator - Always read this first**

## Project Overview

NEAR Intents Simulator is a TypeScript library that simulates NEAR's 1Click API (Intents Protocol) for localnet development. It provides production-shaped interfaces with real NEAR RPC support via dependency injection.

**Current Status**: **Phase 1 - Core Simulator Implementation** ✅

### What Works Now (Phase 1)
- ✅ TypeScript library with proper compilation
- ✅ `OneClickSimulator` class with full quote/execution simulation
- ✅ Asset registry supporting NEAR, Ethereum, Bitcoin, Dogecoin
- ✅ Cross-chain route calculation (Rainbow Bridge, Uniswap, Ref Finance)
- ✅ **Real NEAR localnet integration** via `@near-sandbox/cross-chain-simulator`
- ✅ **Real MPC network** for Chain Signatures ([github.com/near/mpc](https://github.com/near/mpc))
- ✅ Production-equivalent adapter interfaces
- ✅ Comprehensive logging and error handling
- ✅ Factory pattern for environment selection

### Architecture Principle: Real Infrastructure Over Mocks

> **We don't mock the blockchain.** This simulator runs against real NEAR localnet with real MPC nodes for Chain Signatures. The only simulated components are external chain transactions (Ethereum, Bitcoin, etc.) that aren't running locally.

### What's Coming (Phase 2+)
- 🚀 Production 1Click API client integration
- 🧪 Comprehensive test suite
- 📚 Usage examples and adapter implementations
- 🔧 Enhanced asset registry and fee models
- 🌐 Multi-chain expansion support
- 📊 Metrics and monitoring

## Quick Reference

### Essential Commands
```bash
# Start NEAR localnet + MPC infrastructure
# (from @near-sandbox/cross-chain-simulator)
npm run start:localnet

# Build the library
npm run build

# Watch mode for development
npm run watch

# Check TypeScript compilation
npx tsc --noEmit

# Stop localnet infrastructure
npm run stop:localnet

# Publish to npm (after build)
npm publish
```

### Key Files to Know

#### Core Implementation
- [`src/index.ts`](mdc:src/index.ts) - Main exports and public API
- [`src/types.ts`](mdc:src/types.ts) - TypeScript interfaces and types
- [`src/factory.ts`](mdc:src/factory.ts) - Client factory (simulator vs production)
- [`src/config.ts`](mdc:src/config.ts) - Environment configuration

#### Simulator
- [`src/intents/simulator.ts`](mdc:src/intents/simulator.ts) - Main simulator implementation
- [`src/shared/`](mdc:src/shared/) - Shared utilities (currently empty)

#### Configuration
- [`package.json`](mdc:package.json) - Dependencies and scripts
- [`tsconfig.json`](mdc:tsconfig.json) - TypeScript compilation settings

## Project Structure

```
/
├── src/
│   ├── index.ts                    # Main exports
│   ├── types.ts                    # TypeScript interfaces
│   ├── factory.ts                  # Client factory
│   ├── config.ts                   # Configuration
│   ├── intents/
│   │   └── simulator.ts           # Core simulator
│   └── shared/                     # Shared utilities
├── dist/                           # Compiled JavaScript
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript config
└── README.md                       # Documentation
```

## How to Use Cursor Rules

### For Phase 1 Work (Current)

**Always Available**:
1. **This rule (near-intents-simulator-guide)** - You're reading it now
2. **[near-intents-architecture](mdc:.cursor/rules/near-intents-architecture.mdc)** - NEAR Intents protocol patterns
3. **[adapter-implementation](mdc:.cursor/rules/adapter-implementation.mdc)** - How to implement adapters

**Request When Needed**:
- Ask: "How do NEAR transactions work?" → loads near-intents-architecture rule
- Ask: "How do I implement a NearExecutionAdapter?" → loads adapter-implementation rule

### For Future Phases

**Phase 2+ Rules (To Be Created)**:
- `testing-patterns` - Unit and integration testing
- `production-client` - Real 1Click API integration
- `ci-cd-setup` - Build and deployment automation

## Architecture Overview

### Core Pattern: Real Infrastructure with Dependency Injection

The simulator integrates with **real NEAR localnet** and **real MPC nodes** via the `@near-sandbox/cross-chain-simulator` module.

```typescript
import { 
  LocalnetConfig,
  getNearRpcUrl,
  getMpcContractId,
  getMpcNodes
} from '@near-sandbox/cross-chain-simulator';

// Configuration imported from cross-chain-simulator
const localnetConfig: LocalnetConfig = {
  rpcUrl: getNearRpcUrl(),           // http://localhost:3030
  mpcContractId: getMpcContractId(), // v1.signer-dev.testnet
  mpcNodes: getMpcNodes(),           // [http://localhost:3000, ...]
  networkId: 'localnet'
};

// Simulator with REAL NEAR + REAL MPC
const simulator = new OneClickSimulator({
  crossChain: new LocalnetMPCAdapter(localnetConfig),  // Real MPC nodes
  nearExec: new LocalnetNearExecutor(localnetConfig)   // Real NEAR RPC
});

// For testing only (CI/CD without infrastructure)
const simulator = new OneClickSimulator({
  crossChain: new MockCrossChainAdapter(),  // Mock only when MPC unavailable
  nearExec: new MockNearExecutor()          // Mock only for unit tests
});
```

### Infrastructure Stack

```
┌──────────────────────────────┐
│  NEAR Intents Simulator      │ ← This repository
└──────────┬───────────────────┘
           │ imports config
           ▼
┌──────────────────────────────┐
│  cross-chain-simulator       │ ← Provides RPC URLs, MPC endpoints
└──────────┬───────────────────┘
           │ orchestrates
           ▼
┌──────────────────────────────┐
│  Docker Infrastructure       │
│  • NEAR Localnet (nearcore)  │ ← Real blockchain
│  • MPC Network (3-8 nodes)   │ ← Real MPC (github.com/near/mpc)
│  • v1.signer contract        │ ← Real Chain Signatures
└──────────────────────────────┘
```

### Key Interfaces

#### NearExecutionAdapter
```typescript
interface NearExecutionAdapter {
  sendNearTransfer(
    sender: string,
    encryptedKey: string,
    recipient: string,
    amountNear: string
  ): Promise<{ txHash: string; blockHeight: number }>;
}
```

#### CrossChainAdapter
```typescript
interface CrossChainAdapter {
  deriveAddress(nearAccount: string, chain: string): Promise<{
    address: string;
    publicKey: string;
  }>;
  simulateDestinationTx(params: {
    chain: string;
    correlateTo: string;
  }): Promise<string>;
}
```

## Data Models

### Quote Request
```typescript
interface QuoteRequest {
  swapType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'ANY_INPUT';
  originAsset: string;        // "near:wrap.near"
  destinationAsset: string;   // "ethereum:usdc.eth"
  amount: string;             // Smallest unit (yoctoNEAR, wei)
  refundTo: string;           // NEAR account
  recipient: string;          // Destination address
  slippageTolerance?: number;
  deadline?: string;
}
```

### Quote Response
```typescript
interface QuoteResponse {
  quoteId: string;
  quote: {
    amountIn: string;
    amountOut: string;
    amountOutFormatted: string;
    fee: string;
    route: { steps: Array<{ from: string; to: string; protocol: string }> };
    deadline: string;
    timeEstimate: number;
  };
}
```

### Swap Status
```typescript
interface SwapStatusResponse {
  status: 'PENDING_DEPOSIT' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  quoteResponse: QuoteResponse;
  swapDetails?: {
    nearTxHashes?: string[];
    destinationTxHash?: string;
    amountIn: string;
    amountOut: string;
  };
}
```

## Testing the Simulator

### Basic Usage
```typescript
import { OneClickSimulator } from '@near-sandbox/near-intents-simulator';

// Create simulator instance
const simulator = new OneClickSimulator({
  crossChain: mockAdapter
});

// Request quote
const quote = await simulator.requestQuote({
  swapType: 'EXACT_INPUT',
  originAsset: 'near:wrap.near',
  destinationAsset: 'ethereum:usdc.eth',
  amount: '1000000000000000000000000', // 1 NEAR
  refundTo: 'alice.near',
  recipient: '0x123...abc'
});

// Check status
const status = await simulator.getSwapStatus(quote.quoteId);
```

### With Real NEAR Execution
```typescript
const simulator = new OneClickSimulator({
  crossChain: realCrossChainAdapter,
  nearExec: new LocalnetNearExecutor('http://localhost:3030')
});
```

## Common Tasks & Which Rules to Use

### Simulator Development
→ Use **near-intents-architecture** rule
- Implementing quote calculation logic
- Adding new asset types or protocols
- Understanding NEAR Intents flow
- Cross-chain route planning

### Adapter Implementation
→ Use **adapter-implementation** rule
- Creating NearExecutionAdapter for real NEAR RPC
- Implementing CrossChainAdapter for address derivation
- Mock adapter development for testing

### TypeScript Development
→ Use **this rule (near-intents-simulator-guide)**
- Understanding project structure
- Working with the type system
- Adding new features to the simulator

## When to Ask for Help

**Use near-intents-architecture rule** when:
- Working with NEAR transaction concepts
- Understanding Intents Protocol flow
- Planning cross-chain integrations
- Designing quote calculation logic

**Use adapter-implementation rule** when:
- Implementing real NEAR RPC calls
- Creating cross-chain address derivation
- Building mock adapters for testing
- Understanding adapter patterns

**Use this rule** when:
- Understanding project structure
- Working with TypeScript types
- Planning new features
- Understanding the factory pattern

## Key Development Patterns

### Adding New Asset Types
```typescript
// In simulator.ts, update getDecimals/getSymbol methods
private getDecimals(chain: string, token: string): number {
  const key = `${chain}:${token}`;
  const registry: Record<string, number> = {
    // ... existing entries
    'polygon:native': 18,
    'polygon:usdc.polygon': 6,
  };
  return registry[key] || 18;
}
```

### Adding New Protocols
```typescript
// Update calculateQuote method
const protocols = {
  'polygon-to-ethereum': [
    { from: 'MATIC', to: 'MATIC (bridged)', protocol: 'polygon-bridge' },
    { from: 'MATIC (bridged)', to: 'USDC', protocol: 'uniswap-v3' }
  ]
};
```

### Error Handling Pattern
```typescript
try {
  // Operation that might fail
  const result = await this.nearExec.sendNearTransfer(/*...*/);
  console.log('✅ [INTENTS] Real NEAR transfer executed');
} catch (error) {
  console.error('❌ [INTENTS] Real execution failed:', error.message);
  // Fallback to mock
  return this.generateMockTxHash('NEAR');
}
```

## Troubleshooting Quick Guide

**TypeScript compilation issues**:
```bash
npx tsc --noEmit  # Check for errors without emitting files
```

**Build issues**:
```bash
rm -rf dist && npm run build  # Clean rebuild
```

**Import issues**:
- Check `src/index.ts` for proper exports
- Ensure types are exported from `src/types.ts`

**Runtime issues**:
- Check console logs for `[INTENTS]` prefixed messages
- Verify adapter implementations
- Ensure proper environment configuration

## Development Workflow

### Making Changes
1. **Edit source files** in `src/`
2. **Run build** to compile to `dist/`
3. **Test changes** with your application
4. **Update types** if adding new interfaces
5. **Update README** if changing public API

### Adding Features
1. **Update types** in `src/types.ts`
2. **Implement logic** in appropriate module
3. **Add logging** with `[INTENTS]` prefix
4. **Update exports** in `src/index.ts`
5. **Test thoroughly** before publishing

## Phase Roadmap

**Phase 1 (Current)**: Core Simulator ✅
- Fully functional simulator with mock and real NEAR support
- Comprehensive type system and interfaces
- Production-ready library structure

**Phase 2 (Next)**: Production Integration 🚀
- Real 1Click API client implementation
- Comprehensive test suite
- Usage examples and documentation
- CI/CD pipeline setup

**Phase 3 (Future)**: Advanced Features 🏦
- Enhanced asset registry
- Multi-chain expansion
- Performance optimization
- Monitoring and metrics

---

**Remember**: This is Phase 1. Focus on the simulator core - clean interfaces, comprehensive logging, and solid TypeScript patterns. The production client can be added later without breaking existing integrations! 🎉
# NEAR Intents Simulator - Architecture Overview

## Core Principle: Real Infrastructure Over Mocks

**We don't mock the blockchain.** This simulator runs against real NEAR localnet with real MPC nodes for Chain Signatures.

## Infrastructure Stack

```
┌──────────────────────────────────────────────────┐
│   NEAR Intents Simulator (This Repository)      │
│   • Quote calculation & fee models               │
│   • Execution orchestration                      │
│   • Adapter interfaces (NearExecutionAdapter,    │
│     CrossChainAdapter)                           │
└────────────────┬─────────────────────────────────┘
                 │
                 │ imports config from
                 ▼
┌──────────────────────────────────────────────────┐
│   @near-sandbox/cross-chain-simulator (npm)      │
│   • Provides RPC URLs (http://localhost:3030)    │
│   • Provides MPC endpoints                       │
│   • Provides contract addresses                  │
│   • Orchestrates infrastructure                  │
└────────────────┬─────────────────────────────────┘
                 │
                 │ imports NEAR node from
                 ▼
┌──────────────────────────────────────────────────┐
│   aws-blockchain-node-runners                    │
│   • NEAR node CDK deployment                     │
│   • Localnet configuration                       │
│   • RPC endpoint management                      │
└────────────────┬─────────────────────────────────┘
                 │
                 │ deploys infrastructure
                 ▼
┌──────────────────────────────────────────────────┐
│   Real Infrastructure (AWS/Docker)               │
│                                                  │
│   ┌────────────────────────────────────┐        │
│   │ NEAR Localnet (nearcore)           │        │
│   │ • Real blockchain node (AWS CDK)   │        │
│   │ • RPC endpoint: localhost:3030     │        │
│   │ • Real transaction finality        │        │
│   └────────────────────────────────────┘        │
│                                                  │
│   ┌────────────────────────────────────┐        │
│   │ MPC Network (github.com/near/mpc)  │        │
│   │ • MPC Node 1: localhost:3000       │        │
│   │ • MPC Node 2: localhost:3001       │        │
│   │ • MPC Node 3: localhost:3002       │        │
│   │ • Real threshold signatures         │        │
│   │ • cait-sith implementation         │        │
│   └────────────────────────────────────┘        │
│                                                  │
│   ┌────────────────────────────────────┐        │
│   │ Deployed Smart Contracts           │        │
│   │ • v1.signer-dev.testnet            │        │
│   │ • Chain Signatures contract        │        │
│   │ • Real on-chain state              │        │
│   └────────────────────────────────────┘        │
│                                                  │
│   ┌────────────────────────────────────┐        │
│   │ Development Tools                  │        │
│   │ • Block Explorer (localnet)        │        │
│   │ • Price Feed APIs (optional)       │        │
│   └────────────────────────────────────┘        │
└──────────────────────────────────────────────────┘
```

## What's Real vs What's Simulated

### ✅ Real Infrastructure (Production Equivalent)

| Component | Implementation | Source |
|-----------|---------------|--------|
| **NEAR Blockchain** | Real localnet node running nearcore | Inherited from [aws-blockchain-node-runners](https://github.com/shaiss/aws-blockchain-node-runners) |
| **MPC Network** | Real MPC nodes (3-8 instances) | [github.com/near/mpc](https://github.com/near/mpc) |
| **Chain Signatures** | Real threshold signature generation | MPC network via `v1.signer` |
| **NEAR RPC** | Real RPC connection to localnet | Inherited by `cross-chain-simulator` from AWS Node Runner |
| **Smart Contracts** | Real contract deployment on-chain | `v1.signer-dev.testnet` on localnet |
| **NEAR Transactions** | Real on-chain transactions with finality | NEAR localnet blockchain (nearcore protocol) |
| **Gas Fees** | Real gas calculation and deduction | NEAR protocol running on localnet |
| **State Changes** | Real on-chain state modifications | Stored in localnet blockchain |

### 🔧 Simulated Components (External Chains Only)

| Component | Implementation | Source |
|-----------|---------------|--------|
| **Destination Chain Transactions** | External blockchains (ETH, BTC) via Chain Signatures | Configured cross-chain signing via MPC |
| **Bridge APIs** | External infrastructure (Rainbow Bridge backend) | Simulated responses for localnet |
| **Price Feeds** | Real-time market data | Free/open APIs (CoinGecko, CryptoCompare, etc.) |
| **Block Explorer** | Localnet blockchain explorer | [NearLightweightBlockExplorer](https://github.com/shaiss/NearLightweightBlockExplorer) |

### 🚫 Never Mock (Core Infrastructure)

- NEAR blockchain operations
- MPC signature generation
- Chain Signatures address derivation
- NEAR RPC calls
- Smart contract interactions
- NEAR transaction finality
- Gas fee calculations
- Account state management

## Adapter Architecture

### NearExecutionAdapter

**Purpose**: Execute real NEAR transfers on localnet

**Implementation**: `LocalnetNearExecutor`
```typescript
import { LocalnetConfig } from '@near-sandbox/cross-chain-simulator';

const executor = new LocalnetNearExecutor({
  rpcUrl: 'http://localhost:3030',  // From cross-chain-simulator
  networkId: 'localnet',
  mpcContractId: 'v1.signer-dev.testnet'
});

// Executes REAL on-chain transaction
const result = await executor.sendNearTransfer(
  'alice.near',
  encryptedKey,
  'bob.near',
  '1.0'  // Real NEAR transfer
);
// Returns real txHash and blockHeight
```

### CrossChainAdapter

**Purpose**: Derive cross-chain addresses via real MPC

**Implementation**: `LocalnetMPCAdapter`
```typescript
const mpcAdapter = new LocalnetMPCAdapter({
  rpcUrl: 'http://localhost:3030',
  mpcContractId: 'v1.signer-dev.testnet',
  mpcNodes: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002'
  ]
});

// Calls REAL v1.signer contract, gets REAL MPC-derived key
const { address, publicKey } = await mpcAdapter.deriveAddress(
  'alice.near',
  'ethereum'
);
// address: Real Ethereum address controlled by MPC network
// publicKey: Real secp256k1 public key from threshold signature
```

## Development Workflow

### 1. Start Infrastructure
```bash
# From @near-sandbox/cross-chain-simulator
npm run start:localnet
```

This starts:
- NEAR localnet node
- MPC network (3-8 nodes)
- Deploys v1.signer contract
- Exposes RPC and MPC endpoints

### 2. Initialize Simulator
```typescript
import { 
  LocalnetConfig,
  getNearRpcUrl,
  getMpcContractId,
  getMpcNodes
} from '@near-sandbox/cross-chain-simulator';

import { 
  OneClickSimulator,
  LocalnetNearExecutor,
  LocalnetMPCAdapter
} from '@near-sandbox/near-intents-simulator';

// Import real configuration
const config: LocalnetConfig = {
  rpcUrl: getNearRpcUrl(),           // Real RPC URL
  mpcContractId: getMpcContractId(), // Real contract address
  mpcNodes: getMpcNodes(),           // Real MPC node URLs
  networkId: 'localnet'
};

// Create simulator with real infrastructure
const simulator = new OneClickSimulator({
  crossChain: new LocalnetMPCAdapter(config),
  nearExec: new LocalnetNearExecutor(config)
});
```

### 3. Execute NEAR Intents
```typescript
// Request quote (uses real asset registry and fee calculation)
const quote = await simulator.requestQuote({
  swapType: 'EXACT_INPUT',
  originAsset: 'near:native',
  destinationAsset: 'ethereum:usdc.eth',
  amount: '1000000000000000000000000', // 1 NEAR
  refundTo: 'alice.near',
  recipient: '0x742d35Cc6597C0532895a0d889f46a9b49ba7D617'
});

// Executes:
// 1. Real NEAR transfer on localnet (alice.near → deposit address)
// 2. Real MPC address derivation for Ethereum
// 3. Simulated Ethereum transaction (ETH chain not running)
const status = await simulator.getSwapStatus(quote.quoteId);
```

### 4. Stop Infrastructure
```bash
npm run stop:localnet
```

## Key Benefits

### Production Parity
- Localnet behaves identically to mainnet
- Same RPC interface, same contract behavior
- Real transaction finality and state management

### Complete Testing
- Test full NEAR Intents flow including MPC signatures
- Verify gas fees, transaction ordering, state changes
- Catch issues before deploying to public testnet
- Validate flows in localnet → testnet → mainnet progression

### No Mocking Core Logic
- Real blockchain eliminates "works in test, fails in prod" scenarios
- Real MPC ensures cryptographic correctness
- Real contracts ensure state management accuracy

### Developer Experience
- Simple npm scripts (`start:localnet`, `stop:localnet`)
- Configuration automatically imported
- Docker orchestration hidden behind clean APIs

## Integration Points

### With cross-chain-simulator

**Import Configuration**:
```typescript
import { 
  LocalnetConfig,
  getNearRpcUrl,
  getMpcContractId,
  getMpcNodes
} from '@near-sandbox/cross-chain-simulator';
```

**Usage**:
- `getNearRpcUrl()`: Returns `http://localhost:3030`
- `getMpcContractId()`: Returns deployed contract address
- `getMpcNodes()`: Returns array of MPC node URLs

### With NEAR MPC

**Direct Integration**:
- MPC nodes run from [github.com/near/mpc](https://github.com/near/mpc)
- Threshold signature generation using cait-sith
- Real multi-party computation for key derivation

**Contract Interface**:
```rust
// v1.signer contract methods
pub fn public_key(&self, path: String) -> PublicKey;
pub fn sign(&mut self, request: SignRequest) -> Promise;
```

## Testing Strategy

### Unit Tests
- Mock adapters for testing quote calculation logic
- Mock for testing fee models and slippage
- Real adapters NOT needed for isolated logic tests

### Integration Tests
- **Always use real adapters** with localnet infrastructure
- Test complete flow: quote → execution → status
- Verify real blockchain state changes

### CI/CD
- GitHub Actions can use mock adapters (no Docker)
- Local development MUST use real infrastructure
- Pre-merge testing requires localnet environment

## Future Enhancements

### Phase 2: Production Deployment Path
- **Localnet → Testnet → Mainnet** progression with minimal code changes
- Use mainnet NEAR Intents contracts directly in production
- Same simulator codebase validates behavior across all environments
- Configuration-only changes between environments

### Phase 3: Enhanced Testing
- Automated infrastructure setup in CI
- Chaos testing with MPC node failures
- Performance benchmarking on localnet

### Phase 4: Cross-Chain Integration
- Configure Chain Signatures to connect to external chains (Ethereum, Bitcoin, etc.)
- Enable cross-chain swaps via MPC-based signing
- NEAR Intents inherits cross-chain capabilities from Chain Signatures module
- End-to-end testing with real cross-chain transactions

## References

### Core Infrastructure
- [NEAR MPC Repository](https://github.com/near/mpc) - Real MPC node implementation
- [Cross-Chain Simulator](https://github.com/near/cross-chain-simulator) - Infrastructure orchestration
- [AWS Blockchain Node Runners](https://github.com/shaiss/aws-blockchain-node-runners) - NEAR node deployment (see `lib/near/`)
- [AWS Node Runner Development Notes](../../../AWSNodeRunner/README.md) - Work-in-progress notes

### Protocol Documentation
- [NEAR Intents Protocol](https://near.org/intents) - Protocol specification
- [Chain Signatures Documentation](https://docs.near.org/concepts/abstraction/chain-signatures) - MPC architecture
- [NEAR Documentation](https://docs.near.org/) - Complete NEAR ecosystem docs

### Development Tools
- [NearLightweightBlockExplorer](https://github.com/shaiss/NearLightweightBlockExplorer) - Localnet block explorer
- Free Price Feed APIs: [CoinGecko](https://www.coingecko.com/en/api), [CryptoCompare](https://www.cryptocompare.com/api/)

## Questions?

See the Cursor rules in `.cursor/rules/`:
- `near-intents-simulator-guide.mdc` - Project navigation
- `adapter-implementation.mdc` - Detailed adapter patterns
- `near-intents-architecture.mdc` - Protocol implementation
- `testing-development.mdc` - Testing strategies

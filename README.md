# near-intents-simulator

> **Layer 4: Intents Protocol** - NEAR 1Click API for cross-chain swaps

NEAR Intents (1Click API) simulator for localnet development and testing. Provides production-shaped interfaces with real NEAR RPC support via dependency injection.

## Layer Architecture

This is **Layer 4** of the 5-layer NEAR Localnet Simulator Stack:

```
Layer 1: NEAR Base                  → AWSNodeRunner
Layer 2: NEAR Services              → near-localnet-services
Layer 3: Chain Signatures           → cross-chain-simulator (includes MPC)
Layer 4: Intents Protocol (this)    ← You are here
Layer 5: User Applications          → Your dApp
```

**Depends on**: Layer 3 (Chain Signatures) - uses `@near-sandbox/cross-chain-simulator`
**Provides to higher layers**: 1Click API for quote generation and cross-chain swap execution

## Installation

```bash
npm install @near-sandbox/near-intents-simulator
```

## Usage

```typescript
import { OneClickSimulator, createOneClickClient } from '@near-sandbox/near-intents-simulator';

// Option 1: Use factory (auto-selects simulator or production)
const intents = createOneClickClient();

// Option 2: Manual with real Chain Signatures (localnet)
import { createChainSignaturesClient } from '@near-sandbox/cross-chain-simulator';
const chainSigs = createChainSignaturesClient();
const intents = new OneClickSimulator({
  crossChain: chainSigs,
  nearExec: new LocalnetNearExecutor(rpcUrl)
});

// Option 3: Pure simulation (no infrastructure)
const intents = new OneClickSimulator({
  crossChain: mockChainSigs
});

// Request a quote
const quote = await intents.requestQuote({
  swapType: 'EXACT_INPUT',
  originAsset: 'near:wrap.near',
  destinationAsset: 'ethereum:usdc.eth',
  amount: '1000000000000000000000000', // 1 NEAR
  refundTo: 'alice.near',
  recipient: '0x...'
});

// Execute the swap
const status = await intents.getSwapStatus(quote.quoteId);
```

## Interfaces

### NearExecutionAdapter
Executes real NEAR transfers on localnet via RPC.

```typescript
export interface NearExecutionAdapter {
  sendNearTransfer(sender: string, encryptedKey: string, recipient: string, amountNear: string):
    Promise<{ txHash: string; blockHeight: number }>;
}
```

### CrossChainAdapter
Provides address derivation and destination chain tx simulation via Chain Signatures (Layer 3).

```typescript
export interface CrossChainAdapter {
  deriveAddress(nearAccount: string, chain: string): Promise<{ address: string; publicKey: string }>;
  simulateDestinationTx(params: { chain: string; correlateTo: string }): Promise<string>;
}
```

## Dependency on Layer 3

This layer **depends on** `@near-sandbox/cross-chain-simulator` (Layer 3) for:
- Address derivation (BTC, ETH, etc.)
- Transaction signing via MPC
- v1.signer contract interaction

The Chain Signatures layer must be deployed and configured before using this layer.

## Production vs. Simulator

### Simulator (localnet)
- Real NEAR transfers via injected RPC adapter
- Real Chain Signatures via MPC (Layer 3)
- Simulated external chain transactions

### Production (1Click API)
- Actual 1Click endpoint integration
- Real solver network competition
- Live blockchain bridges

Both share identical interfaces, enabling seamless migration.

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Type checking
npx tsc --noEmit
```

## License

MIT

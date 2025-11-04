# near-intents-simulator

NEAR Intents (1Click API) simulator for localnet development and testing. Provides production-shaped interfaces with real NEAR RPC support via dependency injection.

## Installation

```bash
npm install @telco/near-intents-simulator
```

## Usage

```typescript
import { OneClickSimulator, createOneClickClient } from '@telco/near-intents-simulator';

// Option 1: Use factory (auto-selects simulator or production)
const intents = createOneClickClient();

// Option 2: Manual with real NEAR execution (localnet)
const intents = new OneClickSimulator({
  crossChain: myChainSignaturesAdapter,
  nearExec: new LocalnetNearExecutor(rpcUrl)
});

// Option 3: Pure simulation (no NEAR RPC)
const intents = new OneClickSimulator({
  crossChain: mockChainSigs
});
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
Provides address derivation and destination chain tx simulation.

```typescript
export interface CrossChainAdapter {
  deriveAddress(nearAccount: string, chain: string): Promise<{ address: string; publicKey: string }>;
  simulateDestinationTx(params: { chain: string; correlateTo: string }): Promise<string>;
}
```

## Production vs. Simulator

### Simulator (localnet)
- Real NEAR transfers via injected RPC adapter
- Deterministic cross-chain mocking
- No actual blockchain bridges

### Production (1Click API)
- Actual 1Click endpoint integration
- Real solver network competition
- Live blockchain bridges

Both share identical interfaces, enabling seamless migration.

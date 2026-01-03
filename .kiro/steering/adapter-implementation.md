---
inclusion: always
---

# Adapter Implementation Guide

**How to implement NearExecutionAdapter and CrossChainAdapter for the NEAR Intents Simulator**

## Adapter Overview

The simulator uses dependency injection to support different execution environments, **prioritizing real blockchain and MPC infrastructure** over mocks:

- **NearExecutionAdapter**: Handles **real NEAR transfers on localnet** via RPC
- **CrossChainAdapter**: Manages **real MPC-based** address derivation and cross-chain operations

### Core Architecture Principle

> **We don't mock the blockchain.** The simulator runs against real NEAR localnet with real MPC nodes ([NEAR MPC](https://github.com/near/mpc)). Mocks are only used for non-critical infrastructure or development tooling that can be replaced.

### Real Infrastructure Components

- **NEAR Localnet**: Real blockchain running locally via `cross-chain-simulator` npm module
- **MPC Network**: Real MPC nodes for chain signatures (Chain Abstraction)
- **NEAR RPC**: Real RPC connection imported from localnet configuration

### Optional Mock Components

- **External APIs**: Non-critical external services (price feeds, analytics)
- **Development Tooling**: Test harnesses, monitoring replacements
- **Non-Production Services**: Services not essential to NEAR Intents core flow

## Integration with cross-chain-simulator

The simulator leverages the [`@near-sandbox/cross-chain-simulator`](https://github.com/near/cross-chain-simulator) npm module which provides:

### What cross-chain-simulator Provides

1. **Real NEAR Localnet**: Full NEAR blockchain running locally
2. **Real MPC Network**: [NEAR MPC nodes](https://github.com/near/mpc) (3-8 nodes) for Chain Signatures
3. **Contract Deployment**: Automated deployment of `v1.signer` contract
4. **Configuration Management**: RPC URLs, contract addresses, MPC endpoints
5. **Docker Orchestration**: Complete environment via docker-compose

### Importing Configuration

```typescript
// Import RPC connection and MPC configuration from cross-chain-simulator
import { 
  LocalnetConfig,
  getNearRpcUrl,
  getMpcContractId,
  getMpcNodes
} from '@near-sandbox/cross-chain-simulator';

// Use in adapters
const localnetConfig: LocalnetConfig = {
  rpcUrl: getNearRpcUrl(),           // http://localhost:3030
  mpcContractId: getMpcContractId(), // v1.signer-dev.testnet
  mpcNodes: getMpcNodes(),           // [http://localhost:3000, ...]
  networkId: 'localnet'
};

const nearAdapter = new LocalnetNearExecutor(localnetConfig);
const mpcAdapter = new LocalnetMPCAdapter(localnetConfig);
```

### Development Workflow

1. **Start Infrastructure**: `npm run start:localnet` (from cross-chain-simulator)
2. **Run Simulator**: Uses imported config to connect to real NEAR + MPC
3. **Test Intents**: Full NEAR Intents flow with real blockchain and MPC
4. **Stop Infrastructure**: `npm run stop:localnet`

### Why This Matters

- **Production Parity**: Localnet behaves exactly like mainnet
- **Full Testing**: Test complete Intents flow including MPC signatures
- **No Mocking**: Real blockchain + real MPC = confidence in production
- **Developer Experience**: Simple npm scripts hide complexity

## NearExecutionAdapter Implementation

### Interface Definition
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

### Localnet Implementation (Production-Like)

This implementation connects to **real NEAR localnet** running via the `cross-chain-simulator` module, which provides the same infrastructure as mainnet (including MPC).

```typescript
import { connect, keyStores, KeyPair } from 'near-api-js';
import { LocalnetConfig } from '@near-sandbox/cross-chain-simulator';

/**
 * LocalnetNearExecutor - Executes real NEAR transactions on localnet
 * 
 * Uses RPC connection imported from cross-chain-simulator module which provides:
 * - Real NEAR blockchain (not mocked)
 * - Real MPC network for Chain Signatures
 * - Production-equivalent Intents infrastructure
 */
export class LocalnetNearExecutor implements NearExecutionAdapter {
  private near: any;
  private keyStore: keyStores.KeyStore;
  private config: LocalnetConfig;

  constructor(config?: Partial<LocalnetConfig>) {
    // Import localnet configuration from cross-chain-simulator
    this.config = {
      rpcUrl: config?.rpcUrl || 'http://localhost:3030',
      networkId: 'localnet',
      mpcContractId: config?.mpcContractId || 'v1.signer-dev.testnet',
      ...config
    };

    this.keyStore = new keyStores.InMemoryKeyStore();
  }

  async initialize(): Promise<void> {
    this.near = await connect({
      networkId: this.config.networkId,
      keyStore: this.keyStore,
      nodeUrl: this.config.rpcUrl,
      // Headers for localnet RPC
      headers: this.config.headers || {}
    });

    console.log('[ADAPTER] Connected to NEAR localnet:', {
      rpc: this.config.rpcUrl,
      network: this.config.networkId,
      mpcContract: this.config.mpcContractId
    });
  }

  async sendNearTransfer(
    sender: string,
    encryptedKey: string,
    recipient: string,
    amountNear: string
  ): Promise<{ txHash: string; blockHeight: number }> {
    // 1. Decrypt the sender's private key (using your encryption scheme)
    const keyPair = this.decryptKeyPair(encryptedKey);

    // 2. Add key to keystore temporarily
    await this.keyStore.setKey(this.config.networkId, sender, keyPair);

    // 3. Get account connection
    const account = await this.near.account(sender);

    // 4. Convert NEAR to yoctoNEAR
    const amountYocto = (parseFloat(amountNear) * Math.pow(10, 24)).toFixed(0);

    console.log('[ADAPTER] Executing REAL NEAR transfer:', {
      from: sender,
      to: recipient,
      amount: amountNear + ' NEAR',
      yocto: amountYocto
    });

    // 5. Execute REAL transfer on localnet
    const result = await account.sendMoney(recipient, amountYocto);

    // 6. Cleanup keystore
    await this.keyStore.clear();

    console.log('[ADAPTER] Real NEAR transfer completed:', {
      txHash: result.transaction.hash,
      blockHeight: result.transaction.blockHeight
    });

    return {
      txHash: result.transaction.hash,
      blockHeight: result.transaction.blockHeight
    };
  }

  private decryptKeyPair(encryptedKey: string): KeyPair {
    // Decrypt using your key management scheme
    // For localnet development, keys might be stored in plaintext or simple encryption
    const secretKey = this.decryptKey(encryptedKey);
    return KeyPair.fromString(secretKey);
  }

  private decryptKey(encryptedKey: string): string {
    // Implementation depends on your encryption scheme
    // For development: simple base64 or environment-based decryption
    // For production: HSM or TEE-based decryption
    if (process.env.NODE_ENV === 'development') {
      // Simple base64 for dev (example)
      return Buffer.from(encryptedKey, 'base64').toString('utf-8');
    }

    // Production decryption logic
    return this.productionDecrypt(encryptedKey);
  }

  private productionDecrypt(encryptedKey: string): string {
    // TODO: Implement production-grade decryption
    throw new Error('Production decryption not implemented');
  }
}
```

### Testnet Implementation
```typescript
export class TestnetNearExecutor implements NearExecutionAdapter {
  constructor(private rpcUrl: string = 'https://rpc.testnet.near.org') {}

  async sendNearTransfer(
    sender: string,
    encryptedKey: string,
    recipient: string,
    amountNear: string
  ): Promise<{ txHash: string; blockHeight: number }> {
    // Similar to localnet but with testnet configuration
    const keyPair = KeyPair.fromString(this.decryptKey(encryptedKey));

    const near = await connect({
      networkId: 'testnet',
      keyStore: new keyStores.InMemoryKeyStore(),
      nodeUrl: this.rpcUrl,
    });

    await near.keyStore.setKey('testnet', sender, keyPair);

    const account = await near.account(sender);
    const amountYocto = (parseFloat(amountNear) * 1e24).toFixed(0);

    const result = await account.sendMoney(recipient, amountYocto);

    return {
      txHash: result.transaction.hash,
      blockHeight: result.transaction.blockHeight
    };
  }
}
```

### Mock Implementation for Testing
```typescript
export class MockNearExecutor implements NearExecutionAdapter {
  private transactions: Map<string, any> = new Map();

  async sendNearTransfer(
    sender: string,
    encryptedKey: string,
    recipient: string,
    amountNear: string
  ): Promise<{ txHash: string; blockHeight: number }> {
    // Generate mock transaction
    const txHash = this.generateMockTxHash();
    const blockHeight = Math.floor(Date.now() / 1000);

    // Store for verification
    this.transactions.set(txHash, {
      sender,
      recipient,
      amount: amountNear,
      timestamp: new Date(),
      blockHeight
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return { txHash, blockHeight };
  }

  private generateMockTxHash(): string {
    return Array.from({ length: 44 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
    ).join('');
  }

  // Helper for testing
  getTransaction(txHash: string) {
    return this.transactions.get(txHash);
  }
}
```

## CrossChainAdapter Implementation

### Interface Definition
```typescript
interface CrossChainAdapter {
  deriveAddress(
    nearAccount: string,
    chain: string
  ): Promise<{ address: string; publicKey: string }>;

  simulateDestinationTx(params: {
    chain: string;
    correlateTo: string;
  }): Promise<string>;
}
```

### Real MPC Implementation for Localnet

This implementation connects to **real MPC nodes** running locally via the [NEAR MPC](https://github.com/near/mpc) repository. The MPC network handles Chain Signatures for cross-chain operations.

```typescript
import { connect, keyStores } from 'near-api-js';
import { createHash } from 'crypto';
import { LocalnetConfig } from '@near-sandbox/cross-chain-simulator';

/**
 * LocalnetMPCAdapter - Real MPC-based Chain Signatures for localnet
 * 
 * Connects to real MPC nodes (https://github.com/near/mpc) running locally.
 * This provides the same Chain Signatures functionality as mainnet but in a 
 * local development environment.
 * 
 * Architecture:
 * - MPC network (typically 3-8 nodes) running via docker-compose
 * - v1.signer-dev.testnet contract (or custom localnet contract)
 * - Real threshold signature generation using cait-sith
 */
export class LocalnetMPCAdapter implements CrossChainAdapter {
  private near: any;
  private mpcContractId: string;
  private config: LocalnetConfig;

  constructor(config?: Partial<LocalnetConfig>) {
    this.config = {
      rpcUrl: config?.rpcUrl || 'http://localhost:3030',
      networkId: 'localnet',
      mpcContractId: config?.mpcContractId || 'v1.signer-dev.testnet',
      mpcNodes: config?.mpcNodes || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002'
      ],
      ...config
    };

    this.mpcContractId = this.config.mpcContractId;
  }

  async initialize(): Promise<void> {
    this.near = await connect({
      networkId: this.config.networkId,
      keyStore: new keyStores.InMemoryKeyStore(),
      nodeUrl: this.config.rpcUrl,
    });

    console.log('[MPC] Connected to localnet MPC:', {
      contract: this.mpcContractId,
      nodes: this.config.mpcNodes.length,
      rpc: this.config.rpcUrl
    });

    // Verify MPC nodes are responsive
    await this.healthCheck();
  }

  async deriveAddress(
    nearAccount: string,
    chain: string
  ): Promise<{ address: string; publicKey: string }> {
    // Use REAL MPC network to derive address via Chain Signatures
    const path = `${nearAccount},${chain}`;

    console.log('[MPC] Deriving address via real MPC:', {
      account: nearAccount,
      chain,
      path
    });

    try {
      // Call REAL v1.signer contract on localnet
      const account = await this.near.account(this.mpcContractId);
      const result = await account.viewFunction({
        contractId: this.mpcContractId,
        methodName: 'public_key',
        args: { path }
      });

      // Convert MPC-derived public key to target chain address
      const address = this.publicKeyToAddress(result.public_key, chain);
      
      console.log('[MPC] Real address derived:', {
        chain,
        publicKey: result.public_key.substring(0, 20) + '...',
        address: address.substring(0, 20) + '...'
      });

      return { 
        address, 
        publicKey: result.public_key 
      };

    } catch (error) {
      console.error('[MPC] Address derivation failed:', error);
      throw new Error(`MPC address derivation failed: ${error.message}`);
    }
  }

  async simulateDestinationTx(params: {
    chain: string;
    correlateTo: string;
  }): Promise<string> {
    // For destination chains, we simulate the transaction
    // In production, this would be a real cross-chain bridge transaction
    
    console.log('[MPC] Simulating destination tx:', {
      chain: params.chain,
      correlatedTo: params.correlateTo.substring(0, 20) + '...'
    });

    const baseHash = params.correlateTo;
    const chainPrefix = this.getChainPrefix(params.chain);

    // Create deterministic hash correlated to NEAR transaction
    const combined = `${baseHash}:${params.chain}:destination`;
    const hash = createHash('sha256').update(combined).digest('hex');

    return chainPrefix + hash.substring(0, 64);
  }

  private async healthCheck(): Promise<void> {
    try {
      // Check MPC contract is accessible
      const account = await this.near.account(this.mpcContractId);
      await account.viewFunction({
        contractId: this.mpcContractId,
        methodName: 'public_key',
        args: { path: 'healthcheck' }
      });

      console.log('[MPC] Health check passed - MPC network operational');
    } catch (error) {
      console.warn('[MPC] Health check failed - MPC network may not be ready:', error.message);
      // Don't throw - allow initialization to continue
    }
  }

  private publicKeyToAddress(publicKey: string, chain: string): string {
    switch (chain.toLowerCase()) {
      case 'ethereum':
        return this.derivedKeyToEthAddress(publicKey);

      case 'bitcoin':
        return this.derivedKeyToBtcAddress(publicKey);

      case 'dogecoin':
        return this.derivedKeyToDogeAddress(publicKey);

      default:
        // For unknown chains, return the public key
        return publicKey;
    }
  }

  private derivedKeyToEthAddress(publicKey: string): string {
    // Convert secp256k1 public key (from MPC) to Ethereum address
    // Implementation depends on key format from MPC
    // This is a simplified example
    const hash = createHash('sha256').update(publicKey).digest('hex');
    return '0x' + hash.substring(hash.length - 40);
  }

  private derivedKeyToBtcAddress(publicKey: string): string {
    // Convert to Bitcoin P2PKH address
    // Real implementation would use bitcoin-address library
    const hash = createHash('sha256').update(publicKey).digest('hex');
    return '1' + hash.substring(0, 33); // P2PKH starts with '1'
  }

  private derivedKeyToDogeAddress(publicKey: string): string {
    // Convert to Dogecoin address
    const hash = createHash('sha256').update(publicKey).digest('hex');
    return 'D' + hash.substring(0, 33);
  }

  private getChainPrefix(chain: string): string {
    const prefixes: Record<string, string> = {
      ethereum: '0x',
      bitcoin: '',
      dogecoin: 'D',
    };
    return prefixes[chain.toLowerCase()] || '';
  }
}
```

### Mainnet MPC Adapter (Production)

For mainnet, the adapter connects to the production MPC network:

```typescript
export class MainnetMPCAdapter implements CrossChainAdapter {
  private near: any;
  private readonly MAINNET_MPC_CONTRACT = 'v1.signer';

  constructor(rpcUrl: string = 'https://rpc.mainnet.near.org') {
    // Similar to LocalnetMPCAdapter but connects to mainnet
    // Production MPC network with 8+ nodes
  }

  async deriveAddress(nearAccount: string, chain: string): Promise<{ address: string; publicKey: string }> {
    // Production implementation - same as localnet but on mainnet
    const path = `${nearAccount},${chain}`;
    
    const account = await this.near.account(this.MAINNET_MPC_CONTRACT);
    const result = await account.viewFunction({
      contractId: this.MAINNET_MPC_CONTRACT,
      methodName: 'public_key',
      args: { path }
    });

    return {
      address: this.publicKeyToAddress(result.public_key, chain),
      publicKey: result.public_key
    };
  }

  // ... similar implementation to LocalnetMPCAdapter
}
```

### Mock Adapter (Testing Only)

**Note**: Mocks should only be used for:
- Unit testing individual components
- CI/CD pipelines where MPC nodes aren't available
- Quick prototyping without full infrastructure

For actual development and integration testing, **always use the real MPC adapter**.

```typescript
/**
 * MockCrossChainAdapter - FOR TESTING ONLY
 * 
 * This adapter simulates MPC behavior but does NOT use real MPC nodes.
 * Use this ONLY for:
 * - Unit tests of non-MPC components
 * - CI/CD where MPC infrastructure is unavailable
 * - Quick prototyping
 * 
 * For development: Use LocalnetMPCAdapter with real MPC nodes
 */
export class MockCrossChainAdapter implements CrossChainAdapter {
  private derivedAddresses: Map<string, { address: string; publicKey: string }> = new Map();

  async deriveAddress(
    nearAccount: string,
    chain: string
  ): Promise<{ address: string; publicKey: string }> {
    const key = `${nearAccount}:${chain}`;

    if (this.derivedAddresses.has(key)) {
      return this.derivedAddresses.get(key)!;
    }

    // Generate mock address based on chain
    const mockAddress = this.generateMockAddress(chain);
    const mockPublicKey = this.generateMockPublicKey(chain);

    const result = { address: mockAddress, publicKey: mockPublicKey };
    this.derivedAddresses.set(key, result);

    return result;
  }

  async simulateDestinationTx(params: {
    chain: string;
    correlateTo: string;
  }): Promise<string> {
    // Generate deterministic hash based on input
    const input = `${params.correlateTo}:${params.chain}`;
    const hash = createHash('sha256').update(input).digest('hex');

    const prefix = this.getChainPrefix(params.chain);
    return prefix + hash.substring(0, 40); // 40 chars for readability
  }

  private generateMockAddress(chain: string): string {
    const prefixes = {
      ethereum: '0x',
      bitcoin: '1',
      dogecoin: 'D',
      near: '', // NEAR addresses don't have prefix in this context
    };

    const prefix = prefixes[chain.toLowerCase()] || '';
    const randomPart = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    return prefix + randomPart;
  }

  private generateMockPublicKey(chain: string): string {
    // Generate appropriate format based on chain
    switch (chain.toLowerCase()) {
      case 'ethereum':
        return '0x' + Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('');

      case 'bitcoin':
        return Array.from({ length: 66 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('');

      default:
        return 'ed25519:' + Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('');
    }
  }

  private getChainPrefix(chain: string): string {
    const prefixes = {
      ethereum: '0x',
      bitcoin: '',
      dogecoin: 'D',
    };
    return prefixes[chain.toLowerCase()] || '';
  }
}
```

## Rainbow Bridge Implementation

### For NEAR ↔ Ethereum Cross-Chain
```typescript
export class RainbowBridgeAdapter implements CrossChainAdapter {
  private ethNodeUrl: string;

  constructor(ethNodeUrl: string = 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID') {
    this.ethNodeUrl = ethNodeUrl;
  }

  async deriveAddress(
    nearAccount: string,
    chain: string
  ): Promise<{ address: string; publicKey: string }> {
    if (chain.toLowerCase() !== 'ethereum') {
      throw new Error('RainbowBridgeAdapter only supports Ethereum');
    }

    // Use Rainbow Bridge mapping
    // This is simplified - real implementation would query bridge contracts
    const ethAddress = await this.getRainbowBridgeAddress(nearAccount);

    return {
      address: ethAddress,
      publicKey: '0x' + ethAddress.substring(2) // Mock public key
    };
  }

  async simulateDestinationTx(params: {
    chain: string;
    correlateTo: string;
  }): Promise<string> {
    // Simulate Rainbow Bridge transfer
    const bridgeTx = await this.simulateBridgeTransfer(params.correlateTo);

    return bridgeTx.hash;
  }

  private async getRainbowBridgeAddress(nearAccount: string): Promise<string> {
    // Query Rainbow Bridge contracts to get mapped Ethereum address
    // This is a placeholder - real implementation would interact with bridge
    const mockAddress = '0x' + nearAccount.replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);
    return mockAddress.toLowerCase();
  }

  private async simulateBridgeTransfer(nearTxHash: string): Promise<{ hash: string }> {
    // Simulate bridge transfer with delay
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

    return {
      hash: '0x' + createHash('sha256').update(nearTxHash + 'bridge').digest('hex').substring(0, 64)
    };
  }
}
```

## Implementation Best Practices

### Error Handling
```typescript
export class RobustNearExecutor implements NearExecutionAdapter {
  async sendNearTransfer(
    sender: string,
    encryptedKey: string,
    recipient: string,
    amountNear: string
  ): Promise<{ txHash: string; blockHeight: number }> {
    try {
      // Validate inputs
      this.validateInputs(sender, recipient, amountNear);

      // Decrypt key
      const privateKey = this.decryptKey(encryptedKey);
      if (!privateKey) {
        throw new Error('Failed to decrypt private key');
      }

      // Execute transfer
      const result = await this.near.account(sender).sendMoney(
        recipient,
        this.nearToYocto(amountNear)
      );

      return {
        txHash: result.transaction.hash,
        blockHeight: result.transaction.blockHeight
      };

    } catch (error) {
      // Log error details
      console.error('[ADAPTER] NEAR transfer failed:', {
        sender,
        recipient,
        amount: amountNear,
        error: error.message
      });

      // Re-throw with context
      throw new Error(`NEAR transfer failed: ${error.message}`);
    }
  }

  private validateInputs(sender: string, recipient: string, amount: string) {
    if (!sender || !recipient) {
      throw new Error('Sender and recipient are required');
    }
    if (parseFloat(amount) <= 0) {
      throw new Error('Amount must be positive');
    }
  }

  private nearToYocto(amount: string): string {
    return (parseFloat(amount) * Math.pow(10, 24)).toFixed(0);
  }
}
```

### Connection Management
```typescript
export class ConnectionPoolNearExecutor implements NearExecutionAdapter {
  private connections: Map<string, any> = new Map();
  private maxConnections: number = 10;

  async sendNearTransfer(/* params */): Promise<{ txHash: string; blockHeight: number }> {
    const connection = await this.getConnection();

    try {
      // Use connection for transfer
      const result = await connection.account(sender).sendMoney(recipient, amount);

      return {
        txHash: result.transaction.hash,
        blockHeight: result.transaction.blockHeight
      };
    } finally {
      this.releaseConnection(connection);
    }
  }

  private async getConnection(): Promise<any> {
    // Implement connection pooling logic
    // Return existing connection or create new one
  }

  private releaseConnection(connection: any) {
    // Return connection to pool
  }
}
```

### Testing Adapters
```typescript
describe('NearExecutionAdapter', () => {
  let adapter: NearExecutionAdapter;

  beforeEach(() => {
    adapter = new LocalnetNearExecutor('http://localhost:3030');
  });

  it('should execute NEAR transfer successfully', async () => {
    const result = await adapter.sendNearTransfer(
      'alice.near',
      'encrypted-key-here',
      'bob.near',
      '1.0'
    );

    expect(result.txHash).toBeDefined();
    expect(result.blockHeight).toBeGreaterThan(0);
  });

  it('should handle insufficient balance', async () => {
    await expect(
      adapter.sendNearTransfer(
        'poor-account.near',
        'encrypted-key',
        'recipient.near',
        '1000000.0' // Very large amount
      )
    ).rejects.toThrow('insufficient balance');
  });
});
```

## Common Implementation Patterns

### Key Encryption/Decryption
```typescript
class SecureKeyManager {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.NEAR_KEY_ENCRYPTION_KEY!;
  }

  encryptPrivateKey(privateKey: string): string {
    // Use AES-256-GCM or similar
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decryptPrivateKey(encryptedKey: string): string {
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

### Address Validation
```typescript
class AddressValidator {
  static isValidNearAddress(address: string): boolean {
    // NEAR address validation (account.near format or implicit address)
    return /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/.test(address) ||
           /^[0-9a-f]{64}$/.test(address);
  }

  static isValidEthAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static isValidBtcAddress(address: string): boolean {
    // Simplified BTC address validation
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
  }
}
```

### Adapter Factory Pattern
```typescript
export class AdapterFactory {
  static createNearExecutor(environment: string): NearExecutionAdapter {
    switch (environment) {
      case 'localnet':
        return new LocalnetNearExecutor();
      case 'testnet':
        return new TestnetNearExecutor();
      case 'mock':
      default:
        return new MockNearExecutor();
    }
  }

  static createCrossChainAdapter(type: string): CrossChainAdapter {
    switch (type) {
      case 'chain-signatures':
        return new NearChainSignaturesAdapter();
      case 'rainbow-bridge':
        return new RainbowBridgeAdapter();
      case 'mock':
      default:
        return new MockCrossChainAdapter();
    }
  }
}

// Usage
const simulator = new OneClickSimulator({
  crossChain: AdapterFactory.createCrossChainAdapter('mock'),
  nearExec: AdapterFactory.createNearExecutor('localnet')
});
```

## Architecture Summary: What's Real vs What's Mocked

### ✅ Real Infrastructure (Always)

| Component | Implementation | Source |
|-----------|---------------|--------|
| **NEAR Blockchain** | Real localnet node | `cross-chain-simulator` |
| **MPC Network** | Real MPC nodes (3-8) | [github.com/near/mpc](https://github.com/near/mpc) |
| **Chain Signatures** | Real threshold signatures | MPC network via `v1.signer` |
| **NEAR RPC** | Real RPC connection | Imported from `cross-chain-simulator` |
| **Smart Contracts** | Real contract deployment | `v1.signer-dev.testnet` on localnet |
| **NEAR Transactions** | Real on-chain transactions | NEAR localnet |

### 🔧 Simulated/Mocked (Development Only)

| Component | Why Simulated | Alternative |
|-----------|---------------|-------------|
| **Destination Chain Transactions** | External blockchain not running locally | Mock tx hash generation |
| **Price Feeds** | Not critical to Intents core flow | Mock or external API |
| **Analytics/Monitoring** | Development tooling replacement | Console logs |
| **External Bridge APIs** | Non-NEAR infrastructure | Simulated responses |

### 🚫 Never Mock

- NEAR blockchain operations
- MPC signature generation
- Chain Signatures address derivation
- NEAR RPC calls
- Smart contract interactions
- NEAR transaction finality

### Development Environment Stack

```
┌─────────────────────────────────────────┐
│   NEAR Intents Simulator (This Repo)   │
│  - Quote calculation                    │
│  - Execution orchestration              │
│  - Adapter interfaces                   │
└────────────┬────────────────────────────┘
             │
             │ imports config
             ▼
┌─────────────────────────────────────────┐
│   @near-sandbox/cross-chain-simulator   │
│  - Provides RPC URLs                    │
│  - Provides MPC endpoints               │
│  - Provides contract addresses          │
└────────────┬────────────────────────────┘
             │
             │ orchestrates
             ▼
┌─────────────────────────────────────────┐
│   Real Infrastructure (Docker)          │
│  ┌───────────────────────────────────┐  │
│  │ NEAR Localnet (nearcore)          │  │
│  │  - Real blockchain                │  │
│  │  - RPC: localhost:3030            │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ MPC Network (github.com/near/mpc) │  │
│  │  - Node 1: localhost:3000         │  │
│  │  - Node 2: localhost:3001         │  │
│  │  - Node 3: localhost:3002         │  │
│  │  - Real threshold signatures      │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Deployed Contracts                │  │
│  │  - v1.signer-dev.testnet          │  │
│  │  - Chain Signatures contract      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Key Takeaways

1. **Real Blockchain**: We run a real NEAR blockchain locally, not a mock
2. **Real MPC**: We run real MPC nodes for Chain Signatures, not simulated crypto
3. **Real Contracts**: We deploy and interact with real smart contracts
4. **Real Transactions**: All NEAR transactions are real on-chain operations
5. **Simulated Bridges**: Only external chain transactions are simulated (they're not running locally)

This architecture provides **production parity** while maintaining a **local development** environment. The only mocking happens at the boundaries of external systems we don't control (like Ethereum mainnet, Bitcoin network, etc.).

### References

- [NEAR MPC Repository](https://github.com/near/mpc) - Real MPC implementation
- [Cross-Chain Simulator](https://github.com/near/cross-chain-simulator) - Infrastructure orchestration
- [NEAR Intents Documentation](https://near.org/intents) - Protocol overview
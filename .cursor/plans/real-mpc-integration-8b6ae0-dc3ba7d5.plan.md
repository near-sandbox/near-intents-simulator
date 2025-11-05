<!-- dc3ba7d5-c0a2-4433-8c52-ebb5f196bf93 ec13721c-238d-4e14-8977-328f22c26a2c -->
# Contract Deployment & Localnet Connection

## Goal

Implement contract deployment infrastructure to connect to the EC2 NEAR localnet node (deployed via AWS Node Runner), deploy v1.signer contract, and coordinate MPC nodes.

## Context

- EC2 NEAR node at `http://54.90.246.254:3030` (deployed separately via `/AWSNodeRunner/lib/near`)
- Master account: `test.near` (confirmed exists)
- Account naming: Use `.localnet` suffix (e.g., `v1.signer.localnet` following mainnet pattern)
- Chain ID: `test-chain-jszNl`
- Key management: AWS KMS only (following [AWS KMS BYOK guide](https://aws.amazon.com/blogs/web3/import-ethereum-private-keys-to-aws-kms/))

## Phase 1: Update Configuration for .localnet Suffix

Update all references from `.testnet` to `.localnet`:

### Update `src/config.ts`

```typescript
export function getMpcContractId(): string {
  return process.env.MPC_CONTRACT_ID || 'v1.signer.localnet';
}

export function getDeployerAccountId(): string {
  return process.env.DEPLOYER_ACCOUNT_ID || 'deployer.localnet';
}

export function getMasterAccountId(): string {
  return process.env.MASTER_ACCOUNT_ID || 'test.near';
}

export function getDeployerKmsKeyId(): string | undefined {
  return process.env.DEPLOYER_KMS_KEY_ID;
}
```

Update references in:

- `deployment/docker-compose.mpc.yml` - Change default to `v1.signer.localnet`
- `scripts/start-mpc.sh` - Update contract ID references
- `src/__tests__/integration.test.ts` - Update test expectations

## Phase 2: AWS KMS Key Management

### Add AWS SDK Dependency

```json
"dependencies": {
  "@aws-sdk/client-kms": "^3.x.x"
}
```

### Implement KMS Key Manager (`src/localnet/kms-key-manager.ts`)

AWS KMS-only implementation per [AWS KMS BYOK guide](https://aws.amazon.com/blogs/web3/import-ethereum-private-keys-to-aws-kms/):

```typescript
import { KMSClient, SignCommand, GetPublicKeyCommand } from '@aws-sdk/client-kms';

export class KMSKeyManager {
  private kmsClient: KMSClient;
  
  constructor(region: string = 'us-east-1') {
    // Uses IAM role from EC2 instance
    this.kmsClient = new KMSClient({ region });
  }

  async signTransaction(keyId: string, message: Buffer): Promise<Buffer> {
    // Sign NEAR transaction using AWS KMS
  }
  
  async getPublicKey(keyId: string): Promise<string> {
    // Get NEAR ED25519 public key from KMS
  }
}
```

## Phase 3: Contract Deployer

### Implement Contract Deployer (`src/localnet/contract-deployer.ts`)

```typescript
export class ContractDeployer {
  constructor(
    private rpcUrl: string,
    private kmsManager: KMSKeyManager,
    private deployerAccountId: string = 'deployer.localnet',
    private masterAccountId: string = 'test.near'
  ) {}

  async initializeMasterAccount(): Promise<void> {
    // Check if test.near has access keys
    // Add key if needed (from KMS)
  }

  async createDeployerAccount(): Promise<void> {
    // 1. Get deployer public key from KMS
    // 2. Create deployer.localnet from test.near
    // 3. Fund deployer account
  }

  async deploySignerContract(
    contractAccountId: string = 'v1.signer.localnet',
    wasmPath: string
  ): Promise<string> {
    // 1. Check if contract account exists
    // 2. Create account if needed
    // 3. Load contract WASM
    // 4. Deploy contract (signed via KMS)
    // 5. Initialize contract
    // 6. Return contract ID
  }

  async verifyContractDeployment(contractId: string): Promise<boolean> {
    // Verify contract is deployed and accessible via RPC
  }
}
```

## Phase 4: Localnet Orchestrator

Connects to EC2 localnet RPC, deploys contracts, starts MPC:

### Implement Orchestrator (`src/localnet/orchestrator.ts`)

```typescript
export class LocalnetOrchestrator {
  private deployer: ContractDeployer;

  async start(): Promise<LocalnetConfig> {
    console.log('🚀 Connecting to NEAR localnet and deploying infrastructure...');
    
    // 1. Verify EC2 NEAR RPC is accessible
    await this.verifyRpcConnection();
    
    // 2. Initialize master account (if needed)
    await this.deployer.initializeMasterAccount();
    
    // 3. Create deployer account (if needed)
    await this.deployer.createDeployerAccount();
    
    // 4. Deploy v1.signer contract (if not exists)
    const contractId = await this.deployer.deploySignerContract();
    
    // 5. Start MPC nodes via Docker
    await this.startMpcNodes(contractId);
    
    // 6. Wait for all services to be ready
    await this.healthCheck();
    
    // 7. Return LocalnetConfig
    return {
      rpcUrl: getNearRpcUrl(),
      networkId: 'localnet',
      mpcContractId: contractId,
      mpcNodes: getMpcNodes(),
    };
  }

  async stop(): Promise<void> {
    // Stop MPC nodes (contracts persist on blockchain)
  }
  
  private async verifyRpcConnection(): Promise<void> {
    // Check EC2 RPC accessibility at getNearRpcUrl()
  }
  
  private async startMpcNodes(contractId: string): Promise<void> {
    // Start MPC Docker containers configured to watch contractId
  }
  
  private async healthCheck(): Promise<void> {
    // Verify MPC nodes are ready and contract is accessible
  }
}
```

### Create Scripts

**`scripts/start-localnet.sh`** (new):

```bash
#!/bin/bash
# Connect to EC2 NEAR localnet RPC and deploy Chain Signatures infrastructure
# Note: EC2 NEAR node deployed separately via /AWSNodeRunner/lib/near
# This script manages contract deployment and MPC nodes only
# 1. Verify RPC connection to EC2 node
# 2. Deploy contracts (via ContractDeployer using AWS KMS)
# 3. Start MPC nodes (Docker containers watching deployed contract)
```

**`scripts/stop-localnet.sh`** (new):

```bash
#!/bin/bash
# Stop MPC infrastructure only (contracts persist on blockchain)
# EC2 NEAR node managed separately via /AWSNodeRunner/lib/near
```

**Update `package.json`**:

```json
"scripts": {
  "start:localnet": "./scripts/start-localnet.sh",
  "stop:localnet": "./scripts/stop-localnet.sh"
}
```

**Note**: `start:localnet` and `stop:localnet` control this project's infrastructure (contract deployment + MPC nodes). The EC2 NEAR node is managed separately by `/AWSNodeRunner/lib/near` and must be running before calling `start:localnet`.

## Phase 5: v1.signer Contract Research & Deployment

### Contract Naming Convention (from research)

Based on [near-examples/near-multichain](https://github.com/near-examples/near-multichain) configuration:
- **Mainnet**: `v1.signer` (production contract)
- **Testnet**: `v1.signer-prod.testnet` (with -prod marker)
- **Localnet**: `v1.signer.localnet` (following mainnet pattern with .localnet suffix)

**Key finding**: Use simple `v1.signer.localnet` name, not `v1.signer-dev.localnet`

### Contract Source & WASM Location

**Primary sources to investigate:**
1. **[github.com/near/mpc](https://github.com/near/mpc)** - MPC network implementation (likely contains contract)
2. **[github.com/near/mpc-recovery](https://github.com/near/mpc-recovery)** - MPC recovery service (may contain contract source)
3. **Download from testnet**: Fetch WASM from `v1.signer-prod.testnet` if accessible

**NEAR chain signatures example repositories** (all should work with our localnet):
- [github.com/near/multichain-tools](https://github.com/near/multichain-tools) - JS signing tools
- [github.com/near-examples/chainsig-script](https://github.com/near-examples/chainsig-script) - CLI examples  
- [github.com/near-examples/near-multichain](https://github.com/near-examples/near-multichain) - Multi-chain wallet
- [github.com/EdsonAlcala/omni-transaction-rs](https://github.com/EdsonAlcala/omni-transaction-rs) - Rust tools
- [github.com/mattlockyer/near-trade-signatures](https://github.com/mattlockyer/near-trade-signatures) - Trading signatures

### Deployment Strategy

**Option 1: Download pre-built WASM** (fastest)
```bash
# Download from testnet contract (if state allows)
near view-state v1.signer-prod.testnet --finality final --utf8 false
# Or use NEAR explorer API to get contract code
```

**Option 2: Build from source** (most reliable)
```bash
# Clone MPC repo and build
git clone https://github.com/near/mpc.git
cd mpc/contract  # or wherever contract source is
cargo build --release --target wasm32-unknown-unknown
```

**Option 3: Use existing testnet deployment** (for testing)
```typescript
// For initial testing, reference testnet contract directly
// Then deploy to localnet once WASM is obtained
```

### WASM Storage
```
contracts/
├── v1.signer.wasm          # Contract binary
├── download-wasm.sh        # Script to fetch WASM
└── README.md               # Source and build instructions
```

## Phase 6: Integration Testing

### Contract Deployment Tests

```typescript
// src/__tests__/contract-deployment.test.ts
describe('Contract Deployment to EC2 Localnet', () => {
  it('should deploy deployer.localnet account', async () => {
    const deployer = new ContractDeployer(/*...*/);
    await deployer.createDeployerAccount();
  });

  it('should deploy v1.signer.localnet contract', async () => {
    const contractId = await deployer.deploySignerContract();
    expect(contractId).toBe('v1.signer.localnet');
  });
});
```

### Orchestrator Tests

```typescript
// src/__tests__/orchestrator.test.ts
describe('Localnet Orchestrator', () => {
  it('should connect and deploy to EC2 localnet', async () => {
    const orchestrator = new LocalnetOrchestrator(/*...*/);
    const config = await orchestrator.start();
    
    expect(config.rpcUrl).toBe('http://54.90.246.254:3030');
    expect(config.mpcContractId).toBe('v1.signer.localnet');
  });
});
```

### Manual Testing

```bash
# Connect to EC2 localnet and deploy
export NEAR_RPC_URL=http://54.90.246.254:3030
npm run start:localnet

# Verify deployment
curl -X POST http://54.90.246.254:3030 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"query","params":{"request_type":"view_account","account_id":"v1.signer.localnet","finality":"final"}}'
```

## Success Criteria

- ✅ All configurations use `.localnet` suffix
- ✅ KMS key manager implemented (AWS KMS only)
- ✅ Contract deployer creates deployer.localnet
- ✅ Contract deployer deploys v1.signer.localnet
- ✅ Orchestrator connects to EC2 RPC and deploys contracts/MPC
- ✅ `npm run start:localnet` deploys to EC2 localnet
- ✅ Contract accessible via EC2 RPC
- ✅ MPC nodes connected to contract
- ✅ All chain signatures examples work on localnet

## References

- [AWS Node Runner for NEAR](/AWSNodeRunner/lib/near/README.md) - Separate EC2 deployment
- [AWS KMS BYOK Guide](https://aws.amazon.com/blogs/web3/import-ethereum-private-keys-to-aws-kms/)
- [NEAR Chain Signatures Examples](https://github.com/near-examples/near-multichain)
- [NEAR Multichain Tools](https://github.com/near/multichain-tools)

### To-dos

- [x] Update src/config.ts: change to v1.signer.localnet, add getDeployerAccountId, getMasterAccountId, getDeployerKmsKeyId
- [x] Update deployment/docker-compose.mpc.yml to use v1.signer.localnet default
- [x] Update scripts/start-mpc.sh to use v1.signer.localnet default
- [x] Update src/__tests__/integration.test.ts to expect v1.signer.localnet
- [x] Add @aws-sdk/client-kms dependency to package.json
- [x] Create src/localnet/kms-key-manager.ts with AWS KMS integration (encrypt/decrypt pattern)
- [x] Research v1.signer contract WASM: check github.com/near/mpc, github.com/near/mpc-recovery, or download from v1.signer-prod.testnet
- [x] Create contracts/download-wasm.sh to fetch/build v1.signer WASM
- [x] Create src/localnet/contract-deployer.ts with KMS-based deployment to EC2 localnet
- [x] Create src/localnet/orchestrator.ts to connect to EC2 RPC, deploy contracts, start MPC
- [x] Create scripts/start-localnet.sh to run orchestrator (connects to EC2, deploys, starts MPC)
- [x] Create scripts/stop-localnet.sh to stop MPC only (EC2 node managed by AWSNodeRunner)
- [x] Add start:localnet and stop:localnet scripts to package.json
- [x] Create src/localnet/index.ts to export LocalnetOrchestrator and ContractDeployer
- [x] Update src/index.ts to export localnet components
- [x] Create src/__tests__/contract-deployment.test.ts
- [x] Create src/__tests__/orchestrator.test.ts
- [ ] Test deployment to EC2 localnet (NEAR_RPC_URL=http://54.90.246.254:3030) - PENDING
- [ ] Verify near-examples/near-multichain and other examples work with our localnet - PENDING
- [ ] Update README.md with deployment orchestration and EC2 RPC usage - PARTIALLY COMPLETE
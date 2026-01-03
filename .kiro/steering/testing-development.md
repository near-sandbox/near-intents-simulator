---
inclusion: always
---

# Testing & Development Guide

**Best practices for testing, debugging, and developing with the NEAR Intents Simulator**

## Testing Strategies

### Unit Testing Patterns

#### Quote Calculation Tests
```typescript
import { OneClickSimulator } from '../src/intents/simulator';
import { MockCrossChainAdapter } from './mocks/MockCrossChainAdapter';

describe('Quote Calculation', () => {
  let simulator: OneClickSimulator;

  beforeEach(() => {
    simulator = new OneClickSimulator({
      crossChain: new MockCrossChainAdapter()
    });
  });

  describe('Fee Calculation', () => {
    it('should apply 0.3% fee correctly', async () => {
      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'near:wrap.near',
        amount: '1000000000000000000000000', // 1 NEAR
        refundTo: 'alice.near',
        recipient: 'bob.near'
      };

      const quote = await simulator.requestQuote(request);

      // 1 NEAR - 0.3% fee = 0.997 NEAR
      const expectedAmountOut = '997000000000000000000000';
      expect(quote.quote.amountOut).toBe(expectedAmountOut);

      // Fee should be 0.003 NEAR
      const expectedFee = '3000000000000000000000';
      expect(quote.quote.fee).toBe(expectedFee);
    });

    it('should handle different decimal places', async () => {
      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'ethereum:usdc.eth', // 6 decimals
        destinationAsset: 'near:usdc.near', // 6 decimals
        amount: '1000000', // 1 USDC (6 decimals)
        refundTo: 'alice.near',
        recipient: 'bob.near'
      };

      const quote = await simulator.requestQuote(request);

      // Should preserve decimal precision
      expect(quote.quote.amountOut).toBe('997000'); // 0.997 USDC
      expect(quote.quote.fee).toBe('3000'); // 0.003 USDC
    });
  });

  describe('Slippage Tolerance', () => {
    it('should apply default 1% slippage', async () => {
      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'ethereum:usdc.eth',
        amount: '1000000000000000000000000', // 1 NEAR
        refundTo: 'alice.near',
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const quote = await simulator.requestQuote(request);

      // After fee: 0.997 NEAR worth of USDC
      // After 1% slippage: 0.997 * 0.99 = 0.98703
      // At ~$5/NEAR and $1/USDC: ~4.935 USDC
      const expectedMinOut = '4935000'; // Assuming 1 NEAR = ~5 USDC
      expect(parseFloat(quote.quote.amountOut)).toBeLessThanOrEqual(parseFloat(expectedMinOut));
    });

    it('should respect custom slippage tolerance', async () => {
      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'ethereum:usdc.eth',
        amount: '1000000000000000000000000',
        slippageTolerance: 0.02, // 2%
        refundTo: 'alice.near',
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const quote = await simulator.requestQuote(request);

      // Should apply 2% slippage instead of default 1%
      // Implementation should use request.slippageTolerance || 0.01
    });
  });

  describe('Asset Validation', () => {
    it('should reject invalid asset formats', async () => {
      const invalidRequest = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'invalid-format',
        destinationAsset: 'near:native',
        amount: '1000000000000000000000000',
        refundTo: 'alice.near',
        recipient: 'bob.near'
      };

      await expect(simulator.requestQuote(invalidRequest))
        .rejects.toThrow('Invalid asset format');
    });

    it('should support all registered assets', async () => {
      const testCases = [
        { origin: 'near:native', dest: 'near:wrap.near' },
        { origin: 'ethereum:native', dest: 'near:usdc.near' },
        { origin: 'bitcoin:native', dest: 'ethereum:usdc.eth' },
        { origin: 'near:usdc.near', dest: 'dogecoin:native' }
      ];

      for (const testCase of testCases) {
        const request = {
          swapType: 'EXACT_INPUT' as const,
          originAsset: testCase.origin,
          destinationAsset: testCase.dest,
          amount: '1000000000000000000000000',
          refundTo: 'alice.near',
          recipient: 'bob.near'
        };

        const quote = await simulator.requestQuote(request);
        expect(quote.quote.amountOut).toBeDefined();
        expect(quote.quote.fee).toBeDefined();
      }
    });
  });
});
```

#### Route Calculation Tests
```typescript
describe('Route Calculation', () => {
  it('should generate same-chain routes', async () => {
    const request = {
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'near:wrap.near',
      destinationAsset: 'near:usdc.near',
      amount: '1000000000000000000000000',
      refundTo: 'alice.near',
      recipient: 'bob.near'
    };

    const quote = await simulator.requestQuote(request);

    expect(quote.quote.route.steps).toEqual([
      {
        from: 'wNEAR',
        to: 'USDC',
        protocol: 'ref-finance'
      }
    ]);
  });

  it('should generate cross-chain routes', async () => {
    const request = {
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'near:native',
      destinationAsset: 'ethereum:usdc.eth',
      amount: '1000000000000000000000000',
      refundTo: 'alice.near',
      recipient: '0x1234567890123456789012345678901234567890'
    };

    const quote = await simulator.requestQuote(request);

    expect(quote.quote.route.steps).toEqual([
      {
        from: 'NEAR',
        to: 'NEAR (bridged)',
        protocol: 'rainbow-bridge'
      },
      {
        from: 'NEAR (bridged)',
        to: 'USDC',
        protocol: 'uniswap-v3'
      }
    ]);
  });
});
```

#### Status Tracking Tests
```typescript
describe('Swap Status Tracking', () => {
  it('should track swap lifecycle', async () => {
    const request = {
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'near:native',
      destinationAsset: 'near:wrap.near',
      amount: '1000000000000000000000000',
      refundTo: 'alice.near',
      recipient: 'bob.near'
    };

    // Request quote
    const quote = await simulator.requestQuote(request);
    expect(quote.quoteId).toBeDefined();

    // Check initial status
    let status = await simulator.getSwapStatus(quote.quoteId);
    expect(status.status).toBe('PENDING_DEPOSIT');

    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check final status
    status = await simulator.getSwapStatus(quote.quoteId);
    expect(status.status).toBe('SUCCESS');
    expect(status.swapDetails).toBeDefined();
    expect(status.swapDetails!.nearTxHashes).toBeDefined();
  });

  it('should handle execution failures', async () => {
    // Configure adapter to fail
    const failingAdapter = new MockNearExecutor();
    failingAdapter.shouldFail = true;

    const simulatorWithFailingAdapter = new OneClickSimulator({
      crossChain: new MockCrossChainAdapter(),
      nearExec: failingAdapter
    });

    const request = {
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'near:native',
      destinationAsset: 'near:wrap.near',
      amount: '1000000000000000000000000',
      refundTo: 'alice.near',
      recipient: 'bob.near'
    };

    const quote = await simulatorWithFailingAdapter.requestQuote(request);

    // Wait for execution to fail
    await new Promise(resolve => setTimeout(resolve, 2000));

    const status = await simulatorWithFailingAdapter.getSwapStatus(quote.quoteId);
    expect(status.status).toBe('FAILED');
    expect(status.error).toBeDefined();
  });
});
```

### Integration Testing

#### Full Swap Flow Tests
```typescript
describe('Full Swap Integration', () => {
  let simulator: OneClickSimulator;
  let mockNearExec: MockNearExecutor;
  let mockCrossChain: MockCrossChainAdapter;

  beforeEach(() => {
    mockNearExec = new MockNearExecutor();
    mockCrossChain = new MockCrossChainAdapter();

    simulator = new OneClickSimulator({
      crossChain: mockCrossChain,
      nearExec: mockNearExec
    });
  });

  describe('Same-Chain Swaps', () => {
    it('should complete NEAR to wNEAR swap', async () => {
      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'near:wrap.near',
        amount: '1000000000000000000000000', // 1 NEAR
        refundTo: 'alice.near',
        recipient: 'bob.near'
      };

      // Execute swap
      const quote = await simulator.requestQuote(request);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const status = await simulator.getSwapStatus(quote.quoteId);

      // Verify results
      expect(status.status).toBe('SUCCESS');
      expect(status.swapDetails!.nearTxHashes).toHaveLength(1);
      expect(status.swapDetails!.destinationTxHash).toBeUndefined(); // Same chain

      // Verify transaction was recorded
      const txHash = status.swapDetails!.nearTxHashes[0];
      const recordedTx = mockNearExec.getTransaction(txHash);
      expect(recordedTx).toBeDefined();
      expect(recordedTx.sender).toBe('alice.near');
      expect(recordedTx.recipient).toBe('bob.near');
      expect(recordedTx.amount).toBe('0.997'); // After fee
    });
  });

  describe('Cross-Chain Swaps', () => {
    it('should complete NEAR to Ethereum USDC swap', async () => {
      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'ethereum:usdc.eth',
        amount: '1000000000000000000000000', // 1 NEAR
        refundTo: 'alice.near',
        recipient: '0x742d35Cc6597C0532895a0d889f46a9b49ba7D617'
      };

      // Execute swap
      const quote = await simulator.requestQuote(request);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Cross-chain takes longer

      const status = await simulator.getSwapStatus(quote.quoteId);

      // Verify results
      expect(status.status).toBe('SUCCESS');
      expect(status.swapDetails!.nearTxHashes).toHaveLength(1);
      expect(status.swapDetails!.destinationTxHash).toBeDefined();

      // Verify cross-chain address derivation
      const derivedAddress = mockCrossChain.getDerivedAddress('alice.near', 'ethereum');
      expect(derivedAddress).toBeDefined();
    });

    it('should handle cross-chain failures gracefully', async () => {
      // Configure cross-chain adapter to fail
      mockCrossChain.shouldFailDerivation = true;

      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'ethereum:usdc.eth',
        amount: '1000000000000000000000000',
        refundTo: 'alice.near',
        recipient: '0x742d35Cc6597C0532895a0d889f46a9b49ba7D617'
      };

      const quote = await simulator.requestQuote(request);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const status = await simulator.getSwapStatus(quote.quoteId);

      // Should still succeed with mock destination tx
      expect(status.status).toBe('SUCCESS');
      expect(status.swapDetails!.destinationTxHash).toBeDefined();
    });
  });
});
```

#### Adapter Testing
```typescript
describe('Adapter Integration', () => {
  describe('NearExecutionAdapter', () => {
    it('should integrate with simulator correctly', async () => {
      const adapter = new MockNearExecutor();
      const simulator = new OneClickSimulator({
        crossChain: new MockCrossChainAdapter(),
        nearExec: adapter
      });

      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'near:wrap.near',
        amount: '1000000000000000000000000',
        refundTo: 'alice.near',
        recipient: 'bob.near'
      };

      const quote = await simulator.requestQuote(request);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const status = await simulator.getSwapStatus(quote.quoteId);

      // Verify adapter was called correctly
      const transactions = adapter.getAllTransactions();
      expect(transactions).toHaveLength(1);

      const tx = transactions[0];
      expect(tx.sender).toBe('alice.near');
      expect(tx.recipient).toBe('bob.near');
      expect(tx.amount).toBe('0.997'); // After 0.3% fee
    });
  });

  describe('CrossChainAdapter', () => {
    it('should derive addresses for cross-chain swaps', async () => {
      const adapter = new MockCrossChainAdapter();
      const simulator = new OneClickSimulator({
        crossChain: adapter
      });

      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'ethereum:usdc.eth',
        amount: '1000000000000000000000000',
        refundTo: 'alice.near',
        recipient: '0x742d35Cc6597C0532895a0d889f46a9b49ba7D617'
      };

      const quote = await simulator.requestQuote(request);

      // Verify address derivation was called
      const derivedAddresses = adapter.getAllDerivedAddresses();
      expect(derivedAddresses).toHaveLength(1);

      const derivation = derivedAddresses[0];
      expect(derivation.nearAccount).toBe('alice.near');
      expect(derivation.chain).toBe('ethereum');
      expect(derivation.address).toBeDefined();
      expect(derivation.publicKey).toBeDefined();
    });
  });
});
```

## Debugging Techniques

### Console Logging Analysis
```typescript
// Enable detailed logging for debugging
const simulator = new OneClickSimulator({
  crossChain: adapter,
  nearExec: executor
});

// Monitor logs during execution
const request = { /* ... */ };
const quote = await simulator.requestQuote(request);

// Expected log sequence:
// 🔄 [INTENTS] Requesting quote: { from: 'near:native', to: 'ethereum:usdc.eth', amount: '1' }
// ✅ [INTENTS] Quote generated: { quoteId: '...', amountOut: '4.97', timeEstimate: 45 }
// ⚙️  [INTENTS] Executing swap: quoteId
// ✅ [INTENTS] Swap completed: { status: 'SUCCESS', nearTx: '...', destTx: '...' }
```

### State Inspection
```typescript
// Access internal state for debugging
const simulator = new OneClickSimulator({ crossChain: adapter });

// Access private properties (for testing only)
const internalState = (simulator as any);
console.log('Active swaps:', internalState.swaps.size);

// Inspect specific swap
const swap = internalState.swaps.get(quoteId);
console.log('Swap state:', {
  status: swap.status,
  createdAt: swap.createdAt,
  updatedAt: swap.updatedAt,
  error: swap.error
});
```

### Mock Adapter Debugging
```typescript
class DebugMockNearExecutor extends MockNearExecutor {
  private callLog: any[] = [];

  async sendNearTransfer(sender: string, encryptedKey: string, recipient: string, amountNear: string) {
    const call = {
      timestamp: new Date(),
      method: 'sendNearTransfer',
      params: { sender, recipient, amountNear },
      encryptedKeyProvided: !!encryptedKey
    };

    this.callLog.push(call);
    console.log('[DEBUG] NearExecutionAdapter called:', call);

    return super.sendNearTransfer(sender, encryptedKey, recipient, amountNear);
  }

  getCallLog() {
    return this.callLog;
  }
}

// Use in tests
const debugAdapter = new DebugMockNearExecutor();
const simulator = new OneClickSimulator({
  crossChain: new MockCrossChainAdapter(),
  nearExec: debugAdapter
});

// After execution
console.log('Adapter calls:', debugAdapter.getCallLog());
```

## Development Workflows

### Adding New Asset Types
```typescript
// 1. Update asset registry in simulator.ts
private getDecimals(chain: string, token: string): number {
  const key = `${chain}:${token}`;
  const registry: Record<string, number> = {
    // ... existing entries
    'polygon:native': 18,
    'polygon:usdc.polygon': 6,
    'avalanche:native': 18,
    'avalanche:usdc.avalanche': 6,
  };
  return registry[key] || 18;
}

private getSymbol(chain: string, token: string): string {
  const key = `${chain}:${token}`;
  const registry: Record<string, string> = {
    // ... existing entries
    'polygon:native': 'MATIC',
    'polygon:usdc.polygon': 'USDC',
    'avalanche:native': 'AVAX',
    'avalanche:usdc.avalanche': 'USDC',
  };
  return registry[key] || token;
}

// 2. Add tests for new assets
describe('New Asset Support', () => {
  it('should support Polygon assets', async () => {
    const request = {
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'polygon:native',
      destinationAsset: 'near:usdc.near',
      amount: '1000000000000000000', // 1 MATIC
      refundTo: 'alice.near',
      recipient: 'bob.near'
    };

    const quote = await simulator.requestQuote(request);
    expect(quote.quote.amountOut).toBeDefined();
  });
});
```

### Adding New Protocols
```typescript
// 1. Update route calculation
private getProtocol(fromChain: string, toChain: string, fromToken: string, toToken: string): string {
  // Same chain
  if (fromChain === toChain) {
    if (fromChain === 'near') return 'ref-finance';
    if (fromChain === 'ethereum') return 'uniswap-v3';
    if (fromChain === 'polygon') return 'quickswap';
  }

  // Cross-chain
  if ((fromChain === 'near' && toChain === 'ethereum') ||
      (fromChain === 'ethereum' && toChain === 'near')) {
    return 'rainbow-bridge';
  }

  if ((fromChain === 'near' && toChain === 'polygon') ||
      (fromChain === 'polygon' && toChain === 'near')) {
    return 'polygon-bridge';
  }

  return 'generic-bridge'; // fallback
}

// 2. Test new protocol routing
describe('Protocol Routing', () => {
  it('should route Polygon swaps correctly', async () => {
    const request = {
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'polygon:native',
      destinationAsset: 'near:usdc.near',
      amount: '1000000000000000000',
      refundTo: 'alice.near',
      recipient: 'bob.near'
    };

    const quote = await simulator.requestQuote(request);

    expect(quote.quote.route.steps).toEqual([
      {
        from: 'MATIC',
        to: 'MATIC (bridged)',
        protocol: 'polygon-bridge'
      },
      {
        from: 'MATIC (bridged)',
        to: 'USDC',
        protocol: 'ref-finance'
      }
    ]);
  });
});
```

### Performance Testing
```typescript
describe('Performance', () => {
  it('should handle multiple concurrent swaps', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => ({
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'near:native',
      destinationAsset: 'near:wrap.near',
      amount: '1000000000000000000000000',
      refundTo: `alice${i}.near`,
      recipient: `bob${i}.near`
    }));

    const startTime = Date.now();

    // Execute all swaps concurrently
    const quotes = await Promise.all(
      requests.map(req => simulator.requestQuote(req))
    );

    // Wait for all executions to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify all swaps completed
    for (const quote of quotes) {
      const status = await simulator.getSwapStatus(quote.quoteId);
      expect(status.status).toBe('SUCCESS');
    }

    // Performance assertions
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    console.log(`10 concurrent swaps completed in ${duration}ms`);
  });

  it('should maintain performance under load', async () => {
    const request = {
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'near:native',
      destinationAsset: 'ethereum:usdc.eth',
      amount: '1000000000000000000000000',
      refundTo: 'alice.near',
      recipient: '0x1234567890123456789012345678901234567890'
    };

    // Measure quote generation performance
    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await simulator.requestQuote(request);
    }

    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;

    expect(avgTime).toBeLessThan(100); // Average < 100ms per quote
    console.log(`Average quote time: ${avgTime.toFixed(2)}ms`);
  });
});
```

## Error Scenarios Testing

### Invalid Input Testing
```typescript
describe('Error Handling', () => {
  it('should reject invalid amounts', async () => {
    const invalidRequests = [
      { amount: '0' },
      { amount: '-100' },
      { amount: 'not-a-number' },
      { amount: '' }
    ];

    for (const invalid of invalidRequests) {
      const request = {
        swapType: 'EXACT_INPUT' as const,
        originAsset: 'near:native',
        destinationAsset: 'near:wrap.near',
        amount: invalid.amount,
        refundTo: 'alice.near',
        recipient: 'bob.near'
      };

      await expect(simulator.requestQuote(request))
        .rejects.toThrow('Valid amount required');
    }
  });

  it('should handle missing required fields', async () => {
    const incompleteRequest = {
      swapType: 'EXACT_INPUT' as const,
      // missing originAsset, destinationAsset, etc.
      amount: '1000000000000000000000000'
    };

    await expect(simulator.requestQuote(incompleteRequest as any))
      .rejects.toThrow('Origin and destination assets required');
  });

  it('should handle adapter failures gracefully', async () => {
    const failingAdapter = new MockNearExecutor();
    failingAdapter.shouldFail = true;

    const simulator = new OneClickSimulator({
      crossChain: new MockCrossChainAdapter(),
      nearExec: failingAdapter
    });

    const request = {
      swapType: 'EXACT_INPUT' as const,
      originAsset: 'near:native',
      destinationAsset: 'near:wrap.near',
      amount: '1000000000000000000000000',
      refundTo: 'alice.near',
      recipient: 'bob.near'
    };

    // Should not throw during quote request
    const quote = await simulator.requestQuote(request);
    expect(quote.quoteId).toBeDefined();

    // Should fail during execution but not crash
    await new Promise(resolve => setTimeout(resolve, 2000));
    const status = await simulator.getSwapStatus(quote.quoteId);
    expect(status.status).toBe('FAILED');
    expect(status.error).toContain('failed');
  });
});
```

These testing patterns ensure robust development and reliable operation of the NEAR Intents Simulator across various scenarios and edge cases.
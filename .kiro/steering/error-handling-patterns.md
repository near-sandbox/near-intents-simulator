---
inclusion: always
---

# Error Handling Patterns

**Comprehensive error handling strategies for robust simulator operations**

## Error Hierarchy

### Custom Error Classes
Reference error types from `src/types.ts` and implement custom error hierarchy:

```typescript
// Base error class
export class IntentsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, IntentsError.prototype);
  }
}

// Validation errors
export class ValidationError extends IntentsError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

// Adapter errors
export class AdapterError extends IntentsError {
  constructor(
    message: string,
    public readonly adapter: string,
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message, 'ADAPTER_ERROR', { adapter, operation });
    this.name = 'AdapterError';
    this.cause = cause;
  }
}

// Quote calculation errors
export class QuoteCalculationError extends IntentsError {
  constructor(
    message: string,
    public readonly request: QuoteRequest,
    public readonly cause?: Error
  ) {
    super(message, 'QUOTE_CALCULATION_ERROR', { request });
    this.cause = cause;
  }
}

// Execution errors
export class ExecutionError extends IntentsError {
  constructor(
    message: string,
    public readonly quoteId: string,
    public readonly stage: 'NEAR_TRANSFER' | 'CROSS_CHAIN' | 'VALIDATION',
    public readonly cause?: Error
  ) {
    super(message, 'EXECUTION_ERROR', { quoteId, stage });
    this.cause = cause;
  }
}
```

## Validation Patterns

### Request Validation
Reference validation in `src/intents/simulator.ts` line 271-283:

```typescript
// ✅ Good: Comprehensive validation with typed errors
private validateQuoteRequest(request: QuoteRequest): void {
  if (!request.originAsset || !request.destinationAsset) {
    throw new ValidationError(
      'Origin and destination assets required',
      'assets',
      { origin: request.originAsset, destination: request.destinationAsset }
    );
  }

  // Validate asset format (chain:token)
  if (!request.originAsset.includes(':') || !request.destinationAsset.includes(':')) {
    throw new ValidationError(
      'Invalid asset format: use chain:token',
      'assetFormat',
      { origin: request.originAsset, destination: request.destinationAsset }
    );
  }

  // Validate amount
  const amountNum = parseFloat(request.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new ValidationError(
      'Valid positive amount required',
      'amount',
      request.amount
    );
  }

  // Validate addresses
  if (!request.refundTo || !request.recipient) {
    throw new ValidationError(
      'Refund and recipient addresses required',
      'addresses',
      { refundTo: request.refundTo, recipient: request.recipient }
    );
  }

  // Validate slippage tolerance if provided
  if (request.slippageTolerance !== undefined) {
    if (request.slippageTolerance < 0 || request.slippageTolerance > 1) {
      throw new ValidationError(
        'Slippage tolerance must be between 0 and 1',
        'slippageTolerance',
        request.slippageTolerance
      );
    }
  }
}
```

### Asset Validation
Validate asset identifiers with proper error context:

```typescript
// ✅ Good: Asset validation with error details
function validateAsset(asset: string): { chain: string; token: string } {
  if (!asset || typeof asset !== 'string') {
    throw new ValidationError('Asset must be a string', 'asset', asset);
  }

  const parts = asset.split(':');
  if (parts.length !== 2) {
    throw new ValidationError(
      'Asset must be in format chain:token',
      'assetFormat',
      asset
    );
  }

  const [chain, token] = parts;
  
  if (!chain || !token) {
    throw new ValidationError(
      'Chain and token cannot be empty',
      'assetParts',
      { chain, token }
    );
  }

  // Validate chain is supported
  const supportedChains = ['near', 'ethereum', 'bitcoin', 'dogecoin'];
  if (!supportedChains.includes(chain.toLowerCase())) {
    throw new ValidationError(
      `Unsupported chain: ${chain}`,
      'chain',
      chain
    );
  }

  return { chain, token };
}
```

## Adapter Error Handling

### Graceful Degradation Pattern
Reference the pattern in `src/intents/simulator.ts` line 200-232:

```typescript
// ✅ Good: Try real execution, fallback to mock
private async executeNearTransfer(
  swap: StoredSwap,
  sender: string,
  encryptedKey: string,
  recipientAccount: string
): Promise<string> {
  let nearTxHash: string;

  if (this.nearExec && recipientAccount) {
    try {
      const amountYocto = swap.quoteResponse.quote.amountIn;
      const amountNear = (parseFloat(amountYocto) / 1e24).toString();

      console.log('[INTENTS] Executing REAL NEAR transfer:', {
        from: sender,
        to: recipientAccount,
        amount: amountNear,
      });

      const result = await this.nearExec.sendNearTransfer(
        sender,
        encryptedKey,
        recipientAccount,
        amountNear
      );

      nearTxHash = result.txHash;
      
      console.log('[INTENTS] Real transaction executed:', {
        nearTxHash,
        blockHeight: result.blockHeight,
      });

      return nearTxHash;

    } catch (error: unknown) {
      const adapterError = new AdapterError(
        `Real NEAR execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NearExecutionAdapter',
        'sendNearTransfer',
        error instanceof Error ? error : undefined
      );

      console.error('[INTENTS] Real execution failed, falling back to mock:', {
        error: adapterError.message,
        context: adapterError.context
      });

      // Fallback to mock
      nearTxHash = this.generateMockTxHash('NEAR');
      return nearTxHash;
    }
  } else {
    // Pure simulation: generate mock hash
    nearTxHash = this.generateMockTxHash('NEAR');
    return nearTxHash;
  }
}
```

### Cross-Chain Adapter Errors
Handle cross-chain operations with proper error context:

```typescript
// ✅ Good: Cross-chain error handling
private async deriveDepositAddress(
  request: QuoteRequest,
  originChain: string
): Promise<string> {
  if (originChain === 'near') {
    return request.refundTo;
  }

  try {
    const derived = await this.crossChain.deriveAddress(
      request.refundTo,
      originChain
    );
    
    return derived.address;

  } catch (error: unknown) {
    const adapterError = new AdapterError(
      `Failed to derive address for chain ${originChain}`,
      'CrossChainAdapter',
      'deriveAddress',
      error instanceof Error ? error : undefined
    );

    console.error('[INTENTS] Address derivation failed:', adapterError.message);
    
    // For cross-chain, we might want to fail fast or use a fallback
    // Decision depends on business logic
    throw adapterError;
  }
}
```

## Execution Error Recovery

### Swap Execution Error Handling
Reference `src/intents/simulator.ts` line 172-269 for execution error patterns:

```typescript
// ✅ Good: Comprehensive execution error handling
private async simulateExecution(quoteId: string): Promise<void> {
  const swap = this.swaps.get(quoteId);
  if (!swap) {
    console.warn(`[INTENTS] Swap not found for execution: ${quoteId}`);
    return;
  }

  try {
    console.log('⚙️  [INTENTS] Executing swap:', quoteId);

    swap.status = 'PROCESSING';
    swap.updatedAt = new Date();

    // Simulate execution time
    await new Promise((resolve) =>
      setTimeout(resolve, swap.quoteResponse.quote.timeEstimate * 100)
    );

    const quoteReq = swap.quoteResponse.quoteRequest;
    const sender = quoteReq.refundTo;

    // Determine recipient NEAR account
    let recipientAccount: string | undefined;
    if (quoteReq.destinationAsset.startsWith('near:')) {
      recipientAccount = quoteReq.recipient;
    } else {
      console.warn('[INTENTS] No recipient NEAR account for cross-chain, simulating only');
    }

    // Execute NEAR transfer
    let nearTxHash: string;
    try {
      nearTxHash = await this.executeNearTransfer(
        swap,
        sender,
        (quoteReq as any)._senderEncryptedPrivateKey || '',
        recipientAccount || ''
      );
    } catch (error: unknown) {
      throw new ExecutionError(
        `NEAR transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        quoteId,
        'NEAR_TRANSFER',
        error instanceof Error ? error : undefined
      );
    }

    // Execute destination chain transaction
    const destChain = quoteReq.destinationAsset.split(':')[0];
    let destTxHash: string | undefined;

    if (destChain !== 'near') {
      try {
        destTxHash = await this.crossChain.simulateDestinationTx({
          chain: destChain,
          correlateTo: nearTxHash,
        });
      } catch (error: unknown) {
        throw new ExecutionError(
          `Destination chain transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          quoteId,
          'CROSS_CHAIN',
          error instanceof Error ? error : undefined
        );
      }
    }

    // Success
    swap.status = 'SUCCESS';
    swap.updatedAt = new Date();
    swap.swapDetails = {
      nearTxHashes: [nearTxHash],
      destinationTxHash: destTxHash,
      amountIn: quoteReq.amount,
      amountOut: swap.quoteResponse.quote.amountOut,
      executionTime: Math.floor(
        (swap.updatedAt.getTime() - swap.createdAt.getTime()) / 1000
      ),
    };

    console.log('✅ [INTENTS] Swap completed:', {
      quoteId,
      status: 'SUCCESS',
      nearTx: nearTxHash,
      destTx: destTxHash,
    });

  } catch (error: unknown) {
    console.error('❌ [INTENTS] Swap failed:', {
      quoteId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    swap.status = 'FAILED';
    swap.updatedAt = new Date();
    swap.error = error instanceof IntentsError 
      ? error.message 
      : error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
  }
}
```

## Error Logging Patterns

### Structured Error Logging
Use consistent error logging format:

```typescript
// ✅ Good: Structured error logging
function logError(
  error: Error,
  context: {
    operation: string;
    quoteId?: string;
    request?: QuoteRequest;
    [key: string]: unknown;
  }
): void {
  const errorDetails = {
    timestamp: new Date().toISOString(),
    operation: context.operation,
    error: {
      name: error.name,
      message: error.message,
      code: error instanceof IntentsError ? error.code : 'UNKNOWN',
      context: error instanceof IntentsError ? error.context : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
    ...context,
  };

  console.error('❌ [INTENTS] Error occurred:', errorDetails);

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry.captureException(error, { contexts: { operation: context } });
  }
}

// Usage
try {
  await this.simulateExecution(quoteId);
} catch (error) {
  logError(error as Error, {
    operation: 'simulateExecution',
    quoteId,
  });
  throw error;
}
```

## Error Recovery Strategies

### Retry Pattern
Implement retry logic for transient errors:

```typescript
// ✅ Good: Retry with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors
      if (error instanceof ValidationError) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError!;
}

// Usage
const result = await retryWithBackoff(
  () => this.nearExec!.sendNearTransfer(sender, key, recipient, amount),
  { maxRetries: 3 }
);
```

### Circuit Breaker Pattern
Implement circuit breaker for adapter failures:

```typescript
// ✅ Good: Circuit breaker for adapter health
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold = 5,
    private readonly timeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime?.getTime() || 0) > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

## Best Practices Checklist

When implementing error handling:

- [ ] Use custom error classes for different error types
- [ ] Include context in error messages (field names, values, operation)
- [ ] Log errors with structured format and context
- [ ] Implement graceful degradation for adapter failures
- [ ] Use type guards to check error types before handling
- [ ] Preserve error chains with `cause` property
- [ ] Never expose sensitive information in error messages
- [ ] Implement retry logic for transient errors
- [ ] Use circuit breaker pattern for external dependencies
- [ ] Document expected errors in JSDoc comments

## Common Error Scenarios

### Invalid Quote Request
```typescript
// Validation error handling
try {
  this.validateQuoteRequest(request);
} catch (error) {
  if (error instanceof ValidationError) {
    // Client-facing error - return structured response
    throw error;
  }
  // Unexpected error - wrap and rethrow
  throw new IntentsError(
    'Unexpected validation error',
    'VALIDATION_UNEXPECTED',
    { originalError: error }
  );
}
```

### Adapter Unavailable
```typescript
// Handle missing adapter gracefully
if (!this.nearExec) {
  console.warn('[INTENTS] NEAR executor not available, using mock');
  return this.generateMockTxHash('NEAR');
}
```

### Network Timeout
```typescript
// Handle timeout errors
try {
  const result = await Promise.race([
    this.nearExec.sendNearTransfer(...),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 30000)
    )
  ]);
  return result;
} catch (error) {
  if (error instanceof Error && error.message === 'Timeout') {
    throw new AdapterError(
      'NEAR transfer timed out',
      'NearExecutionAdapter',
      'sendNearTransfer',
      error
    );
  }
  throw error;
}
```

Follow these patterns to ensure robust error handling throughout the simulator while maintaining clear error messages and recovery paths.

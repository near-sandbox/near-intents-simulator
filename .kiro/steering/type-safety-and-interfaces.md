---
inclusion: always
---

# Type Safety and Interface Design

**Comprehensive TypeScript type patterns for maintaining strict type safety across the NEAR Intents Simulator**

## Core Type Safety Principles

### Strict Null Checking
Always use explicit null checks and optional chaining:

```typescript
// ✅ Good: Explicit null handling
function getSwap(quoteId: string): StoredSwap | null {
  const swap = this.swaps.get(quoteId);
  if (!swap) {
    return null;
  }
  return swap;
}

// ❌ Bad: Implicit any
function getSwap(quoteId: string) {
  return this.swaps.get(quoteId); // Returns undefined if not found
}
```

### Union Types for State Management
Use discriminated unions for swap states:

```typescript
// Reference: src/types.ts line 8-14
type SwapStatus =
  | 'PENDING_DEPOSIT'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'INCOMPLETE_DEPOSIT'
  | 'REFUNDED'
  | 'FAILED';

// Use in interfaces with conditional types
interface SwapStatusResponse {
  status: SwapStatus;
  quoteResponse: QuoteResponse;
  swapDetails?: SwapDetails;  // Only present when status === 'SUCCESS'
  error?: string;              // Only present when status === 'FAILED'
}
```

### Branded Types for Type Safety
Use branded types to prevent mixing of similar string types:

```typescript
// Brand NEAR account IDs
type NearAccountId = string & { readonly __brand: 'NearAccountId' };
type Address = string & { readonly __brand: 'Address' };

function createNearAccount(id: string): NearAccountId {
  if (!isValidNearAccount(id)) {
    throw new Error('Invalid NEAR account ID');
  }
  return id as NearAccountId;
}

// Prevents accidental mixing
function sendTo(address: Address) {}
sendTo(createNearAccount('alice.near')); // ❌ Type error
```

## Interface Design Patterns

### Composition Over Inheritance
Reference: Use composition patterns as shown in `src/types.ts`:

```typescript
// ✅ Good: Composed interfaces
interface BaseQuote {
  amountIn: string;
  amountOut: string;
  fee: string;
}

interface Quote extends BaseQuote {
  depositAddress: string;
  deadline: string;
  timeEstimate: number;
  route: Route;
}
```

### Readonly Properties for Immutability
Use readonly for configuration and response objects:

```typescript
// ✅ Good: Immutable config
interface SimulatorConfig {
  readonly crossChain: CrossChainAdapter;
  readonly nearExec?: NearExecutionAdapter;
  readonly feeRate: number;
}

// ❌ Bad: Mutable config leads to bugs
interface SimulatorConfig {
  crossChain: CrossChainAdapter;
  nearExec?: NearExecutionAdapter;
  feeRate: number; // Can be modified after creation
}
```

### Generic Constraints
Constrain generics to enforce type safety:

```typescript
// ✅ Good: Constrained generic
interface AssetIdentifier<T extends string = string> {
  chain: T;
  token: string;
  decimals: number;
  symbol: string;
}

// Usage with specific chain types
type NearAsset = AssetIdentifier<'near'>;
type EthereumAsset = AssetIdentifier<'ethereum'>;
```

## Type Guards and Narrowing

### Custom Type Guards
Create type guards for runtime type checking:

```typescript
// ✅ Good: Type guard function
function isValidQuoteRequest(request: unknown): request is QuoteRequest {
  if (typeof request !== 'object' || request === null) {
    return false;
  }

  const req = request as Record<string, unknown>;
  return (
    typeof req.swapType === 'string' &&
    typeof req.originAsset === 'string' &&
    typeof req.destinationAsset === 'string' &&
    typeof req.amount === 'string' &&
    typeof req.refundTo === 'string' &&
    typeof req.recipient === 'string'
  );
}

// Usage
function processRequest(request: unknown) {
  if (isValidQuoteRequest(request)) {
    // TypeScript knows request is QuoteRequest here
    return request.originAsset; // ✅ Type-safe
  }
  throw new Error('Invalid request');
}
```

### Discriminated Unions
Use discriminated unions for type narrowing:

```typescript
// ✅ Good: Discriminated union
type SwapResult =
  | { status: 'success'; txHash: string; blockHeight: number }
  | { status: 'failed'; error: string };

function handleSwapResult(result: SwapResult) {
  if (result.status === 'success') {
    // TypeScript narrows to success case
    return result.txHash; // ✅ Type-safe
  } else {
    // TypeScript narrows to failed case
    return result.error; // ✅ Type-safe
  }
}
```

## Advanced Type Patterns

### Conditional Types
Use conditional types for flexible type transformations:

```typescript
// Extract return type from Promise
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

// Extract adapter return type
type NearTransferResult = UnwrapPromise<
  ReturnType<NearExecutionAdapter['sendNearTransfer']>
>;
```

### Mapped Types
Use mapped types for type transformations:

```typescript
// Make all properties optional
type PartialQuoteRequest = {
  [K in keyof QuoteRequest]?: QuoteRequest[K];
};

// Make all properties readonly
type ReadonlyQuoteRequest = {
  readonly [K in keyof QuoteRequest]: QuoteRequest[K];
};
```

### Template Literal Types
Use template literal types for asset format validation:

```typescript
// ✅ Good: Template literal for asset format
type AssetFormat = `${Chain}:${Token}`;

// Validate at compile time
type ValidAsset = 
  | 'near:native'
  | 'near:wrap.near'
  | 'ethereum:native'
  | 'ethereum:usdc.eth'
  | 'bitcoin:native';

function parseAsset(asset: ValidAsset): [Chain, Token] {
  return asset.split(':') as [Chain, Token];
}
```

## Error Handling with Types

### Custom Error Types
Create typed error classes:

```typescript
// ✅ Good: Typed error with context
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly adapter: string,
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AdapterError';
    Object.setPrototypeOf(this, AdapterError.prototype);
  }
}

// Usage with type safety
try {
  await adapter.deriveAddress(account, chain);
} catch (error) {
  if (error instanceof AdapterError) {
    // TypeScript knows error has adapter, operation, cause properties
    console.error(`Adapter ${error.adapter} failed: ${error.operation}`);
  }
}
```

### Result Type Pattern
Use Result types instead of throwing:

```typescript
// ✅ Good: Result type for operations
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage with type safety
async function requestQuote(
  request: QuoteRequest
): Promise<Result<QuoteResponse, ValidationError>> {
  try {
    const validation = validateRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        error: new ValidationError('Invalid request', 'request', request)
      };
    }

    const quote = await calculateQuote(request);
    return { success: true, data: quote };
  } catch (error) {
    return {
      success: false,
      error: new ValidationError('Quote failed', 'calculation', error)
    };
  }
}
```

## Export Patterns

### Type Exports
Always export types explicitly:

```typescript
// ✅ Good: Named type exports
export type { QuoteRequest, QuoteResponse, SwapStatusResponse };
export type { NearExecutionAdapter, CrossChainAdapter };

// ❌ Bad: Default exports for types
export default QuoteRequest; // Hard to import
```

### Interface Exports
Use type exports for interfaces:

```typescript
// ✅ Good: Export interface as type
export interface IOneClickClient {
  requestQuote(request: QuoteRequest): Promise<QuoteResponse>;
  getSwapStatus(quoteId: string): Promise<SwapStatusResponse>;
}

// Reference: src/types.ts line 73-76
```

## Type Assertions

### Avoid Dangerous Assertions
Only use type assertions when absolutely necessary:

```typescript
// ✅ Good: Type guard instead of assertion
function isValidNearAccount(id: unknown): id is string {
  return typeof id === 'string' && id.endsWith('.near');
}

// ❌ Bad: Unsafe type assertion
const account = id as string; // No runtime check
```

### Safe Assertions with Validation
Validate before asserting:

```typescript
// ✅ Good: Assert after validation
function parseAssetIdentifier(input: string): AssetIdentifier {
  if (!input.includes(':')) {
    throw new Error('Invalid asset format');
  }
  
  const [chain, token] = input.split(':');
  return { chain, token } as AssetIdentifier;
}
```

## Best Practices Checklist

When working with types in this codebase:

- [ ] Use explicit return types for all public functions
- [ ] Prefer `type` over `interface` for unions and intersections
- [ ] Use `interface` for object shapes that may be extended
- [ ] Never use `any` - use `unknown` if type is truly unknown
- [ ] Use type guards for runtime type checking
- [ ] Export types explicitly, not as default exports
- [ ] Use readonly for immutable properties
- [ ] Create branded types for similar but distinct string types
- [ ] Use discriminated unions for state management
- [ ] Add JSDoc with TypeScript examples for complex types

## Common Type Patterns

### Asset Parsing
```typescript
type AssetParts = {
  chain: string;
  token: string;
};

function parseAsset(asset: string): AssetParts {
  const parts = asset.split(':');
  if (parts.length !== 2) {
    throw new ValidationError('Invalid asset format', 'asset', asset);
  }
  return { chain: parts[0], token: parts[1] };
}
```

### Amount Formatting
```typescript
type AmountString = string & { readonly __brand: 'AmountString' };

function formatAmount(
  amount: string,
  decimals: number,
  symbol: string
): string {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return `${num.toFixed(2)} ${symbol}`;
}
```

### Quote ID Validation
```typescript
type QuoteId = string & { readonly __brand: 'QuoteId' };

function validateQuoteId(id: string): QuoteId | null {
  // UUID v4 format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? (id as QuoteId) : null;
}
```

Follow these patterns to maintain strict type safety throughout the codebase while enabling powerful type inference and compile-time error detection.

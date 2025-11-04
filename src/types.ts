/**
 * NEAR Intents (1Click API) types
 * Matches production 1Click API surface
 */

export type SwapType = 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'ANY_INPUT';

export type SwapStatus =
  | 'PENDING_DEPOSIT'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'INCOMPLETE_DEPOSIT'
  | 'REFUNDED'
  | 'FAILED';

export interface AssetIdentifier {
  chain: string;
  token: string;
  decimals: number;
  symbol: string;
}

export interface QuoteRequest {
  dry?: boolean;
  swapType: SwapType;
  slippageTolerance?: number;
  originAsset: string; // "near:wrap.near", "ethereum:usdc.eth"
  destinationAsset: string;
  amount: string; // smallest unit (yoctoNEAR, wei, etc)
  refundTo: string; // NEAR account
  recipient: string; // destination address
  deadline?: string; // ISO timestamp
}

export interface Quote {
  depositAddress: string;
  amountIn: string;
  amountOut: string;
  amountOutFormatted: string;
  deadline: string;
  timeEstimate: number;
  fee: string;
  route: {
    steps: Array<{
      from: string;
      to: string;
      protocol: string;
    }>;
  };
}

export interface QuoteResponse {
  quoteId: string;
  timestamp: string;
  quoteRequest: QuoteRequest;
  quote: Quote;
}

export interface SwapStatusResponse {
  quoteResponse: QuoteResponse;
  status: SwapStatus;
  updatedAt: string;
  swapDetails?: {
    nearTxHashes?: string[];
    destinationTxHash?: string;
    amountIn: string;
    amountOut: string;
    executionTime?: number;
  };
  error?: string;
}

export interface IOneClickClient {
  requestQuote(request: QuoteRequest): Promise<QuoteResponse>;
  getSwapStatus(quoteId: string): Promise<SwapStatusResponse>;
}

/**
 * Adapter interfaces for environment-specific behavior
 */

export interface NearExecutionAdapter {
  /**
   * Execute real NEAR transfer on localnet
   */
  sendNearTransfer(
    sender: string,
    encryptedKey: string,
    recipient: string,
    amountNear: string
  ): Promise<{ txHash: string; blockHeight: number }>;
}

export interface CrossChainAdapter {
  /**
   * Derive address on target chain
   */
  deriveAddress(
    nearAccount: string,
    chain: string
  ): Promise<{ address: string; publicKey: string }>;

  /**
   * Simulate destination chain transaction
   */
  simulateDestinationTx(params: {
    chain: string;
    correlateTo: string;
  }): Promise<string>;
}

/**
 * NEAR Intents Simulator (1Click API)
 *
 * Simulates production 1Click API for localnet.
 * Executes real NEAR transactions if adapter provided,
 * otherwise pure simulation with mock hashes.
 */

import {
  IOneClickClient,
  QuoteRequest,
  QuoteResponse,
  SwapStatusResponse,
  SwapStatus,
  Quote,
  NearExecutionAdapter,
  CrossChainAdapter,
} from '../types';
import { randomUUID, createHash } from 'crypto';

interface StoredSwap {
  quoteResponse: QuoteResponse;
  status: SwapStatus;
  createdAt: Date;
  updatedAt: Date;
  swapDetails?: any;
  error?: string;
}

export class OneClickSimulator implements IOneClickClient {
  private swaps: Map<string, StoredSwap> = new Map();
  private crossChain: CrossChainAdapter;
  private nearExec?: NearExecutionAdapter;

  constructor(opts: { crossChain: CrossChainAdapter; nearExec?: NearExecutionAdapter }) {
    this.crossChain = opts.crossChain;
    this.nearExec = opts.nearExec;
  }

  /**
   * Request a quote for an intent
   */
  async requestQuote(request: QuoteRequest): Promise<QuoteResponse> {
    console.log('🔄 [INTENTS] Requesting quote:', {
      from: request.originAsset,
      to: request.destinationAsset,
      amount: request.amount,
    });

    this.validateQuoteRequest(request);

    // Generate quote
    const quote = await this.calculateQuote(request);

    // Create quote response
    const quoteId = randomUUID();
    const quoteResponse: QuoteResponse = {
      quoteId,
      timestamp: new Date().toISOString(),
      quoteRequest: request,
      quote,
    };

    // Store swap with initial status
    this.swaps.set(quoteId, {
      quoteResponse,
      status: 'PENDING_DEPOSIT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ [INTENTS] Quote generated:', {
      quoteId,
      amountOut: quote.amountOutFormatted,
      timeEstimate: quote.timeEstimate,
    });

    // Auto-execute if not dry run
    if (!request.dry) {
      setTimeout(() => this.simulateExecution(quoteId), 1000);
    }

    return quoteResponse;
  }

  /**
   * Get status of a swap
   */
  async getSwapStatus(quoteId: string): Promise<SwapStatusResponse> {
    const swap = this.swaps.get(quoteId);

    if (!swap) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    return {
      quoteResponse: swap.quoteResponse,
      status: swap.status,
      updatedAt: swap.updatedAt.toISOString(),
      swapDetails: swap.swapDetails,
      error: swap.error,
    };
  }

  /**
   * Calculate quote using asset registry and fee model
   */
  private async calculateQuote(request: QuoteRequest): Promise<Quote> {
    const [originChain, originToken] = request.originAsset.split(':');
    const [destChain, destToken] = request.destinationAsset.split(':');

    const originDecimals = this.getDecimals(originChain, originToken);
    const destDecimals = this.getDecimals(destChain, destToken);

    const amountInNum = parseFloat(request.amount);
    const feePercent = 0.003; // 0.3% fee
    const amountOutNum = amountInNum * (1 - feePercent);

    const slippage = request.slippageTolerance || 0.01;
    const amountOutWithSlippage = amountOutNum * (1 - slippage);

    // Derive or get deposit address
    let depositAddress = request.refundTo;
    if (originChain !== 'near') {
      const derived = await this.crossChain.deriveAddress(
        request.refundTo,
        originChain
      );
      depositAddress = derived.address;
    }

    const deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const isCrossChain = originChain !== destChain;
    const timeEstimate = isCrossChain ? 45 : 7;

    return {
      depositAddress,
      amountIn: request.amount,
      amountOut: amountOutWithSlippage.toFixed(destDecimals),
      amountOutFormatted: `${amountOutWithSlippage.toFixed(2)} ${this.getSymbol(destChain, destToken)}`,
      deadline,
      timeEstimate,
      fee: (amountInNum * feePercent).toFixed(originDecimals),
      route: {
        steps: isCrossChain
          ? [
              {
                from: this.getSymbol(originChain, originToken),
                to: `${this.getSymbol(originChain, originToken)} (bridged)`,
                protocol: 'rainbow-bridge',
              },
              {
                from: `${this.getSymbol(originChain, originToken)} (bridged)`,
                to: this.getSymbol(destChain, destToken),
                protocol: 'uniswap-v3',
              },
            ]
          : [
              {
                from: this.getSymbol(originChain, originToken),
                to: this.getSymbol(destChain, destToken),
                protocol: 'ref-finance',
              },
            ],
      },
    };
  }

  /**
   * Simulate swap execution
   */
  private async simulateExecution(quoteId: string): Promise<void> {
    const swap = this.swaps.get(quoteId);
    if (!swap) return;

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

      let nearTxHash: string;

      // Try to execute real NEAR transfer if adapter and recipient available
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
            (quoteReq as any)._senderEncryptedPrivateKey || '',
            recipientAccount,
            amountNear
          );

          nearTxHash = result.txHash;

          console.log('[INTENTS] REAL transaction executed:', {
            nearTxHash,
            blockHeight: result.blockHeight,
          });
        } catch (error: any) {
          console.error('[INTENTS] Real NEAR execution failed:', error.message);
          nearTxHash = this.generateMockTxHash('NEAR');
        }
      } else {
        // Pure simulation: generate mock hash
        nearTxHash = this.generateMockTxHash('NEAR');
      }

      // Simulate destination chain execution
      const destChain = quoteReq.destinationAsset.split(':')[0];
      const destTxHash =
        destChain !== 'near'
          ? await this.crossChain.simulateDestinationTx({
              chain: destChain,
              correlateTo: nearTxHash,
            })
          : undefined;

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
    } catch (error: any) {
      console.error('❌ [INTENTS] Swap failed:', error.message);

      swap.status = 'FAILED';
      swap.updatedAt = new Date();
      swap.error = error.message;
    }
  }

  private validateQuoteRequest(request: QuoteRequest): void {
    if (!request.originAsset || !request.destinationAsset) {
      throw new Error('Origin and destination assets required');
    }

    if (!request.amount || parseFloat(request.amount) <= 0) {
      throw new Error('Valid amount required');
    }

    if (!request.refundTo || !request.recipient) {
      throw new Error('Refund and recipient addresses required');
    }
  }

  private getDecimals(chain: string, token: string): number {
    const key = `${chain}:${token}`;
    const registry: Record<string, number> = {
      'near:native': 24,
      'near:wrap.near': 24,
      'near:usdc.near': 6,
      'ethereum:native': 18,
      'ethereum:usdc.eth': 6,
      'bitcoin:native': 8,
      'dogecoin:native': 8,
    };
    return registry[key] || 18;
  }

  private getSymbol(chain: string, token: string): string {
    const key = `${chain}:${token}`;
    const registry: Record<string, string> = {
      'near:native': 'NEAR',
      'near:wrap.near': 'wNEAR',
      'near:usdc.near': 'USDC',
      'ethereum:native': 'ETH',
      'ethereum:usdc.eth': 'USDC',
      'bitcoin:native': 'BTC',
      'dogecoin:native': 'DOGE',
    };
    return registry[key] || token;
  }

  private generateMockTxHash(chain: string): string {
    const prefix = {
      NEAR: '',
      ETHEREUM: '0x',
      BITCOIN: '',
    }[chain] || '';

    const hash = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    return prefix + hash;
  }
}

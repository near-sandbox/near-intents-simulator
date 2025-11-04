/**
 * Factory for creating OneClick client (simulator or production)
 */

import { getConfig } from './config';
import { OneClickSimulator } from './intents/simulator';
import { IOneClickClient, CrossChainAdapter } from './types';

export class ProductionOneClickClient implements IOneClickClient {
  async requestQuote(): Promise<never> {
    throw new Error('Production client not yet implemented');
  }
  async getSwapStatus(): Promise<never> {
    throw new Error('Production client not yet implemented');
  }
}

export function createOneClickClient(
  crossChain: CrossChainAdapter
): IOneClickClient {
  const config = getConfig();

  if (config.useSimulators) {
    return new OneClickSimulator({ crossChain });
  } else {
    return new ProductionOneClickClient();
  }
}

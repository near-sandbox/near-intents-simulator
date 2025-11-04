/**
 * Environment-based configuration
 */

export interface OneClickConfig {
  useSimulators: boolean;
  oneClickApiUrl?: string;
}

export function getConfig(): OneClickConfig {
  const useSimulators = process.env.USE_PRODUCTION_SIMULATORS !== 'true';

  return {
    useSimulators,
    oneClickApiUrl: process.env.ONECLICK_API_URL,
  };
}

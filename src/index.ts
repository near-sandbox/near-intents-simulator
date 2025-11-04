/**
 * NEAR Intents Simulator - Main exports
 */

// Types
export * from './types';

// Simulators
export { OneClickSimulator } from './intents/simulator';
export { ProductionOneClickClient, createOneClickClient } from './factory';

// Config
export { getConfig } from './config';

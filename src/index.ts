/**
 * Augments MCP Server
 *
 * Main entry point for the TypeScript MCP server.
 * Provides real-time framework documentation access for AI assistants.
 */

export { AugmentsMcpServer, getServer, SERVER_VERSION } from './server';
export { getRegistry, FrameworkRegistryManager } from './registry/manager';
export { getCache, KVCache } from './cache';
export { getGitHubProvider, GitHubProvider } from './providers/github';
export { getWebsiteProvider, WebsiteProvider } from './providers/website';

// Re-export types
export * from './types';

/**
 * Environment configuration for Augments MCP Server
 */

export interface Config {
  // Server settings
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';

  // GitHub settings
  githubToken?: string;

  // Redis/Upstash settings
  upstashRedisUrl?: string;
  upstashRedisToken?: string;

  // Cache settings
  enableAutoCache: boolean;
  enableHotReload: boolean;

  // Rate limiting
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number; // in seconds

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Feature flags
  premiumEnabled: boolean;
}

function getEnvString(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  return value !== undefined ? value : defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function getConfig(): Config {
  const env = getEnvString('NODE_ENV', 'development') as Config['env'];

  return {
    // Server settings
    port: getEnvNumber('PORT', 3000),
    host: getEnvString('HOST', '0.0.0.0') || '0.0.0.0',
    env,

    // GitHub settings
    githubToken: getEnvString('GITHUB_TOKEN'),

    // Redis/Upstash settings
    upstashRedisUrl: getEnvString('UPSTASH_REDIS_REST_URL'),
    upstashRedisToken: getEnvString('UPSTASH_REDIS_REST_TOKEN'),

    // Cache settings
    enableAutoCache: getEnvBoolean('ENABLE_AUTO_CACHE', false),
    enableHotReload: getEnvBoolean('ENABLE_HOT_RELOAD', env === 'development'),

    // Rate limiting
    rateLimitEnabled: getEnvBoolean('RATE_LIMIT_ENABLED', true),
    rateLimitRequests: getEnvNumber('RATE_LIMIT_REQUESTS', 100),
    rateLimitWindow: getEnvNumber('RATE_LIMIT_WINDOW', 3600), // 1 hour

    // Logging
    logLevel: (getEnvString('LOG_LEVEL', env === 'production' ? 'info' : 'debug') || 'info') as Config['logLevel'],

    // Feature flags
    premiumEnabled: getEnvBoolean('PREMIUM_ENABLED', false),
  };
}

// Export singleton config
export const config = getConfig();

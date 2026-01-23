/**
 * Cache TTL strategies based on content stability
 */

export const CacheTTL = {
  // Stable releases - 24 hours
  stable: 86400,

  // Beta versions - 6 hours
  beta: 21600,

  // Development branches - 1 hour
  dev: 3600,

  // Default TTL - 3 hours
  default: 10800,
} as const;

export type CacheTTLType = keyof typeof CacheTTL;

/**
 * Determine TTL based on framework version and branch
 */
export function determineTTL(version: string, branch: string = 'main'): number {
  const versionLower = version.toLowerCase();
  const branchLower = branch.toLowerCase();

  // Development branches get shorter TTL
  if (branchLower === 'dev' || branchLower === 'develop' || branchLower === 'development') {
    return CacheTTL.dev;
  }

  // Alpha versions get shortest TTL
  if (versionLower.includes('dev') || versionLower.includes('alpha')) {
    return CacheTTL.dev;
  }

  // Beta and RC versions get medium TTL
  if (versionLower.includes('beta') || versionLower.includes('rc')) {
    return CacheTTL.beta;
  }

  // Stable or latest versions get longest TTL
  if (versionLower === 'stable' || versionLower === 'latest') {
    return CacheTTL.stable;
  }

  return CacheTTL.default;
}

/**
 * Generate a cache key for framework documentation
 */
export function generateCacheKey(
  framework: string,
  path: string = '',
  sourceType: string = 'docs'
): string {
  // Create a consistent key format
  const normalizedPath = path.replace(/\//g, ':').toLowerCase();
  const key = `augments:${sourceType}:${framework}:${normalizedPath || 'main'}`;
  return key;
}

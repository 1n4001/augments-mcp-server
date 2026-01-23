/**
 * API Key authentication middleware
 *
 * Built but disabled for v3.0 - all requests pass through.
 * Infrastructure ready for premium tier implementation.
 */

import { config } from '@/config';
import { getLogger } from '@/utils/logger';

const logger = getLogger('auth');

export interface AuthResult {
  authenticated: boolean;
  apiKey?: string;
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  userId?: string;
}

/**
 * Validate API key from request headers
 *
 * Currently disabled - all requests are authenticated as free tier.
 * When premium is enabled, this will validate API keys.
 */
export async function validateApiKey(authHeader: string | null): Promise<AuthResult> {
  // Premium features disabled - allow all requests
  if (!config.premiumEnabled) {
    return {
      authenticated: true,
      tier: 'free',
    };
  }

  // If no auth header, treat as free tier
  if (!authHeader) {
    return {
      authenticated: true,
      tier: 'free',
    };
  }

  // Parse Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    logger.warn('Invalid authorization header format');
    return {
      authenticated: true,
      tier: 'free',
    };
  }

  const apiKey = match[1];

  // TODO: When premium is enabled, validate API key against database
  // For now, all valid-looking keys are treated as authenticated
  if (apiKey.startsWith('aug_')) {
    logger.debug('API key provided', { key: apiKey.substring(0, 8) + '...' });
    return {
      authenticated: true,
      apiKey,
      tier: 'pro', // Would be looked up from database
    };
  }

  return {
    authenticated: true,
    tier: 'free',
  };
}

/**
 * Check if a feature is available for the given tier
 */
export function checkFeatureAccess(tier: AuthResult['tier'], feature: string): boolean {
  // All features are currently available for all tiers
  // When premium is enabled, this will check feature access
  if (!config.premiumEnabled) {
    return true;
  }

  const tierFeatures: Record<string, Set<string>> = {
    free: new Set([
      'list_available_frameworks',
      'search_frameworks',
      'get_framework_info',
      'get_registry_stats',
      'get_framework_docs',
      'get_framework_examples',
      'search_documentation',
      'get_framework_context',
      'analyze_code_compatibility',
      'check_framework_updates',
      'get_cache_stats',
    ]),
    pro: new Set([
      // All free features plus:
      'refresh_framework_cache',
      'custom_frameworks', // Future feature
    ]),
    team: new Set([
      // All pro features plus team features
    ]),
    enterprise: new Set([
      // All features
    ]),
  };

  // Enterprise has access to everything
  if (tier === 'enterprise') {
    return true;
  }

  // Check if feature is in tier's feature set
  const features = tierFeatures[tier];
  if (features && features.has(feature)) {
    return true;
  }

  // Check if feature is in a lower tier
  const tierOrder = ['free', 'pro', 'team', 'enterprise'];
  const currentTierIndex = tierOrder.indexOf(tier);

  for (let i = 0; i < currentTierIndex; i++) {
    const lowerTierFeatures = tierFeatures[tierOrder[i]];
    if (lowerTierFeatures && lowerTierFeatures.has(feature)) {
      return true;
    }
  }

  return false;
}

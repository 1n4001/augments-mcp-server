/**
 * Rate limiting middleware using Upstash
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';

const logger = getLogger('rate-limit');

// Rate limiter instance
let ratelimit: Ratelimit | null = null;

/**
 * Initialize rate limiter
 */
function getRateLimiter(): Ratelimit | null {
  if (!config.rateLimitEnabled) {
    return null;
  }

  if (ratelimit) {
    return ratelimit;
  }

  // Check if Upstash is configured
  if (!config.upstashRedisUrl || !config.upstashRedisToken) {
    logger.warn('Rate limiting disabled: Upstash Redis not configured');
    return null;
  }

  try {
    const redis = new Redis({
      url: config.upstashRedisUrl,
      token: config.upstashRedisToken,
    });

    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.rateLimitRequests, `${config.rateLimitWindow}s`),
      analytics: true,
      prefix: 'augments-mcp',
    });

    logger.info('Rate limiter initialized', {
      requests: config.rateLimitRequests,
      window: config.rateLimitWindow,
    });

    return ratelimit;
  } catch (error) {
    logger.error('Failed to initialize rate limiter', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for an identifier (IP address or API key)
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getRateLimiter();

  if (!limiter) {
    // Rate limiting disabled or not configured
    return {
      success: true,
      limit: -1,
      remaining: -1,
      reset: 0,
    };
  }

  try {
    const result = await limiter.limit(identifier);

    if (!result.success) {
      logger.warn('Rate limit exceeded', {
        identifier: identifier.substring(0, 8) + '...',
        remaining: result.remaining,
      });
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    logger.error('Rate limit check failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit: -1,
      remaining: -1,
      reset: 0,
    };
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  if (result.limit === -1) {
    return {};
  }

  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

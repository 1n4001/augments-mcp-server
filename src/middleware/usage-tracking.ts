/**
 * Anonymous usage tracking middleware
 *
 * Tracks usage statistics for analytics without collecting PII.
 * Stored in Upstash Redis for aggregation.
 */

import { Redis } from '@upstash/redis';
import { config } from '@/config';
import { getLogger } from '@/utils/logger';

const logger = getLogger('usage-tracking');

// Redis client for usage tracking
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) {
    return redis;
  }

  if (!config.upstashRedisUrl || !config.upstashRedisToken) {
    return null;
  }

  try {
    redis = new Redis({
      url: config.upstashRedisUrl,
      token: config.upstashRedisToken,
    });
    return redis;
  } catch (error) {
    logger.warn('Failed to initialize Redis for usage tracking', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface UsageEvent {
  tool: string;
  framework?: string;
  tier: string;
  timestamp: number;
  success: boolean;
  duration_ms?: number;
}

/**
 * Track a tool usage event
 */
export async function trackUsage(event: UsageEvent): Promise<void> {
  const redisClient = getRedis();
  if (!redisClient) {
    return;
  }

  try {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const hour = new Date().getUTCHours();

    // Increment counters
    const pipeline = redisClient.pipeline();

    // Daily tool usage
    pipeline.hincrby(`usage:${date}:tools`, event.tool, 1);

    // Hourly tool usage for today
    pipeline.hincrby(`usage:${date}:${hour}:tools`, event.tool, 1);

    // Framework usage (if applicable)
    if (event.framework) {
      pipeline.hincrby(`usage:${date}:frameworks`, event.framework, 1);
    }

    // Tier usage
    pipeline.hincrby(`usage:${date}:tiers`, event.tier, 1);

    // Success/failure rates
    if (event.success) {
      pipeline.hincrby(`usage:${date}:status`, 'success', 1);
    } else {
      pipeline.hincrby(`usage:${date}:status`, 'failure', 1);
    }

    // Set expiry (keep 90 days of data)
    const keys = [
      `usage:${date}:tools`,
      `usage:${date}:${hour}:tools`,
      `usage:${date}:frameworks`,
      `usage:${date}:tiers`,
      `usage:${date}:status`,
    ];

    for (const key of keys) {
      pipeline.expire(key, 90 * 24 * 60 * 60); // 90 days
    }

    await pipeline.exec();

    logger.debug('Usage tracked', {
      tool: event.tool,
      framework: event.framework,
      tier: event.tier,
    });
  } catch (error) {
    // Don't fail the request if tracking fails
    logger.warn('Failed to track usage', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get usage statistics for a date range
 */
export async function getUsageStats(
  startDate: string,
  endDate: string
): Promise<{
  tools: Record<string, number>;
  frameworks: Record<string, number>;
  tiers: Record<string, number>;
  total_requests: number;
  success_rate: number;
}> {
  const redisClient = getRedis();
  if (!redisClient) {
    return {
      tools: {},
      frameworks: {},
      tiers: {},
      total_requests: 0,
      success_rate: 0,
    };
  }

  try {
    const tools: Record<string, number> = {};
    const frameworks: Record<string, number> = {};
    const tiers: Record<string, number> = {};
    let totalSuccess = 0;
    let totalFailure = 0;

    // Iterate through dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().split('T')[0];

      // Get tool usage
      const toolUsage = await redisClient.hgetall(`usage:${date}:tools`);
      if (toolUsage) {
        for (const [tool, count] of Object.entries(toolUsage)) {
          tools[tool] = (tools[tool] || 0) + Number(count);
        }
      }

      // Get framework usage
      const frameworkUsage = await redisClient.hgetall(`usage:${date}:frameworks`);
      if (frameworkUsage) {
        for (const [framework, count] of Object.entries(frameworkUsage)) {
          frameworks[framework] = (frameworks[framework] || 0) + Number(count);
        }
      }

      // Get tier usage
      const tierUsage = await redisClient.hgetall(`usage:${date}:tiers`);
      if (tierUsage) {
        for (const [tier, count] of Object.entries(tierUsage)) {
          tiers[tier] = (tiers[tier] || 0) + Number(count);
        }
      }

      // Get status
      const status = await redisClient.hgetall(`usage:${date}:status`);
      if (status) {
        totalSuccess += Number(status.success || 0);
        totalFailure += Number(status.failure || 0);
      }
    }

    const totalRequests = totalSuccess + totalFailure;
    const successRate = totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;

    return {
      tools,
      frameworks,
      tiers,
      total_requests: totalRequests,
      success_rate: Math.round(successRate * 100) / 100,
    };
  } catch (error) {
    logger.error('Failed to get usage stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      tools: {},
      frameworks: {},
      tiers: {},
      total_requests: 0,
      success_rate: 0,
    };
  }
}

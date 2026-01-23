/**
 * Registry models and Zod schemas for framework configuration validation
 */

import { z } from 'zod';
import {
  FrameworkConfigSchema,
  type FrameworkConfig,
  type FrameworkInfo,
  type SearchResult,
} from '@/types';

/**
 * Validate a framework configuration object
 */
export function validateFrameworkConfig(data: unknown): FrameworkConfig | null {
  try {
    return FrameworkConfigSchema.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Convert a FrameworkConfig to FrameworkInfo for listings
 */
export function configToInfo(config: FrameworkConfig): FrameworkInfo {
  return {
    name: config.name,
    display_name: config.display_name,
    category: config.category,
    type: config.type,
    description: `${config.display_name} - ${config.type}`,
    tags: [...config.key_features, ...config.common_patterns],
    priority: config.priority,
    version: config.version,
  };
}

/**
 * Calculate search relevance score for a framework
 */
export function calculateSearchScore(
  config: FrameworkConfig,
  query: string
): { score: number; matched_fields: string[] } {
  const queryLower = query.toLowerCase();
  let score = 0;
  const matched_fields: string[] = [];

  // Exact name match gets highest score
  if (queryLower === config.name.toLowerCase()) {
    score += 100;
    matched_fields.push('name');
  } else if (config.name.toLowerCase().includes(queryLower)) {
    score += 50;
    matched_fields.push('name');
  }

  // Display name match
  if (config.display_name.toLowerCase().includes(queryLower)) {
    score += 30;
    matched_fields.push('display_name');
  }

  // Category match
  if (queryLower === config.category.toLowerCase()) {
    score += 25;
    matched_fields.push('category');
  }

  // Type match
  if (config.type.toLowerCase().includes(queryLower)) {
    score += 20;
    matched_fields.push('type');
  }

  // Key features match
  for (const feature of config.key_features) {
    if (feature.toLowerCase().includes(queryLower)) {
      score += 15;
      if (!matched_fields.includes('key_features')) {
        matched_fields.push('key_features');
      }
    }
  }

  // Common patterns match
  for (const pattern of config.common_patterns) {
    if (pattern.toLowerCase().includes(queryLower)) {
      score += 10;
      if (!matched_fields.includes('common_patterns')) {
        matched_fields.push('common_patterns');
      }
    }
  }

  return { score, matched_fields: [...new Set(matched_fields)] };
}

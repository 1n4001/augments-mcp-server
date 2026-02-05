/**
 * Unified Cache
 *
 * Generic LRU cache with configurable TTL, bounded size, and hit rate stats.
 * Replaces inconsistent per-module caching with a single, consistent implementation.
 */

import { getLogger } from '@/utils/logger';

const logger = getLogger('unified-cache');

export interface UnifiedCacheOptions {
  /** Maximum number of entries */
  maxSize: number;
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Cache name for logging */
  name: string;
}

interface CacheEntry<T> {
  value: T;
  storedAt: number;
  ttl: number;
}

export interface CacheMetrics {
  name: string;
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * Generic LRU cache with TTL support and metrics tracking
 */
export class UnifiedCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly options: UnifiedCacheOptions;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: UnifiedCacheOptions) {
    this.options = options;
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.storedAt > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // LRU: move to end by deleting and re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;

    return entry.value;
  }

  /**
   * Store a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // If key already exists, delete first to maintain insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict LRU entries if at capacity
    while (this.cache.size >= this.options.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.evictions++;
      }
    }

    this.cache.set(key, {
      value,
      storedAt: Date.now(),
      ttl: ttl ?? this.options.defaultTTL,
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.storedAt > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Cache cleared', { name: this.options.name });
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const total = this.hits + this.misses;
    return {
      name: this.options.name,
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) / 100 : 0,
      evictions: this.evictions,
    };
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.cache.size;
  }
}

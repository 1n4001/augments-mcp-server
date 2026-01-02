"""Documentation caching system with advanced TTL strategies."""

import os
import time
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List, Set
from dataclasses import dataclass
from collections import OrderedDict
import diskcache as dc
import structlog

logger = structlog.get_logger(__name__)

# Memory cache configuration
MAX_MEMORY_CACHE_ENTRIES = 100  # Maximum entries in memory cache (LRU eviction)


@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    content: str
    cached_at: float
    ttl: int
    version: str
    framework: str
    source_type: str  # 'github', 'website', 'custom'


class DocumentationCache:
    """Advanced documentation caching system."""
    
    def __init__(self, cache_dir: Optional[str] = None):
        """Initialize the documentation cache.
        
        Args:
            cache_dir: Directory for cache storage (defaults to ~/.cache/augments-mcp-server)
        """
        if cache_dir is None:
            cache_dir = os.path.expanduser("~/.cache/augments-mcp-server")
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize cache with TTL strategies
        self.cache = dc.Cache(str(self.cache_dir / "documentation"))
        # Use OrderedDict for LRU eviction (most recently used at end)
        self.memory_cache: OrderedDict[str, CacheEntry] = OrderedDict()
        # Index: framework name -> set of cache keys (for O(1) lookups)
        self._framework_keys: Dict[str, Set[str]] = {}
        
        # TTL strategies based on content stability
        self.cache_ttl = {
            'stable': 24 * 60 * 60,    # 24 hours for stable releases
            'beta': 6 * 60 * 60,       # 6 hours for beta versions  
            'dev': 1 * 60 * 60,        # 1 hour for development branches
            'default': 3 * 60 * 60     # 3 hours default
        }
        
        logger.info("Documentation cache initialized", cache_dir=str(self.cache_dir))
    
    def _get_cache_key(self, framework: str, path: str = "", source_type: str = "docs") -> str:
        """Generate a cache key for the given parameters."""
        key_data = f"{framework}:{path}:{source_type}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _determine_ttl(self, framework: str, version: str, branch: str = "main") -> int:
        """Determine TTL based on framework version and branch."""
        version_lower = version.lower()
        branch_lower = branch.lower()
        
        # Development branches get shorter TTL
        if branch_lower in ['dev', 'develop', 'development', 'master', 'main']:
            if 'dev' in version_lower or 'alpha' in version_lower:
                return self.cache_ttl['dev']
        
        # Beta versions get medium TTL
        if 'beta' in version_lower or 'rc' in version_lower:
            return self.cache_ttl['beta']
        
        # Stable versions get longer TTL
        if 'stable' in version_lower or version_lower == 'latest':
            return self.cache_ttl['stable']
        
        return self.cache_ttl['default']
    
    async def get(
        self, 
        framework: str, 
        path: str = "", 
        source_type: str = "docs"
    ) -> Optional[str]:
        """Get cached documentation content."""
        cache_key = self._get_cache_key(framework, path, source_type)
        
        # Check memory cache first
        if cache_key in self.memory_cache:
            entry = self.memory_cache[cache_key]
            if not self._is_expired(entry):
                # Move to end for LRU (most recently used)
                self.memory_cache.move_to_end(cache_key)
                logger.debug("Cache hit (memory)", framework=framework, path=path)
                return entry.content
            else:
                # Remove expired entry and update index
                del self.memory_cache[cache_key]
                self._remove_from_index(cache_key, entry.framework)
        
        # Check disk cache
        try:
            entry_data = self.cache.get(cache_key)
            if entry_data:
                entry = CacheEntry(**entry_data)
                if not self._is_expired(entry):
                    # Promote to memory cache with LRU eviction
                    self._add_to_memory_cache(cache_key, entry)
                    logger.debug("Cache hit (disk)", framework=framework, path=path)
                    return entry.content
                else:
                    # Remove expired entry
                    del self.cache[cache_key]
        except Exception as e:
            logger.warning("Cache read error", error=str(e), key=cache_key)
        
        logger.debug("Cache miss", framework=framework, path=path)
        return None
    
    async def set(
        self,
        framework: str,
        content: str,
        path: str = "",
        source_type: str = "docs",
        version: str = "latest",
        branch: str = "main"
    ) -> None:
        """Store documentation content in cache."""
        cache_key = self._get_cache_key(framework, path, source_type)
        ttl = self._determine_ttl(framework, version, branch)
        
        entry = CacheEntry(
            content=content,
            cached_at=time.time(),
            ttl=ttl,
            version=version,
            framework=framework,
            source_type=source_type
        )

        # Store in memory cache with LRU eviction
        self._add_to_memory_cache(cache_key, entry)
        
        try:
            entry_dict = {
                'content': entry.content,
                'cached_at': entry.cached_at,
                'ttl': entry.ttl,
                'version': entry.version,
                'framework': entry.framework,
                'source_type': entry.source_type
            }
            self.cache.set(cache_key, entry_dict, expire=ttl)
            
            logger.debug("Content cached", 
                        framework=framework, 
                        path=path, 
                        ttl=ttl,
                        size=len(content))
                        
        except Exception as e:
            logger.error("Cache write error", error=str(e), key=cache_key)
    
    def _is_expired(self, entry: CacheEntry) -> bool:
        """Check if a cache entry has expired."""
        return time.time() - entry.cached_at > entry.ttl

    def _add_to_memory_cache(self, cache_key: str, entry: CacheEntry) -> None:
        """Add entry to memory cache with LRU eviction."""
        # If key exists, remove it first (will be re-added at end)
        if cache_key in self.memory_cache:
            old_entry = self.memory_cache[cache_key]
            del self.memory_cache[cache_key]
            self._remove_from_index(cache_key, old_entry.framework)

        # Evict oldest entries if at capacity
        while len(self.memory_cache) >= MAX_MEMORY_CACHE_ENTRIES:
            oldest_key, oldest_entry = self.memory_cache.popitem(last=False)
            self._remove_from_index(oldest_key, oldest_entry.framework)
            logger.debug("LRU eviction", evicted_key=oldest_key, framework=oldest_entry.framework)

        # Add new entry at end (most recently used)
        self.memory_cache[cache_key] = entry
        self._add_to_index(cache_key, entry.framework)

    def _add_to_index(self, cache_key: str, framework: str) -> None:
        """Add cache key to framework index."""
        if framework not in self._framework_keys:
            self._framework_keys[framework] = set()
        self._framework_keys[framework].add(cache_key)

    def _remove_from_index(self, cache_key: str, framework: str) -> None:
        """Remove cache key from framework index."""
        if framework in self._framework_keys:
            self._framework_keys[framework].discard(cache_key)
            if not self._framework_keys[framework]:
                del self._framework_keys[framework]
    
    async def invalidate(self, framework: str, path: str = "", source_type: str = "docs") -> None:
        """Invalidate specific cached content."""
        cache_key = self._get_cache_key(framework, path, source_type)

        # Remove from memory cache and index
        if cache_key in self.memory_cache:
            del self.memory_cache[cache_key]
            self._remove_from_index(cache_key, framework)
        
        # Remove from disk cache
        try:
            if cache_key in self.cache:
                del self.cache[cache_key]
                logger.debug("Cache invalidated", framework=framework, path=path)
        except Exception as e:
            logger.warning("Cache invalidation error", error=str(e), key=cache_key)
    
    async def clear_framework(self, framework: str) -> int:
        """Clear all cached content for a specific framework."""
        cleared_count = 0

        # Clear from memory cache using index (O(1) lookup instead of O(n) scan)
        if framework in self._framework_keys:
            keys_to_remove = list(self._framework_keys[framework])
            for key in keys_to_remove:
                if key in self.memory_cache:
                    del self.memory_cache[key]
                    cleared_count += 1
            # Clear the index for this framework
            del self._framework_keys[framework]

        # Clear from disk cache (still O(n) but disk cache is TTL-based so less critical)
        try:
            for key in list(self.cache.iterkeys()):
                try:
                    entry_data = self.cache.get(key)
                    if entry_data and entry_data.get('framework') == framework:
                        del self.cache[key]
                        cleared_count += 1
                except Exception:
                    continue
        except Exception as e:
            logger.warning("Cache clear error", error=str(e), framework=framework)

        logger.info("Framework cache cleared", framework=framework, count=cleared_count)
        return cleared_count
    
    async def clear_all(self) -> int:
        """Clear all cached content."""
        # Clear memory cache and index
        memory_count = len(self.memory_cache)
        self.memory_cache.clear()
        self._framework_keys.clear()

        # Clear disk cache
        disk_count = 0
        try:
            disk_count = len(self.cache)
            self.cache.clear()
        except Exception as e:
            logger.error("Disk cache clear error", error=str(e))

        total_count = memory_count + disk_count
        logger.info("All cache cleared", count=total_count)
        return total_count
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            disk_size = len(self.cache)
            disk_volume = self.cache.volume()
        except Exception:
            disk_size = 0
            disk_volume = 0

        return {
            "memory_entries": len(self.memory_cache),
            "memory_max_entries": MAX_MEMORY_CACHE_ENTRIES,
            "memory_utilization_pct": round(len(self.memory_cache) / MAX_MEMORY_CACHE_ENTRIES * 100, 1),
            "indexed_frameworks": len(self._framework_keys),
            "disk_entries": disk_size,
            "disk_volume_bytes": disk_volume,
            "cache_directory": str(self.cache_dir),
            "ttl_strategies": self.cache_ttl
        }
    
    async def get_framework_cache_info(self, framework: str) -> Dict[str, Any]:
        """Get cache information for a specific framework."""
        memory_entries = 0
        disk_entries = 0
        total_size = 0

        # Count memory entries using index (O(1) lookup)
        if framework in self._framework_keys:
            for key in self._framework_keys[framework]:
                if key in self.memory_cache:
                    memory_entries += 1
                    total_size += len(self.memory_cache[key].content)

        # Count disk entries (still O(n) but called infrequently)
        try:
            for key in self.cache.iterkeys():
                try:
                    entry_data = self.cache.get(key)
                    if entry_data and entry_data.get('framework') == framework:
                        disk_entries += 1
                        total_size += len(entry_data.get('content', ''))
                except Exception:
                    continue
        except Exception as e:
            logger.warning("Error counting disk entries", error=str(e))
        
        return {
            "framework": framework,
            "memory_entries": memory_entries,
            "disk_entries": disk_entries,
            "total_size_bytes": total_size,
            "cache_directory": str(self.cache_dir)
        }
    
    async def list_keys(self, framework: str) -> List[str]:
        """List all cache keys for a specific framework."""
        framework_keys_set: Set[str] = set()

        # Check memory cache using index (O(1) lookup)
        if framework in self._framework_keys:
            for key in self._framework_keys[framework]:
                if key in self.memory_cache:
                    entry = self.memory_cache[key]
                    framework_keys_set.add(f"{framework}:{entry.source_type}")

        # Check disk cache (still O(n) but called infrequently)
        try:
            for key in self.cache.iterkeys():
                try:
                    entry_data = self.cache.get(key)
                    if entry_data and entry_data.get('framework') == framework:
                        source_type = entry_data.get('source_type', 'docs')
                        framework_keys_set.add(f"{framework}:{source_type}")
                except Exception:
                    continue
        except Exception as e:
            logger.warning("Error listing cache keys", error=str(e), framework=framework)

        return list(framework_keys_set)
    
    async def get_by_key(self, cache_key: str) -> Optional[str]:
        """Get cached content by reconstructed cache key."""
        try:
            # Parse the cache key format: "framework:source_type"
            parts = cache_key.split(':')
            if len(parts) >= 2:
                framework = parts[0]
                source_type = parts[1]
                # Use empty path since we're looking for general content
                return await self.get(framework, "", source_type)
        except Exception as e:
            logger.warning("Error getting content by key", error=str(e), key=cache_key)
        
        return None
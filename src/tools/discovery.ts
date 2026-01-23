/**
 * Framework Discovery Tools
 *
 * Tools for listing, searching, and getting information about frameworks
 */

import { z } from 'zod';
import { FrameworkRegistryManager } from '@/registry/manager';
import { type FrameworkInfo, type SearchResult, type RegistryStats, FrameworkCategories } from '@/types';
import { getLogger } from '@/utils/logger';

const logger = getLogger('tools:discovery');

// Input schemas for tools
export const ListFrameworksInputSchema = z.object({
  category: z.enum(FrameworkCategories).optional().describe('Filter by category (web, backend, mobile, ai-ml, design, tools, database, devops, testing, state-management)'),
});

export const SearchFrameworksInputSchema = z.object({
  query: z.string().min(1).describe('Search term to match against framework names and features'),
});

export const GetFrameworkInfoInputSchema = z.object({
  framework: z.string().min(1).describe('Framework name (e.g., "react", "nextjs", "tailwindcss")'),
});

export type ListFrameworksInput = z.infer<typeof ListFrameworksInputSchema>;
export type SearchFrameworksInput = z.infer<typeof SearchFrameworksInputSchema>;
export type GetFrameworkInfoInput = z.infer<typeof GetFrameworkInfoInputSchema>;

/**
 * List all available frameworks, optionally filtered by category
 */
export async function listAvailableFrameworks(
  registry: FrameworkRegistryManager,
  input: ListFrameworksInput
): Promise<FrameworkInfo[]> {
  try {
    const frameworks = registry.listFrameworks(input.category);

    logger.info('Listed frameworks', {
      count: frameworks.length,
      category: input.category,
    });

    return frameworks;
  } catch (error) {
    logger.error('Failed to list frameworks', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Search for frameworks by name, keyword, or feature
 */
export async function searchFrameworks(
  registry: FrameworkRegistryManager,
  input: SearchFrameworksInput
): Promise<SearchResult[]> {
  try {
    const query = input.query.trim();
    if (!query) {
      logger.warn('Empty search query provided');
      return [];
    }

    const results = registry.searchFrameworks(query);

    logger.info('Framework search completed', {
      query,
      results: results.length,
    });

    return results;
  } catch (error) {
    logger.error('Framework search failed', {
      query: input.query,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get detailed information about a specific framework
 */
export async function getFrameworkInfo(
  registry: FrameworkRegistryManager,
  input: GetFrameworkInfoInput
): Promise<Record<string, unknown> | null> {
  try {
    const config = registry.getFramework(input.framework);

    if (!config) {
      logger.warn('Framework not found', { framework: input.framework });
      return null;
    }

    // Build detailed info object
    const result: Record<string, unknown> = {
      name: config.name,
      display_name: config.display_name,
      category: config.category,
      type: config.type,
      version: config.version,
      priority: config.priority,
      sources: {
        documentation: {},
        examples: null,
      },
      context_files: config.context_files,
      key_features: config.key_features,
      common_patterns: config.common_patterns,
    };

    // Add sections if available
    if (config.sections) {
      result.sections = config.sections;
    }

    // Add documentation source info
    const docSource = config.sources.documentation;
    const sources = result.sources as Record<string, unknown>;
    const docSources = sources.documentation as Record<string, unknown>;

    if (docSource.github) {
      docSources.github = {
        repo: docSource.github.repo,
        docs_path: docSource.github.docs_path,
        branch: docSource.github.branch,
      };
    }

    if (docSource.website) {
      docSources.website = docSource.website;
    }

    // Add examples source info if available
    if (config.sources.examples) {
      const examplesSource = config.sources.examples;
      sources.examples = {};
      const examplesSources = sources.examples as Record<string, unknown>;

      if (examplesSource.github) {
        examplesSources.github = {
          repo: examplesSource.github.repo,
          docs_path: examplesSource.github.docs_path,
          branch: examplesSource.github.branch,
        };
      }

      if (examplesSource.website) {
        examplesSources.website = examplesSource.website;
      }
    }

    logger.debug('Retrieved framework info', { framework: input.framework });

    return result;
  } catch (error) {
    logger.error('Failed to get framework info', {
      framework: input.framework,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get statistics about the framework registry
 */
export async function getRegistryStats(
  registry: FrameworkRegistryManager
): Promise<RegistryStats> {
  try {
    const totalFrameworks = registry.getFrameworkCount();
    const categories = registry.getCategories();

    // Count frameworks per category
    const categoryCounts: Record<string, number> = {};
    for (const category of categories) {
      const frameworksInCategory = registry.listFrameworks(category);
      categoryCounts[category] = frameworksInCategory.length;
    }

    const result: RegistryStats = {
      total_frameworks: totalFrameworks,
      categories,
      category_counts: categoryCounts,
      is_loaded: registry.isLoaded(),
    };

    logger.debug('Registry stats retrieved', { stats: result });

    return result;
  } catch (error) {
    logger.error('Failed to get registry stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

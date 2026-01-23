/**
 * Documentation Access Tools
 *
 * Tools for fetching and searching framework documentation
 */

import { z } from 'zod';
import { FrameworkRegistryManager } from '@/registry/manager';
import { KVCache } from '@/cache';
import { GitHubProvider } from '@/providers/github';
import { WebsiteProvider } from '@/providers/website';
import { type DocSearchResult } from '@/types';
import { getLogger } from '@/utils/logger';

const logger = getLogger('tools:documentation');

// Input schemas
export const GetFrameworkDocsInputSchema = z.object({
  framework: z.string().min(1).describe('Framework name (e.g., "react", "nextjs", "tailwindcss")'),
  section: z.string().optional().describe('Specific documentation section (e.g., "installation", "configuration", "routing")'),
  use_cache: z.boolean().default(true).describe('Whether to use cached content (default: true)'),
});

export const GetFrameworkExamplesInputSchema = z.object({
  framework: z.string().min(1).describe('Framework name'),
  pattern: z.string().optional().describe('Specific pattern to filter examples (e.g., "components", "routing", "authentication")'),
});

export const SearchDocumentationInputSchema = z.object({
  framework: z.string().min(1).describe('Framework name to search within'),
  query: z.string().min(1).describe('Search query'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of results (default: 10)'),
});

export type GetFrameworkDocsInput = z.infer<typeof GetFrameworkDocsInputSchema>;
export type GetFrameworkExamplesInput = z.infer<typeof GetFrameworkExamplesInputSchema>;
export type SearchDocumentationInput = z.infer<typeof SearchDocumentationInputSchema>;

/**
 * Retrieve comprehensive documentation for a specific framework
 */
export async function getFrameworkDocs(
  registry: FrameworkRegistryManager,
  cache: KVCache,
  githubProvider: GitHubProvider,
  websiteProvider: WebsiteProvider,
  input: GetFrameworkDocsInput
): Promise<string> {
  try {
    const { framework, section, use_cache } = input;

    // Get framework configuration
    const config = registry.getFramework(framework);
    if (!config) {
      const errorMsg = `Framework '${framework}' not found in registry`;
      logger.warn(errorMsg);
      return `Error: ${errorMsg}`;
    }

    // Try cache first
    if (use_cache) {
      const cachedContent = await cache.get(framework, section || '', 'docs');
      if (cachedContent) {
        logger.debug('Documentation retrieved from cache', { framework });
        return cachedContent;
      }
    }

    // Fetch from sources
    const documentationParts: Array<{
      source: string;
      repo?: string;
      url?: string;
      content: string;
    }> = [];

    // Try GitHub source first
    const docSource = config.sources.documentation;
    if (docSource.github) {
      try {
        const githubContent = await githubProvider.fetchDocumentation(
          docSource.github.repo,
          section || docSource.github.docs_path,
          docSource.github.branch
        );

        if (githubContent) {
          documentationParts.push({
            source: 'GitHub',
            repo: docSource.github.repo,
            content: githubContent,
          });
        }
      } catch (error) {
        logger.warn('GitHub fetch failed', {
          framework,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Try website source if GitHub didn't work or as supplement
    if (docSource.website && (!documentationParts.length || section)) {
      try {
        let websiteUrl = docSource.website;
        if (section) {
          // Check if framework has section mappings
          const sectionPath = config.sections?.[section] || section;
          websiteUrl = websiteUrl.endsWith('/')
            ? `${websiteUrl}${sectionPath}`
            : `${websiteUrl}/${sectionPath}`;
        }

        const websiteContent = await websiteProvider.fetchDocumentation(websiteUrl);
        if (websiteContent) {
          documentationParts.push({
            source: 'Website',
            url: websiteUrl,
            content: websiteContent,
          });
        }
      } catch (error) {
        logger.warn('Website fetch failed', {
          framework,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!documentationParts.length) {
      const errorMsg = `No documentation found for ${framework}${section ? ` (section: ${section})` : ''}`;
      logger.warn(errorMsg);
      return `Error: ${errorMsg}`;
    }

    // Format the documentation
    const formattedDocs = formatDocumentation(framework, documentationParts, config);

    // Cache the result
    if (use_cache && formattedDocs) {
      await cache.set(
        framework,
        formattedDocs,
        section || '',
        'docs',
        config.version
      );
    }

    logger.info('Documentation retrieved', {
      framework,
      section,
      sources: documentationParts.length,
    });

    return formattedDocs;
  } catch (error) {
    const errorMsg = `Failed to retrieve documentation for ${input.framework}: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('Documentation retrieval failed', {
      framework: input.framework,
      section: input.section,
      error: error instanceof Error ? error.message : String(error),
    });
    return `Error: ${errorMsg}`;
  }
}

/**
 * Get code examples for specific patterns within a framework
 */
export async function getFrameworkExamples(
  registry: FrameworkRegistryManager,
  cache: KVCache,
  githubProvider: GitHubProvider,
  websiteProvider: WebsiteProvider,
  input: GetFrameworkExamplesInput
): Promise<string> {
  try {
    const { framework, pattern } = input;

    // Get framework configuration
    const config = registry.getFramework(framework);
    if (!config) {
      const errorMsg = `Framework '${framework}' not found in registry`;
      logger.warn(errorMsg);
      return `Error: ${errorMsg}`;
    }

    // Check cache first
    const cacheKeySuffix = `examples:${pattern || 'general'}`;
    const cachedContent = await cache.get(framework, cacheKeySuffix, 'examples');
    if (cachedContent) {
      logger.debug('Examples retrieved from cache', { framework });
      return cachedContent;
    }

    const examplesParts: Array<{
      source: string;
      repo?: string;
      url?: string;
      path?: string;
      content: string;
    }> = [];

    // Try examples source first
    if (config.sources.examples) {
      const examplesSource = config.sources.examples;

      if (examplesSource.github) {
        try {
          const examplesPath = pattern || examplesSource.github.docs_path;
          const githubExamples = await githubProvider.fetchExamples(
            examplesSource.github.repo,
            examplesPath,
            examplesSource.github.branch,
            pattern
          );

          if (githubExamples) {
            examplesParts.push({
              source: 'GitHub Examples',
              repo: examplesSource.github.repo,
              content: githubExamples,
            });
          }
        } catch (error) {
          logger.warn('GitHub examples fetch failed', {
            framework,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (examplesSource.website) {
        try {
          let websiteUrl = examplesSource.website;
          if (pattern) {
            websiteUrl = websiteUrl.endsWith('/')
              ? `${websiteUrl}${pattern}`
              : `${websiteUrl}/${pattern}`;
          }

          const websiteExamples = await websiteProvider.fetchExamples(websiteUrl, pattern);
          if (websiteExamples) {
            examplesParts.push({
              source: 'Website Examples',
              url: websiteUrl,
              content: websiteExamples,
            });
          }
        } catch (error) {
          logger.warn('Website examples fetch failed', {
            framework,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Fallback to main documentation source
    if (!examplesParts.length) {
      const docSource = config.sources.documentation;

      if (docSource.github) {
        const examplePaths = ['examples', 'docs/examples', 'samples', 'demos'];
        const pathsToTry = pattern
          ? examplePaths.map((p) => `${p}/${pattern}`)
          : examplePaths;

        for (const examplePath of pathsToTry) {
          try {
            const githubExamples = await githubProvider.fetchExamples(
              docSource.github.repo,
              examplePath,
              docSource.github.branch,
              pattern
            );

            if (githubExamples) {
              examplesParts.push({
                source: 'GitHub Documentation',
                repo: docSource.github.repo,
                path: examplePath,
                content: githubExamples,
              });
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }

    // Try to extract examples from main documentation as last resort
    if (!examplesParts.length) {
      const docContent = await getFrameworkDocs(
        registry,
        cache,
        githubProvider,
        websiteProvider,
        { framework, section: pattern, use_cache: true }
      );

      if (docContent && !docContent.startsWith('Error:')) {
        const extractedExamples = extractExamplesFromDocs(docContent, pattern);
        if (extractedExamples) {
          examplesParts.push({
            source: 'Extracted from Documentation',
            content: extractedExamples,
          });
        }
      }
    }

    if (!examplesParts.length) {
      const errorMsg = `No examples found for ${framework}${pattern ? ` (pattern: ${pattern})` : ''}`;
      logger.warn(errorMsg);
      return `Error: ${errorMsg}`;
    }

    // Format the examples
    const formattedExamples = formatExamples(framework, examplesParts, pattern, config);

    // Cache the result
    if (formattedExamples) {
      await cache.set(framework, formattedExamples, cacheKeySuffix, 'examples', config.version);
    }

    logger.info('Examples retrieved', {
      framework,
      pattern,
      sources: examplesParts.length,
    });

    return formattedExamples;
  } catch (error) {
    const errorMsg = `Failed to retrieve examples for ${input.framework}: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('Examples retrieval failed', {
      framework: input.framework,
      pattern: input.pattern,
      error: error instanceof Error ? error.message : String(error),
    });
    return `Error: ${errorMsg}`;
  }
}

/**
 * Search within a framework's documentation
 */
export async function searchDocumentation(
  registry: FrameworkRegistryManager,
  cache: KVCache,
  githubProvider: GitHubProvider,
  websiteProvider: WebsiteProvider,
  input: SearchDocumentationInput
): Promise<DocSearchResult[]> {
  try {
    const { framework, query, limit } = input;

    // First try: Search cached documentation
    let docContent = await cache.get(framework, '', 'docs');

    if (docContent) {
      const results = searchTextContent(docContent, query, limit);
      if (results.length > 0) {
        logger.info('Documentation search completed using cache', {
          framework,
          query,
          results: results.length,
        });
        return results;
      }
    }

    // Second try: Fetch fresh documentation and search within it
    const inferredSection = inferSectionFromQuery(query);

    const freshDocs = await getFrameworkDocs(registry, cache, githubProvider, websiteProvider, {
      framework,
      section: inferredSection,
      use_cache: false,
    });

    if (freshDocs && !freshDocs.startsWith('Error:')) {
      const results = searchTextContent(freshDocs, query, limit);
      if (results.length > 0) {
        logger.info('Documentation search completed using fresh docs', {
          framework,
          query,
          results: results.length,
        });
        return results;
      }
    }

    // Third try: Search examples cache
    const examplesContent = await cache.get(framework, '', 'examples');
    if (examplesContent) {
      const results = searchTextContent(examplesContent, query, limit);
      if (results.length > 0) {
        logger.info('Documentation search found results in cached examples', {
          framework,
          query,
        });
        return results;
      }
    }

    logger.warn('No search results found', { framework, query });
    return [];
  } catch (error) {
    logger.error('Documentation search failed', {
      framework: input.framework,
      query: input.query,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// Helper functions

function formatDocumentation(
  framework: string,
  parts: Array<{ source: string; repo?: string; url?: string; content: string }>,
  config: { display_name: string; category: string; type: string; version: string; key_features: string[]; common_patterns: string[] }
): string {
  const formattedParts: string[] = [];

  // Add header
  formattedParts.push(`# ${config.display_name} Documentation`);
  formattedParts.push(`**Category:** ${config.category} | **Type:** ${config.type} | **Version:** ${config.version}`);
  formattedParts.push('');

  // Add key features
  if (config.key_features.length > 0) {
    formattedParts.push('## Key Features');
    for (const feature of config.key_features) {
      formattedParts.push(`- ${feature}`);
    }
    formattedParts.push('');
  }

  // Add documentation content
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (parts.length > 1) {
      formattedParts.push(`## Documentation Source ${i + 1}: ${part.source}`);
      if (part.repo) {
        formattedParts.push(`**Repository:** ${part.repo}`);
      }
      if (part.url) {
        formattedParts.push(`**URL:** ${part.url}`);
      }
      formattedParts.push('');
    }

    formattedParts.push(part.content);
    formattedParts.push('');
  }

  // Add common patterns
  if (config.common_patterns.length > 0) {
    formattedParts.push('## Common Patterns');
    for (const pattern of config.common_patterns) {
      formattedParts.push(`- ${pattern}`);
    }
    formattedParts.push('');
  }

  return formattedParts.join('\n');
}

function formatExamples(
  framework: string,
  parts: Array<{ source: string; repo?: string; url?: string; path?: string; content: string }>,
  pattern: string | undefined,
  config: { display_name: string }
): string {
  const formattedParts: string[] = [];

  // Add header
  let title = `${config.display_name} Examples`;
  if (pattern) {
    title += ` - ${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`;
  }
  formattedParts.push(`# ${title}`);
  formattedParts.push('');

  // Add examples content
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (parts.length > 1) {
      formattedParts.push(`## Examples Source ${i + 1}: ${part.source}`);
      if (part.repo) {
        formattedParts.push(`**Repository:** ${part.repo}`);
      }
      if (part.url) {
        formattedParts.push(`**URL:** ${part.url}`);
      }
      if (part.path) {
        formattedParts.push(`**Path:** ${part.path}`);
      }
      formattedParts.push('');
    }

    formattedParts.push(part.content);
    formattedParts.push('');
  }

  return formattedParts.join('\n');
}

function extractExamplesFromDocs(docContent: string, pattern?: string): string | null {
  if (!docContent) return null;

  // Find code blocks
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
  const matches = [...docContent.matchAll(codeBlockRegex)];

  if (!matches.length) return null;

  const examples: string[] = [];
  let exampleIndex = 0;

  for (const match of matches) {
    const codeBlock = match[1].trim();

    // Skip very short code blocks
    if (codeBlock.length < 20) continue;

    // If pattern is specified, filter relevant examples
    if (pattern) {
      const patternLower = pattern.toLowerCase();
      const codeLower = codeBlock.toLowerCase();

      if (
        !codeLower.includes(patternLower) &&
        !codeLower.includes(patternLower.replace('-', '')) &&
        !codeLower.includes(patternLower.replace('_', ''))
      ) {
        continue;
      }
    }

    exampleIndex++;
    examples.push(`### Example ${exampleIndex}\n\n\`\`\`\n${codeBlock}\n\`\`\`\n`);
  }

  if (!examples.length) return null;

  return '## Code Examples\n\n' + examples.join('\n');
}

function searchTextContent(content: string, query: string, limit: number): DocSearchResult[] {
  if (!content || !query) return [];

  const queryLower = query.toLowerCase();
  const lines = content.split('\n');
  const results: DocSearchResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (queryLower.split(/\s+/).some((word) => lines[i].toLowerCase().includes(word))) {
      // Get context around the match
      const startIdx = Math.max(0, i - 2);
      const endIdx = Math.min(lines.length, i + 3);

      const contextLines = lines.slice(startIdx, endIdx);
      const context = contextLines.join('\n');

      results.push({
        line_number: i + 1,
        content: context,
        relevance: calculateRelevance(lines[i], query),
      });

      if (results.length >= limit) break;
    }
  }

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);

  return results.slice(0, limit);
}

function calculateRelevance(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match gets highest score
  if (queryLower === textLower.trim()) {
    return 100;
  }

  // Count occurrences
  const occurrences = (textLower.match(new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (occurrences === 0) {
    return 0;
  }

  // Base score from occurrences
  let score = occurrences * 10;

  // Boost for word boundaries
  if (new RegExp(`\\b${queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(textLower)) {
    score += 20;
  }

  // Boost for beginning of line
  if (textLower.trim().startsWith(queryLower)) {
    score += 15;
  }

  // Penalty for very long lines
  if (text.length > 200) {
    score *= 0.8;
  }

  return Math.min(score, 100);
}

function inferSectionFromQuery(query: string): string | undefined {
  const queryLower = query.toLowerCase();

  const sectionMappings: Record<string, string> = {
    'app router': 'app-router',
    router: 'routing',
    routing: 'routing',
    installation: 'installation',
    install: 'installation',
    setup: 'installation',
    'getting started': 'getting-started',
    start: 'getting-started',
    config: 'configuration',
    configuration: 'configuration',
    api: 'api',
    component: 'components',
    components: 'components',
    hook: 'hooks',
    hooks: 'hooks',
    auth: 'authentication',
    authentication: 'authentication',
    deploy: 'deployment',
    deployment: 'deployment',
    testing: 'testing',
    test: 'testing',
    styling: 'styling',
    css: 'styling',
    'dark mode': 'theming',
    theme: 'theming',
    theming: 'theming',
  };

  for (const [keyword, section] of Object.entries(sectionMappings)) {
    if (queryLower.includes(keyword)) {
      return section;
    }
  }

  return undefined;
}

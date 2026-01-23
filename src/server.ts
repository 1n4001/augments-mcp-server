/**
 * Augments MCP Server
 *
 * A comprehensive MCP server that provides real-time access to framework documentation
 * and context to enhance Claude Code's ability to generate accurate, up-to-date code.
 */

import { z } from 'zod';
import { getRegistry, FrameworkRegistryManager } from '@/registry/manager';
import { getCache, KVCache } from '@/cache';
import { getGitHubProvider, GitHubProvider } from '@/providers/github';
import { getWebsiteProvider, WebsiteProvider } from '@/providers/website';
import {
  // Discovery tools
  listAvailableFrameworks,
  searchFrameworks,
  getFrameworkInfo,
  getRegistryStats,
  // Documentation tools
  getFrameworkDocs,
  getFrameworkExamples,
  searchDocumentation,
  // Context tools
  getFrameworkContext,
  analyzeCodeCompatibility,
  // Cache management tools
  checkFrameworkUpdates,
  refreshFrameworkCache,
  getCacheStats,
} from '@/tools';
import { FrameworkCategories } from '@/types';
import { getLogger } from '@/utils/logger';

const logger = getLogger('mcp-server');

// Server version
export const SERVER_VERSION = '3.0.0';

// Tool definition interface
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

/**
 * Augments MCP Server class
 */
export class AugmentsMcpServer {
  private tools: Map<string, ToolDefinition> = new Map();
  private registry!: FrameworkRegistryManager;
  private cache!: KVCache;
  private githubProvider!: GitHubProvider;
  private websiteProvider!: WebsiteProvider;
  private initialized = false;

  /**
   * Initialize the server and register all tools
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing Augments MCP Server', { version: SERVER_VERSION });

    // Initialize dependencies
    this.registry = await getRegistry();
    this.cache = getCache();
    this.githubProvider = getGitHubProvider();
    this.websiteProvider = getWebsiteProvider();

    logger.info('Dependencies initialized', {
      frameworks: this.registry.getFrameworkCount(),
      categories: this.registry.getCategories(),
    });

    // Register all tools
    this.registerTools();

    this.initialized = true;
    logger.info('MCP Server initialized successfully', {
      tools: this.tools.size,
      version: SERVER_VERSION,
    });
  }

  /**
   * Register all MCP tools
   */
  private registerTools(): void {
    // ==================== Discovery Tools ====================

    this.registerTool({
      name: 'list_available_frameworks',
      description: 'List all available frameworks, optionally filtered by category. Returns framework information including name, category, and description.',
      inputSchema: z.object({
        category: z.enum(FrameworkCategories).optional(),
      }),
      handler: async (args: unknown) => {
        const input = args as { category?: (typeof FrameworkCategories)[number] };
        return listAvailableFrameworks(this.registry, input);
      },
    });

    this.registerTool({
      name: 'search_frameworks',
      description: 'Search for frameworks by name, keyword, or feature. Returns a ranked list of matching frameworks with relevance scores.',
      inputSchema: z.object({
        query: z.string().min(1),
      }),
      handler: async (args: unknown) => {
        const input = args as { query: string };
        return searchFrameworks(this.registry, input);
      },
    });

    this.registerTool({
      name: 'get_framework_info',
      description: 'Get detailed information about a specific framework including sources, features, and patterns.',
      inputSchema: z.object({
        framework: z.string().min(1),
      }),
      handler: async (args: unknown) => {
        const input = args as { framework: string };
        return getFrameworkInfo(this.registry, input);
      },
    });

    this.registerTool({
      name: 'get_registry_stats',
      description: 'Get statistics about the framework registry including total frameworks and categories.',
      inputSchema: z.object({}),
      handler: async () => {
        return getRegistryStats(this.registry);
      },
    });

    // ==================== Documentation Tools ====================

    this.registerTool({
      name: 'get_framework_docs',
      description: 'Retrieve comprehensive documentation for a specific framework. Fetches from GitHub or official documentation.',
      inputSchema: z.object({
        framework: z.string().min(1),
        section: z.string().optional(),
        use_cache: z.boolean().default(true),
      }),
      handler: async (args: unknown) => {
        const input = args as { framework: string; section?: string; use_cache?: boolean };
        return getFrameworkDocs(this.registry, this.cache, this.githubProvider, this.websiteProvider, {
          ...input,
          use_cache: input.use_cache ?? true,
        });
      },
    });

    this.registerTool({
      name: 'get_framework_examples',
      description: 'Get code examples for specific patterns within a framework.',
      inputSchema: z.object({
        framework: z.string().min(1),
        pattern: z.string().optional(),
      }),
      handler: async (args: unknown) => {
        const input = args as { framework: string; pattern?: string };
        return getFrameworkExamples(this.registry, this.cache, this.githubProvider, this.websiteProvider, input);
      },
    });

    this.registerTool({
      name: 'search_documentation',
      description: "Search within a framework's documentation for specific topics or keywords.",
      inputSchema: z.object({
        framework: z.string().min(1),
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      }),
      handler: async (args: unknown) => {
        const input = args as { framework: string; query: string; limit?: number };
        return searchDocumentation(this.registry, this.cache, this.githubProvider, this.websiteProvider, {
          ...input,
          limit: input.limit ?? 10,
        });
      },
    });

    // ==================== Context Enhancement Tools ====================

    this.registerTool({
      name: 'get_framework_context',
      description: 'Get relevant context for multiple frameworks based on the development task. Combines documentation, patterns, and best practices.',
      inputSchema: z.object({
        frameworks: z.array(z.string().min(1)).min(1),
        task_description: z.string().min(1),
      }),
      handler: async (args: unknown) => {
        const input = args as { frameworks: string[]; task_description: string };
        return getFrameworkContext(this.registry, this.cache, input);
      },
    });

    this.registerTool({
      name: 'analyze_code_compatibility',
      description: 'Analyze code for framework compatibility and suggest improvements.',
      inputSchema: z.object({
        code: z.string().min(1),
        frameworks: z.array(z.string().min(1)).min(1),
      }),
      handler: async (args: unknown) => {
        const input = args as { code: string; frameworks: string[] };
        return analyzeCodeCompatibility(this.registry, input);
      },
    });

    // ==================== Cache Management Tools ====================

    this.registerTool({
      name: 'check_framework_updates',
      description: 'Check if framework documentation has been updated since last cache.',
      inputSchema: z.object({
        framework: z.string().min(1),
      }),
      handler: async (args: unknown) => {
        const input = args as { framework: string };
        return checkFrameworkUpdates(this.registry, this.cache, this.githubProvider, input);
      },
    });

    this.registerTool({
      name: 'refresh_framework_cache',
      description: 'Refresh cached documentation for frameworks.',
      inputSchema: z.object({
        framework: z.string().optional(),
        force: z.boolean().default(false),
      }),
      handler: async (args: unknown) => {
        const input = args as { framework?: string; force?: boolean };
        return refreshFrameworkCache(this.registry, this.cache, this.githubProvider, this.websiteProvider, {
          ...input,
          force: input.force ?? false,
        });
      },
    });

    this.registerTool({
      name: 'get_cache_stats',
      description: 'Get detailed cache statistics and performance metrics.',
      inputSchema: z.object({}),
      handler: async () => {
        return getCacheStats(this.registry, this.cache);
      },
    });

    logger.info('Tools registered', { count: this.tools.size });
  }

  /**
   * Register a single tool
   */
  private registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    logger.debug('Tool registered', { name: tool.name });
  }

  /**
   * Get list of all registered tools (for MCP tools/list)
   */
  getToolsList(): Array<{
    name: string;
    description: string;
    inputSchema: unknown;
  }> {
    const toolsList: Array<{
      name: string;
      description: string;
      inputSchema: unknown;
    }> = [];

    for (const tool of this.tools.values()) {
      toolsList.push({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      });
    }

    return toolsList;
  }

  /**
   * Call a tool by name (for MCP tools/call)
   */
  async callTool(name: string, args: unknown): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Error: Unknown tool '${name}'` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args);
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      const isError = typeof result === 'string' && result.startsWith('Error:');

      return {
        content: [{ type: 'text', text }],
        isError,
      };
    } catch (error) {
      logger.error('Tool execution failed', {
        tool: name,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
}

/**
 * Convert Zod schema to JSON Schema (simplified)
 */
function zodToJsonSchema(schema: z.ZodType<unknown>): unknown {
  // This is a simplified conversion - for production, use a proper library like zod-to-json-schema
  // Cast to any to access internal Zod properties
  const def = schema._def as any;
  const typeName = def.typeName as string;

  if (typeName === 'ZodObject') {
    const shape = def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodType<unknown>;
      properties[key] = zodToJsonSchema(zodValue);

      if (!zodValue.isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (typeName === 'ZodString') {
    return { type: 'string' };
  }

  if (typeName === 'ZodNumber') {
    return { type: 'number' };
  }

  if (typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }

  if (typeName === 'ZodArray') {
    return {
      type: 'array',
      items: zodToJsonSchema(def.type),
    };
  }

  if (typeName === 'ZodOptional') {
    return zodToJsonSchema(def.innerType);
  }

  if (typeName === 'ZodDefault') {
    return zodToJsonSchema(def.innerType);
  }

  if (typeName === 'ZodEnum') {
    return {
      type: 'string',
      enum: def.values,
    };
  }

  return { type: 'string' };
}

// Singleton instance for serverless environments
let serverInstance: AugmentsMcpServer | null = null;

export async function getServer(): Promise<AugmentsMcpServer> {
  if (!serverInstance) {
    serverInstance = new AugmentsMcpServer();
    await serverInstance.initialize();
  }
  return serverInstance;
}

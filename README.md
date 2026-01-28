![Augments MCP Server](https://raw.githubusercontent.com/augmnt/augments-mcp-server/main/banner.png)

A next-generation framework documentation provider for Claude Code via Model Context Protocol (MCP). Provides **query-focused API context** by extracting TypeScript definitions directly from npm packages - delivering minimal, accurate information instead of dumping entire documentation pages.

mcp-name: dev.augments/mcp

## What's New in v4

**Version 4.0** introduces a fundamentally new approach to framework documentation:

| Old Approach (v3) | New Approach (v4) |
|-------------------|-------------------|
| Fetch entire documentation pages | Extract specific API signatures |
| ~50KB of context per query | ~500 tokens of precise context |
| Manual framework registry (85) | Auto-discovery via npm (millions) |
| No version support | Version-specific queries |
| Prose documentation | TypeScript definitions (source of truth) |

### Why TypeScript Definitions?

Documentation can be outdated or wrong. **TypeScript definitions can't lie** - they're compiled and must match the actual API. When you ask "what are the params for useEffect?", v4 gives you:

```typescript
function useEffect(effect: EffectCallback, deps?: DependencyList): void
```

Not 5KB of tutorial explaining what effects are.

## Quick Start

### Option 1: Hosted MCP Server (Recommended)

```bash
# Add the hosted MCP server
claude mcp add --transport http augments https://mcp.augments.dev/mcp

# Verify configuration
claude mcp list
```

### Option 2: Using Cursor

```json
{
  "mcpServers": {
    "augments": {
      "transport": "http",
      "url": "https://mcp.augments.dev/mcp"
    }
  }
}
```

### Using the v4 Tools

```
# Get API signature with minimal context
@augments get_api_context query="useEffect cleanup" framework="react" version="19"

# Search for APIs across frameworks
@augments search_apis query="state management hook"

# Get version information
@augments get_version_info framework="react" fromVersion="18" toVersion="19"
```

## MCP Tools

### v4 API Context Tools (New)

| Tool | Description |
|------|-------------|
| `get_api_context` | Query-focused TypeScript extraction - returns minimal API signatures |
| `search_apis` | Search for APIs across frameworks by keyword |
| `get_version_info` | Get npm version info, compare versions, detect breaking changes |

### Framework Discovery

| Tool | Description |
|------|-------------|
| `list_available_frameworks` | List frameworks by category |
| `search_frameworks` | Search with relevance scoring |
| `get_framework_info` | Get detailed framework config |
| `get_registry_stats` | Registry statistics |

### Documentation Access

| Tool | Description |
|------|-------------|
| `get_framework_docs` | Fetch comprehensive documentation |
| `get_framework_examples` | Get code examples |
| `search_documentation` | Search within docs |

### Context Enhancement

| Tool | Description |
|------|-------------|
| `get_framework_context` | Multi-framework context |
| `analyze_code_compatibility` | Code compatibility check |

### Cache Management

| Tool | Description |
|------|-------------|
| `check_framework_updates` | Check for updates |
| `refresh_framework_cache` | Refresh cache |
| `get_cache_stats` | Cache statistics |

## v4 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Query: "useEffect cleanup react 19"                    │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Query Parser                                           │
│  • Identify framework: react                            │
│  • Identify concept: useEffect                          │
│  • Identify version: 19                                 │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Type Fetcher                                           │
│  • Fetch @types/react@19 from npm CDN                   │
│  • Handle barrel exports (sub-module fetching)          │
│  • Cache with TTL                                       │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Type Parser (TypeScript Compiler API)                  │
│  • Extract useEffect signature                          │
│  • Resolve related types (EffectCallback, etc.)         │
│  • Find overloads                                       │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Return ~500 tokens:                                    │
│  {                                                      │
│    api: { name, signature, parameters, returnType },    │
│    relatedTypes: { EffectCallback: "...", ... },        │
│    examples: [...],                                     │
│    version: "19.0.4"                                    │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
```

### Source Structure

```
src/
├── core/                    # v4 Core modules
│   ├── query-parser.ts      # Parse natural language → framework + concept
│   ├── type-fetcher.ts      # Fetch .d.ts from npm/unpkg/jsdelivr
│   ├── type-parser.ts       # Parse TypeScript, extract signatures
│   ├── example-extractor.ts # Fetch code examples from GitHub
│   └── version-registry.ts  # npm registry integration
├── tools/
│   ├── v4/                  # v4 API context tools
│   │   ├── get-api-context.ts
│   │   ├── search-apis.ts
│   │   └── get-version-info.ts
│   ├── discovery.ts         # Framework discovery tools
│   ├── documentation.ts     # Documentation tools
│   ├── context.ts           # Context enhancement tools
│   └── cache-management.ts  # Cache management
├── registry/                # Framework registry (v3 compatibility)
├── providers/               # Documentation providers
├── cache/                   # Caching layer
└── server.ts                # MCP server setup (15 tools)
```

## Supported Frameworks

### v4 Auto-Discovery
Any npm package with TypeScript types can be queried - no manual configuration needed:
- Bundled types (`"types": "./dist/index.d.ts"` in package.json)
- DefinitelyTyped (`@types/package-name`)

### Tested & Optimized
| Framework | Package | Features |
|-----------|---------|----------|
| React | `react`, `@types/react` | All hooks, components, types |
| TanStack Query | `@tanstack/react-query` | useQuery, useMutation, etc. |
| React Hook Form | `react-hook-form` | useForm, useController, etc. |
| Supabase | `@supabase/supabase-js` | createClient, auth, storage |
| Express | `express` | Router, middleware |
| Mongoose | `mongoose` | Schema, Model |
| Next.js | `next` | App Router, Server Components |
| Vue 3 | `vue` | Composition API |
| Zod | `zod` | Schema validation |
| tRPC | `@trpc/client` | Type-safe APIs |
| Prisma | `@prisma/client` | Database ORM |

### Legacy Framework Registry
85+ frameworks with manual documentation sources are still available via v3 tools.

## Self-Hosting

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/augmnt/augments-mcp-server&env=GITHUB_TOKEN,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Optional | GitHub token for higher API rate limits |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis URL for caching |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis token |

### Local Development

```bash
# Clone and install
git clone https://github.com/augmnt/augments-mcp-server.git
cd augments-mcp-server
npm install

# Run development server
npm run dev

# Build
npm run build

# Type check
npm run type-check
```

## How v4 Compares to Context7

| Aspect | Context7 | Augments v4 |
|--------|----------|-------------|
| **Source** | Parsed prose docs | TypeScript definitions |
| **Accuracy** | Docs can be wrong | Types must be correct |
| **Context size** | ~5-10KB chunks | ~500 tokens |
| **LLM cost** | Pays for ranking | Zero - pure data retrieval |
| **Freshness** | Crawl schedule | On-demand from npm |
| **Coverage** | Manual submission | Any npm package with types |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/augmnt/augments-mcp-server/issues)
- [GitHub Discussions](https://github.com/augmnt/augments-mcp-server/discussions)

---

**Built for the Claude Code ecosystem** | **Version 4.0.0**

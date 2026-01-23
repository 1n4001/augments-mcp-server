![Augments MCP Server](https://raw.githubusercontent.com/augmnt/augments-mcp-server/main/banner.png)

A comprehensive framework documentation provider for Claude Code via Model Context Protocol (MCP). Provides real-time access to framework documentation, context-aware assistance, and intelligent caching to enhance development workflows.

mcp-name: dev.augments/mcp

## 🚀 Overview

Augments MCP Server is a sophisticated documentation retrieval system that integrates with Claude Code to provide comprehensive, up-to-date framework information. It features advanced caching strategies, multi-source documentation aggregation, and intelligent context enhancement for modern development workflows.

**Version 3.0** - Now available in TypeScript for Vercel deployment with enhanced performance and serverless optimization.

## ✨ Key Features

### 🎯 **Comprehensive Framework Support**
- **85+ Frameworks**: Web, Backend, Mobile, AI/ML, Design, DevOps, and Tools
- **Multi-Source Documentation**: GitHub repositories, official websites, and examples
- **Real-Time Updates**: Automatic documentation refresh with smart caching
- **Intelligent Prioritization**: Framework importance-based ranking

### ⚡ **Advanced Caching System**
- **TTL-Based Strategies**: Different cache durations for stable/beta/dev versions
- **Serverless Optimized**: Upstash Redis for Vercel edge performance
- **Smart Invalidation**: Automatic cache refresh based on source updates
- **Cache Analytics**: Detailed statistics and performance monitoring

### 🧠 **Context Enhancement**
- **Multi-Framework Context**: Combine documentation from multiple frameworks
- **Code Compatibility Analysis**: Detect framework compatibility issues
- **Pattern Recognition**: Common usage patterns and best practices
- **Task-Specific Guidance**: Context tailored to development tasks

### 🔧 **Developer Experience**
- **12 MCP Tools**: Comprehensive documentation lifecycle coverage
- **Structured Responses**: Clean, validated JSON outputs
- **Error Resilience**: Graceful degradation with detailed error messages
- **Edge Performance**: Optimized for serverless environments

## 🛠️ Quick Start

### **Option 1: Hosted MCP Server (Recommended)**

Connect directly to our hosted server - no installation required!

#### **Using Claude Code CLI**

```bash
# Add the hosted MCP server
claude mcp add --transport http augments https://mcp.augments.dev/mcp

# Verify the server is configured
claude mcp list
```

#### **Using Cursor**

Add to your MCP configuration:

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

#### **Using the Server**

Once configured, access framework documentation directly:

```
@augments list frameworks in the web category
@augments get documentation for tailwindcss
@augments get context for nextjs, tailwindcss, and react
```

### **Option 2: Self-Host on Vercel (TypeScript v3.0)**

Deploy your own instance to Vercel for customization or private use.

#### **Prerequisites**
- Node.js 18+
- Vercel account
- (Optional) Upstash Redis account for caching

#### **Deploy to Vercel**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/augmentscode/augments-mcp-server&env=GITHUB_TOKEN,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN)

Or deploy manually:

```bash
# Clone the repository
git clone https://github.com/augmentscode/augments-mcp-server.git
cd augments-mcp-server

# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Vercel
vercel
```

#### **Environment Variables**

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Optional | GitHub token for higher API rate limits |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis URL for caching |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis token |
| `RATE_LIMIT_ENABLED` | Optional | Enable rate limiting (default: true) |
| `RATE_LIMIT_REQUESTS` | Optional | Requests per window (default: 100) |

### **Option 3: Local Development (Python Legacy)**

For local development or offline use with Python:

```bash
# Clone the repository
git clone https://github.com/augmentscode/augments-mcp-server.git
cd augments-mcp-server

# Install with uv (recommended)
uv sync

# Run the server
uv run augments-mcp-server
```

See [Python Installation Guide](docs/python-installation.md) for detailed setup.

## 🔧 MCP Tools

### **Framework Discovery**

| Tool | Description |
|------|-------------|
| `list_available_frameworks` | List frameworks by category |
| `search_frameworks` | Search with relevance scoring |
| `get_framework_info` | Get detailed framework config |
| `get_registry_stats` | Registry statistics |

### **Documentation Access**

| Tool | Description |
|------|-------------|
| `get_framework_docs` | Fetch comprehensive documentation |
| `get_framework_examples` | Get code examples |
| `search_documentation` | Search within docs |

### **Context Enhancement**

| Tool | Description |
|------|-------------|
| `get_framework_context` | Multi-framework context |
| `analyze_code_compatibility` | Code compatibility check |

### **Cache Management**

| Tool | Description |
|------|-------------|
| `check_framework_updates` | Check for updates |
| `refresh_framework_cache` | Refresh cache |
| `get_cache_stats` | Cache statistics |

## 🏗️ Architecture

### **TypeScript (v3.0) - Vercel Deployment**

```
src/
├── config/              # Environment configuration
├── registry/            # Framework registry management
│   ├── manager.ts      # Registry manager with JSON loading
│   └── models.ts       # Zod schemas for validation
├── cache/              # Serverless cache layer
│   ├── kv-cache.ts     # Upstash Redis cache
│   └── strategies.ts   # TTL strategies
├── providers/          # Documentation providers
│   ├── github.ts       # GitHub docs provider
│   └── website.ts      # Website scraper
├── tools/              # MCP tool implementations
│   ├── discovery.ts    # Framework discovery tools
│   ├── documentation.ts # Documentation tools
│   ├── context.ts      # Context enhancement tools
│   └── cache-management.ts # Cache management
├── middleware/         # Request middleware
│   ├── rate-limit.ts   # Upstash rate limiting
│   └── auth.ts         # API key validation (ready for premium)
└── server.ts           # McpServer setup

app/api/mcp/route.ts    # Next.js API route for MCP
frameworks/             # JSON framework configurations
```

### **Framework Configuration Schema**

```json
{
  "name": "nextjs",
  "display_name": "Next.js",
  "category": "web",
  "type": "react-framework",
  "version": "latest",
  "sources": {
    "documentation": {
      "github": {
        "repo": "vercel/next.js",
        "docs_path": "docs",
        "branch": "canary"
      },
      "website": "https://nextjs.org/docs"
    },
    "examples": {
      "github": {
        "repo": "vercel/next.js",
        "docs_path": "examples",
        "branch": "canary"
      }
    }
  },
  "context_files": ["docs/getting-started/installation.mdx"],
  "key_features": ["app-router", "server-components", "api-routes"],
  "common_patterns": ["file-based-routing", "data-fetching"],
  "priority": 90
}
```

## 📚 Supported Frameworks

**85+ frameworks** across 10 categories:

| Category | Count | Examples |
|----------|-------|----------|
| Web | 25 | React, Next.js, Vue.js, Tailwind CSS, Angular |
| Backend | 18 | FastAPI, Express, NestJS, Django, Flask |
| AI/ML | 14 | PyTorch, TensorFlow, LangChain, Hugging Face |
| Mobile | 6 | React Native, Flutter, Expo |
| Database | 5 | Prisma, TypeORM, Mongoose |
| State Management | 4 | Redux, Zustand, MobX |
| Testing | 5 | Jest, Playwright, Cypress, pytest |
| DevOps | 4 | Docker, Kubernetes, Terraform |
| Tools | 7 | Vite, Webpack, ESLint, Prettier |
| Design | 1 | shadcn/ui |

## 🔄 Adding New Frameworks

Create a JSON file in the appropriate category directory:

```bash
frameworks/web/my-framework.json
```

The server automatically detects new framework configurations.

## 🧪 Development

### **TypeScript (v3.0)**

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build for production
npm run build
```

### **Python (Legacy)**

```bash
# Install with uv
uv sync

# Run tests
uv run pytest

# Run with auto-reload
uv run fastmcp dev src/augments_mcp/server.py
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🆘 Support

- 📖 **Documentation**: [augments.dev/docs](https://augments.dev/docs)
- 🐛 **Issues**: [GitHub Issues](https://github.com/augmentscode/augments-mcp-server/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/augmentscode/augments-mcp-server/discussions)

---

**Built with ❤️ for the Claude Code ecosystem**

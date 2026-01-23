import { SERVER_VERSION } from '@/server';

export default function Home() {
  return (
    <main style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <h1>Augments MCP Server</h1>
      <p>Version: {SERVER_VERSION}</p>

      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/mcp</code> - Health check and server info</li>
        <li><code>POST /api/mcp</code> - MCP protocol endpoint</li>
      </ul>

      <h2>Documentation</h2>
      <p>
        Visit <a href="https://augments.dev/docs">augments.dev/docs</a> for full documentation.
      </p>

      <h2>Quick Start</h2>
      <pre style={{
        background: '#f5f5f5',
        padding: '1rem',
        borderRadius: '4px',
        overflow: 'auto'
      }}>
{`# Add to Claude Code
claude mcp add augments https://mcp.augments.dev/mcp

# Or configure in MCP settings
{
  "mcpServers": {
    "augments": {
      "url": "https://mcp.augments.dev/mcp"
    }
  }
}`}
      </pre>

      <h2>Available Tools</h2>
      <ul>
        <li><strong>list_available_frameworks</strong> - List frameworks by category</li>
        <li><strong>search_frameworks</strong> - Search for frameworks</li>
        <li><strong>get_framework_info</strong> - Get framework details</li>
        <li><strong>get_framework_docs</strong> - Fetch documentation</li>
        <li><strong>get_framework_examples</strong> - Get code examples</li>
        <li><strong>search_documentation</strong> - Search within docs</li>
        <li><strong>get_framework_context</strong> - Multi-framework context</li>
        <li><strong>analyze_code_compatibility</strong> - Code compatibility check</li>
        <li><strong>check_framework_updates</strong> - Check for updates</li>
        <li><strong>refresh_framework_cache</strong> - Refresh cache</li>
        <li><strong>get_cache_stats</strong> - Cache statistics</li>
        <li><strong>get_registry_stats</strong> - Registry statistics</li>
      </ul>
    </main>
  );
}

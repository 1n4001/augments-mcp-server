/**
 * MCP API Route for Vercel
 *
 * Handles HTTP requests for the MCP server.
 * Uses direct JSON-RPC handling for serverless compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServer, SERVER_VERSION } from '@/server';
import { checkRateLimit, getRateLimitHeaders } from '@/middleware/rate-limit';
import { validateApiKey } from '@/middleware/auth';
import { trackUsage } from '@/middleware/usage-tracking';
import { getLogger } from '@/utils/logger';

const logger = getLogger('api:mcp');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
};

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Handle GET requests - health check and server info
 */
export async function GET() {
  return NextResponse.json(
    {
      name: 'augments-mcp-server',
      version: SERVER_VERSION,
      status: 'healthy',
      transport: 'http',
      endpoint: '/api/mcp',
      tools: 12,
    },
    {
      headers: corsHeaders,
    }
  );
}

/**
 * Handle POST requests - MCP protocol messages
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let toolName: string | undefined;
  let framework: string | undefined;

  try {
    // Get client identifier for rate limiting (use IP or API key)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // Validate API key (currently all requests pass through)
    const authResult = await validateApiKey(request.headers.get('authorization'));

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      authResult.apiKey || clientIp
    );

    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded', { clientIp });

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Rate limit exceeded. Please try again later.',
          },
          id: null,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Parse the request body
    const body = await request.json();

    // Extract tool name for tracking
    if (body.method === 'tools/call' && body.params?.name) {
      toolName = body.params.name;
      framework = body.params.arguments?.framework;
    }

    // Get the MCP server
    const server = await getServer();

    // Handle the JSON-RPC request
    let result: unknown;

    if (body.method === 'initialize') {
      // Handle initialize request
      result = {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'augments-mcp-server',
          version: SERVER_VERSION,
        },
      };
    } else if (body.method === 'tools/list') {
      // List available tools
      result = {
        tools: server.getToolsList(),
      };
    } else if (body.method === 'tools/call') {
      // Call a tool
      const toolResult = await server.callTool(body.params.name, body.params.arguments);
      result = toolResult;
    } else {
      // Unknown method
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${body.method}`,
          },
          id: body.id,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Track usage
    await trackUsage({
      tool: toolName || body.method || 'unknown',
      framework,
      tier: authResult.tier,
      timestamp: Date.now(),
      success: true,
      duration_ms: Date.now() - startTime,
    });

    // Return successful response
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        result,
        id: body.id,
      },
      {
        headers: {
          ...corsHeaders,
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    );
  } catch (error) {
    logger.error('MCP request failed', {
      error: error instanceof Error ? error.message : String(error),
      toolName,
    });

    // Track failed usage
    await trackUsage({
      tool: toolName || 'unknown',
      framework,
      tier: 'free',
      timestamp: Date.now(),
      success: false,
      duration_ms: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: null,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

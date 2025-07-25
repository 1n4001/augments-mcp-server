#!/usr/bin/env python3
"""
Augments MCP Server - Main Entry Point

Supports both MCP mode (for Claude Desktop) and Web API mode (for hosting)
"""

import os
import sys
import click
import structlog

logger = structlog.get_logger(__name__)

@click.group()
def cli():
    """Augments MCP Server - Framework Documentation Provider"""
    pass

@cli.command()
@click.option('--host', default='0.0.0.0', help='Host to bind to')
@click.option('--port', default=8080, type=int, help='Port to bind to')
@click.option('--workers', default=None, type=int, help='Number of workers (production only)')
@click.option('--reload', is_flag=True, help='Enable auto-reload (development only)')
def web(host, port, workers, reload):
    """Run as web API server"""
    os.environ['HOST'] = host
    os.environ['PORT'] = str(port)
    
    if workers:
        os.environ['WORKERS'] = str(workers)
    
    if reload and os.getenv('ENV') == 'production':
        logger.warning("Auto-reload disabled in production")
        reload = False
    
    logger.info(
        "Starting web API server",
        host=host,
        port=port,
        workers=workers or "auto",
        reload=reload
    )
    
    from .web_server import main
    main()

@cli.command()
def mcp():
    """Run as MCP server (for Claude Desktop)"""
    logger.info("Starting MCP server mode")
    from .server import main
    main()

@cli.command()
def version():
    """Show version information"""
    from . import __version__
    click.echo(f"Augments MCP Server v{__version__}")

if __name__ == '__main__':
    # Default to MCP mode if no command specified
    if len(sys.argv) == 1:
        sys.argv.append('mcp')
    
    cli()
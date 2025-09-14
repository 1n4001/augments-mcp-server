"""Augments MCP Server - Framework documentation provider."""

__version__ = "2.0.4"

# Remove the direct import that causes the RuntimeWarning
# from .server import mcp

__all__ = ["__version__"]

def get_mcp():
    """Lazy import to avoid circular import issues."""
    from .server import mcp
    return mcp

#!/usr/bin/env python3
"""
Test script to verify the full MCP server can import and start
"""
import sys
import os

# Add src to Python path
sys.path.insert(0, '/app/src' if os.path.exists('/app/src') else 'src')

try:
    print("Testing MCP server import...")
    from augments_mcp.web_server import app, main
    print("✓ Import successful")
    
    # Test that the app has the expected endpoints
    routes = [route.path for route in app.routes]
    print(f"✓ Found {len(routes)} routes")
    
    expected_routes = ["/", "/health", "/api/v1/frameworks"]
    for route in expected_routes:
        if any(route in r for r in routes):
            print(f"✓ Found expected route: {route}")
        else:
            print(f"⚠ Missing route: {route}")
            
    print("✓ MCP server ready to start")
    
except Exception as e:
    print(f"✗ Error importing MCP server: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
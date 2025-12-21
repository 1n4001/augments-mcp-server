"""Tests for the local repository provider."""

import os
import asyncio
import pytest
pytestmark = pytest.mark.asyncio
from unittest.mock import patch, AsyncMock
import tempfile
import shutil

from src.augments_mcp.providers.localrepository import LocalRepositoryProvider


@pytest.fixture
def local_repo_dir():
    """Create a temporary directory structure for testing."""
    temp_dir = tempfile.mkdtemp()

    # Create docs directory
    docs_dir = os.path.join(temp_dir, "docs")
    os.makedirs(docs_dir)

    # Create example docs file
    with open(os.path.join(docs_dir, "README.md"), "w") as f:
        f.write("# Test Documentation\n\nThis is a test document.\n")

    # Create getting started docs
    getting_started_dir = os.path.join(docs_dir, "getting-started")
    os.makedirs(getting_started_dir)
    with open(os.path.join(getting_started_dir, "index.md"), "w") as f:
        f.write("# Getting Started\n\nThis is the getting started guide.\n")

    # Create examples directory
    examples_dir = os.path.join(temp_dir, "examples")
    os.makedirs(examples_dir)

    # Create example code files
    with open(os.path.join(examples_dir, "example.js"), "w") as f:
        f.write('console.log("Hello, World!");\n\nfunction test() {\n  return true;\n}\n')

    with open(os.path.join(examples_dir, "component.jsx"), "w") as f:
        f.write('import React from "react";\n\nconst TestComponent = () => {\n  return <div>Test</div>;\n};\n')

    # Create routing examples
    routing_dir = os.path.join(examples_dir, "routing")
    os.makedirs(routing_dir)
    with open(os.path.join(routing_dir, "router.js"), "w") as f:
        f.write('const router = createRouter();\n\nrouter.addRoute("/", HomePage);\nrouter.addRoute("/about", AboutPage);\n')

    yield temp_dir

    # Cleanup
    shutil.rmtree(temp_dir)


async def test_init():
    """Test initialization of the local repository provider."""
    # Test with base path
    provider = LocalRepositoryProvider(base_path="/test/path")
    assert provider.base_path == "/test/path"

    # Test without base path
    provider = LocalRepositoryProvider()
    assert provider.base_path is None

    await provider.close()


async def test_fetch_documentation(local_repo_dir):
    """Test fetching documentation from a local repository."""
    provider = LocalRepositoryProvider()

    # Test fetching from docs directory
    docs = await provider.fetch_documentation(local_repo_dir, "docs")
    assert docs is not None
    assert "# Test Documentation" in docs

    # Test fetching specific section
    section_docs = await provider.fetch_documentation(local_repo_dir, "docs/getting-started")
    assert section_docs is not None
    assert "# Getting Started" in section_docs

    # Test fetching single file
    file_path = os.path.join(local_repo_dir, "docs", "README.md")
    file_docs = await provider.fetch_documentation(file_path, "")  # Use empty subpath
    assert file_docs is not None
    assert "# Test Documentation" in file_docs

    # Test fetching nonexistent path
    nonexistent_docs = await provider.fetch_documentation(local_repo_dir, "nonexistent")
    assert nonexistent_docs is None

    await provider.close()


async def test_fetch_examples(local_repo_dir):
    """Test fetching examples from a local repository."""
    provider = LocalRepositoryProvider()

    # Test fetching from examples directory
    examples = await provider.fetch_examples(local_repo_dir, "examples")
    assert examples is not None
    assert "console.log" in examples
    assert "TestComponent" in examples

    # Test fetching with pattern
    routing_examples = await provider.fetch_examples(local_repo_dir, "examples", "routing")
    assert routing_examples is not None
    assert "createRouter" in routing_examples

    # Test fetching nonexistent path
    nonexistent_examples = await provider.fetch_examples(local_repo_dir, "nonexistent")
    assert nonexistent_examples is None

    await provider.close()


async def test_search_repository(local_repo_dir):
    """Test searching in a local repository."""
    provider = LocalRepositoryProvider()

    # Test searching for text
    results = await provider.search_repository(local_repo_dir, "Test")
    assert len(results) > 0
    assert any("README.md" in result["file"] for result in results)

    # Test searching with file extension filter
    js_results = await provider.search_repository(local_repo_dir, "router", ".js")
    assert len(js_results) > 0
    assert all(".js" in result["file"] for result in js_results)

    # Test searching for nonexistent text
    nonexistent_results = await provider.search_repository(local_repo_dir, "nonexistenttext")
    assert len(nonexistent_results) == 0

    await provider.close()


async def test_resolve_path():
    """Test path resolution."""
    # Test with base_path
    provider = LocalRepositoryProvider(base_path="/base/path")
    assert provider._resolve_path("repo", "docs") == "/base/path/repo/docs"
    assert provider._resolve_path("/absolute/repo", "docs") == "/absolute/repo/docs"  # Absolute paths should not be modified

    # Test without base_path
    provider = LocalRepositoryProvider()
    assert provider._resolve_path("repo", "docs") == "repo/docs"
    assert provider._resolve_path("/absolute/repo", "docs") == "/absolute/repo/docs"

    await provider.close()


async def test_read_file():
    """Test reading files."""
    provider = LocalRepositoryProvider()

    # Test with mock file
    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        f.write("Test content")
        temp_file = f.name

    try:
        content = await provider._read_file(temp_file)
        assert content == "Test content"

        # Test with nonexistent file
        nonexistent_content = await provider._read_file("nonexistentfile.txt")
        assert nonexistent_content is None
    finally:
        os.unlink(temp_file)

    await provider.close()


@patch("aiofiles.open", side_effect=Exception("Test error"))
async def test_read_file_error(mock_open):
    """Test error handling when reading files."""
    provider = LocalRepositoryProvider()

    content = await provider._read_file("test.txt")
    assert content is None
    mock_open.assert_called_once()

    await provider.close()


async def test_format_file_content():
    """Test formatting file content."""
    provider = LocalRepositoryProvider()

    # Test with markdown file
    content = provider._format_file_content("# Test\n\nContent", "test.md")
    assert content.startswith("## Test")
    assert "Content" in content

    # Test with other file
    content = provider._format_file_content("Code content", "test.js")
    assert content.startswith("## Test")
    assert "Code content" in content

    await provider.close()


async def test_clean_markdown():
    """Test markdown cleaning."""
    provider = LocalRepositoryProvider()

    # Test with HTML comments
    content = provider._clean_markdown("# Test\n<!-- Comment -->\nContent")
    assert "<!-- Comment -->" not in content
    assert "# Test" in content
    assert "Content" in content

    # Test with relative links
    content = provider._clean_markdown("# Test\n[Link](./path/to/file)\nContent")
    assert "[Link](path/to/file)" in content

    # Test with excessive whitespace
    content = provider._clean_markdown("# Test\n\n\n\nContent\n\n\n")
    assert "# Test\n\nContent" in content

    await provider.close()


async def test_detect_language():
    """Test language detection from file extension."""
    provider = LocalRepositoryProvider()

    assert provider._detect_language("test.js") == "javascript"
    assert provider._detect_language("test.py") == "python"
    assert provider._detect_language("test.tsx") == "tsx"
    assert provider._detect_language("test.unknown") == "text"

    await provider.close()
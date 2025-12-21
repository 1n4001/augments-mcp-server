"""Local repository documentation provider."""

import os
import re
from typing import Optional, List, Dict, Any
import structlog
import aiofiles
from pathlib import Path

from .base import BaseProvider

logger = structlog.get_logger(__name__)


class LocalRepositoryProvider(BaseProvider):
    """Provider for fetching documentation from a local repository directory."""

    def __init__(self, base_path: Optional[str] = None):
        """Initialize local repository provider.

        Args:
            base_path: Optional base path for all local repositories. If not provided,
                      the path must be fully specified in each request.
        """
        super().__init__()
        self.base_path = base_path
        logger.info("Local repository provider initialized", base_path=base_path)

    async def close(self):
        """Close the provider (nothing to do for local repository)."""
        logger.debug("Local repository provider closed")

    async def fetch_documentation(
        self,
        path: str,
        subpath: Optional[str] = None,
        file_pattern: str = "*.md"
    ) -> Optional[str]:
        """Fetch documentation content from a local repository.

        Args:
            path: Path to the local repository
            subpath: Documentation path in the repository (None to use path directly)
            file_pattern: File pattern to match (defaults to *.md)

        Returns:
            Formatted documentation content or None if not found
        """
        try:
            full_path = self._resolve_path(path, subpath)
            self.logger.info("Fetching documentation from local repository", path=full_path)

            if not os.path.exists(full_path):
                self.logger.warning("Path not found", path=full_path)
                return None

            # Try to get the content as a single file first
            if os.path.isfile(full_path):
                content = await self._read_file(full_path)
                if content:
                    return self._format_single_file(content, os.path.basename(full_path))

            # If not a single file, try to get directory contents
            if os.path.isdir(full_path):
                return await self._process_directory(full_path, file_pattern)

            self.logger.warning("No documentation found", path=full_path)
            return None

        except Exception as e:
            self.logger.error("Local repository documentation fetch failed",
                            path=path,
                            subpath=subpath,
                            error=str(e))
            return None

    async def fetch_examples(
        self,
        path: str,
        subpath: Optional[str] = None,
        pattern: Optional[str] = None
    ) -> Optional[str]:
        """Fetch code examples from a local repository.

        Args:
            path: Path to the local repository
            subpath: Examples path in the repository (None to use path directly)
            pattern: Specific pattern to search for

        Returns:
            Formatted examples content or None if not found
        """
        try:
            full_path = self._resolve_path(path, subpath)
            self.logger.info("Fetching examples from local repository",
                           path=full_path,
                           pattern=pattern)

            if not os.path.exists(full_path):
                self.logger.warning("Path not found", path=full_path)
                return None

            if os.path.isdir(full_path):
                # Filter for code files and example files
                code_extensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c']
                example_files = []

                for root, _, files in os.walk(full_path):
                    for file in files:
                        file_name = file.lower()
                        file_path = os.path.join(root, file)

                        # Check if it's a code file
                        if any(file_name.endswith(ext) for ext in code_extensions):
                            # If pattern is specified, filter by pattern
                            if pattern:
                                if pattern.lower() in file_name or pattern.lower() in file_path:
                                    example_files.append((file_name, file_path))
                            else:
                                example_files.append((file_name, file_path))

                if not example_files:
                    self.logger.warning("No example files found", path=full_path, pattern=pattern)
                    return None

                # Limit number of files to process
                example_files = example_files[:5]

                # Fetch content for each example file
                examples_parts = []
                for file_name, file_path in example_files:
                    file_content = await self._read_file(file_path)

                    if file_content:
                        # Detect language for syntax highlighting
                        language = self._detect_language(file_name)

                        formatted_example = f"### {file_name}\n\n"
                        formatted_example += f"```{language}\n{file_content}\n```\n"

                        examples_parts.append(formatted_example)

                if not examples_parts:
                    self.logger.warning("No readable example files found", path=full_path)
                    return None

                # Combine all examples
                repo_name = os.path.basename(path)
                header = f"# Examples from {repo_name}\n"
                if subpath != "examples":
                    header += f"**Path:** {subpath}\n"
                if pattern:
                    header += f"**Pattern:** {pattern}\n"
                header += "\n"

                full_content = header + "\n".join(examples_parts)

                self.logger.info("Local repository examples fetched successfully",
                               path=full_path,
                               files=len(examples_parts))

                return full_content

            else:
                self.logger.warning("Not a directory", path=full_path)
                return None

        except Exception as e:
            self.logger.error("Local repository examples fetch failed",
                            path=path,
                            subpath=subpath,
                            pattern=pattern,
                            error=str(e))
            return None

    async def search_repository(
        self,
        path: str,
        query: str,
        file_extension: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search for content in a local repository.

        Args:
            path: Path to the local repository
            query: Search query
            file_extension: Optional file extension filter

        Returns:
            List of search results
        """
        try:
            full_path = self._resolve_path(path)
            self.logger.info("Searching local repository",
                           path=full_path,
                           query=query,
                           file_extension=file_extension)

            if not os.path.isdir(full_path):
                self.logger.warning("Not a directory", path=full_path)
                return []

            results = []
            query_lower = query.lower()

            for root, _, files in os.walk(full_path):
                for file in files:
                    if file_extension and not file.endswith(file_extension):
                        continue

                    file_path = os.path.join(root, file)
                    try:
                        file_content = await self._read_file(file_path)
                        if file_content and query_lower in file_content.lower():
                            # Find matching lines
                            lines = file_content.split('\n')
                            matching_lines = []
                            for i, line in enumerate(lines):
                                if query_lower in line.lower():
                                    # Get context: 1 line before and after
                                    start = max(0, i - 1)
                                    end = min(len(lines), i + 2)
                                    context = '\n'.join(lines[start:end])
                                    matching_lines.append({
                                        "line_number": i + 1,
                                        "content": context
                                    })

                            # Add to results
                            result = {
                                "file": os.path.relpath(file_path, full_path),
                                "matches": matching_lines[:3]  # Limit to 3 matching contexts
                            }
                            results.append(result)
                    except Exception as e:
                        self.logger.debug(f"Failed to read file: {file_path} - {str(e)}")

            self.logger.info("Repository search completed",
                           path=full_path,
                           query=query,
                           results=len(results))

            return results

        except Exception as e:
            self.logger.error("Repository search failed",
                            path=path,
                            query=query,
                            error=str(e))
            return []

    def _resolve_path(self, path: str, subpath: Optional[str] = None) -> str:
        """Resolve the full path by combining base_path with path and subpath."""
        if self.base_path:
            full_path = os.path.join(self.base_path, path)
        else:
            full_path = path

        if subpath:
            full_path = os.path.join(full_path, subpath)

        # Normalize the path
        return os.path.normpath(full_path)

    async def _read_file(self, file_path: str) -> Optional[str]:
        """Read content from a file asynchronously."""
        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                return await f.read()
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                async with aiofiles.open(file_path, 'r', encoding='latin-1') as f:
                    return await f.read()
            except Exception:
                self.logger.warning(f"Could not read file {file_path} - encoding issue")
                return None
        except Exception as e:
            self.logger.warning(f"Failed to read file: {file_path} - {str(e)}")
            return None

    async def _process_directory(self, dir_path: str, file_pattern: str) -> Optional[str]:
        """Process all matching files in a directory."""
        # Find all files matching the pattern
        path_obj = Path(dir_path)
        matching_files = list(path_obj.glob(file_pattern))

        if not matching_files:
            self.logger.warning("No matching files found", dir=dir_path, pattern=file_pattern)
            return None

        # Sort files to prioritize common documentation files
        priority_files = ["README.md", "index.md", "introduction.md", "getting-started.md"]
        sorted_files = []

        # First add priority files in order
        for priority_file in priority_files:
            for file_path in matching_files:
                if file_path.name == priority_file:
                    sorted_files.append(file_path)

        # Then add remaining files
        for file_path in matching_files:
            if file_path not in sorted_files:
                sorted_files.append(file_path)

        # Limit to prevent overwhelming output
        sorted_files = sorted_files[:10]

        # Read contents of each file
        content_parts = []
        for file_path in sorted_files:
            file_content = await self._read_file(str(file_path))
            if file_content:
                formatted_content = self._format_file_content(file_content, file_path.name)
                content_parts.append(formatted_content)

        if not content_parts:
            self.logger.warning("No readable files found", dir=dir_path)
            return None

        # Combine all parts
        repo_name = os.path.basename(os.path.dirname(dir_path))
        header = f"# Documentation from {repo_name}\n"
        header += f"**Path:** {os.path.basename(dir_path)}\n\n"

        full_content = header + "\n\n".join(content_parts)

        self.logger.info("Local repository documentation processed successfully",
                       dir=dir_path,
                       files=len(content_parts))

        return full_content

    def _format_single_file(self, content: str, file_name: str) -> str:
        """Format content from a single file."""
        # Clean up the content
        content = self._clean_markdown(content)

        # Add file header if it doesn't already have one
        if not content.strip().startswith('#'):
            content = f"# {file_name}\n\n{content}"

        return content

    def _format_file_content(self, content: str, file_name: str) -> str:
        """Format content from a specific file."""
        content = self._clean_markdown(content)

        # Add section header
        section_title = file_name.replace('.md', '').replace('.mdx', '').replace('-', ' ').title()
        formatted_content = f"## {section_title}\n\n{content}"

        return formatted_content

    def _clean_markdown(self, content: str) -> str:
        """Clean and normalize markdown content."""
        if not content:
            return ""

        # Remove excessive whitespace
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

        # Remove HTML comments
        content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)

        # Clean up relative links (basic cleanup)
        content = re.sub(r'\]\(\./([^)]+)\)', r'](\1)', content)

        return content.strip()

    def _detect_language(self, filename: str) -> str:
        """Detect programming language from filename."""
        ext_map = {
            '.js': 'javascript',
            '.jsx': 'jsx',
            '.ts': 'typescript',
            '.tsx': 'tsx',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin'
        }

        for ext, lang in ext_map.items():
            if filename.lower().endswith(ext):
                return lang

        return 'text'
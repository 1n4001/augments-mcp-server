/**
 * GitHub documentation provider
 */

import { GitHubClient, getGitHubClient } from '@/utils/github-client';
import { cleanMarkdown } from '@/utils/html-parser';
import { getLogger } from '@/utils/logger';

const logger = getLogger('github-provider');

export class GitHubProvider {
  private client: GitHubClient;

  constructor(client?: GitHubClient) {
    this.client = client || getGitHubClient();
  }

  /**
   * Fetch documentation content from a GitHub repository
   */
  async fetchDocumentation(
    repo: string,
    path: string = 'docs',
    branch: string = 'main'
  ): Promise<string | null> {
    try {
      // Try to get the content as a single file first
      const content = await this.client.getFileContent(repo, path, branch);
      if (content) {
        return this.formatSingleFile(content, path);
      }

      // If not a single file, try to get directory contents
      const directoryContents = await this.client.getDirectoryContents(repo, path, branch);
      if (!directoryContents.length) {
        logger.warn('No documentation found', { repo, path });
        return null;
      }

      // Process multiple files
      const priorityFiles = ['README.md', 'index.md', 'introduction.md', 'getting-started.md'];
      const regularFiles: Array<{ name: string; type: string; path: string }> = [];
      const priorityItems: Array<{ name: string; type: string; path: string; priority: number }> = [];

      for (const item of directoryContents) {
        if (item.type === 'file' && /\.(md|mdx)$/i.test(item.name)) {
          const priorityIndex = priorityFiles.indexOf(item.name);
          if (priorityIndex !== -1) {
            priorityItems.push({ ...item, priority: priorityIndex });
          } else {
            regularFiles.push(item);
          }
        }
      }

      // Sort priority files and combine with regular files (limit to 10 regular files)
      priorityItems.sort((a, b) => a.priority - b.priority);
      const allFiles = [
        ...priorityItems.map((item) => ({
          name: item.name,
          type: item.type,
          path: item.path,
        })),
        ...regularFiles.slice(0, 10),
      ];

      // Fetch content for each file
      const contentParts: string[] = [];

      for (const fileItem of allFiles) {
        const fileContent = await this.client.getFileContent(
          repo,
          fileItem.path,
          branch
        );

        if (fileContent) {
          const formattedContent = this.formatFileContent(
            fileContent,
            fileItem.name,
            fileItem.path
          );
          contentParts.push(formattedContent);
        }
      }

      if (!contentParts.length) {
        logger.warn('No readable documentation files found', { repo, path });
        return null;
      }

      // Combine all parts
      const header = [
        `# Documentation from ${repo}`,
        path !== 'docs' ? `**Path:** ${path}` : '',
        `**Branch:** ${branch}`,
        '',
      ]
        .filter(Boolean)
        .join('\n');

      const fullContent = header + '\n\n' + contentParts.join('\n\n');

      logger.info('GitHub documentation fetched successfully', {
        repo,
        path,
        files: contentParts.length,
      });

      return fullContent;
    } catch (error) {
      logger.error('GitHub documentation fetch failed', {
        repo,
        path,
        branch,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch code examples from a GitHub repository
   */
  async fetchExamples(
    repo: string,
    path: string = 'examples',
    branch: string = 'main',
    pattern?: string
  ): Promise<string | null> {
    try {
      const directoryContents = await this.client.getDirectoryContents(repo, path, branch);
      if (!directoryContents.length) {
        return null;
      }

      // Filter for code files
      const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];
      const exampleFiles: Array<{ name: string; path: string }> = [];

      for (const item of directoryContents) {
        if (item.type === 'file') {
          const isCodeFile = codeExtensions.some((ext) => item.name.toLowerCase().endsWith(ext));
          if (isCodeFile) {
            // If pattern is specified, filter by pattern
            if (pattern) {
              const patternLower = pattern.toLowerCase();
              if (
                item.name.toLowerCase().includes(patternLower) ||
                item.path.toLowerCase().includes(patternLower)
              ) {
                exampleFiles.push({ name: item.name, path: item.path });
              }
            } else {
              exampleFiles.push({ name: item.name, path: item.path });
            }
          }
        }
      }

      if (!exampleFiles.length) {
        return null;
      }

      // Limit number of files to process
      const filesToProcess = exampleFiles.slice(0, 5);
      const exampleParts: string[] = [];

      for (const fileItem of filesToProcess) {
        const fileContent = await this.client.getFileContent(repo, fileItem.path, branch);

        if (fileContent) {
          const language = this.detectLanguage(fileItem.name);
          exampleParts.push(`### ${fileItem.name}\n\n\`\`\`${language}\n${fileContent}\n\`\`\`\n`);
        }
      }

      if (!exampleParts.length) {
        return null;
      }

      // Combine all examples
      const header = [
        `# Examples from ${repo}`,
        path !== 'examples' ? `**Path:** ${path}` : '',
        pattern ? `**Pattern:** ${pattern}` : '',
        `**Branch:** ${branch}`,
        '',
      ]
        .filter(Boolean)
        .join('\n');

      const fullContent = header + '\n\n' + exampleParts.join('\n');

      logger.info('GitHub examples fetched successfully', {
        repo,
        path,
        pattern,
        files: exampleParts.length,
      });

      return fullContent;
    } catch (error) {
      logger.error('GitHub examples fetch failed', {
        repo,
        path,
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Search for content in a repository
   */
  async searchRepository(
    repo: string,
    query: string,
    fileExtension?: string
  ): Promise<Array<{ path: string; url: string }>> {
    try {
      const results = await this.client.searchCode(repo, query, fileExtension);
      logger.debug('Repository search completed', {
        repo,
        query,
        results: results.length,
      });
      return results;
    } catch (error) {
      logger.error('Repository search failed', {
        repo,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private formatSingleFile(content: string, filePath: string): string {
    // Clean up the content
    let cleaned = cleanMarkdown(content);

    // Add file header if it doesn't already have one
    if (!cleaned.trim().startsWith('#')) {
      const fileName = filePath.split('/').pop() || filePath;
      cleaned = `# ${fileName}\n\n${cleaned}`;
    }

    return cleaned;
  }

  private formatFileContent(content: string, fileName: string, filePath: string): string {
    const cleaned = cleanMarkdown(content);

    // Add section header
    const sectionTitle = fileName
      .replace(/\.(md|mdx)$/i, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return `## ${sectionTitle}\n\n${cleaned}`;
  }

  private detectLanguage(filename: string): string {
    const extMap: Record<string, string> = {
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
      '.kt': 'kotlin',
    };

    const lowerFilename = filename.toLowerCase();
    for (const [ext, lang] of Object.entries(extMap)) {
      if (lowerFilename.endsWith(ext)) {
        return lang;
      }
    }

    return 'text';
  }
}

// Singleton instance
let providerInstance: GitHubProvider | null = null;

export function getGitHubProvider(): GitHubProvider {
  if (!providerInstance) {
    providerInstance = new GitHubProvider();
  }
  return providerInstance;
}

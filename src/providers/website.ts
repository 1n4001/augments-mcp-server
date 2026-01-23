/**
 * Website documentation provider
 */

import { htmlToMarkdown, extractCodeExamples, cleanMarkdown } from '@/utils/html-parser';
import { getLogger } from '@/utils/logger';

const logger = getLogger('website-provider');

export class WebsiteProvider {
  private userAgent = 'Augments-MCP-Server/3.0 (Documentation Fetcher)';

  /**
   * Fetch documentation content from a website
   */
  async fetchDocumentation(url: string): Promise<string | null> {
    try {
      logger.debug('Fetching documentation from website', { url });

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        logger.error('Website HTTP error', {
          url,
          status: response.status,
        });
        return null;
      }

      const html = await response.text();
      const markdown = htmlToMarkdown(html, url);

      if (!markdown) {
        logger.warn('No meaningful content extracted', { url });
        return null;
      }

      // Add header
      const formattedContent = `# Documentation from ${url}\n\n${markdown}`;

      logger.info('Website documentation fetched successfully', {
        url,
        length: formattedContent.length,
      });

      return formattedContent;
    } catch (error) {
      logger.error('Website documentation fetch failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch examples from a website
   */
  async fetchExamples(url: string, pattern?: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      const examples = extractCodeExamples(html, pattern);

      if (!examples.length) {
        logger.warn('No code examples found', { url, pattern });
        return null;
      }

      // Format examples
      const parts: string[] = [
        `# Examples from ${url}`,
        pattern ? `**Pattern:** ${pattern}` : '',
        '',
      ].filter(Boolean);

      for (const example of examples) {
        parts.push(`## ${example.title}`);
        parts.push(`\`\`\`${example.language}`);
        parts.push(example.code);
        parts.push('```\n');
      }

      const formattedExamples = parts.join('\n');

      logger.info('Website examples fetched successfully', {
        url,
        pattern,
        count: examples.length,
      });

      return formattedExamples;
    } catch (error) {
      logger.error('Website examples fetch failed', {
        url,
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check if website has been updated (basic check via HEAD request)
   */
  async checkForUpdates(url: string): Promise<{
    lastModified: string | null;
    etag: string | null;
  }> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      return {
        lastModified: response.headers.get('last-modified'),
        etag: response.headers.get('etag'),
      };
    } catch (error) {
      logger.warn('Website update check failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        lastModified: null,
        etag: null,
      };
    }
  }
}

// Singleton instance
let providerInstance: WebsiteProvider | null = null;

export function getWebsiteProvider(): WebsiteProvider {
  if (!providerInstance) {
    providerInstance = new WebsiteProvider();
  }
  return providerInstance;
}

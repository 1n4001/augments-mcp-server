/**
 * HTML to Markdown conversion utilities
 */

import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { getLogger } from '@/utils/logger';

const logger = getLogger('html-parser');

// Initialize Turndown service
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});

// Configure Turndown rules
turndownService.addRule('codeBlocks', {
  filter: ['pre', 'code'],
  replacement: function (content, node) {
    const element = node as Element;
    const parent = element.parentNode as Element;

    // If code is inside pre, handle at pre level
    if (element.nodeName === 'CODE' && parent?.nodeName === 'PRE') {
      return content;
    }

    // Handle pre with code
    if (element.nodeName === 'PRE') {
      const codeElement = element.querySelector('code');
      const codeContent = codeElement ? codeElement.textContent : element.textContent;
      const language = detectLanguageFromClass(codeElement?.className || element.className);
      return `\n\`\`\`${language}\n${codeContent?.trim()}\n\`\`\`\n`;
    }

    // Inline code
    if (element.nodeName === 'CODE') {
      return `\`${content}\``;
    }

    return content;
  },
});

function detectLanguageFromClass(className: string): string {
  if (!className) return '';

  const classes = className.split(/\s+/);
  for (const cls of classes) {
    if (cls.startsWith('language-')) {
      return cls.replace('language-', '');
    }
    if (['javascript', 'typescript', 'python', 'html', 'css', 'json', 'bash', 'jsx', 'tsx'].includes(cls)) {
      return cls;
    }
  }
  return '';
}

/**
 * Extract main content from HTML
 */
export function extractMainContent(html: string, url?: string): string | null {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Try common content selectors in order of preference
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.documentation',
      '.docs',
      'article',
      '.article',
      '#content',
      '#main',
    ];

    let contentElement: Element | null = null;

    for (const selector of contentSelectors) {
      contentElement = document.querySelector(selector);
      if (contentElement) {
        logger.debug('Content found with selector', { selector, url });
        break;
      }
    }

    // Fallback to body content
    if (!contentElement) {
      contentElement = document.body;

      if (contentElement) {
        // Remove navigation, header, footer, sidebar elements
        const unwantedSelectors = [
          'nav',
          'header',
          'footer',
          '.nav',
          '.navigation',
          '.sidebar',
          '.menu',
          '.header',
          '.footer',
          '.toc',
          '.table-of-contents',
        ];

        for (const selector of unwantedSelectors) {
          const elements = contentElement.querySelectorAll(selector);
          elements.forEach((el) => el.remove());
        }

        logger.debug('Using body content as fallback', { url });
      }
    }

    if (!contentElement) {
      logger.warn('No suitable content container found', { url });
      return null;
    }

    return contentElement.innerHTML;
  } catch (error) {
    logger.error('Failed to extract main content', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Convert HTML to Markdown
 */
export function htmlToMarkdown(html: string, url?: string): string {
  try {
    const mainContent = extractMainContent(html, url);
    if (!mainContent) {
      return '';
    }

    let markdown = turndownService.turndown(mainContent);

    // Clean up excessive whitespace
    markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Remove leading/trailing whitespace
    markdown = markdown.trim();

    return markdown;
  } catch (error) {
    logger.error('Failed to convert HTML to Markdown', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

/**
 * Extract code examples from HTML
 */
export function extractCodeExamples(
  html: string,
  pattern?: string
): Array<{ title: string; code: string; language: string }> {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const examples: Array<{ title: string; code: string; language: string }> = [];
    const codeBlocks = document.querySelectorAll('pre, code');

    let exampleIndex = 0;

    codeBlocks.forEach((block) => {
      const codeText = block.textContent?.trim() || '';

      // Skip very short code snippets
      if (codeText.length < 20) {
        return;
      }

      // If pattern is specified, filter by pattern
      if (pattern) {
        const patternLower = pattern.toLowerCase();
        if (!codeText.toLowerCase().includes(patternLower)) {
          // Check surrounding text for context
          const parentText = block.parentElement?.textContent?.toLowerCase() || '';
          if (!parentText.includes(patternLower)) {
            return;
          }
        }
      }

      // Detect language
      const language = detectLanguageFromClass(block.className);

      // Try to get a title from surrounding context
      let title = `Example ${++exampleIndex}`;
      let currentElement: Element | null = block as Element;

      // Look for preceding heading
      for (let i = 0; i < 5; i++) {
        if (!currentElement) break;
        const prev: Element | null = currentElement.previousElementSibling;
        const parent: Element | null = currentElement.parentElement;
        currentElement = prev || parent;
        if (currentElement && /^H[1-6]$/.test(currentElement.tagName)) {
          title = currentElement.textContent?.trim() || title;
          break;
        }
      }

      examples.push({
        title,
        code: codeText,
        language,
      });
    });

    return examples;
  } catch (error) {
    logger.error('Failed to extract code examples', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Clean markdown content
 */
export function cleanMarkdown(content: string): string {
  if (!content) return '';

  // Remove excessive whitespace
  let cleaned = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Clean up relative links (basic cleanup)
  cleaned = cleaned.replace(/\]\(\.\/([^)]+)\)/g, ']($1)');

  // Remove trailing whitespace from lines
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  return cleaned.trim();
}

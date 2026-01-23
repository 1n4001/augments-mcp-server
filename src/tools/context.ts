/**
 * Context Enhancement Tools
 *
 * Tools for multi-framework context and code compatibility analysis
 */

import { z } from 'zod';
import { FrameworkRegistryManager } from '@/registry/manager';
import { KVCache } from '@/cache';
import {
  type CompatibilityAnalysis,
  type CompatibilityIssue,
  type CodeAnalysis,
} from '@/types';
import { getLogger } from '@/utils/logger';

const logger = getLogger('tools:context');

// Input schemas
export const GetFrameworkContextInputSchema = z.object({
  frameworks: z.array(z.string().min(1)).min(1).describe('List of framework names being used'),
  task_description: z.string().min(1).describe('Description of what you are trying to build'),
});

export const AnalyzeCodeCompatibilityInputSchema = z.object({
  code: z.string().min(1).describe('Code snippet to analyze'),
  frameworks: z.array(z.string().min(1)).min(1).describe('List of frameworks the code should work with'),
});

export type GetFrameworkContextInput = z.infer<typeof GetFrameworkContextInputSchema>;
export type AnalyzeCodeCompatibilityInput = z.infer<typeof AnalyzeCodeCompatibilityInputSchema>;

/**
 * Get relevant context for multiple frameworks based on the development task
 */
export async function getFrameworkContext(
  registry: FrameworkRegistryManager,
  cache: KVCache,
  input: GetFrameworkContextInput
): Promise<string> {
  try {
    const { frameworks, task_description } = input;

    if (!frameworks.length) {
      return 'Error: No frameworks specified';
    }

    if (!task_description.trim()) {
      return 'Error: Task description is required';
    }

    // Validate frameworks exist
    const validFrameworks: string[] = [];
    for (const framework of frameworks) {
      const config = registry.getFramework(framework);
      if (config) {
        validFrameworks.push(framework);
      } else {
        logger.warn('Framework not found', { framework });
      }
    }

    if (!validFrameworks.length) {
      return 'Error: No valid frameworks found';
    }

    // Analyze task to identify relevant patterns and features
    const taskKeywords = extractTaskKeywords(task_description);

    // Build context for each framework
    const frameworkContexts: Array<{
      framework: string;
      display_name: string;
      category: string;
      type: string;
      relevant_features: string[];
      relevant_patterns: string[];
      integration_notes: string[];
      documentation_snippets: Array<{ section: string; content: string }>;
    }> = [];

    for (const framework of validFrameworks) {
      const config = registry.getFramework(framework)!;

      // Get relevant sections based on task
      const relevantSections = identifyRelevantSections(config, taskKeywords);

      const frameworkContext = {
        framework,
        display_name: config.display_name,
        category: config.category,
        type: config.type,
        relevant_features: filterRelevantFeatures(config.key_features, taskKeywords),
        relevant_patterns: filterRelevantPatterns(config.common_patterns, taskKeywords),
        integration_notes: getIntegrationNotes(config, validFrameworks, taskKeywords),
        documentation_snippets: [] as Array<{ section: string; content: string }>,
      };

      // Get documentation snippets for relevant sections (limit to top 3)
      for (const section of relevantSections.slice(0, 3)) {
        try {
          const cachedContent = await cache.get(framework, section, 'docs');
          if (cachedContent) {
            const snippet = extractRelevantSnippet(cachedContent, taskKeywords, section);
            if (snippet) {
              frameworkContext.documentation_snippets.push({
                section,
                content: snippet,
              });
            }
          }
        } catch (error) {
          logger.warn('Failed to get documentation snippet', {
            framework,
            section,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      frameworkContexts.push(frameworkContext);
    }

    // Generate compatibility insights
    const compatibilityInsights = generateCompatibilityInsights(
      validFrameworks,
      registry,
      taskKeywords
    );

    // Format the final context
    const formattedContext = formatFrameworkContext(
      frameworkContexts,
      task_description,
      compatibilityInsights
    );

    logger.info('Framework context generated', {
      frameworks: validFrameworks,
      task_keywords: taskKeywords,
    });

    return formattedContext;
  } catch (error) {
    const errorMsg = `Failed to generate framework context: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('Context generation failed', {
      frameworks: input.frameworks,
      error: error instanceof Error ? error.message : String(error),
    });
    return `Error: ${errorMsg}`;
  }
}

/**
 * Analyze code for framework compatibility and suggest improvements
 */
export async function analyzeCodeCompatibility(
  registry: FrameworkRegistryManager,
  input: AnalyzeCodeCompatibilityInput
): Promise<CompatibilityAnalysis> {
  try {
    const { code, frameworks } = input;

    if (!code.trim()) {
      throw new Error('No code provided for analysis');
    }

    if (!frameworks.length) {
      throw new Error('No frameworks specified for compatibility check');
    }

    // Validate frameworks
    const validFrameworks: string[] = [];
    const frameworkConfigs: Record<string, ReturnType<FrameworkRegistryManager['getFramework']>> = {};

    for (const framework of frameworks) {
      const config = registry.getFramework(framework);
      if (config) {
        validFrameworks.push(framework);
        frameworkConfigs[framework] = config;
      } else {
        logger.warn('Framework not found for analysis', { framework });
      }
    }

    if (!validFrameworks.length) {
      throw new Error('No valid frameworks found');
    }

    // Analyze code structure
    const codeAnalysis = analyzeCodeStructure(code);

    // Check compatibility with each framework
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    const compatibilityScores: Record<string, number> = {};

    for (const framework of validFrameworks) {
      const config = frameworkConfigs[framework]!;
      const { issues: frameworkIssues, suggestions: frameworkSuggestions, score } =
        checkFrameworkCompatibility(code, codeAnalysis, config);

      issues.push(...frameworkIssues);
      suggestions.push(...frameworkSuggestions);
      compatibilityScores[framework] = score;
    }

    // Calculate overall compatibility
    const overallScore =
      Object.values(compatibilityScores).reduce((sum, score) => sum + score, 0) /
      Object.values(compatibilityScores).length;
    const hasErrors = issues.some((i) => i.severity === 'error');
    const isCompatible = overallScore >= 0.7 && !hasErrors;

    // Generate cross-framework suggestions
    const crossFrameworkSuggestions = generateCrossFrameworkSuggestions(
      validFrameworks,
      frameworkConfigs,
      codeAnalysis
    );
    suggestions.push(...crossFrameworkSuggestions);

    // Remove duplicate suggestions
    const uniqueSuggestions = [...new Set(suggestions)];

    const result: CompatibilityAnalysis = {
      compatible: isCompatible,
      frameworks: validFrameworks,
      overall_compatibility_score: Math.round(overallScore * 100) / 100,
      framework_scores: Object.fromEntries(
        Object.entries(compatibilityScores).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
      issues,
      suggestions: uniqueSuggestions,
      code_analysis: codeAnalysis,
    };

    logger.info('Code compatibility analysis completed', {
      frameworks: validFrameworks,
      overall_score: overallScore,
      issues: issues.length,
    });

    return result;
  } catch (error) {
    logger.error('Compatibility analysis failed', {
      frameworks: input.frameworks,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Helper functions

function extractTaskKeywords(taskDescription: string): string[] {
  const developmentKeywords = new Set([
    'component',
    'components',
    'ui',
    'interface',
    'form',
    'forms',
    'routing',
    'router',
    'navigation',
    'auth',
    'authentication',
    'login',
    'api',
    'rest',
    'graphql',
    'database',
    'db',
    'model',
    'models',
    'state',
    'store',
    'redux',
    'context',
    'hook',
    'hooks',
    'style',
    'styling',
    'css',
    'design',
    'theme',
    'responsive',
    'test',
    'testing',
    'unit',
    'integration',
    'e2e',
    'deploy',
    'deployment',
    'build',
    'production',
    'server',
    'performance',
    'optimization',
    'bundle',
    'lazy',
    'loading',
  ]);

  const words = taskDescription.toLowerCase().match(/\b\w+\b/g) || [];
  const keywords: string[] = [];

  for (const word of words) {
    if (developmentKeywords.has(word) || word.length > 3) {
      keywords.push(word);
    }
  }

  // Remove duplicates while preserving order
  return [...new Set(keywords)];
}

function identifyRelevantSections(
  config: NonNullable<ReturnType<FrameworkRegistryManager['getFramework']>>,
  taskKeywords: string[]
): string[] {
  const sections = [
    'installation',
    'setup',
    'configuration',
    'getting-started',
    'components',
    'api',
    'routing',
    'state-management',
    'forms',
    'authentication',
    'styling',
    'theming',
    'testing',
    'deployment',
    'examples',
    'tutorial',
    'guide',
    'best-practices',
  ];

  const relevantSections: Array<{ section: string; score: number }> = [];

  for (const section of sections) {
    let sectionScore = 0;

    // Direct keyword match
    if (taskKeywords.includes(section)) {
      sectionScore += 10;
    }

    // Partial matches
    for (const keyword of taskKeywords) {
      if (keyword.includes(section) || section.includes(keyword)) {
        sectionScore += 5;
      }
    }

    // Feature/pattern matches
    for (const feature of config.key_features) {
      for (const keyword of taskKeywords) {
        if (feature.toLowerCase().includes(keyword.toLowerCase())) {
          sectionScore += 3;
        }
      }
    }

    for (const pattern of config.common_patterns) {
      for (const keyword of taskKeywords) {
        if (pattern.toLowerCase().includes(keyword.toLowerCase())) {
          sectionScore += 3;
        }
      }
    }

    if (sectionScore > 0) {
      relevantSections.push({ section, score: sectionScore });
    }
  }

  // Sort by relevance score and return section names
  relevantSections.sort((a, b) => b.score - a.score);
  return relevantSections.slice(0, 5).map((s) => s.section);
}

function filterRelevantFeatures(features: string[], taskKeywords: string[]): string[] {
  const relevant: string[] = [];

  for (const feature of features) {
    const featureLower = feature.toLowerCase();
    for (const keyword of taskKeywords) {
      if (featureLower.includes(keyword) || keyword.split('-').some((word) => featureLower.includes(word))) {
        relevant.push(feature);
        break;
      }
    }
  }

  return relevant;
}

function filterRelevantPatterns(patterns: string[], taskKeywords: string[]): string[] {
  const relevant: string[] = [];

  for (const pattern of patterns) {
    const patternLower = pattern.toLowerCase();
    for (const keyword of taskKeywords) {
      if (patternLower.includes(keyword) || keyword.split('-').some((word) => patternLower.includes(word))) {
        relevant.push(pattern);
        break;
      }
    }
  }

  return relevant;
}

function getIntegrationNotes(
  config: NonNullable<ReturnType<FrameworkRegistryManager['getFramework']>>,
  frameworks: string[],
  taskKeywords: string[]
): string[] {
  const notes: string[] = [];

  const frameworkIntegrations: Record<string, Record<string, string>> = {
    react: {
      tailwindcss: 'Use Tailwind classes directly in JSX className attributes',
      nextjs: 'React components work seamlessly with Next.js pages and app router',
      typescript: 'Add TypeScript types for props and state management',
    },
    nextjs: {
      tailwindcss: 'Configure Tailwind in next.config.js and use with App Router',
      react: 'Use React components in Next.js pages and layouts',
      vercel: 'Deploy easily to Vercel with zero configuration',
    },
    tailwindcss: {
      react: 'Use utility classes in className prop for responsive design',
      nextjs: 'Configure PostCSS and import Tailwind in global styles',
      'shadcn-ui': 'shadcn/ui components are pre-styled with Tailwind utilities',
    },
  };

  const currentFramework = config.name.toLowerCase();

  for (const otherFramework of frameworks) {
    if (otherFramework !== config.name) {
      const otherLower = otherFramework.toLowerCase();

      // Check for specific integration notes
      if (frameworkIntegrations[currentFramework]?.[otherLower]) {
        notes.push(frameworkIntegrations[currentFramework][otherLower]);
      }

      // Generic integration notes based on categories
      if (config.category === 'web' && taskKeywords.includes('css')) {
        notes.push(`Ensure CSS styles from ${config.display_name} are compatible with ${otherFramework}`);
      }

      if (config.category === 'design' && ['react', 'nextjs', 'vue'].includes(otherLower)) {
        notes.push(`Import ${config.display_name} components into ${otherFramework} components`);
      }
    }
  }

  return notes;
}

function extractRelevantSnippet(
  content: string,
  taskKeywords: string[],
  section: string
): string | null {
  if (!content) return null;

  const lines = content.split('\n');
  const relevantLines: string[] = [];
  const contextWindow = 3;

  // Find lines that match task keywords
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();

    let relevanceScore = 0;
    for (const keyword of taskKeywords) {
      if (lineLower.includes(keyword)) {
        relevanceScore += 1;
      }
    }

    if (relevanceScore > 0) {
      const startIdx = Math.max(0, i - contextWindow);
      const endIdx = Math.min(lines.length, i + contextWindow + 1);

      relevantLines.push(...lines.slice(startIdx, endIdx));
    }
  }

  if (!relevantLines.length) {
    // Fallback to first few lines of the section
    return lines.slice(0, 10).join('\n');
  }

  // Remove duplicates while preserving order
  const uniqueLines: string[] = [];
  const seen = new Set<string>();
  for (const line of relevantLines) {
    if (!seen.has(line)) {
      uniqueLines.push(line);
      seen.add(line);
    }
  }

  const snippet = uniqueLines.slice(0, 20).join('\n');
  return snippet.length > 50 ? snippet : null;
}

function generateCompatibilityInsights(
  frameworks: string[],
  registry: FrameworkRegistryManager,
  taskKeywords: string[]
): string[] {
  const insights: string[] = [];

  // Get framework categories
  const categories: Record<string, string> = {};
  for (const framework of frameworks) {
    const config = registry.getFramework(framework);
    if (config) {
      categories[framework] = config.category;
    }
  }

  // Check for potential conflicts
  const cssFrameworks = Object.entries(categories)
    .filter(([f, cat]) => (cat === 'design' || cat === 'web') && f.toLowerCase().includes('css'))
    .map(([f]) => f);
  if (cssFrameworks.length > 1) {
    insights.push(`Multiple CSS frameworks detected: ${cssFrameworks.join(', ')}. Consider using one primary styling system.`);
  }

  // Check for complementary frameworks
  const hasReact = frameworks.some((f) => f.toLowerCase().includes('react'));
  const hasNextjs = frameworks.some((f) => f.toLowerCase().includes('next'));

  if (hasReact && hasNextjs) {
    insights.push('React and Next.js work excellently together. Use React components within Next.js pages and layouts.');
  }

  // Task-specific insights
  if (taskKeywords.includes('ui') || taskKeywords.includes('component')) {
    const designFrameworks = Object.entries(categories)
      .filter(([, cat]) => cat === 'design')
      .map(([f]) => f);
    if (designFrameworks.length > 0) {
      insights.push(`For UI components, leverage ${designFrameworks.join(', ')} for consistent design patterns.`);
    }
  }

  return insights;
}

function formatFrameworkContext(
  frameworkContexts: Array<{
    framework: string;
    display_name: string;
    category: string;
    type: string;
    relevant_features: string[];
    relevant_patterns: string[];
    integration_notes: string[];
    documentation_snippets: Array<{ section: string; content: string }>;
  }>,
  taskDescription: string,
  compatibilityInsights: string[]
): string {
  const parts: string[] = [];

  // Header
  const frameworkNames = frameworkContexts.map((ctx) => ctx.display_name);
  parts.push('# Multi-Framework Development Context');
  parts.push(`**Frameworks:** ${frameworkNames.join(', ')}`);
  parts.push(`**Task:** ${taskDescription}`);
  parts.push('');

  // Compatibility insights
  if (compatibilityInsights.length > 0) {
    parts.push('## Compatibility Insights');
    for (const insight of compatibilityInsights) {
      parts.push(`- ${insight}`);
    }
    parts.push('');
  }

  // Framework-specific context
  for (const ctx of frameworkContexts) {
    parts.push(`## ${ctx.display_name} (${ctx.category})`);

    if (ctx.relevant_features.length > 0) {
      parts.push('**Relevant Features:**');
      for (const feature of ctx.relevant_features) {
        parts.push(`- ${feature}`);
      }
      parts.push('');
    }

    if (ctx.relevant_patterns.length > 0) {
      parts.push('**Relevant Patterns:**');
      for (const pattern of ctx.relevant_patterns) {
        parts.push(`- ${pattern}`);
      }
      parts.push('');
    }

    if (ctx.integration_notes.length > 0) {
      parts.push('**Integration Notes:**');
      for (const note of ctx.integration_notes) {
        parts.push(`- ${note}`);
      }
      parts.push('');
    }

    if (ctx.documentation_snippets.length > 0) {
      parts.push('**Documentation Snippets:**');
      for (const snippet of ctx.documentation_snippets) {
        parts.push(`### ${snippet.section.charAt(0).toUpperCase() + snippet.section.slice(1)}`);
        parts.push(snippet.content.length > 500 ? `${snippet.content.slice(0, 500)}...` : snippet.content);
        parts.push('');
      }
    }
  }

  return parts.join('\n');
}

function analyzeCodeStructure(code: string): CodeAnalysis {
  return {
    language: detectLanguage(code),
    imports: extractImports(code),
    functions: extractFunctions(code),
    classes: extractClasses(code),
    jsx_elements: extractJsxElements(code),
    css_selectors: extractCssSelectors(code),
    patterns: detectPatterns(code),
  };
}

function detectLanguage(code: string): string {
  const codeLower = code.toLowerCase();

  if (code.includes('import ') && (code.includes('from ') || codeLower.includes('jsx') || codeLower.includes('tsx'))) {
    if (code.includes('<') && code.includes('>') && (code.includes('/>') || code.includes('</'))) {
      return codeLower.includes('.tsx') ? 'tsx' : 'jsx';
    }
    return codeLower.includes('.ts') ? 'typescript' : 'javascript';
  }

  if (code.includes('def ') && code.includes('import ')) {
    return 'python';
  }

  if (code.includes('<?php') || code.includes('namespace ')) {
    return 'php';
  }

  if (code.includes('class ') && code.includes('public ')) {
    return 'java';
  }

  return 'unknown';
}

function extractImports(code: string): string[] {
  const importPatterns = [
    /import\s+.*?from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /from\s+([^\s]+)\s+import/g,
    /require\(['"]([^'"]+)['"]\)/g,
  ];

  const imports: string[] = [];
  for (const pattern of importPatterns) {
    const matches = code.matchAll(pattern);
    for (const match of matches) {
      imports.push(match[1]);
    }
  }

  return [...new Set(imports)];
}

function extractFunctions(code: string): string[] {
  const functionPatterns = [
    /function\s+(\w+)/g,
    /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g,
    /def\s+(\w+)\s*\(/g,
    /(\w+)\s*:\s*\([^)]*\)\s*=>/g,
  ];

  const functions: string[] = [];
  for (const pattern of functionPatterns) {
    const matches = code.matchAll(pattern);
    for (const match of matches) {
      functions.push(match[1]);
    }
  }

  return [...new Set(functions)];
}

function extractClasses(code: string): string[] {
  const classPatterns = [/class\s+(\w+)/g, /interface\s+(\w+)/g, /type\s+(\w+)\s*=/g];

  const classes: string[] = [];
  for (const pattern of classPatterns) {
    const matches = code.matchAll(pattern);
    for (const match of matches) {
      classes.push(match[1]);
    }
  }

  return [...new Set(classes)];
}

function extractJsxElements(code: string): string[] {
  const jsxPattern = /<(\w+)(?:\s|>|\/)/g;
  const matches = code.matchAll(jsxPattern);

  const htmlElements = new Set([
    'div',
    'span',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'a',
    'img',
    'ul',
    'ol',
    'li',
    'table',
    'tr',
    'td',
    'th',
    'form',
    'input',
    'button',
    'select',
    'option',
    'textarea',
  ]);

  const customElements: string[] = [];
  for (const match of matches) {
    if (!htmlElements.has(match[1].toLowerCase())) {
      customElements.push(match[1]);
    }
  }

  return [...new Set(customElements)];
}

function extractCssSelectors(code: string): string[] {
  const cssPatterns = [
    /className=['"]([^'"]+)['"]/g,
    /class=['"]([^'"]+)['"]/g,
    /\.([a-zA-Z][a-zA-Z0-9_-]*)/g,
    /#([a-zA-Z][a-zA-Z0-9_-]*)/g,
  ];

  const selectors: string[] = [];
  for (const pattern of cssPatterns) {
    const matches = code.matchAll(pattern);
    for (const match of matches) {
      selectors.push(match[1]);
    }
  }

  return [...new Set(selectors)];
}

function detectPatterns(code: string): string[] {
  const patterns: string[] = [];

  if (code.includes('useState')) {
    patterns.push('react-hooks');
  }

  if (code.includes('useEffect')) {
    patterns.push('react-effects');
  }

  if (code.includes('async') && code.includes('await')) {
    patterns.push('async-await');
  }

  if (code.includes('fetch(') || code.includes('axios')) {
    patterns.push('api-calls');
  }

  if (code.toLowerCase().includes('router') || code.toLowerCase().includes('navigate')) {
    patterns.push('routing');
  }

  if (code.toLowerCase().includes('form') && (code.includes('onSubmit') || code.includes('submit'))) {
    patterns.push('form-handling');
  }

  return patterns;
}

function checkFrameworkCompatibility(
  code: string,
  codeAnalysis: CodeAnalysis,
  config: NonNullable<ReturnType<FrameworkRegistryManager['getFramework']>>
): { issues: CompatibilityIssue[]; suggestions: string[]; score: number } {
  const issues: CompatibilityIssue[] = [];
  const suggestions: string[] = [];
  let score = 1.0;

  const frameworkName = config.name.toLowerCase();

  // Framework-specific compatibility checks
  if (frameworkName === 'react') {
    const result = checkReactCompatibility(code, codeAnalysis);
    issues.push(...result.issues);
    suggestions.push(...result.suggestions);
    score -= result.scorePenalty;
  } else if (frameworkName === 'nextjs') {
    const result = checkNextjsCompatibility(code, codeAnalysis);
    issues.push(...result.issues);
    suggestions.push(...result.suggestions);
    score -= result.scorePenalty;
  } else if (frameworkName === 'tailwindcss') {
    const result = checkTailwindCompatibility(code, codeAnalysis);
    issues.push(...result.issues);
    suggestions.push(...result.suggestions);
    score -= result.scorePenalty;
  }

  return { issues, suggestions, score: Math.max(0, score) };
}

function checkReactCompatibility(
  code: string,
  analysis: CodeAnalysis
): { issues: CompatibilityIssue[]; suggestions: string[]; scorePenalty: number } {
  const issues: CompatibilityIssue[] = [];
  const suggestions: string[] = [];
  let scorePenalty = 0;

  // Check for React import
  const reactImported = analysis.imports.some((imp) => imp.toLowerCase().includes('react'));
  if (!reactImported && analysis.jsx_elements.length > 0) {
    issues.push({
      line: 1,
      severity: 'error',
      message: 'JSX elements found but React not imported',
      suggestion: "Add: import React from 'react'",
    });
    scorePenalty += 0.3;
  }

  // Check for proper hook usage
  if (code.includes('useState') && !reactImported) {
    issues.push({
      line: 1,
      severity: 'error',
      message: 'useState hook used but React not imported',
      suggestion: "Import React hooks: import { useState } from 'react'",
    });
    scorePenalty += 0.2;
  }

  // Suggestions
  if (analysis.jsx_elements.length > 0) {
    suggestions.push('Use React.Fragment or <> </> for multiple root elements');
    suggestions.push('Consider using React.memo for performance optimization');
  }

  return { issues, suggestions, scorePenalty };
}

function checkNextjsCompatibility(
  code: string,
  analysis: CodeAnalysis
): { issues: CompatibilityIssue[]; suggestions: string[]; scorePenalty: number } {
  const issues: CompatibilityIssue[] = [];
  const suggestions: string[] = [];
  let scorePenalty = 0;

  // Check for proper Next.js imports
  if (code.includes('Link') && !analysis.imports.some((imp) => imp.includes('next/link'))) {
    issues.push({
      line: 1,
      severity: 'warning',
      message: 'Link component used but not imported from next/link',
      suggestion: "Add: import Link from 'next/link'",
    });
    scorePenalty += 0.1;
  }

  // Check for Image optimization
  if (code.includes('<img')) {
    suggestions.push('Consider using Next.js Image component for automatic optimization');
  }

  return { issues, suggestions, scorePenalty };
}

function checkTailwindCompatibility(
  code: string,
  analysis: CodeAnalysis
): { issues: CompatibilityIssue[]; suggestions: string[]; scorePenalty: number } {
  const issues: CompatibilityIssue[] = [];
  const suggestions: string[] = [];
  const scorePenalty = 0;

  // Check for custom CSS alongside Tailwind
  if (analysis.css_selectors.length > 0) {
    const customClasses = analysis.css_selectors.filter((sel) => !isTailwindClass(sel));
    if (customClasses.length > 0) {
      suggestions.push('Consider replacing custom CSS classes with Tailwind utilities');
    }
  }

  return { issues, suggestions, scorePenalty };
}

function isTailwindClass(className: string): boolean {
  const tailwindPatterns = [
    /^(text|bg|border|rounded|p|m|w|h|flex|grid|space)-/,
    /^(sm|md|lg|xl|2xl):/,
    /^(hover|focus|active|disabled):/,
    /^(text|bg)-(red|blue|green|yellow|purple|pink|gray|black|white)-\d+$/,
  ];

  return tailwindPatterns.some((pattern) => pattern.test(className));
}

function generateCrossFrameworkSuggestions(
  frameworks: string[],
  configs: Record<string, ReturnType<FrameworkRegistryManager['getFramework']>>,
  analysis: CodeAnalysis
): string[] {
  const suggestions: string[] = [];
  const frameworkNames = frameworks.map((f) => f.toLowerCase());

  // React + Tailwind suggestions
  if (frameworkNames.includes('react') && frameworkNames.includes('tailwindcss')) {
    suggestions.push('Use className prop instead of class for Tailwind classes in React');
    suggestions.push('Consider using clsx or classnames for conditional Tailwind classes');
  }

  // Next.js + Tailwind suggestions
  if (frameworkNames.includes('nextjs') && frameworkNames.includes('tailwindcss')) {
    suggestions.push('Configure Tailwind in next.config.js for optimal performance');
    suggestions.push("Use Tailwind's JIT mode for faster builds in Next.js");
  }

  // General multi-framework suggestions
  if (frameworks.length > 2) {
    suggestions.push('Ensure consistent coding patterns across all frameworks');
    suggestions.push('Consider creating a shared configuration file for framework settings');
  }

  return suggestions;
}

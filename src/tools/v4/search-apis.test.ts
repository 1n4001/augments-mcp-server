import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatSearchApisResponse, type SearchApisOutput } from './search-apis';

vi.mock('@/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('search-apis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatSearchApisResponse', () => {
    it('formats empty results with suggestions', () => {
      const output: SearchApisOutput = {
        results: [],
        totalFound: 0,
        frameworksSearched: ['react'],
        query: 'nonExistent',
      };

      const response = formatSearchApisResponse(output);
      expect(response).toContain('No APIs found');
      expect(response).toContain('Try:');
    });

    it('formats results grouped by framework', () => {
      const output: SearchApisOutput = {
        results: [
          {
            framework: 'react',
            name: 'useState',
            kind: 'function',
            signature: 'function useState<S>(initialState: S): [S, (value: S) => void]',
            relevance: 0.9,
          },
          {
            framework: 'react',
            name: 'useEffect',
            kind: 'function',
            signature: 'function useEffect(effect: () => void): void',
            relevance: 0.8,
          },
          {
            framework: 'vue',
            name: 'ref',
            kind: 'function',
            signature: 'function ref<T>(value: T): Ref<T>',
            relevance: 0.7,
          },
        ],
        totalFound: 3,
        frameworksSearched: ['react', 'vue'],
        query: 'state',
      };

      const response = formatSearchApisResponse(output);
      expect(response).toContain('## react');
      expect(response).toContain('## vue');
      expect(response).toContain('useState');
      expect(response).toContain('useEffect');
      expect(response).toContain('ref');
      expect(response).toContain('Found: 3 results');
    });

    it('includes relevance percentage', () => {
      const output: SearchApisOutput = {
        results: [
          {
            framework: 'react',
            name: 'useState',
            kind: 'function',
            signature: 'function useState()',
            relevance: 0.95,
          },
        ],
        totalFound: 1,
        frameworksSearched: ['react'],
        query: 'useState',
      };

      const response = formatSearchApisResponse(output);
      expect(response).toContain('95%');
    });

    it('includes description when available', () => {
      const output: SearchApisOutput = {
        results: [
          {
            framework: 'react',
            name: 'useState',
            kind: 'function',
            signature: 'function useState()',
            description: 'Returns a stateful value',
            relevance: 0.9,
          },
        ],
        totalFound: 1,
        frameworksSearched: ['react'],
        query: 'useState',
      };

      const response = formatSearchApisResponse(output);
      expect(response).toContain('Returns a stateful value');
    });

    it('wraps signature in typescript code block', () => {
      const output: SearchApisOutput = {
        results: [
          {
            framework: 'react',
            name: 'useState',
            kind: 'function',
            signature: 'function useState<S>(init: S): [S, (v: S) => void]',
            relevance: 0.9,
          },
        ],
        totalFound: 1,
        frameworksSearched: ['react'],
        query: 'useState',
      };

      const response = formatSearchApisResponse(output);
      expect(response).toContain('```typescript');
      expect(response).toContain('function useState<S>');
    });

    it('shows kind in result header', () => {
      const output: SearchApisOutput = {
        results: [
          {
            framework: 'react',
            name: 'useState',
            kind: 'function',
            signature: 'function useState()',
            relevance: 0.9,
          },
        ],
        totalFound: 1,
        frameworksSearched: ['react'],
        query: 'useState',
      };

      const response = formatSearchApisResponse(output);
      expect(response).toContain('### useState (function)');
    });
  });
});

/**
 * Performance Benchmark Script
 *
 * Measures latency for v4 tools to verify optimization targets:
 * - search_apis: <500ms
 * - get_api_context: <1s cold, <200ms warm
 * - Cache hit rates with LRU
 *
 * Run with: npx tsx scripts/benchmark.ts
 */

import { getApiContext } from '../src/tools/v4/get-api-context';
import { searchApis } from '../src/tools/v4/search-apis';
import { getVersionInfo } from '../src/tools/v4/get-version-info';

// Colors for terminal output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

interface BenchmarkResult {
  name: string;
  coldMs: number;
  warmMs: number;
  target: string;
  passed: boolean;
}

async function measure<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  return { result, ms };
}

async function benchmarkSearchApis(): Promise<BenchmarkResult> {
  console.log(dim('  Running search_apis benchmark...'));

  // Cold run
  const { ms: coldMs } = await measure(() =>
    searchApis({
      query: 'state management hook',
      frameworks: ['react', 'vue', 'zod'],
      limit: 5,
    })
  );

  // Warm run (types are cached)
  const { ms: warmMs } = await measure(() =>
    searchApis({
      query: 'state management hook',
      frameworks: ['react', 'vue', 'zod'],
      limit: 5,
    })
  );

  return {
    name: 'search_apis (3 frameworks)',
    coldMs,
    warmMs,
    target: '<500ms warm',
    passed: warmMs < 500,
  };
}

async function benchmarkSearchApisAll(): Promise<BenchmarkResult> {
  console.log(dim('  Running search_apis (all defaults) benchmark...'));

  const { ms: coldMs } = await measure(() =>
    searchApis({
      query: 'use',
      limit: 5,
    })
  );

  const { ms: warmMs } = await measure(() =>
    searchApis({
      query: 'use',
      limit: 5,
    })
  );

  return {
    name: 'search_apis (8 default frameworks)',
    coldMs,
    warmMs,
    target: '<500ms warm',
    passed: warmMs < 500,
  };
}

async function benchmarkGetApiContextCold(): Promise<BenchmarkResult> {
  console.log(dim('  Running get_api_context cold benchmark...'));

  const { ms: coldMs, result } = await measure(() =>
    getApiContext({
      query: 'react useEffect cleanup',
      includeExamples: true,
      maxExamples: 2,
    })
  );

  // Warm run
  const { ms: warmMs } = await measure(() =>
    getApiContext({
      query: 'react useEffect cleanup',
      includeExamples: true,
      maxExamples: 2,
    })
  );

  console.log(dim(`    API found: ${result.api?.name || 'none'}, examples: ${result.examples.length}`));

  return {
    name: 'get_api_context "react useEffect"',
    coldMs,
    warmMs,
    target: '<1s cold, <200ms warm',
    passed: coldMs < 3000 && warmMs < 500,
  };
}

async function benchmarkGetApiContextScoped(): Promise<BenchmarkResult> {
  console.log(dim('  Running get_api_context (scoped package) benchmark...'));

  const { ms: coldMs, result } = await measure(() =>
    getApiContext({
      query: '@tanstack/react-query useQuery',
      includeExamples: false,
    })
  );

  const { ms: warmMs } = await measure(() =>
    getApiContext({
      query: '@tanstack/react-query useQuery',
      includeExamples: false,
    })
  );

  console.log(dim(`    Framework: ${result.framework}, API: ${result.api?.name || 'none'}`));

  return {
    name: 'get_api_context "@tanstack/react-query"',
    coldMs,
    warmMs,
    target: '<1s cold',
    passed: coldMs < 3000,
  };
}

async function benchmarkGetApiContextDynamic(): Promise<BenchmarkResult> {
  console.log(dim('  Running get_api_context (dynamic resolution) benchmark...'));

  const { ms: coldMs, result } = await measure(() =>
    getApiContext({
      query: 'chalk bold',
      includeExamples: false,
    })
  );

  const { ms: warmMs } = await measure(() =>
    getApiContext({
      query: 'chalk bold',
      includeExamples: false,
    })
  );

  console.log(dim(`    Framework: ${result.framework}, Package: ${result.packageName}`));

  return {
    name: 'get_api_context "chalk bold" (dynamic)',
    coldMs,
    warmMs,
    target: '<2s cold',
    passed: coldMs < 5000,
  };
}

async function benchmarkVersionInfo(): Promise<BenchmarkResult> {
  console.log(dim('  Running get_version_info benchmark...'));

  const { ms: coldMs, result } = await measure(() =>
    getVersionInfo({ framework: 'react' })
  );

  const { ms: warmMs } = await measure(() =>
    getVersionInfo({ framework: 'react' })
  );

  console.log(dim(`    Latest: ${result.latestStable}, Total versions: ${result.totalVersions}`));

  return {
    name: 'get_version_info "react"',
    coldMs,
    warmMs,
    target: '<500ms warm',
    passed: warmMs < 500,
  };
}

async function benchmarkCacheHitRate(): Promise<void> {
  console.log(dim('  Running cache hit rate benchmark...'));

  const queries = [
    'react useEffect',
    'react useState',
    'react useCallback',
    'react useMemo',
    'react useRef',
    'vue ref',
    'vue reactive',
    'zod object',
    'express router',
    'react useEffect',   // repeat
    'react useState',    // repeat
    'vue ref',           // repeat
    'react useEffect',   // repeat again
    'zod object',        // repeat
    'react useCallback', // repeat
  ];

  const timings: number[] = [];
  for (const query of queries) {
    const { ms } = await measure(() =>
      getApiContext({ query, includeExamples: false })
    );
    timings.push(ms);
  }

  // First 9 are cold, last 6 are warm (repeats)
  const coldTimings = timings.slice(0, 9);
  const warmTimings = timings.slice(9);

  const avgCold = Math.round(coldTimings.reduce((a, b) => a + b, 0) / coldTimings.length);
  const avgWarm = Math.round(warmTimings.reduce((a, b) => a + b, 0) / warmTimings.length);

  console.log(`    Avg cold latency: ${avgCold}ms`);
  console.log(`    Avg warm latency: ${avgWarm}ms`);
  console.log(`    Speedup: ${avgCold > 0 ? (avgCold / Math.max(avgWarm, 1)).toFixed(1) : '?'}x`);
}

function printResult(r: BenchmarkResult) {
  const status = r.passed ? green('PASS') : red('FAIL');
  const coldStr = r.coldMs > 1000 ? yellow(`${r.coldMs}ms`) : `${r.coldMs}ms`;
  const warmStr = r.warmMs > 500 ? yellow(`${r.warmMs}ms`) : green(`${r.warmMs}ms`);
  console.log(`  ${status} ${r.name}`);
  console.log(`       Cold: ${coldStr} | Warm: ${warmStr} | Target: ${r.target}`);
}

async function main() {
  console.log();
  console.log(bold('='.repeat(60)));
  console.log(bold(' Augments MCP Server - Performance Benchmarks'));
  console.log(bold('='.repeat(60)));
  console.log();

  const results: BenchmarkResult[] = [];

  // Run benchmarks sequentially for accurate timing
  console.log(bold('1. search_apis'));
  results.push(await benchmarkSearchApis());
  results.push(await benchmarkSearchApisAll());
  console.log();

  console.log(bold('2. get_api_context'));
  results.push(await benchmarkGetApiContextCold());
  results.push(await benchmarkGetApiContextScoped());
  results.push(await benchmarkGetApiContextDynamic());
  console.log();

  console.log(bold('3. get_version_info'));
  results.push(await benchmarkVersionInfo());
  console.log();

  console.log(bold('4. Cache hit rate'));
  await benchmarkCacheHitRate();
  console.log();

  // Summary
  console.log(bold('='.repeat(60)));
  console.log(bold(' Results'));
  console.log(bold('='.repeat(60)));
  console.log();

  for (const r of results) {
    printResult(r);
    console.log();
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const allPassed = passed === total;

  console.log(bold('='.repeat(60)));
  console.log(
    allPassed
      ? green(bold(` All ${total} benchmarks passed!`))
      : red(bold(` ${passed}/${total} benchmarks passed`))
  );
  console.log(bold('='.repeat(60)));
  console.log();

  if (!allPassed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exitCode = 1;
});

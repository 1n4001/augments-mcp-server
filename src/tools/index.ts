/**
 * Tools module exports
 */

// Discovery tools
export {
  listAvailableFrameworks,
  searchFrameworks,
  getFrameworkInfo,
  getRegistryStats,
  ListFrameworksInputSchema,
  SearchFrameworksInputSchema,
  GetFrameworkInfoInputSchema,
  type ListFrameworksInput,
  type SearchFrameworksInput,
  type GetFrameworkInfoInput,
} from './discovery';

// Documentation tools
export {
  getFrameworkDocs,
  getFrameworkExamples,
  searchDocumentation,
  GetFrameworkDocsInputSchema,
  GetFrameworkExamplesInputSchema,
  SearchDocumentationInputSchema,
  type GetFrameworkDocsInput,
  type GetFrameworkExamplesInput,
  type SearchDocumentationInput,
} from './documentation';

// Context tools
export {
  getFrameworkContext,
  analyzeCodeCompatibility,
  GetFrameworkContextInputSchema,
  AnalyzeCodeCompatibilityInputSchema,
  type GetFrameworkContextInput,
  type AnalyzeCodeCompatibilityInput,
} from './context';

// Cache management tools
export {
  checkFrameworkUpdates,
  refreshFrameworkCache,
  getCacheStats,
  CheckFrameworkUpdatesInputSchema,
  RefreshFrameworkCacheInputSchema,
  type CheckFrameworkUpdatesInput,
  type RefreshFrameworkCacheInput,
} from './cache-management';

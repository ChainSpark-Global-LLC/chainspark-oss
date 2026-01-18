/**
 * AI Extraction Framework - Core Module
 * 
 * This is the main entry point for the extraction framework.
 * Import from `@/lib/core` to access all core functionality.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { createPipeline, ExtractorConfig } from "@/lib/core";
 * 
 * const result = await createPipeline().extractFromPages(chunks, myExtractor);
 * ```
 * 
 * ## What's Included
 * 
 * - **Types**: `ExtractorConfig`, `PageChunk`, `ExtractionResult`, etc.
 * - **Errors**: `ExtractionError`, `RateLimitError`, error codes
 * - **Pipeline**: `ExtractionPipeline`, `createPipeline`
 * - **Rate Limiting**: `RateLimiter`, `createRateLimiter`
 * - **Logging**: `Logger`, `createLogger`
 * 
 * @module core
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
    ExtractorConfig,
    RateLimitConfig,
    PageChunk,
    PageExtractionResult,
    ExtractionResult,
    ExtractionMetrics,
    ExtractedItem,
    EvidenceSpan,
} from "./types";

export { DEFAULT_RATE_LIMIT } from "./types";

// ============================================================================
// ERRORS
// ============================================================================

export {
    // Error codes enum
    ErrorCode,

    // Base error class
    ExtractionError,

    // Specialized error classes
    RateLimitError,
    ApiKeyError,
    SchemaValidationError,
    InputValidationError,

    // Error utilities
    wrapError,
    isExtractionError,

    // Types
    type ExtractionErrorMetadata,
} from "./errors";

// ============================================================================
// RATE LIMITER
// ============================================================================

export {
    RateLimiter,
    createRateLimiter,
    sleep,
    type RateLimiterMetrics,
} from "./rate-limiter";

// ============================================================================
// EXTRACTION PIPELINE
// ============================================================================

export {
    ExtractionPipeline,
    createPipeline,
    type ExtractionPipelineOptions,
} from "./extraction-pipeline";

// ============================================================================
// LOGGER
// ============================================================================

export {
    Logger,
    createLogger,
    type LogLevel,
    type LoggerConfig,
} from "./logger";

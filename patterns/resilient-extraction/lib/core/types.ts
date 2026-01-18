/**
 * Core Types for the AI Extraction Framework
 * 
 * ## Overview
 * 
 * This module defines the extension interface for creating custom extractors.
 * The key type is `ExtractorConfig` - implement this interface to add new
 * extraction capabilities without modifying the core framework.
 * 
 * ## Pattern: Configuration Objects over Classes
 * 
 * We use configuration objects (`ExtractorConfig`) instead of classes because:
 * 1. Easier to compose and extend
 * 2. JSON-serializable (useful for API boundaries)
 * 3. No `this` binding issues
 * 4. Better tree-shaking in bundlers
 * 
 * @module types
 */

import { ZodTypeAny } from "zod";

// ============================================================================
// EXTRACTOR CONFIGURATION
// ============================================================================

/**
 * Configuration for a custom extractor.
 * 
 * ## The Extension Interface
 * 
 * This is the primary interface for adding new extraction types.
 * Implement this interface, register it in `lib/extractors/index.ts`,
 * and your extractor is automatically available via the API.
 * 
 * ## Required Properties
 * 
 * - `name`: Unique identifier, used in API routes (`/api/extract/{name}`)
 * - `description`: Human-readable description for UI and docs
 * - `schema`: Zod schema that defines the shape of extracted items
 * - `buildPrompt`: Function that creates the LLM prompt from input text
 * 
 * @typeParam T - The Zod schema type for extracted items
 * 
 * @example Basic extractor
 * ```typescript
 * import { z } from "zod";
 * import { ExtractorConfig } from "./types";
 * 
 * const ProductSchema = z.object({
 *   name: z.string(),
 *   price: z.number(),
 *   confidence: z.number().min(0).max(1),
 * });
 * 
 * const productExtractor: ExtractorConfig<typeof ProductSchema> = {
 *   name: "product",
 *   description: "Extract products from e-commerce pages",
 *   schema: ProductSchema,
 *   buildPrompt: (text) => `Extract all products from:\n${text}`,
 * };
 * ```
 * 
 * @example With custom rate limiting
 * ```typescript
 * const slowExtractor: ExtractorConfig<typeof MySchema> = {
 *   name: "slow-service",
 *   description: "Extractor for a slow API",
 *   schema: MySchema,
 *   buildPrompt: (text) => `...`,
 *   rateLimit: {
 *     delayMs: 15000, // 15 seconds between calls
 *     maxRetries: 5,  // More retries for flaky service
 *   },
 * };
 * ```
 */
export interface ExtractorConfig<T extends ZodTypeAny = ZodTypeAny> {
    /**
     * Unique identifier for this extractor.
     * 
     * Used in:
     * - API routes: `/api/extract/{name}`
     * - Registry lookup: `getExtractor(name)`
     * - Logs and metrics
     * 
     * Convention: lowercase with hyphens (e.g., "job-posting", "invoice")
     */
    name: string;

    /**
     * Human-readable description.
     * 
     * Displayed in:
     * - API documentation
     * - UI dropdowns
     * - Help text
     */
    description: string;

    /**
     * Zod schema defining the structure of extracted items.
     * 
     * ## Why Zod?
     * 
     * 1. **Type inference**: `z.infer<typeof schema>` gives you TypeScript types
     * 2. **Runtime validation**: Guarantees LLM output matches expected shape
     * 3. **Self-documenting**: Schema fields have descriptions for the LLM
     * 4. **AI SDK integration**: Works directly with `generateObject()`
     * 
     * ## Best Practices
     * 
     * - Use `.describe()` on fields to help the LLM understand what to extract
     * - Include a `confidence` field (0-1) for quality filtering
     * - Use `.nullable()` for optional fields, not `.optional()`
     * 
     * @example
     * ```typescript
     * const schema = z.object({
     *   name: z.string().describe("Product name as displayed"),
     *   price: z.number().describe("Price in dollars, without currency symbol"),
     *   inStock: z.boolean().describe("Whether the item is available"),
     *   confidence: z.number().min(0).max(1).describe("Extraction confidence"),
     * });
     * ```
     */
    schema: T;

    /**
     * Function that builds the extraction prompt for the LLM.
     * 
     * ## Prompt Engineering Tips
     * 
     * 1. **Be specific**: Tell the LLM exactly what format you expect
     * 2. **Provide examples**: Show sample input/output pairs
     * 3. **Set boundaries**: Specify what NOT to include
     * 4. **Request confidence**: Ask the LLM to rate its own confidence
     * 
     * @param text - The input text to extract from
     * @returns The complete prompt to send to the LLM
     * 
     * @example
     * ```typescript
     * buildPrompt: (text) => `
     *   You are an expert at extracting product data from e-commerce pages.
     *   
     *   Extract ALL products from this text. For each product:
     *   - name: The product name exactly as displayed
     *   - price: Numeric price (e.g., "$29.99" → 29.99)
     *   - confidence: Your confidence in this extraction (0.0 to 1.0)
     *   
     *   TEXT:
     *   ${text}
     * `
     * ```
     */
    buildPrompt: (text: string) => string;

    /**
     * Optional rate limit configuration.
     * 
     * Override defaults when:
     * - Using a slower API (increase delayMs)
     * - Service is flaky (increase maxRetries)
     * - High-priority extractions (decrease delayMs, if within limits)
     * 
     * @default { delayMs: 7000, maxRetries: 3 }
     */
    rateLimit?: RateLimitConfig;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limiting configuration.
 * 
 * ## Why Rate Limiting?
 * 
 * LLM APIs have strict rate limits:
 * - Gemini: ~10 requests per minute
 * - OpenAI: Varies by tier (60-10,000 RPM)
 * - Anthropic: ~5-50 RPM depending on model
 * 
 * Without rate limiting, batch extraction jobs will hit 429 errors.
 * 
 * ## How It Works
 * 
 * 1. Before each API call, wait for `delayMs` since the last call
 * 2. On 429 error, wait with exponential backoff (2^attempt * delayMs)
 * 3. Give up after `maxRetries` attempts
 */
export interface RateLimitConfig {
    /**
     * Minimum delay between API calls in milliseconds.
     * 
     * For Gemini's 10 RPM limit: 7000ms = ~8.5 RPM (safe margin)
     * 
     * @default 7000
     */
    delayMs: number;

    /**
     * Maximum retry attempts on rate limit (429) errors.
     * 
     * Each retry uses exponential backoff: 2^attempt * delayMs
     * 
     * @default 3
     */
    maxRetries: number;

    /**
     * Maximum number of concurrent requests.
     * 
     * Use this to process multiple pages in parallel while still
     * respecting the `delayMs` per "slot".
     * 
     * @default 1
     */
    maxConcurrent: number;
}

/**
 * Default rate limit configuration.
 * 
 * Tuned for Gemini's 10 RPM limit with safety margin.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
    // 7 seconds = ~8.5 requests/minute, safely under 10 RPM
    delayMs: 7000,
    // 3 retries with exponential backoff covers ~2 minutes of throttling
    maxRetries: 3,
    // Default to sequential for backward compatibility
    maxConcurrent: 1,
};

// ============================================================================
// PAGE CHUNKS
// ============================================================================

/**
 * A chunk of document content, typically representing a single page.
 * 
 * ## Why Page-by-Page?
 * 
 * Large documents (100+ pages) can't be processed in a single LLM call due to:
 * 1. Context window limits (8k-128k tokens)
 * 2. Response size limits
 * 3. Timeout constraints
 * 
 * Breaking documents into chunks allows:
 * - Processing documents of any size
 * - Parallel processing (with rate limiting)
 * - Error isolation (one page fails, others continue)
 * 
 * @example Creating chunks from a document
 * ```typescript
 * const chunks: PageChunk[] = [
 *   { content: "Page 1 content...", pageNumber: 1 },
 *   { content: "Page 2 content...", pageNumber: 2 },
 * ];
 * 
 * // Or use the helper:
 * const chunks = ExtractionPipeline.splitIntoPages(text, "\n---\n");
 * ```
 */
export interface PageChunk {
    /**
     * The text content of this chunk.
     */
    content: string;

    /**
     * Page number (1-indexed).
     * 
     * Used for:
     * - Ordering results
     * - Error attribution
     * - Progress tracking
     */
    pageNumber: number;

    /**
     * Optional metadata for this chunk.
     * 
     * Useful for tracking source information:
     * - Source file name
     * - Original page coordinates (for PDFs)
     * - Processing hints
     */
    metadata?: Record<string, unknown>;
}

// ============================================================================
// EXTRACTION RESULTS
// ============================================================================

/**
 * Result of extracting from a single page.
 * 
 * Used internally for tracking per-page success/failure.
 * The final `ExtractionResult` aggregates these.
 */
export interface PageExtractionResult<T> {
    /** Extracted items from this page */
    items: T[];

    /** Page number this result came from */
    pageNumber: number;

    /** Whether extraction succeeded */
    success: boolean;

    /**
     * Error message if extraction failed.
     * 
     * Check this to understand why a page failed without
     * parsing the full error object.
     */
    error?: string;

    /**
     * Error code if extraction failed.
     * 
     * Matches the codes in `lib/core/errors.ts`:
     * - "RATE_LIMIT"
     * - "SCHEMA_VALIDATION_FAILED"
     * - "TIMEOUT"
     * - etc.
     */
    errorCode?: string;
}

/**
 * Complete extraction result across all pages.
 * 
 * ## What's Included
 * 
 * - `items`: Deduplicated array of all extracted items
 * - `pagesProcessed`: Total pages attempted
 * - `pagesFailed`: How many pages had errors
 * - `pageResults`: Per-page details for debugging
 * - `metrics`: Timing and quality metrics
 * 
 * @typeParam T - The type of extracted items
 * 
 * @example Handling results
 * ```typescript
 * const result = await pipeline.extractFromPages(chunks, extractor);
 * 
 * console.log(`Extracted ${result.items.length} items`);
 * console.log(`Success rate: ${100 - (result.pagesFailed / result.pagesProcessed * 100)}%`);
 * 
 * // Filter by confidence
 * const highConfidence = result.items.filter(item => item.confidence > 0.8);
 * 
 * // Check for errors
 * const failedPages = result.pageResults.filter(r => !r.success);
 * if (failedPages.length > 0) {
 *   console.warn("Some pages failed:", failedPages.map(p => p.pageNumber));
 * }
 * ```
 */
export interface ExtractionResult<T> {
    /**
     * All extracted items (deduplicated).
     * 
     * Deduplication is based on the `description` field if present,
     * otherwise by full JSON comparison.
     */
    items: T[];

    /**
     * Total number of pages processed (attempted).
     */
    pagesProcessed: number;

    /**
     * Number of pages that failed extraction.
     * 
     * Check `pageResults` to see which pages failed and why.
     */
    pagesFailed: number;

    /**
     * Per-page results for debugging and detailed analysis.
     * 
     * Use this to:
     * - Find which pages had errors
     * - Retry failed pages
     * - Correlate items to source pages
     */
    pageResults: PageExtractionResult<T>[];

    /**
     * Processing metrics for monitoring and optimization.
     */
    metrics: ExtractionMetrics;
}

/**
 * Metrics about the extraction process.
 * 
 * Useful for:
 * - Monitoring extraction quality over time
 * - Debugging slow extractions
 * - Understanding deduplication impact
 */
export interface ExtractionMetrics {
    /**
     * Final count of unique items extracted.
     */
    totalItems: number;

    /**
     * Count before deduplication.
     * 
     * High `itemsBeforeDedup - totalItems` suggests:
     * - Overlapping content between pages
     * - Or overly aggressive extraction prompt
     */
    itemsBeforeDedup: number;

    /**
     * Total processing time in milliseconds.
     * 
     * Includes:
     * - All LLM API calls
     * - Rate limiting delays
     * - Parsing and validation
     */
    processingTimeMs: number;

    /**
     * Average confidence across all extracted items.
     * 
     * Only present if items have a `confidence` field.
     * Low average (< 0.7) may indicate:
     * - Document quality issues
     * - Schema mismatch
     * - Ambiguous content
     */
    averageConfidence?: number;
}

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Extract the item type from an ExtractorConfig.
 * 
 * @example
 * ```typescript
 * type InvoiceItem = ExtractedItem<typeof invoiceExtractor>;
 * // InvoiceItem is the inferred type from InvoiceLineItemSchema
 * ```
 */
export type ExtractedItem<T extends ExtractorConfig> =
    T extends ExtractorConfig<infer S>
    ? S extends ZodTypeAny
    ? import("zod").z.infer<S>
    : never
    : never;

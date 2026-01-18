/**
 * Extraction Pipeline
 * 
 * ## The Orchestration Pattern
 * 
 * This module implements a resilient, page-by-page extraction pipeline.
 * It coordinates multiple low-level components (AI Client, Rate Limiter, 
 * Schema Validation) into a high-level workflow.
 * 
 * ## Pattern: Page-by-Page Processing
 * 
 * Why this pattern?
 * 1. **Context Limits**: Standard LLM context windows (8k-128k tokens) can't 
 *    safely extract detailed data from 100+ page documents in one go.
 * 2. **Refined Extraction**: Focuses the LLM's attention on a smaller chunk 
 *    per call, leading to significantly higher extraction accuracy.
 * 3. **Error Isolation**: If page 42 has corrupted text that causes a failure, 
 *    pages 1-41 and 43-100 still succeed.
 * 4. **Progress Feedback**: Since processing is sequential, we can report 
 *    real-time progress (e.g., "30% complete").
 * 
 * @module extraction-pipeline
 */

import { z, ZodTypeAny } from "zod";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
    ExtractorConfig,
    PageChunk,
    PageExtractionResult,
    ExtractionResult,
    DEFAULT_RATE_LIMIT,
} from "./types";
import { RateLimiter } from "./rate-limiter";
import { ApiKeyError, wrapError, ExtractionError } from "./errors";
import { createLogger } from "./logger";

const logger = createLogger("extraction-pipeline");

/**
 * Configuration options for the extraction pipeline.
 */
export interface ExtractionPipelineOptions {
    /** 
     * Gemini API key. 
     * Defaults to `GEMINI_API_KEY` environment variable.
     */
    apiKey?: string;

    /** 
     * Model to use (default: "gemini-2.5-flash").
     * Gemini 2.5 Flash is recommended for speed and efficiency in extraction.
     */
    model?: string;

    /** 
     * Temperature for generation (default: 0.1).
     * Low temperature ensures high determinism for structured extraction.
     */
    temperature?: number;

    /** 
     * Optional callback for real-time progress updates.
     * Useful for updating UIs during long-running extractions.
     */
    onProgress?: (current: number, total: number, status: string) => void;
}

/**
 * Main orchestration class for the extraction framework.
 * 
 * @example
 * ```typescript
 * const pipeline = createPipeline();
 * const result = await pipeline.extractFromPages(pages, invoiceExtractor);
 * 
 * console.log(`Extracted ${result.items.length} items from ${result.pagesProcessed} pages`);
 * ```
 */
export class ExtractionPipeline {
    private google: ReturnType<typeof createGoogleGenerativeAI>;
    private model: string;
    private temperature: number;
    private onProgress?: (current: number, total: number, status: string) => void;

    constructor(options: ExtractionPipelineOptions = {}) {
        const apiKey = options.apiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new ApiKeyError(
                "GEMINI_API_KEY is required. Set it in your environment or pass it to the constructor."
            );
        }

        this.google = createGoogleGenerativeAI({ apiKey });
        this.model = options.model || "gemini-2.5-flash";
        this.temperature = options.temperature ?? 0.1;
        this.onProgress = options.onProgress;
    }

    /**
     * Extract items from a single chunk of text.
     * 
     * Uses Vercel AI SDK's `generateObject` for guaranteed structured validation
     * against the provided Zod schema.
     * 
     * @typeParam T - The Zod schema type
     * @param text - Input text content
     * @param extractor - Extractor configuration (schema + prompt builder)
     * @returns Array of validated extracted items
     * @throws {SchemaValidationError} If LLM output doesn't match the schema
     * @throws {ExtractionError} On general generation failures
     */
    async extractSingle<T extends ZodTypeAny>(
        text: string,
        extractor: ExtractorConfig<T>
    ): Promise<z.infer<T>[]> {
        const prompt = extractor.buildPrompt(text);

        try {
            const { object } = await generateObject({
                model: this.google(this.model),
                schema: z.object({
                    items: z.array(extractor.schema).describe("List of extracted items"),
                }),
                prompt,
                temperature: this.temperature,
            });

            return object.items;
        } catch (error) {
            throw wrapError(error, `Extraction failed for schema "${extractor.name}"`);
        }
    }

    /**
     * Extract items from multiple document chunks with full orchestration.
     * 
     * This is the main high-level method for processing entire documents.
     * It handles:
     * 1. Rate limiting between API calls
     * 2. Page-level error isolation
     * 3. Result aggregation
     * 4. Deduplication
     * 
     * @typeParam T - The Zod schema type
     * @param chunks - Array of document pages/chunks
     * @param extractor - Extractor configuration
     * @returns Full extraction result with items, metrics, and page-level details
     */
    async extractFromPages<T extends ZodTypeAny>(
        chunks: PageChunk[],
        extractor: ExtractorConfig<T>
    ): Promise<ExtractionResult<z.infer<T>>> {
        const startTime = Date.now();
        const rateLimiter = new RateLimiter(extractor.rateLimit || DEFAULT_RATE_LIMIT);
        const pageResults: PageExtractionResult<z.infer<T>>[] = [];
        let allItems: z.infer<T>[] = [];

        logger.info(`Starting extraction`, {
            pageCount: chunks.length,
            extractor: extractor.name
        });

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const pageNum = chunk.pageNumber;

            this.onProgress?.(i + 1, chunks.length, `Processing page ${pageNum}`);
            logger.debug(`Processing page`, { pageNum, current: i + 1, total: chunks.length });

            try {
                // Execute extraction with rate limiting and retry logic
                const items = await rateLimiter.execute(
                    () => this.extractSingle(chunk.content, extractor),
                    `Page ${pageNum} extraction`
                );

                pageResults.push({
                    items,
                    pageNumber: pageNum,
                    success: true,
                });

                allItems.push(...items);
                logger.info(`Page extraction successful`, { pageNum, itemCount: items.length });
            } catch (error) {
                const exError = wrapError(error);
                logger.error(`Page extraction failed`, {
                    pageNum,
                    error: exError.message,
                    errorCode: exError.code
                });

                pageResults.push({
                    items: [],
                    pageNumber: pageNum,
                    success: false,
                    error: exError.message,
                    errorCode: exError.code,
                });
            }
        }

        // Aggregate and Deduplicate
        allItems = this.deduplicateItems(allItems);
        const processingTimeMs = Date.now() - startTime;
        const pagesFailed = pageResults.filter((r) => !r.success).length;

        return {
            items: allItems,
            pagesProcessed: chunks.length,
            pagesFailed,
            pageResults,
            metrics: {
                totalItems: allItems.length,
                itemsBeforeDedup: pageResults.reduce((sum, r) => sum + r.items.length, 0),
                processingTimeMs,
                averageConfidence: this.calculateAverageConfidence(allItems),
            },
        };
    }

    /**
     * Optimized: Parallel Page Extraction
     * 
     * Processes all pages concurrently. The total duration is limited by
     * the LLM's RPM and the slowest single page.
     */
    async extractParallel<T extends ZodTypeAny>(
        chunks: PageChunk[],
        extractor: ExtractorConfig<T>
    ): Promise<ExtractionResult<z.infer<T>>> {
        const startTime = Date.now();
        const config = { ...DEFAULT_RATE_LIMIT, ...extractor.rateLimit };
        const rateLimiter = new RateLimiter(config);

        logger.info(`Starting parallel extraction`, {
            pageCount: chunks.length,
            extractor: extractor.name,
            maxConcurrent: config.maxConcurrent
        });

        const tasks = chunks.map(async (chunk, i) => {
            const pageNum = chunk.pageNumber;
            try {
                this.onProgress?.(i + 1, chunks.length, `Processing page ${pageNum}`);
                const items = await rateLimiter.execute(
                    () => this.extractSingle(chunk.content, extractor),
                    `Page ${pageNum} extraction`
                );
                return { items, pageNumber: pageNum, success: true } as PageExtractionResult<z.infer<T>>;
            } catch (error) {
                const exError = wrapError(error);
                return {
                    items: [],
                    pageNumber: pageNum,
                    success: false,
                    error: exError.message,
                    errorCode: exError.code
                } as PageExtractionResult<z.infer<T>>;
            }
        });

        const pageResults = await Promise.all(tasks);
        let allItems: z.infer<T>[] = [];
        for (const res of pageResults) {
            allItems.push(...res.items);
        }

        const itemsBeforeDedup = allItems.length;
        allItems = this.deduplicateItems(allItems);
        const processingTimeMs = Date.now() - startTime;

        return {
            items: allItems,
            pagesProcessed: chunks.length,
            pagesFailed: pageResults.filter((r) => !r.success).length,
            pageResults,
            metrics: {
                totalItems: allItems.length,
                itemsBeforeDedup,
                processingTimeMs,
                averageConfidence: this.calculateAverageConfidence(allItems),
            },
        };
    }

    /**
     * Pattern: Result Streaming
     * 
     * Returns an AsyncGenerator that yields results as soon as they are 
     * available from the LLM.
     */
    async *extractStreaming<T extends ZodTypeAny>(
        chunks: PageChunk[],
        extractor: ExtractorConfig<T>
    ): AsyncGenerator<PageExtractionResult<z.infer<T>>> {
        const config = { ...DEFAULT_RATE_LIMIT, ...extractor.rateLimit };
        const rateLimiter = new RateLimiter(config);

        // Wrap each promise to also return its own identity for removal
        const tasks = chunks.map(async (chunk) => {
            const pageNum = chunk.pageNumber;
            try {
                const items = await rateLimiter.execute(
                    () => this.extractSingle(chunk.content, extractor),
                    `Page ${pageNum} extraction`
                );
                return { items, pageNumber: pageNum, success: true } as PageExtractionResult<z.infer<T>>;
            } catch (error) {
                const exError = wrapError(error);
                return {
                    items: [],
                    pageNumber: pageNum,
                    success: false,
                    error: exError.message,
                    errorCode: exError.code
                } as PageExtractionResult<z.infer<T>>;
            }
        });

        const pool = new Set(tasks);
        while (pool.size > 0) {
            // Promise.race returns the value of the first resolved promise
            // We need to find which promise resolved to remove it from the pool.
            const finished = await Promise.race(
                Array.from(pool).map(p => p.then(res => ({ res, p })))
            );
            yield finished.res;
            pool.delete(finished.p);
        }
    }

    private calculateAverageConfidence(items: any[]): number | undefined {
        if (items.length > 0 && typeof items[0].confidence === "number") {
            const totalConfidence = items.reduce(
                (sum, item) => sum + (item.confidence || 0),
                0
            );
            return totalConfidence / items.length;
        }
        return undefined;
    }

    /**
     * Helper: Global Content Deduplication
     * 
     * Uses a multi-pass strategy to identify duplicate items:
     * 1. **Pass 1 (Evidence-based)**: If items have `evidence` spans, use the
     *    source text for comparison. This is the most precise method because
     *    it uses the exact text from the document.
     * 2. **Pass 2 (Description-based)**: Fallback to comparing by `description`
     *    field (normalized to lowercase).
     * 3. **Pass 3 (Full JSON)**: Final fallback for items without known fields.
     */
    private deduplicateItems<T>(items: T[]): T[] {
        const seen = new Set<string>();
        const deduplicated: T[] = [];

        for (const item of items) {
            let key: string;

            // Pass 1: Use evidence span text if available (highest precision)
            const evidence = (item as any).evidence;
            if (evidence?.descriptionSpan?.text) {
                key = `evidence:${evidence.descriptionSpan.text.trim()}`;
            }
            // Pass 2: Use description field if available
            else if (typeof (item as any).description === "string") {
                key = `desc:${(item as any).description.toLowerCase().trim()}`;
            }
            // Pass 3: Fallback to full JSON comparison
            else {
                key = `json:${JSON.stringify(item)}`;
            }

            if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(item);
            }
        }

        return deduplicated;
    }

    /**
     * Utility: Split text into page chunks using a delimiter.
     * 
     * Useful when processing documents that have clear page markers
     * (e.g., PDF-to-text outputs with marker characters).
     */
    static splitIntoPages(text: string, delimiter: string = "\n---PAGE---\n"): PageChunk[] {
        const pages = text.split(delimiter);
        return pages.map((content, index) => ({
            content: content.trim(),
            pageNumber: index + 1,
        }));
    }

    /**
     * Utility: Intelligent Context Chunking
     * 
     * Splits a large block of text into chunks of `maxChunkSize`, 
     * attempting to preserve paragraph and sentence boundaries.
     * 
     * Why chunking?
     * Prevents large documents from overflowing the LLM's context window.
     */
    static chunkBySize(text: string, maxChunkSize: number = 4000): PageChunk[] {
        const chunks: PageChunk[] = [];
        let remaining = text;
        let pageNumber = 1;

        while (remaining.length > 0) {
            let splitIndex = maxChunkSize;

            if (remaining.length > maxChunkSize) {
                // Heuristic: Try splitting at paragraph break first
                const paragraphBreak = remaining.lastIndexOf("\n\n", maxChunkSize);
                if (paragraphBreak > maxChunkSize * 0.5) {
                    splitIndex = paragraphBreak;
                } else {
                    // Fallback: Split at sentence end
                    const sentenceBreak = remaining.lastIndexOf(". ", maxChunkSize);
                    if (sentenceBreak > maxChunkSize * 0.5) {
                        splitIndex = sentenceBreak + 1;
                    }
                }
            } else {
                splitIndex = remaining.length;
            }

            chunks.push({
                content: remaining.slice(0, splitIndex).trim(),
                pageNumber,
            });

            remaining = remaining.slice(splitIndex).trim();
            pageNumber++;
        }

        return chunks;
    }
}

/**
 * Factory function to create a new extraction pipeline.
 * 
 * Includes default configurations for most use cases.
 */
export function createPipeline(options?: ExtractionPipelineOptions): ExtractionPipeline {
    return new ExtractionPipeline(options);
}

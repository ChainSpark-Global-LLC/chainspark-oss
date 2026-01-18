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
                // Pattern: Error Isolation
                // We log the error but allow the overall process to continue.
                // The final response will detail which pages failed.
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

        // Pattern: Cross-Page Deduplication
        // When splitting documents, some items might span across page boundaries
        // or be repeated (e.g., headers/footers). This step ensures global uniqueness.
        const itemsBeforeDedup = allItems.length;
        allItems = this.deduplicateItems(allItems);

        const processingTimeMs = Date.now() - startTime;
        const pagesFailed = pageResults.filter((r) => !r.success).length;

        logger.info(`Extraction complete`, {
            uniqueItemCount: allItems.length,
            itemsBeforeDedup,
            pagesProcessed: chunks.length,
            pagesFailed,
            durationMs: processingTimeMs
        });

        // Calculate quality metrics (average confidence)
        let averageConfidence: number | undefined;
        if (allItems.length > 0 && typeof (allItems[0] as any).confidence === "number") {
            const totalConfidence = allItems.reduce(
                (sum, item) => sum + ((item as any).confidence || 0),
                0
            );
            averageConfidence = totalConfidence / allItems.length;
        }

        return {
            items: allItems,
            pagesProcessed: chunks.length,
            pagesFailed,
            pageResults,
            metrics: {
                totalItems: allItems.length,
                itemsBeforeDedup,
                processingTimeMs,
                averageConfidence,
            },
        };
    }

    /**
     * Helper: Global Content Deduplication
     * 
     * Uses a heuristic to identify duplicate items across different pages.
     * Priority:
     * 1. If an item has a `description` field, we use its normalized text.
     * 2. If not, we use the full JSON string representation.
     */
    private deduplicateItems<T>(items: T[]): T[] {
        const seen = new Set<string>();
        const deduplicated: T[] = [];

        for (const item of items) {
            const key =
                typeof (item as any).description === "string"
                    ? (item as any).description.toLowerCase().trim()
                    : JSON.stringify(item);

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

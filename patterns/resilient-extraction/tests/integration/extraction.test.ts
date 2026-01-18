/**
 * Extraction Pipeline Integration Tests
 * 
 * ## Pattern: Integration Testing for AI Workflows
 * 
 * These tests verify the orchestration of multiple components:
 * 1. `ExtractionPipeline` (The Orchestrator)
 * 2. `RateLimiter` (Throughput Control)
 * 3. AI SDK `generateObject` (Mocked AI Client)
 * 
 * ## Key Patterns Tested
 * 
 * - **Page-by-Page Processing**: Ensuring sequential calls are made correctly.
 * - **Error Isolation**: Verifying that a single page failure doesn't crash the whole job.
 * - **Aggregation**: Ensuring results from all pages are combined.
 * - **Deduplication**: Verifying that identical items across pages are filtered out.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { z } from "zod";
import { createPipeline, ExtractorConfig, ExtractionPipeline } from "@/lib/core";
import { setupSuccessfulExtraction, setupExtractionSequence } from "../helpers/mock-llm";
import { generateObject } from "ai";

// Mock the AI SDK
vi.mock("ai", () => ({
    generateObject: vi.fn(),
}));

// Set a dummy API key for testing
process.env.GEMINI_API_KEY = "test-key";

describe("Extraction Pipeline Integration", () => {
    // Simple schema for testing
    const TestSchema = z.object({
        name: z.string(),
        value: z.number(),
        description: z.string().optional(),
    });

    const testExtractor: ExtractorConfig<typeof TestSchema> = {
        name: "test-extractor",
        description: "A test extractor for integration tests",
        schema: TestSchema,
        buildPrompt: (text) => `Extract from: ${text}`,
        rateLimit: { delayMs: 10, maxRetries: 2 },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Test: Basic happy path
     */
    it("extracts items from multiple pages and aggregates them", async () => {
        // Arrange
        const pages = [
            { content: "Page 1 data", pageNumber: 1 },
            { content: "Page 2 data", pageNumber: 2 },
        ];

        const mockDataPage1 = [{ name: "Item 1", value: 100 }];
        const mockDataPage2 = [{ name: "Item 2", value: 200 }];

        setupExtractionSequence(generateObject, [
            { success: true, data: mockDataPage1 },
            { success: true, data: mockDataPage2 },
        ]);

        const pipeline = createPipeline();

        // Act
        const result = await pipeline.extractFromPages(pages, testExtractor);

        // Assert
        expect(result.items).toHaveLength(2);
        expect(result.items[0].name).toBe("Item 1");
        expect(result.items[1].name).toBe("Item 2");
        expect(result.pagesProcessed).toBe(2);
        expect(result.pagesFailed).toBe(0);

        // Check specific page status
        expect(result.pageResults[0].success).toBe(true);
        expect(result.pageResults[1].success).toBe(true);
    });

    /**
     * Pattern: Error Isolation Implementation
     * 
     * Test that if Page 2 fails, we still get items from Page 1 and 3.
     */
    it("isolates failures to specific pages without failing the whole job", async () => {
        // Arrange
        const pages = [
            { content: "Success 1", pageNumber: 1 },
            { content: "Fail 2", pageNumber: 2 },
            { content: "Success 3", pageNumber: 3 },
        ];

        setupExtractionSequence(generateObject, [
            { success: true, data: [{ name: "Page 1 Item", value: 1 }] },
            { success: false, data: new Error("Simulated LLM Failure") },
            { success: true, data: [{ name: "Page 3 Item", value: 3 }] },
        ]);

        const pipeline = createPipeline();

        // Act
        const result = await pipeline.extractFromPages(pages, testExtractor);

        // Assert
        expect(result.items).toHaveLength(2); // Items from p1 and p3
        expect(result.pagesProcessed).toBe(3);
        expect(result.pagesFailed).toBe(1);

        // Check specific page status
        expect(result.pageResults[0].success).toBe(true);
        expect(result.pageResults[1].success).toBe(false);
        expect(result.pageResults[1].error).toContain("Simulated LLM Failure");
        expect(result.pageResults[2].success).toBe(true);
    });

    /**
     * Pattern: Global Deduplication
     * 
     * Test that items repeated across pages are only returned once.
     */
    it("deduplicates items based on description across multiple pages", async () => {
        // Arrange
        const pages = [
            { content: "Page 1", pageNumber: 1 },
            { content: "Page 2", pageNumber: 2 },
        ];

        // Item with same description should be deduped
        const mockDataPage1 = [{ name: "Original", value: 10, description: "Shared ID" }];
        const mockDataPage2 = [{ name: "Duplicate", value: 20, description: "Shared ID" }];

        setupExtractionSequence(generateObject, [
            { success: true, data: mockDataPage1 },
            { success: true, data: mockDataPage2 },
        ]);

        const pipeline = createPipeline();

        // Act
        const result = await pipeline.extractFromPages(pages, testExtractor);

        // Assert
        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe("Original");
        expect(result.metrics.itemsBeforeDedup).toBe(2);
    });

    /**
     * Test: Progress reporting
     */
    it("reports progress via callback", async () => {
        // Arrange
        const pages = [
            { content: "P1", pageNumber: 1 },
            { content: "P2", pageNumber: 2 },
        ];
        setupSuccessfulExtraction(generateObject, [{ name: "item", value: 1 }]);

        const onProgress = vi.fn();
        const pipeline = createPipeline({ onProgress });

        // Act
        await pipeline.extractFromPages(pages, testExtractor);

        // Assert
        expect(onProgress).toHaveBeenCalledTimes(2);
        expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2, expect.stringContaining("page 1"));
        expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2, expect.stringContaining("page 2"));
    });

    /**
     * Test: Utility - splitIntoPages
     */
    it("splits text into pages correctly", () => {
        const text = "Part 1\n---PAGE---\nPart 2\n---PAGE---\nPart 3";
        const chunks = ExtractionPipeline.splitIntoPages(text);

        expect(chunks).toHaveLength(3);
        expect(chunks[0].content).toBe("Part 1");
        expect(chunks[1].pageNumber).toBe(2);
    });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPipeline } from "../../lib/core/extraction-pipeline";
import { z } from "zod";
import { generateObject } from "ai";

// Mock the AI SDK
vi.mock("ai", () => ({
    generateObject: vi.fn(),
}));

describe("ExtractionPipeline Latency Optimizations", () => {
    const TestSchema = z.object({
        id: z.number(),
        text: z.string(),
    });

    const testExtractor = {
        name: "test",
        description: "Test extractor",
        schema: TestSchema,
        buildPrompt: (text: string) => `Extract from: ${text}`,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("extractParallel() should return all items from all pages", async () => {
        const mockFn = vi.mocked(generateObject);
        // Return unique items to avoid deduplication
        mockFn.mockImplementation(async (options: any) => {
            const pageId = options.prompt.includes("page 2") ? 2 : 1;
            return {
                object: { items: [{ id: pageId, text: `item ${pageId}` }] },
                finishReason: "stop",
                usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            } as any;
        });

        const pipeline = createPipeline({ apiKey: "test-key" });
        const pages = [
            { content: "page 1", pageNumber: 1 },
            { content: "page 2", pageNumber: 2 },
        ];

        const result = await pipeline.extractParallel(pages, testExtractor);

        expect(result.items).toHaveLength(2);
        expect(result.pagesProcessed).toBe(2);
        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("extractStreaming() should yield results as they become available", async () => {
        const mockFn = vi.mocked(generateObject);

        // Mock with different delays to verify streaming order
        // Page 1 takes 200ms, Page 2 takes 50ms
        mockFn.mockImplementation(async (options: any) => {
            const isPage1 = options.prompt.includes("page 1");
            await new Promise(resolve => setTimeout(resolve, isPage1 ? 200 : 50));
            return {
                object: { items: [{ id: isPage1 ? 1 : 2, text: "item" }] },
                finishReason: "stop",
                usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            } as any;
        });

        const pipeline = createPipeline({ apiKey: "test-key" });
        const pages = [
            { content: "page 1", pageNumber: 1 },
            { content: "page 2", pageNumber: 2 },
        ];

        const yieldedResults: any[] = [];
        // Use an increased RPM to avoid being throttled by the rate limiter during the test
        const fastExtractor = {
            ...testExtractor,
            rateLimit: { delayMs: 10, maxRetries: 1, maxConcurrent: 5 }
        };

        for await (const res of pipeline.extractStreaming(pages, fastExtractor)) {
            yieldedResults.push(res);
        }

        expect(yieldedResults).toHaveLength(2);
        // Page 2 should arrive BEFORE Page 1 because it has a shorter delay
        expect(yieldedResults[0].pageNumber).toBe(2);
        expect(yieldedResults[1].pageNumber).toBe(1);
    });

    it("should respect maxConcurrent limit in rate limiter", async () => {
        const mockFn = vi.mocked(generateObject);

        let inFlight = 0;
        let maxSeenInFlight = 0;

        mockFn.mockImplementation(async () => {
            inFlight++;
            maxSeenInFlight = Math.max(maxSeenInFlight, inFlight);
            await new Promise(resolve => setTimeout(resolve, 50));
            inFlight--;
            return {
                object: { items: [] },
                finishReason: "stop",
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            } as any;
        });

        const pipeline = createPipeline({ apiKey: "test-key" });
        const pages = Array.from({ length: 5 }, (_, i) => ({ content: `page ${i}`, pageNumber: i + 1 }));

        const limitedExtractor = {
            ...testExtractor,
            rateLimit: { delayMs: 0, maxRetries: 1, maxConcurrent: 2 }
        };

        await pipeline.extractParallel(pages, limitedExtractor);

        expect(maxSeenInFlight).toBe(2);
    });
});

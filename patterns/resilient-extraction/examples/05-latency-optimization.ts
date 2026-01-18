/**
 * Example 05: Latency Optimization (Parallel & Streaming)
 * 
 * This example demonstrates the two main latency optimization patterns:
 * 1. **Parallel Extraction**: Processing multiple pages concurrently.
 * 2. **Result Streaming**: Using AsyncGenerators to yield results as they arrive.
 * 
 * Setup:
 * 1. Set GEMINI_API_KEY in your .env file
 * 2. Run: npx tsx examples/05-streaming-extraction.ts
 */

import dotenv from "dotenv";
import { z } from "zod";
import { createPipeline, DEFAULT_RATE_LIMIT } from "../lib/core";

dotenv.config();

// 1. Define the Schema
const FactSchema = z.object({
    fact: z.string().describe("A single verifiable fact from the text"),
    confidence: z.number().min(0).max(1),
});

// 2. Configure the Extractor
const factExtractor = {
    name: "fact-extractor",
    description: "Extracts key facts from text",
    schema: FactSchema,
    buildPrompt: (text: string) => `Extract all unique verifiable facts from this text:\n\n${text}`,
    // Optimize for Latency: Allow 3 concurrent requests
    // Gemini 2.5 Flash Free Tier is 10 RPM, so 3 concurrent is safe
    rateLimit: {
        ...DEFAULT_RATE_LIMIT,
        maxConcurrent: 3,
        delayMs: 2000, // Faster than default since we have high concurrency
    }
};

async function runExample() {
    console.log("🚀 Starting Latency Optimized Extraction Example\n");

    const pipeline = createPipeline();

    // Create a mock multi-page document
    const pages = [
        { content: "The Great Wall of China is over 13,000 miles long.", pageNumber: 1 },
        { content: "The Eiffel Tower was completed in 1889.", pageNumber: 2 },
        { content: "The Amazon River is the largest by discharge volume.", pageNumber: 3 },
        { content: "Mount Everest is 8,848 meters high.", pageNumber: 4 },
        { content: "The Great Barrier Reef is visible from space.", pageNumber: 5 },
    ];

    console.log(`Document has ${pages.length} pages.`);
    console.log(`Configured Concurrency: ${factExtractor.rateLimit.maxConcurrent}\n`);

    // --- Pattern A: Parallel Extraction ---
    console.log("--- Mode 1: Parallel Extraction ---");
    console.log("Processing all pages in parallel...");

    const startParallel = Date.now();
    const fullResult = await pipeline.extractParallel(pages, factExtractor);
    const endParallel = Date.now();

    console.log(`✅ Parallel extraction complete in ${endParallel - startParallel}ms`);
    console.log(`Extracted ${fullResult.items.length} unique items.\n`);


    // --- Pattern B: Result Streaming ---
    console.log("--- Mode 2: Result Streaming ---");
    console.log("Streaming results in real-time...");

    const startStreaming = Date.now();
    let streamedCount = 0;

    for await (const pageResult of pipeline.extractStreaming(pages, factExtractor)) {
        streamedCount++;
        const elapsed = Date.now() - startStreaming;

        if (pageResult.success) {
            console.log(`📍 [${elapsed}ms] Page ${pageResult.pageNumber} finished. Found ${pageResult.items.length} items.`);
            pageResult.items.forEach(item => console.log(`   - ${item.fact}`));
        } else {
            console.error(`❌ Page ${pageResult.pageNumber} failed: ${pageResult.error}`);
        }
    }

    console.log(`\n✅ Streaming complete in ${Date.now() - startStreaming}ms`);
}

runExample().catch((err) => {
    console.error("Example failed:", err);
    process.exit(1);
});

/**
 * Example 02: Multi-Page Document Extraction
 * 
 * This example demonstrates the core "resilient pipeline" pattern: 
 * processing a large document in small chunks with rate limiting 
 * and error isolation.
 * 
 * ## Run this example:
 * 
 * ```bash
 * export GEMINI_API_KEY=your_key_here
 * npx tsx examples/02-multi-page-document.ts
 * ```
 */

import "dotenv/config";
import { createPipeline, ExtractionPipeline } from "../lib/core";
import { EXTRACTORS } from "../lib/extractors";

async function main() {
    console.log("🚀 Starting Multi-Page Extraction Example...");

    // 1. Initialize the pipeline with a progress callback
    const pipeline = createPipeline({
        onProgress: (current, total, status) => {
            const percent = Math.round((current / total) * 100);
            console.log(`📊 Progress: ${percent}% - ${status}`);
        }
    });

    // 2. Sample data representing a large multi-page document
    // In a real app, this would come from a PDF parser or OCR service
    const largeDocumentText = `
    INVOICE #INV-001
    Date: 2024-01-01
    
    ITEMS:
    - Laptop / $1,200 / 1 unit
    - Monitor / $300 / 2 units
    
    ---PAGE---
    
    ITEMS CONTINUED:
    - Keyboard / $100 / 1 unit
    - Mouse / $50 / 1 unit
    
    ---PAGE---
    
    FINAL ITEMS:
    - Web Cam / $80 / 1 unit
    - HDMI Cable / $20 / 5 units
  `;

    // 3. Split the text into pages
    const pages = ExtractionPipeline.splitIntoPages(largeDocumentText, "---PAGE---");

    try {
        console.log(`\n📄 Processing ${pages.length} pages using: invoice extractor`);

        // 4. Run the paginated extraction
        // This will handle the sequence, delays, and aggregation
        const result = await pipeline.extractFromPages(pages, EXTRACTORS.invoice);

        // 5. Output the results and metrics
        console.log("\n✅ Extraction Complete!");
        console.log(`📦 Unique items found: ${result.items.length}`);
        console.log(`⏱️ Processing time: ${(result.metrics.processingTimeMs / 1000).toFixed(1)}s`);

        console.log("\n📋 Results Summary:");
        result.items.forEach((item: any, i: number) => {
            console.log(`  ${i + 1}. [${item.category}] ${item.description} - $${item.total_price}`);
        });

        if (result.pagesFailed > 0) {
            console.warn(`\n⚠️ Warning: ${result.pagesFailed} pages failed to process.`);
        }

    } catch (error) {
        console.error("\n❌ Error during multi-page extraction:");
        console.error(error);
    }
}

// Run the example
main();

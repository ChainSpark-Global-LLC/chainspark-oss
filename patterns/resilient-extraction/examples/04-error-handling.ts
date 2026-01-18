/**
 * Example 04: Robust Error Handling
 * 
 * This example demonstrates how to use the framework's structured 
 * error system to handle various failure scenarios:
 * 1. Missing API keys
 * 2. Rate limiting (429 errors)
 * 3. Schema validation failures
 * 
 * ## Run this example:
 * 
 * ```bash
 * npx tsx examples/04-error-handling.ts
 * ```
 */

import "dotenv/config";
import { createPipeline, ExtractionError, ErrorCode, RateLimitError } from "../lib/core";
import { EXTRACTORS } from "../lib/extractors";

async function main() {
    console.log("🚀 Starting Error Handling Example...");

    // --- SCENARIO 1: MISSING API KEY ---
    console.log("\n⚠️ Scenario 1: Missing API Key");
    try {
        // Force missing API key
        createPipeline({ apiKey: "" });
    } catch (error) {
        if (error instanceof ExtractionError && error.code === ErrorCode.API_KEY_MISSING) {
            console.log("✅ Caught expected ApiKeyError!");
            console.log(`   Message: ${error.message}`);
        }
    }

    // --- SCENARIO 2: INVALID INPUT ---
    console.log("\n⚠️ Scenario 2: Invalid Input for Extraction");
    const pipeline = createPipeline({ apiKey: "test-fake-key" });
    try {
        // @ts-ignore: Intentionally passing empty string to extractor that might expect content
        await pipeline.extractSingle("", EXTRACTORS.recipe);
    } catch (error) {
        // Since we're using a fake key, this might fail with an API error instead
        if (error instanceof ExtractionError) {
            console.log(`✅ Caught ExtractionError: [${error.code}]`);
            console.log(`   Message: ${error.message}`);
        }
    }

    // --- SCENARIO 3: HANDLING SPECIFIC ERRORS IN PRODUCTION ---
    console.log("\n💡 Recommended Production Pattern:");
    console.log(`
    try {
      const result = await pipeline.extractFromPages(pages, extractor);
      return result;
    } catch (error) {
      if (error instanceof RateLimitError) {
        // High-level decision: wait longer, or switch to a different model?
        console.log(\`Rate limited after \${error.attemptsMade} attempts.\`);
      } else if (ExtractionError.isCode(error, ErrorCode.SCHEMA_VALIDATION_FAILED)) {
        // Log the raw response for debugging
        console.log("The LLM produced invalid JSON that didn't match our Zod schema.");
      } else {
        // Fallback for unknown errors
        console.error("An unexpected error occurred during extraction.");
      }
    }
  `);

    console.log("\n✨ Error handling demonstration complete.");
}

// Run the example
main();

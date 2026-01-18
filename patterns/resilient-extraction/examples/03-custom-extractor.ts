/**
 * Example 03: Creating a Custom Extractor
 * 
 * This example demonstrates how easy it is to extend the framework
 * by defining your own custom extractor with a simple Zod schema 
 * and prompt builder.
 * 
 * ## Run this example:
 * 
 * ```bash
 * export GEMINI_API_KEY=your_key_here
 * npx tsx examples/03-custom-extractor.ts
 * ```
 */

import "dotenv/config";
import { z } from "zod";
import { createPipeline, ExtractorConfig } from "../lib/core";

// 1. Define your Custom Schema using Zod
// This provides type safety and automatic validation of LLM output
const ProjectSchema = z.object({
    name: z.string().describe("The name of the project"),
    status: z.enum(["Active", "Completed", "Planning"]).describe("Current status"),
    owner: z.string().describe("Person in charge"),
    budget: z.number().describe("Estimated budget in USD"),
    tags: z.array(z.string()).describe("Related keywords"),
});

// 2. Create the Extractor Configuration
// This maps the schema to the prompt logic and rate limit settings
const projectExtractor: ExtractorConfig<typeof ProjectSchema> = {
    name: "project-info",
    description: "Extracts project metadata from status reports or email updates",
    schema: ProjectSchema,

    // The prompt builder combines the schema context with your specific instructions
    buildPrompt: (text) => `
    You are a professional project manager. 
    Extract project information from the following text.
    
    TEXT TO PROCESS:
    """
    ${text}
    """
    
    Return the structured data following the schema.
  `,

    // Optional: Override default rate limits for this specific extractor
    rateLimit: {
        delayMs: 2000,   // Faster delay if you know this extractor uses less tokens
        maxRetries: 5,   // More retries for mission-critical extraction
    }
};

async function main() {
    console.log("🚀 Starting Custom Extractor Example...");

    const pipeline = createPipeline();

    const sampleEmail = `
    Subject: Q1 Update - Project Phoenix
    
    Hi Team, 
    
    I'm happy to announce that Project Phoenix is now in the Planning phase. 
    Sarah Miller will be leading this initiative. We've secured an initial 
    budget of $50,000. 
    
    Keywords for this project: infrastructure, cloud-migration, security.
    
    Best,
    Management
  `;

    try {
        console.log(`\n📄 Extracting data using custom: ${projectExtractor.name}`);

        // 3. Use the custom extractor just like the built-in ones
        const projects = await pipeline.extractSingle(sampleEmail, projectExtractor);

        console.log("\n✅ Custom Extraction Successful!");
        console.log(JSON.stringify(projects, null, 2));

        if (projects.length > 0) {
            const p = projects[0];
            console.log(`\n📅 Project: ${p.name}`);
            console.log(`👤 Lead: ${p.owner}`);
            console.log(`💰 Budget: $${p.budget.toLocaleString()}`);
        }

    } catch (error) {
        console.error("\n❌ Extraction Failed:");
        console.error(error);
    }
}

// Run the example
main();

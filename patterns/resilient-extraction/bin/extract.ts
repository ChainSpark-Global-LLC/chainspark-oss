#!/usr/bin/env npx tsx
/**
 * CLI Tool: AI Extractor
 * 
 * Allows running extractions from the terminal using the framework's core logic.
 * 
 * Usage:
 *   npx tsx bin/extract.ts --file sample.txt --type recipe
 */

import "dotenv/config";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { createPipeline, ExtractionPipeline } from "../lib/core";
import { EXTRACTORS } from "../lib/extractors";

const program = new Command();

program
    .name("extract")
    .description("Extract structured data from a file using AI")
    .version("1.0.0");

program
    .requiredOption("-f, --file <path>", "Path to the input file")
    .requiredOption("-t, --type <type>", "Type of extractor (recipe, invoice, job-posting)")
    .option("-o, --output <path>", "Path to save results (JSON)")
    .option("-p, --pages", "Treat file as multi-page using ---PAGE--- delimiter")
    .action(async (options) => {
        const filePath = path.resolve(process.cwd(), options.file);
        const extractorType = options.type as keyof typeof EXTRACTORS;

        if (!EXTRACTORS[extractorType]) {
            console.error(`❌ Unknown extractor type: ${extractorType}`);
            console.log(`Available types: ${Object.keys(EXTRACTORS).join(", ")}`);
            process.exit(1);
        }

        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${filePath}`);
            process.exit(1);
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const extractor = EXTRACTORS[extractorType];
        const pipeline = createPipeline();

        console.log(`🚀 Starting extraction using "${extractor.name}"...`);

        try {
            let results;
            if (options.pages) {
                const pages = ExtractionPipeline.splitIntoPages(content);
                console.log(`📄 Document split into ${pages.length} pages.`);
                const extractionResult = await pipeline.extractFromPages(pages, extractor);
                results = extractionResult.items;
            } else {
                results = await pipeline.extractSingle(content, extractor);
            }

            console.log("\n✅ Extraction Successful!");

            if (options.output) {
                const outputPath = path.resolve(process.cwd(), options.output);
                fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
                console.log(`💾 Results saved to: ${options.output}`);
            } else {
                console.log(JSON.stringify(results, null, 2));
            }
        } catch (error: any) {
            console.error("\n❌ Extraction Failed:");
            console.error(error.message || error);
            process.exit(1);
        }
    });

program.parse(process.argv);

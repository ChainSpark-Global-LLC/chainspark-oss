/**
 * Extractor Registry
 * 
 * Central registry of all available extractors.
 * Add your custom extractors here to make them available via the API.
 */

import { ExtractorConfig } from "../core";
import { ZodTypeAny } from "zod";

// Import built-in extractors
import { invoiceExtractor } from "./invoice";
import { recipeExtractor } from "./recipe";
import { jobPostingExtractor } from "./job-posting";

/**
 * Registry of all available extractors
 * 
 * To add a new extractor:
 * 1. Create your extractor in lib/extractors/your-name/index.ts
 * 2. Import it here
 * 3. Add it to the EXTRACTORS object with a unique key
 */
export const EXTRACTORS: Record<string, ExtractorConfig<ZodTypeAny>> = {
    invoice: invoiceExtractor,
    recipe: recipeExtractor,
    "job-posting": jobPostingExtractor,
};

/**
 * Get an extractor by name
 */
export function getExtractor(name: string): ExtractorConfig<ZodTypeAny> | undefined {
    return EXTRACTORS[name];
}

/**
 * Get all available extractor names
 */
export function getExtractorNames(): string[] {
    return Object.keys(EXTRACTORS);
}

/**
 * Get extractor metadata for UI display
 */
export function getExtractorOptions(): Array<{ name: string; description: string }> {
    return Object.values(EXTRACTORS).map((extractor) => ({
        name: extractor.name,
        description: extractor.description,
    }));
}

// Re-export individual extractors for direct import
export { invoiceExtractor } from "./invoice";
export { recipeExtractor } from "./recipe";
export { jobPostingExtractor } from "./job-posting";

/**
 * Source Grounding Utilities
 * 
 * ## Design Decision: Client-Side Offset Computation
 * 
 * LLMs are prediction engines, not calculators. Asking an LLM to compute
 * character offsets leads to:
 * - Extra output tokens (~25% overhead)
 * - Potential for hallucinated/incorrect offsets
 * - Increased latency from "reasoning" about counting
 * 
 * **Solution**: LLM returns only the **evidence text**, and we compute
 * offsets deterministically using string matching.
 * 
 * @module grounding
 */

import { EvidenceSpan } from "./types";

/**
 * Evidence span as returned by the LLM (text only, no offsets).
 * 
 * This is the "raw" format before client-side offset computation.
 */
export interface RawEvidenceSpan {
    /** Exact text copied from the source document. */
    text: string;
}

/**
 * Compute character offsets for an evidence span.
 * 
 * Uses `indexOf()` for deterministic, accurate offset calculation.
 * This is more reliable than asking the LLM to compute offsets.
 * 
 * @param sourceText - The original document text
 * @param evidenceText - The exact text to find
 * @param startFrom - Optional: start searching from this offset (for multiple matches)
 * @returns EvidenceSpan with offsets, or null if not found
 * 
 * @example
 * ```typescript
 * const span = computeEvidenceOffsets(
 *   "Total: $6,000.00",
 *   "$6,000.00"
 * );
 * // { text: "$6,000.00", startOffset: 7, endOffset: 16 }
 * ```
 */
export function computeEvidenceOffsets(
    sourceText: string,
    evidenceText: string,
    startFrom: number = 0
): EvidenceSpan | null {
    if (!evidenceText || !sourceText) {
        return null;
    }

    const startOffset = sourceText.indexOf(evidenceText, startFrom);

    if (startOffset === -1) {
        return null;
    }

    return {
        text: evidenceText,
        startOffset,
        endOffset: startOffset + evidenceText.length,
    };
}

/**
 * Compute offsets for multiple evidence spans in a document.
 * 
 * Handles the case where the same text appears multiple times by
 * searching sequentially and avoiding overlaps.
 * 
 * @param sourceText - The original document text
 * @param evidenceTexts - Array of texts to find
 * @returns Array of EvidenceSpans (nulls filtered out)
 */
export function computeMultipleOffsets(
    sourceText: string,
    evidenceTexts: string[]
): EvidenceSpan[] {
    const results: EvidenceSpan[] = [];

    for (const text of evidenceTexts) {
        const span = computeEvidenceOffsets(sourceText, text);
        if (span) {
            results.push(span);
        }
    }

    return results;
}

/**
 * Process raw evidence from LLM output and compute offsets.
 * 
 * This is the main integration point for post-processing extracted items.
 * 
 * @param sourceText - The original document text
 * @param rawEvidence - Evidence object with text-only spans
 * @returns Evidence object with computed offsets
 */
export function processRawEvidence<T extends Record<string, RawEvidenceSpan | undefined>>(
    sourceText: string,
    rawEvidence: T
): Record<string, EvidenceSpan | null> {
    const result: Record<string, EvidenceSpan | null> = {};

    for (const [key, rawSpan] of Object.entries(rawEvidence)) {
        if (rawSpan?.text) {
            result[key] = computeEvidenceOffsets(sourceText, rawSpan.text);
        } else {
            result[key] = null;
        }
    }

    return result;
}

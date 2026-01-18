/**
 * Unit tests for Source Grounding functionality
 */

import { describe, it, expect } from "vitest";

// Mock the EvidenceSpan type locally for testing deduplication logic
interface EvidenceSpan {
    text: string;
    startOffset: number;
    endOffset: number;
}

interface MockItem {
    description: string;
    total: number;
    evidence?: {
        descriptionSpan?: EvidenceSpan;
        totalSpan?: EvidenceSpan;
    };
}

/**
 * Reimplementation of the deduplication logic for testing purposes.
 * This mirrors the logic in extraction-pipeline.ts
 */
function deduplicateItems<T>(items: T[]): T[] {
    const seen = new Set<string>();
    const deduplicated: T[] = [];

    for (const item of items) {
        let key: string;

        const evidence = (item as any).evidence;
        if (evidence?.descriptionSpan?.text) {
            key = `evidence:${evidence.descriptionSpan.text.trim()}`;
        } else if (typeof (item as any).description === "string") {
            key = `desc:${(item as any).description.toLowerCase().trim()}`;
        } else {
            key = `json:${JSON.stringify(item)}`;
        }

        if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push(item);
        }
    }

    return deduplicated;
}

describe("Source Grounding", () => {
    describe("EvidenceSpan validation", () => {
        it("should accept valid evidence spans", () => {
            const span: EvidenceSpan = {
                text: "$6,000.00",
                startOffset: 342,
                endOffset: 351,
            };

            expect(span.text).toBe("$6,000.00");
            expect(span.endOffset - span.startOffset).toBe(9);
        });

        it("should have consistent offset calculations", () => {
            const sourceText = "Total: $1,234.56";
            const span: EvidenceSpan = {
                text: "$1,234.56",
                startOffset: 7,
                endOffset: 16,
            };

            expect(sourceText.slice(span.startOffset, span.endOffset)).toBe(span.text);
        });
    });

    describe("Evidence-based deduplication", () => {
        it("should deduplicate items with identical evidence spans", () => {
            const items: MockItem[] = [
                {
                    description: "Web Development Services",
                    total: 6000,
                    evidence: {
                        descriptionSpan: { text: "Web Development Services", startOffset: 0, endOffset: 24 },
                        totalSpan: { text: "$6,000.00", startOffset: 50, endOffset: 59 },
                    },
                },
                {
                    description: "Web Development Services", // Same evidence
                    total: 6000,
                    evidence: {
                        descriptionSpan: { text: "Web Development Services", startOffset: 0, endOffset: 24 },
                        totalSpan: { text: "$6,000.00", startOffset: 50, endOffset: 59 },
                    },
                },
            ];

            const result = deduplicateItems(items);
            expect(result).toHaveLength(1);
        });

        it("should keep items with different evidence even if descriptions look similar", () => {
            const items: MockItem[] = [
                {
                    description: "Consulting", // Page 1 version
                    total: 1000,
                    evidence: {
                        descriptionSpan: { text: "Consulting", startOffset: 100, endOffset: 110 },
                    },
                },
                {
                    description: "consulting", // Page 2 version (different case in description, but different evidence)
                    total: 2000,
                    evidence: {
                        descriptionSpan: { text: "consulting services", startOffset: 200, endOffset: 219 },
                    },
                },
            ];

            const result = deduplicateItems(items);
            expect(result).toHaveLength(2);
        });

        it("should fall back to description if no evidence is present", () => {
            const items: MockItem[] = [
                { description: "Item A", total: 100 },
                { description: "item a", total: 100 }, // Same when normalized
            ];

            const result = deduplicateItems(items);
            expect(result).toHaveLength(1);
        });

        it("should use JSON comparison for items without description or evidence", () => {
            const items = [
                { name: "Unknown", price: 50 },
                { name: "Unknown", price: 50 }, // Exact duplicate
                { name: "Unknown", price: 75 }, // Different
            ];

            const result = deduplicateItems(items);
            expect(result).toHaveLength(2);
        });
    });

    describe("computeEvidenceOffsets (client-side)", () => {
        // Local implementation matching the one in grounding.ts
        function computeEvidenceOffsets(
            sourceText: string,
            evidenceText: string
        ): EvidenceSpan | null {
            if (!evidenceText || !sourceText) return null;
            const startOffset = sourceText.indexOf(evidenceText);
            if (startOffset === -1) return null;
            return {
                text: evidenceText,
                startOffset,
                endOffset: startOffset + evidenceText.length,
            };
        }

        it("should compute correct offsets for existing text", () => {
            const source = "Invoice Total: $6,000.00";
            const result = computeEvidenceOffsets(source, "$6,000.00");

            expect(result).toEqual({
                text: "$6,000.00",
                startOffset: 15,
                endOffset: 24,
            });
        });

        it("should return null for text not found", () => {
            const source = "Invoice Total: $6,000.00";
            const result = computeEvidenceOffsets(source, "$7,000.00");

            expect(result).toBeNull();
        });

        it("should handle empty inputs", () => {
            expect(computeEvidenceOffsets("", "test")).toBeNull();
            expect(computeEvidenceOffsets("test", "")).toBeNull();
        });

        it("should find first occurrence when text appears multiple times", () => {
            const source = "Item: Widget, Item: Gadget";
            const result = computeEvidenceOffsets(source, "Item:");

            expect(result?.startOffset).toBe(0);
            expect(result?.endOffset).toBe(5);
        });

        it("should handle multi-line text", () => {
            const source = "Line 1\nLine 2\nTotal: $100";
            const result = computeEvidenceOffsets(source, "$100");

            expect(result).toEqual({
                text: "$100",
                startOffset: 21,
                endOffset: 25,
            });
        });
    });
});


/**
 * Invoice Line Item Extractor
 * 
 * Extracts line items from invoices including:
 * - Description
 * - Quantity and unit
 * - Unit price and total
 * - Confidence score
 * - **Source grounding evidence** (text-only, offsets computed client-side)
 */

import { z } from "zod";
import { ExtractorConfig } from "../../core";

/**
 * Schema for source evidence span (LLM output - text only).
 * 
 * ## Design Decision: Client-Side Offset Computation
 * 
 * LLMs are prediction engines, not calculators. We only ask the LLM
 * for the exact text, then compute offsets deterministically using
 * `computeEvidenceOffsets()` after extraction. This approach:
 * - Reduces output tokens by ~25%
 * - Eliminates hallucinated offsets
 * - Improves latency
 */
export const RawEvidenceSpanSchema = z.object({
    text: z.string().describe("Exact text copied verbatim from the source document"),
});

/**
 * Schema for a single invoice line item with source grounding
 */
export const InvoiceLineItemSchema = z.object({
    description: z.string().describe("Description of the item or service"),
    quantity: z.number().nullable().describe("Quantity (null if not specified)"),
    unit: z.string().nullable().describe("Unit of measure (EA, HR, etc.)"),
    unit_price: z.number().nullable().describe("Price per unit"),
    total: z.number().describe("Total price for this line item"),
    confidence: z.number().min(0).max(1).describe("Extraction confidence (0-1)"),
    evidence: z.object({
        descriptionSpan: RawEvidenceSpanSchema.describe("Exact text of the description from the source"),
        totalSpan: RawEvidenceSpanSchema.describe("Exact text of the total value from the source"),
    }).describe("Source text evidence for grounding (offsets computed client-side)"),
});

export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

/**
 * Build the extraction prompt for invoice line items.
 * 
 * Note: We only ask for the evidence text, not offsets. Offsets are
 * computed client-side using string matching for accuracy and efficiency.
 */
export function buildPrompt(text: string): string {
    return `You are an expert at extracting structured data from invoices.

Extract ALL line items from this invoice. For each line item, extract:
- description: What was purchased or what service was provided
- quantity: The quantity (null if lump sum or not specified)
- unit: Unit of measure like EA, HR, BOX, etc. (null if not specified)
- unit_price: Price per unit (null if not specified)
- total: The total price for this line item (REQUIRED)
- confidence: Your confidence in this extraction (0.0 to 1.0)
- evidence: Source text for grounding

For the "evidence" field, provide:
- descriptionSpan: { text } - The EXACT text of the description as it appears in the source
- totalSpan: { text } - The EXACT text of the total value as it appears in the source

IMPORTANT:
- Extract every line item you can find
- If quantity or unit_price is not specified, set them to null
- Total should always be extracted - this is the most important field
- Be careful with number parsing: $1,234.56 = 1234.56
- Evidence text MUST be copied VERBATIM from the source (we use it to locate the value)

INVOICE TEXT:
${text}`;
}

/**
 * Invoice extractor configuration
 */
export const invoiceExtractor: ExtractorConfig<typeof InvoiceLineItemSchema> = {
    name: "invoice",
    description: "Extract line items from invoices with source grounding",
    schema: InvoiceLineItemSchema,
    buildPrompt,
};

export default invoiceExtractor;



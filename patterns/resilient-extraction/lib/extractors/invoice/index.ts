/**
 * Invoice Line Item Extractor
 * 
 * Extracts line items from invoices including:
 * - Description
 * - Quantity and unit
 * - Unit price and total
 * - Confidence score
 * - **Source grounding evidence** for key fields
 */

import { z } from "zod";
import { ExtractorConfig } from "../../core";

/**
 * Schema for source evidence span
 */
export const EvidenceSpanSchema = z.object({
    text: z.string().describe("Exact text from the source document"),
    startOffset: z.number().describe("0-indexed character offset where text starts"),
    endOffset: z.number().describe("0-indexed character offset where text ends (exclusive)"),
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
        descriptionSpan: EvidenceSpanSchema.describe("Source location of the description"),
        totalSpan: EvidenceSpanSchema.describe("Source location of the total value"),
    }).describe("Source grounding evidence linking values to document text"),
});

export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

/**
 * Build the extraction prompt for invoice line items with source grounding
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
- evidence: Source grounding with exact text and character offsets

For the "evidence" field, you MUST provide:
- descriptionSpan: { text, startOffset, endOffset } for where the description appears
- totalSpan: { text, startOffset, endOffset } for where the total value appears

The offsets are 0-indexed character positions in the INVOICE TEXT below.
The "text" field MUST be a verbatim copy of the characters from the source.

IMPORTANT:
- Extract every line item you can find
- If quantity or unit_price is not specified, set them to null
- Total should always be extracted - this is the most important field
- Be careful with number parsing: $1,234.56 = 1234.56
- Include subtotals or totals as separate line items if they appear as rows
- Evidence spans MUST point to text that actually exists in the source

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


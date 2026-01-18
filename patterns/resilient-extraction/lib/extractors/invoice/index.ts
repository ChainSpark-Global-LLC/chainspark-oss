/**
 * Invoice Line Item Extractor
 * 
 * Extracts line items from invoices including:
 * - Description
 * - Quantity and unit
 * - Unit price and total
 * - Confidence score
 */

import { z } from "zod";
import { ExtractorConfig } from "../../core";

/**
 * Schema for a single invoice line item
 */
export const InvoiceLineItemSchema = z.object({
    description: z.string().describe("Description of the item or service"),
    quantity: z.number().nullable().describe("Quantity (null if not specified)"),
    unit: z.string().nullable().describe("Unit of measure (EA, HR, etc.)"),
    unit_price: z.number().nullable().describe("Price per unit"),
    total: z.number().describe("Total price for this line item"),
    confidence: z.number().min(0).max(1).describe("Extraction confidence (0-1)"),
});

export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

/**
 * Build the extraction prompt for invoice line items
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

IMPORTANT:
- Extract every line item you can find
- If quantity or unit_price is not specified, set them to null
- Total should always be extracted - this is the most important field
- Be careful with number parsing: $1,234.56 = 1234.56
- Include subtotals or totals as separate line items if they appear as rows

INVOICE TEXT:
${text}`;
}

/**
 * Invoice extractor configuration
 */
export const invoiceExtractor: ExtractorConfig<typeof InvoiceLineItemSchema> = {
    name: "invoice",
    description: "Extract line items from invoices",
    schema: InvoiceLineItemSchema,
    buildPrompt,
};

export default invoiceExtractor;

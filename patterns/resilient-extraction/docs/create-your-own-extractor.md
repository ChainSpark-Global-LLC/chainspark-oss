# Create Your Own Extractor

This guide walks you through creating a custom extractor for the AI Extraction Patterns framework.

## Overview

An extractor consists of:

1. **Zod Schema** — Defines the structure of extracted data
2. **Prompt Builder** — Creates the LLM prompt
3. **Extractor Config** — Ties it all together

## Step 1: Create Your Schema

Create a new folder in `lib/extractors/`:

```bash
mkdir lib/extractors/product
```

Define your Zod schema in `lib/extractors/product/index.ts`:

```typescript
import { z } from "zod";
import { ExtractorConfig } from "../../core";

// Define what you want to extract
export const ProductSchema = z.object({
  name: z.string().describe("Product name"),
  price: z.number().describe("Price in dollars"),
  currency: z.string().default("USD"),
  description: z.string().nullable(),
  features: z.array(z.string()),
  confidence: z.number().min(0).max(1).describe("Extraction confidence"),
});

export type Product = z.infer<typeof ProductSchema>;
```

## Step 2: Write Your Prompt Builder

Add the prompt builder function:

```typescript
export function buildPrompt(text: string): string {
  return `You are an expert at extracting product information from e-commerce pages.

Extract ALL products from this text. For each product, extract:
- name: The product name
- price: Numeric price (without currency symbol)
- currency: Currency code (USD, EUR, etc.)
- description: Product description (null if not available)
- features: Array of feature bullet points
- confidence: Your confidence in this extraction (0.0 to 1.0)

IMPORTANT:
- Extract every product you can find
- Parse prices like "$29.99" as 29.99
- Include all listed features

TEXT:
${text}`;
}
```

## Step 3: Create the Extractor Config

```typescript
export const productExtractor: ExtractorConfig<typeof ProductSchema> = {
  name: "product",
  description: "Extract products from e-commerce pages",
  schema: ProductSchema,
  buildPrompt,
};

export default productExtractor;
```

## Step 4: Register Your Extractor

Add it to `lib/extractors/index.ts`:

```typescript
import { productExtractor } from "./product";

export const EXTRACTORS = {
  invoice: invoiceExtractor,
  recipe: recipeExtractor,
  "job-posting": jobPostingExtractor,
  product: productExtractor,  // Add this line
};
```

## Step 5: Test It

Your extractor is now available at `/api/extract/product`:

```bash
curl -X POST http://localhost:3000/api/extract/product \
  -H "Content-Type: application/json" \
  -d '{"text": "iPhone 15 Pro - $999. Features: A17 chip, titanium design..."}'
```

## Tips for Better Extraction

### Be Specific in Your Prompt

Bad:
```
Extract products from this text.
```

Good:
```
Extract ALL products from this e-commerce page. For each product, capture:
- The exact product name as displayed
- The price as a number (e.g., $29.99 → 29.99)
...
```

### Use `.describe()` for Schema Fields

Zod descriptions are sent to the LLM as hints:

```typescript
price: z.number().describe("Price in dollars without currency symbol")
```

### Include a Confidence Field

Always add a confidence field so you can filter low-quality extractions:

```typescript
confidence: z.number().min(0).max(1).describe("How confident are you? 0-1")
```

### Handle Nullables

Use `.nullable()` for optional fields:

```typescript
description: z.string().nullable().describe("Product description if available")
```

## Full Example

Here's a complete custom extractor:

```typescript
// lib/extractors/product/index.ts
import { z } from "zod";
import { ExtractorConfig } from "../../core";

export const ProductSchema = z.object({
  name: z.string().describe("Product name"),
  price: z.number().describe("Price in dollars"),
  currency: z.string().default("USD").describe("Currency code"),
  description: z.string().nullable().describe("Product description"),
  features: z.array(z.string()).describe("List of features"),
  in_stock: z.boolean().describe("Whether the product is in stock"),
  confidence: z.number().min(0).max(1).describe("Extraction confidence"),
});

export type Product = z.infer<typeof ProductSchema>;

export function buildPrompt(text: string): string {
  return `Extract product information from this e-commerce page.

For each product found, extract:
- name: The product name
- price: Numeric price (e.g., $29.99 → 29.99)
- currency: Currency code (USD, EUR, GBP, etc.)
- description: Product description (null if not available)
- features: Array of feature bullet points
- in_stock: true if available, false if out of stock
- confidence: Your confidence in this extraction (0.0 to 1.0)

TEXT:
${text}`;
}

export const productExtractor: ExtractorConfig<typeof ProductSchema> = {
  name: "product",
  description: "Extract products from e-commerce pages",
  schema: ProductSchema,
  buildPrompt,
};

export default productExtractor;
```

# Examples: AI Extraction Framework

This directory contains runnable examples that demonstrate the core patterns and features of the AI Extraction Framework. Use these as templates for your own implementations.

## How to Run the Examples

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variables**:
   Create a `.env` file in the root directory or export your API key:
   ```bash
   export GEMINI_API_KEY=your_key_here
   ```

3. **Run using tsx**:
   ```bash
   npx tsx examples/01-basic-extraction.ts
   ```

---

## Example Catalog

### [01: Basic Extraction](./01-basic-extraction.ts)
**Pattern**: Simple AI Client Wrapper
Demonstrates the quickest way to get started using built-in extractors with a simple text string.
*   **Concepts**: `createPipeline`, `EXTRACTORS`, `extractSingle`.

### [02: Multi-Page Document](./02-multi-page-document.ts)
**Pattern**: Resilient Page-by-Page Orchestration
Shows how to handle large documents by splitting them into pages and processing them sequentially with progress tracking and automatic aggregation.
*   **Concepts**: `extractFromPages`, `onProgress`, `splitIntoPages`.

### [03: Creating a Custom Extractor](./03-custom-extractor.ts)
**Pattern**: Extensibility via Configuration
Practical guide on defining your own Zod schemas and prompt builders to extract specific data types tailored to your domain.
*   **Concepts**: `ExtractorConfig`, Zod Schemas.

### [04: Robust Error Handling](./04-error-handling.ts)
**Pattern**: Structured Error States
Explains how to use the framework's error system to build resilient applications that can differentiate between rate limits, missing keys, and validation failures.
*   **Concepts**: `ExtractionError`, `ErrorCode`, `RateLimitError`.

---

## Best Practices Shown in These Examples

*   **Type Safety**: All examples use TypeScript and Zod for guaranteed data structures.
*   **Isomorphic Design**: The logic works exactly the same in a Node.js script as it does in a Next.js API route.
*   **Educational Comments**: Each script is annotated to explain *why* certain patterns are used, making it perfect for learning and sharing.

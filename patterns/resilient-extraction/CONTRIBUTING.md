# Contributing to AI Extraction Patterns 🤝

Thank you for your interest in contributing to this project! This repository aims to be a high-quality educational resource for AI engineering.

## 🛠️ Development Setup

1. **Clone and Install**:
   ```bash
   git clone https://github.com/your-username/ai-extraction-patterns.git
   cd ai-extraction-patterns
   npm install
   ```

2. **Run Tests**:
   Ensure all tests pass before making changes:
   ```bash
   npm test
   ```

3. **Verify Types**:
   ```bash
   npm run build # Or check via IDE
   ```

## 📐 Adding a New Extractor

1. Create a new file in `lib/extractors/` (e.g., `resume.ts`).
2. Define your Zod schema and `buildPrompt` function.
3. Export it and add it to the `EXTRACTORS` registry in `lib/extractors/index.ts`.
4. Add a sample test case in `tests/integration/extraction.test.ts`.

## 🏛️ Guiding Principles

- **Education First**: Code should be readable and well-annotated. Explain the "why" in JSDoc.
- **Resilience**: Every new feature should consider failure modes (Rate Limits, Schema Failures, etc.).
- **Deduplication**: Think about how your data might overlap across page chunks.
- **Type Safety**: Avoid using `any`. Use Zod for all LLM outputs.

## 🚀 Submitting Changes

1. Create a feature branch.
2. Ensure you've added an educational example in the `examples/` directory if you're introducing a new pattern.
3. Submit a Pull Request with a clear description of the pattern you're adding/improving.

# Chainspark Open-Source (OSS) Hub 🚀

Welcome to the **Chainspark Open-Source Hub**. This repository is a curated collection of production-grade AI patterns, snippets, and educational resources designed for modern AI engineering.

## 🏛️ Repository Structure

This repository is organized into three main areas:

- **[patterns/](./patterns/)**: Complete, runnable modules implementing specific architecture patterns (e.g.,
    - **Resilient AI Extraction**: A production-ready pipeline for page-by-page extraction from large documents. Features high-concurrency rate limiting, result streaming, and robust error handling.
        - [Explore Pattern](patterns/resilient-extraction/README.md)
        - [Latency Optimization Guide](patterns/resilient-extraction/docs/patterns/latency-optimization.md)
- **[snippets/](./snippets/)**: Bite-sized code utility fragments and prompt engineering tricks.
- **[examples/](./patterns/resilient-extraction/examples/)**: Minimal demos to help you get started quickly.

---

## 💎 Available Patterns

### 1. Resilient AI Extraction Pipeline
**Status**: `Production-Ready` | **Complexity**: `High`
A robust orchestration framework for extracting structured data from large, multi-page documents (Invoices, Recipes, Job Postings) using Gemini 2.5 Flash and Vercel AI SDK. Handles rate limits, error isolation, and deduplication.
👉 **[View Pattern](./patterns/resilient-extraction/)**

---

## �️ Principles

All code in this repository follows Chainspark's core engineering principles:
1.  **Resilience First**: Every feature considers failure modes (429s, schema failures, context limits).
2.  **Education Focused**: Code is heavily annotated to explain the "why," not just the "what."
3.  **Type Safety**: Strict Zod schemas and TypeScript are used throughout for guaranteed data integrity.
4.  **Observability**: Structured JSON logging and metrics are integrated into all core patterns.

---

## 🤝 Contributing

We welcome contributions! Please see the [Contributing Guide](./patterns/resilient-extraction/CONTRIBUTING.md) for details on how to add new patterns or snippets.

---

## 📄 License

This repository is licensed under the MIT License.

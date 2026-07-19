# Chainspark Open-Source (OSS) Hub 🚀

Welcome to the **Chainspark Open-Source Hub**. This repository is a curated collection of production-grade AI patterns, snippets, and educational resources designed for modern AI engineering.

## 🏛️ Repository Structure

This repository is organized into three main areas:

- **[patterns/](./patterns/)**: Complete, runnable modules implementing specific architecture patterns (e.g.,
    - **Resilient AI Extraction**: A production-ready pipeline for page-by-page extraction from large documents. Features high-concurrency rate limiting, result streaming, and robust error handling.
        - [Explore Pattern](patterns/resilient-extraction/README.md)
        - [Latency Optimization Guide](patterns/resilient-extraction/docs/patterns/latency-optimization.md)
    - **Agent Authority Model**: A four-tier model for grading agent autonomy by what the action risks, plus a charter template for declaring an agent's write surfaces.
        - [Explore Pattern](patterns/agent-authority-model/README.md)
    - **Write Guard Hook**: A config-driven `PreToolUse` hook for Claude Code that blocks agent writes to protected paths.
        - [Explore Pattern](patterns/write-guard-hook/README.md)
- **[snippets/](./snippets/)**: Bite-sized code utility fragments and prompt engineering tricks.
- **[examples/](./patterns/resilient-extraction/examples/)**: Minimal demos to help you get started quickly.

---

## 💎 Available Patterns

### 1. Resilient AI Extraction Pipeline
**Status**: `Production-Ready` | **Complexity**: `High`
A robust orchestration framework for extracting structured data from large, multi-page documents (Invoices, Recipes, Job Postings) using Gemini 2.5 Flash and Vercel AI SDK. Handles rate limits, error isolation, and deduplication.
👉 **[View Pattern](./patterns/resilient-extraction/)**

### 2. Agent Authority Model
**Status**: `v0.1` | **Complexity**: `Low`
A four-tier model for grading how much autonomy an agent has, based on what the action actually risks rather than one approval gate for everything. Ships with a charter template for declaring an agent's autonomous, propose-only, and never-touch write surfaces. Grounded in published Gartner and Okta findings on approval fatigue.
👉 **[View Pattern](./patterns/agent-authority-model/)**

### 3. Write Guard Hook
**Status**: `Production-Ready` | **Complexity**: `Low`
A config-driven `PreToolUse` hook for Claude Code that blocks agent writes to protected paths — contracts, decision records, production infrastructure, secrets. Protected paths live in a config file, not the script. No dependencies beyond Python 3.8+.
👉 **[View Pattern](./patterns/write-guard-hook/)**

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

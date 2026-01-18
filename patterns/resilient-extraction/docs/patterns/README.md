# AI Extraction Patterns: The Catalog 📚

This repository is more than just a library; it's a collection of **production-grade patterns** for building resilient AI-powered data extraction pipelines.

Each pattern here is designed to be **self-contained**, **educational**, and **copy-pasteable** into your own projects.

---

## 🏛️ Architecture Patterns

### 1. Page-by-Page Orchestration
**The Problem**: LLMs have limited context windows and accuracy degrades with large inputs.
**The Solution**: Process documents in discrete chunks (pages) and aggregate the results.
*   **Where**: [extraction-pipeline.ts](../../lib/core/extraction-pipeline.ts)
*   **Benefits**: High accuracy, context safety, progress feedback.

### 2. Error Isolation (Resonant Failures)
**The Problem**: One bad page with messy OCR or weird formatting can crash an entire extraction job.
**The Solution**: Wrap each page call in a try/catch. Log the error but continue to the next page.
*   **Where**: [extraction-pipeline.ts](../../lib/core/extraction-pipeline.ts#L182-196)
*   **Benefits**: Partial success is better than total failure for large batch jobs.

---

## 🚦 Reliability Patterns

### 3. Smart Rate Limiting (Token Bucket)
**The Problem**: AI APIs (Gemini, OpenAI, Anthropic) enforce strict Rate Limits (RPM/TPM).
**The Solution**: A non-blocking queue that enforces a minimum delay between calls, even when the previous call finishes instantly.
*   **Where**: [rate-limiter.ts](../../lib/core/rate-limiter.ts)
*   **Benefits**: Prevents 429 errors before they happen.

### 4. Exponential Backoff
**The Problem**: Fixed-time retries often hit the rate limit again immediately.
**The Solution**: When an error occurs, wait exponentially longer (2^attempt * delay).
*   **Where**: [rate-limiter.ts](../../lib/core/rate-limiter.ts#L294-303)
*   **Benefits**: Gives the API "breathing room" to reset your quota.

---

## 💎 Data Quality Patterns

### 5. Structured Output (Zod-to-JSON)
**The Problem**: LLMs often return "lazy" JSON or inconsistent fields.
**The Solution**: Use `generateObject` with a strict Zod schema to force the LLM into a specific shape.
*   **Where**: [types.ts](../../lib/core/types.ts) | [extractors/](../../lib/extractors/)
*   **Benefits**: Zero-config validation; Type-safe results in your frontend.

### 6. Heuristic Deduplication
**The Problem**: Items spanning page boundaries often get extracted twice.
**The Solution**: Post-process results using a content-based hash or principal field (like `description`).
*   **Where**: [extraction-pipeline.ts](../../lib/core/extraction-pipeline.ts#L246-263)
*   **Benefits**: Clean data without needing the LLM to "remember" previous pages.

---

## 📊 Observability Patterns

### 7. Structured JSON Logging
**The Problem**: String-based logs are useless in production monitoring.
**The Solution**: Log events as JSON objects with searchable metadata (duration, item counts, error codes).
*   **Where**: [logger.ts](../../lib/core/logger.ts)
*   **Benefits**: Easy dashboarding and alerting in Datadog/CloudWatch.

### 8. Extraction Metrics
**The Problem**: Hard to know if your AI pipeline is getting better or worse over time.
**The Solution**: Track and return meta-data like `averageConfidence`, `processingTimeMs`, and `pagesFailed`.
*   **Where**: [types.ts](../../lib/core/types.ts#L93-114)

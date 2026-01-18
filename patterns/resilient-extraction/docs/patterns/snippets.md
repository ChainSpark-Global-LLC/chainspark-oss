# Tweetable Snippets 🐦

Ready-to-share code snippets highlighting the patterns in this repo.

---

### 1. Resilient Error Isolation
"Don't let one bad page crash your whole data pipeline. Wrap your AI calls in a per-page try/catch for partial success."

```typescript
// From lib/core/extraction-pipeline.ts
for (const page of pages) {
  try {
    const items = await extractor.run(page);
    allItems.push(...items);
  } catch (error) {
    // 💡 Pattern: Error Isolation
    logger.error("Page failed", { pageNum: page.id, error });
    failedPages.push(page.id);
  }
}
```

---

### 2. Smart Rate Limiting (Token Bucket)
"Enforce API delays proactively. Our Token Bucket implementation ensures a minimum cool-down between calls, even when latency is low."

```typescript
// From lib/core/rate-limiter.ts
async waitForNextSlot() {
  const now = Date.now();
  const elapsed = now - this.lastCallTime;
  const remaining = this.config.delayMs - elapsed;

  if (remaining > 0) {
    await sleep(remaining);
  }
  this.lastCallTime = Date.now();
}
```

---

### 3. Type-Safe AI Extractors
"Stop fighting with inconsistent LLM output. Use Zod schemas to force JSON into the exact shape you need."

```typescript
// From lib/extractors/invoice.ts
const InvoiceSchema = z.object({
  id: z.string(),
  total: z.number(),
  items: z.array(z.object({
    desc: z.string(),
    price: z.number()
  }))
});

// Guaranteed type-safety
const data = await pipeline.extract(text, InvoiceSchema);
```

---

### 4. Exponential Backoff for 429s
"Hitting rate limits? Don't just retry immediately. Use exponential backoff to give the API breathing room."

```typescript
// Simple backoff pattern
let attempt = 0;
while (attempt < max) {
  try {
    return await fn();
  } catch (err) {
    if (isRateLimit(err)) {
       const delay = Math.pow(2, attempt) * baseDelay;
       await sleep(delay);
       attempt++;
       continue;
    }
    throw err;
  }
}
```

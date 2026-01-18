# AI Extraction Patterns

Resilient, structured data extraction from unstructured text using LLMs.

## What This Solves

When extracting structured data from documents using LLMs, you'll encounter:

| Problem | This Framework's Solution |
|---------|--------------------------|
| Large documents timeout | Page-by-page processing |
| JSON parsing fails | Structured output with Zod schemas |
| Rate limits (429 errors) | Automatic delays + exponential backoff |
| One failure kills everything | Per-page error isolation |

---

## Architecture Overview

```mermaid
graph TB
    subgraph Input
        A[Document Text] --> B[Page Chunker]
    end
    
    subgraph Core Framework
        B --> C[Extraction Pipeline]
        C --> D[Rate Limiter]
        D --> E[LLM API]
        E --> F[Zod Validation]
    end
    
    subgraph Output
        F --> G[Structured JSON]
    end
    
    subgraph Extractors
        H[Invoice] -.-> C
        I[Recipe] -.-> C
        J[Job Posting] -.-> C
        K[Your Custom] -.-> C
    end
    
    style C fill:#4f46e5,color:#fff
    style F fill:#16a34a,color:#fff
```

---

## Extraction Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as /api/extract/[type]
    participant Pipeline as Extraction Pipeline
    participant RateLimiter
    participant LLM as Gemini API
    participant Zod
    
    Client->>API: POST { text: "..." }
    API->>Pipeline: extractFromPages(chunks, extractor)
    
    loop For each page
        Pipeline->>RateLimiter: waitForNextSlot()
        RateLimiter-->>Pipeline: OK (after delay)
        Pipeline->>LLM: generateObject(prompt, schema)
        LLM-->>Zod: Raw response
        Zod-->>Pipeline: Validated items[]
        Note over Pipeline: Continue even if page fails
    end
    
    Pipeline->>Pipeline: Deduplicate items
    Pipeline-->>API: ExtractionResult
    API-->>Client: { items, metrics }
```

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/your-username/ai-extraction-patterns.git
cd ai-extraction-patterns

# Install dependencies
npm install

# Set up your API key
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the demo.

---

## How It Works

### The Pattern

```typescript
// 1. Define your schema with Zod
const MyItemSchema = z.object({
  name: z.string(),
  value: z.number(),
  confidence: z.number(),
});

// 2. Create an extractor config
const myExtractor: ExtractorConfig<typeof MyItemSchema> = {
  name: "my-extractor",
  description: "Extracts items from documents",
  schema: MyItemSchema,
  buildPrompt: (text) => `Extract items from: ${text}`,
};

// 3. Use the pipeline
const pipeline = createPipeline();
const result = await pipeline.extractFromPages(chunks, myExtractor);
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Page-by-Page Processing** | Processes large documents in chunks |
| **Structured Output** | Uses `generateObject` + Zod for guaranteed valid JSON |
| **Rate Limiting** | Automatic delays with exponential backoff |
| **Error Isolation** | One page fails, the rest continue |
| **Deduplication** | Removes duplicate items automatically |

---

## Built-in Extractors

| Extractor | Use Case | Fields Extracted |
|-----------|----------|------------------|
| 📄 **Invoice** | Financial documents | description, quantity, unit_price, total |
| 🍳 **Recipe** | Cooking blogs | ingredients, steps, prep_time, cook_time |
| 💼 **Job Posting** | Career sites | title, company, requirements, salary, benefits |

---

## Create Your Own Extractor

```mermaid
flowchart LR
    A[Define Zod Schema] --> B[Write Prompt Builder]
    B --> C[Create ExtractorConfig]
    C --> D[Register in index.ts]
    D --> E[Available at /api/extract/your-type]
    
    style A fill:#fbbf24,color:#000
    style E fill:#16a34a,color:#fff
```

**Step 1:** Create `lib/extractors/my-type/index.ts`

```typescript
import { z } from "zod";
import { ExtractorConfig } from "../../core";

export const MySchema = z.object({
  field1: z.string(),
  field2: z.number(),
  confidence: z.number(),
});

export function buildPrompt(text: string): string {
  return `Extract data from: ${text}`;
}

export const myExtractor: ExtractorConfig<typeof MySchema> = {
  name: "my-type",
  description: "My custom extractor",
  schema: MySchema,
  buildPrompt,
};
```

**Step 2:** Register in `lib/extractors/index.ts`

See [docs/create-your-own-extractor.md](docs/create-your-own-extractor.md) for the full guide.

---

## API Usage

```bash
# Extract from text
curl -X POST http://localhost:3000/api/extract/invoice \
  -H "Content-Type: application/json" \
  -d '{"text": "Your invoice text here..."}'

# List available extractors
curl http://localhost:3000/api/extract
```

### Request Options

```json
{
  "text": "Your document text...",
  "options": {
    "autoChunk": true,
    "maxChunkSize": 4000
  }
}
```

---

## Project Structure

```
ai-extraction-patterns/
├── app/
│   ├── page.tsx                 # Demo playground UI
│   └── api/extract/
│       ├── route.ts             # GET: List extractors
│       └── [type]/route.ts      # POST: Run extraction
│
├── lib/
│   ├── core/                    # 🔧 Framework (don't modify)
│   │   ├── types.ts             # ExtractorConfig interface
│   │   ├── rate-limiter.ts      # Rate limiting + backoff
│   │   └── extraction-pipeline.ts
│   │
│   └── extractors/              # 📦 Examples (copy & customize)
│       ├── invoice/
│       ├── recipe/
│       └── job-posting/
│
└── docs/
    └── create-your-own-extractor.md
```

---

## Rate Limiting Strategy

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Waiting: Request received
    Waiting --> Calling: Delay elapsed (7s default)
    Calling --> Success: 200 OK
    Calling --> RateLimited: 429 Error
    RateLimited --> Backoff: Exponential wait
    Backoff --> Calling: Retry
    Success --> Ready
    Backoff --> Failed: Max retries exceeded
```

Default configuration:
- **Delay between calls:** 7 seconds
- **Max retries:** 3
- **Backoff multiplier:** 2x per retry

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Next.js 15](https://nextjs.org/) | React framework |
| [Vercel AI SDK](https://sdk.vercel.ai/) | Unified LLM interface |
| [Gemini](https://ai.google.dev/) | Google's LLM |
| [Zod](https://zod.dev/) | Schema validation |
| [Tailwind CSS](https://tailwindcss.com/) | Styling |

---

## License

MIT

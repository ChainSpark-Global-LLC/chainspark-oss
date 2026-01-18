"use client";

import { useState } from "react";

// Sample data for each extractor type
const SAMPLE_DATA: Record<string, string> = {
    invoice: `INVOICE #INV-2024-0042
Date: January 13, 2026
Due Date: February 13, 2026

Bill To:
Acme Corporation
123 Business Ave
New York, NY 10001

Description                    Qty    Unit Price    Total
---------------------------------------------------------
Web Development Services       40 hrs    $150.00    $6,000.00
UI/UX Design Consultation      8 hrs     $175.00    $1,400.00
Cloud Hosting (Annual)         1 year    $1,200.00  $1,200.00
SSL Certificate                1 EA      $99.00     $99.00
Domain Registration            2 EA      $15.00     $30.00
---------------------------------------------------------
                                        Subtotal:   $8,729.00
                                        Tax (8%):   $698.32
                                        TOTAL:      $9,427.32`,

    recipe: `Classic Chocolate Chip Cookies

Prep Time: 15 minutes
Cook Time: 12 minutes
Servings: 24 cookies

Ingredients:
- 2 1/4 cups all-purpose flour
- 1 tsp baking soda
- 1 tsp salt
- 1 cup (2 sticks) butter, softened
- 3/4 cup granulated sugar
- 3/4 cup packed brown sugar
- 2 large eggs, room temperature
- 1 tsp vanilla extract
- 2 cups chocolate chips

Instructions:
1. Preheat oven to 375°F (190°C). Line baking sheets with parchment paper.
2. In a medium bowl, whisk together flour, baking soda, and salt. Set aside.
3. In a large bowl, beat butter and both sugars until light and fluffy, about 3 minutes.
4. Add eggs one at a time, beating well after each addition. Mix in vanilla.
5. Gradually add flour mixture, mixing on low speed until just combined.
6. Fold in chocolate chips with a spatula.
7. Drop rounded tablespoons of dough onto prepared baking sheets, spacing 2 inches apart.
8. Bake for 10-12 minutes until edges are golden but centers still look slightly underdone.
9. Let cool on baking sheet for 5 minutes before transferring to a wire rack.`,

    "job-posting": `Senior Full-Stack Engineer
TechCorp Inc. | San Francisco, CA (Hybrid)

About the Role:
We're looking for a Senior Full-Stack Engineer to join our growing team. You'll work on our core product, building features used by millions of users worldwide.

Compensation: $180,000 - $220,000 per year + equity

Requirements:
- 5+ years of experience in full-stack development
- Strong proficiency in TypeScript and React
- Experience with Node.js and PostgreSQL
- Familiarity with cloud platforms (AWS or GCP)
- Excellent problem-solving and communication skills

Nice to Have:
- Experience with GraphQL
- Knowledge of Kubernetes
- Previous startup experience
- Open source contributions

Benefits:
- Comprehensive health, dental, and vision insurance
- Unlimited PTO
- 401(k) with 4% match
- $2,000 annual learning budget
- Flexible work schedule
- Home office stipend`,
};

export default function DemoPage() {
    const [extractorType, setExtractorType] = useState("invoice");
    const [inputText, setInputText] = useState(SAMPLE_DATA.invoice);
    const [result, setResult] = useState<object | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExtract = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch(`/api/extract/${extractorType}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Extraction failed");
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleExtractorChange = (type: string) => {
        setExtractorType(type);
        setInputText(SAMPLE_DATA[type] || "");
        setResult(null);
        setError(null);
    };

    return (
        <main className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        AI Extraction Patterns
                    </h1>
                    <p className="text-gray-600">
                        Resilient, structured data extraction from unstructured text
                    </p>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input Panel */}
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Extractor Type
                            </label>
                            <select
                                value={extractorType}
                                onChange={(e) => handleExtractorChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="invoice">📄 Invoice Line Items</option>
                                <option value="recipe">🍳 Recipe</option>
                                <option value="job-posting">💼 Job Posting</option>
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Input Text
                            </label>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                rows={16}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Paste your text here..."
                            />
                        </div>

                        <button
                            onClick={handleExtract}
                            disabled={loading || !inputText.trim()}
                            className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Extracting...
                                </span>
                            ) : (
                                "Extract →"
                            )}
                        </button>
                    </div>

                    {/* Output Panel */}
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h2 className="text-sm font-medium text-gray-700 mb-4">
                            Extraction Result
                        </h2>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
                                <strong>Error:</strong> {error}
                            </div>
                        )}

                        {!error && !result && !loading && (
                            <div className="text-gray-400 text-center py-12">
                                Results will appear here after extraction
                            </div>
                        )}

                        {result && (
                            <div className="space-y-4">
                                {/* Metrics */}
                                {"metrics" in result && (
                                    <div className="flex gap-4 text-sm">
                                        <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full">
                                            {(result as any).metrics.totalItems} items
                                        </div>
                                        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                                            {((result as any).metrics.processingTimeMs / 1000).toFixed(1)}s
                                        </div>
                                        {(result as any).metrics.averageConfidence && (
                                            <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                                                {Math.round((result as any).metrics.averageConfidence * 100)}% confidence
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* JSON Result */}
                                <pre className="bg-gray-900 text-gray-100 rounded-md p-4 overflow-auto max-h-[500px] text-sm">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>
                        Powered by{" "}
                        <a href="https://sdk.vercel.ai" className="text-blue-600 hover:underline">
                            Vercel AI SDK
                        </a>{" "}
                        +{" "}
                        <a href="https://ai.google.dev" className="text-blue-600 hover:underline">
                            Gemini
                        </a>{" "}
                        +{" "}
                        <a href="https://zod.dev" className="text-blue-600 hover:underline">
                            Zod
                        </a>
                    </p>
                </div>
            </div>
        </main>
    );
}

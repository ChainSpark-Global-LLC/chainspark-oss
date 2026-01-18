/**
 * Dynamic Extraction API Route
 * 
 * POST /api/extract/[type]
 * 
 * Handles extraction requests for any registered extractor type.
 * Supports both single-chunk and paginated input.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPipeline, ExtractionPipeline, PageChunk } from "@/lib/core";
import { getExtractor, getExtractorNames } from "@/lib/extractors";

// Request body schema
const RequestSchema = z.object({
    // Text to extract from (required)
    text: z.string().min(1, "Text is required"),

    // Optional: pre-chunked pages
    pages: z.array(z.object({
        content: z.string(),
        pageNumber: z.number(),
    })).optional(),

    // Options
    options: z.object({
        // Maximum chunk size (for auto-chunking)
        maxChunkSize: z.number().default(4000),
        // Whether to auto-chunk if no pages provided
        autoChunk: z.boolean().default(false),
    }).optional(),
});

interface RouteParams {
    params: Promise<{
        type: string;
    }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { type } = await params;

        // Look up the extractor
        const extractor = getExtractor(type);

        if (!extractor) {
            return NextResponse.json(
                {
                    error: `Unknown extractor type: "${type}"`,
                    available: getExtractorNames(),
                },
                { status: 400 }
            );
        }

        // Parse request body
        const body = await request.json();
        const parseResult = RequestSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: parseResult.error.issues[0].message },
                { status: 400 }
            );
        }

        const { text, pages, options } = parseResult.data;

        // Create the extraction pipeline
        const pipeline = createPipeline();

        // Determine chunks to process
        let chunks: PageChunk[];

        if (pages && pages.length > 0) {
            // Use pre-chunked pages
            chunks = pages;
        } else if (options?.autoChunk) {
            // Auto-chunk based on size
            chunks = ExtractionPipeline.chunkBySize(text, options?.maxChunkSize || 4000);
        } else {
            // Single chunk
            chunks = [{ content: text, pageNumber: 1 }];
        }

        // Run extraction
        const result = await pipeline.extractFromPages(chunks, extractor);

        return NextResponse.json({
            success: true,
            extractor: extractor.name,
            ...result,
        });

    } catch (error) {
        console.error("Extraction error:", error);

        const message = error instanceof Error ? error.message : "Unknown error";

        // Check for API key issues
        if (message.includes("GEMINI_API_KEY")) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY not configured. Set it in your .env.local file." },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: `Extraction failed: ${message}` },
            { status: 500 }
        );
    }
}

/**
 * GET /api/extract/[type]
 * 
 * Returns information about the extractor
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { type } = await params;

    const extractor = getExtractor(type);

    if (!extractor) {
        return NextResponse.json(
            {
                error: `Unknown extractor type: "${type}"`,
                available: getExtractorNames(),
            },
            { status: 404 }
        );
    }

    return NextResponse.json({
        name: extractor.name,
        description: extractor.description,
        rateLimit: extractor.rateLimit,
    });
}

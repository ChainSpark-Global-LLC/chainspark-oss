/**
 * Extractors API Route
 * 
 * GET /api/extract
 * 
 * Returns list of all available extractors
 */

import { NextResponse } from "next/server";
import { getExtractorOptions } from "@/lib/extractors";

export async function GET() {
    const extractors = getExtractorOptions();

    return NextResponse.json({
        extractors,
        usage: {
            endpoint: "/api/extract/{type}",
            method: "POST",
            body: {
                text: "string (required) - The text to extract from",
                pages: "array (optional) - Pre-chunked pages with content and pageNumber",
                options: {
                    autoChunk: "boolean - Whether to auto-split large text",
                    maxChunkSize: "number - Max characters per chunk (default: 4000)",
                },
            },
        },
    });
}

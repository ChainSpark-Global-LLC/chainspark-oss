/**
 * Mock LLM Utilities for Integration Testing
 * 
 * ## Pattern: Test Mocks as Documentation
 * 
 * This helper provides utilities to mock the AI SDK's `generateObject` function.
 * It demonstrates how to simulate successful extractions, rate limits, 
 * and schema validation errors.
 */

import { vi } from "vitest";

/**
 * Creates a mock response for `generateObject`
 * 
 * @param items - The array of items to return in the extraction
 */
export function createMockExtractionResponse<T>(items: T[]) {
    return {
        object: { items },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        warnings: [],
    };
}

/**
 * Mocks the `generateObject` function to return a specific set of items.
 * Pass the `generateObject` mock from `vi.mock('ai')`.
 */
export function setupSuccessfulExtraction<T>(mockFn: any, items: T[]) {
    return mockFn.mockResolvedValue(
        createMockExtractionResponse(items) as any
    );
}

/**
 * Mocks the `generateObject` function to trigger a rate limit error.
 */
export function setupRateLimitError(mockFn: any, message: string = "429 Too Many Requests") {
    return mockFn.mockRejectedValue(
        new Error(message)
    );
}

/**
 * Mocks a sequence of responses (e.g., failure followed by success).
 */
export function setupExtractionSequence(mockFn: any, responses: Array<{ success: boolean; data: any }>) {
    responses.forEach(resp => {
        if (resp.success) {
            mockFn.mockResolvedValueOnce(createMockExtractionResponse(resp.data) as any);
        } else {
            mockFn.mockRejectedValueOnce(resp.data instanceof Error ? resp.data : new Error(String(resp.data)));
        }
    });

    return mockFn;
}


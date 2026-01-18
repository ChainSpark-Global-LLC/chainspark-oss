/**
 * Error System Unit Tests
 * 
 * ## Pattern: Structured Error Handling
 * 
 * These tests demonstrate how to use the custom error system:
 * - Error codes for programmatic handling
 * - Error metadata for context
 * - Specialized error classes for common cases
 * 
 * ## Key Takeaways
 * 
 * 1. Use error codes instead of parsing error messages
 * 2. Include actionable metadata with errors
 * 3. Wrap unknown errors for consistency
 */

import { describe, it, expect } from "vitest";
import {
    ExtractionError,
    RateLimitError,
    ApiKeyError,
    SchemaValidationError,
    InputValidationError,
    ErrorCode,
    wrapError,
    isExtractionError,
} from "@/lib/core";

describe("ExtractionError", () => {
    /**
     * Pattern: Error codes over message parsing
     * 
     * Why: Error messages can change between versions.
     * Error codes provide a stable API for error handling.
     */
    describe("error codes", () => {
        it("includes an error code for programmatic handling", () => {
            // Arrange & Act
            const error = new ExtractionError(
                "RATE_LIMIT",
                "API rate limit exceeded"
            );

            // Assert: Can switch on error code
            expect(error.code).toBe("RATE_LIMIT");
            expect(error.message).toBe("API rate limit exceeded");
        });

        it("supports all defined error codes", () => {
            // Assert: All codes are defined
            expect(ErrorCode.RATE_LIMIT).toBe("RATE_LIMIT");
            expect(ErrorCode.API_KEY_MISSING).toBe("API_KEY_MISSING");
            expect(ErrorCode.SCHEMA_VALIDATION_FAILED).toBe("SCHEMA_VALIDATION_FAILED");
            expect(ErrorCode.PARSE_FAILED).toBe("PARSE_FAILED");
            expect(ErrorCode.TIMEOUT).toBe("TIMEOUT");
            expect(ErrorCode.INVALID_INPUT).toBe("INVALID_INPUT");
            expect(ErrorCode.EXTRACTOR_NOT_FOUND).toBe("EXTRACTOR_NOT_FOUND");
            expect(ErrorCode.NETWORK_ERROR).toBe("NETWORK_ERROR");
            expect(ErrorCode.UNKNOWN).toBe("UNKNOWN");
        });
    });

    /**
     * Pattern: Rich error metadata
     * 
     * Why: Errors should include enough context to:
     * - Debug the issue
     * - Take corrective action
     * - Log structured data
     */
    describe("metadata", () => {
        it("includes metadata for debugging", () => {
            // Arrange & Act
            const error = new ExtractionError(
                "RATE_LIMIT",
                "Rate limit exceeded",
                {
                    retryAfter: 60000,
                    attemptsMade: 3,
                    pageNumber: 5,
                }
            );

            // Assert
            expect(error.metadata?.retryAfter).toBe(60000);
            expect(error.metadata?.attemptsMade).toBe(3);
            expect(error.metadata?.pageNumber).toBe(5);
        });

        it("converts to JSON for structured logging", () => {
            // Arrange
            const error = new ExtractionError(
                "TIMEOUT",
                "Request timed out",
                { timeoutMs: 30000 }
            );

            // Act
            const json = error.toJSON();

            // Assert: JSON is structured and includes all fields
            expect(json).toEqual({
                name: "ExtractionError",
                code: "TIMEOUT",
                message: "Request timed out",
                metadata: { timeoutMs: 30000 },
            });

            // Can be stringified for logging
            expect(() => JSON.stringify(json)).not.toThrow();
        });
    });

    /**
     * Pattern: Static helper for code checking
     * 
     * Why: Provides type-safe error code checking without instanceof + property access
     */
    describe("isCode() helper", () => {
        it("returns true when error matches the code", () => {
            const error = new ExtractionError("RATE_LIMIT", "Rate limited");

            expect(ExtractionError.isCode(error, "RATE_LIMIT")).toBe(true);
            expect(ExtractionError.isCode(error, "TIMEOUT")).toBe(false);
        });

        it("returns false for non-ExtractionError", () => {
            const regularError = new Error("Something went wrong");

            expect(ExtractionError.isCode(regularError, "RATE_LIMIT")).toBe(false);
        });
    });
});

/**
 * Specialized error classes
 */
describe("Specialized Error Classes", () => {
    describe("RateLimitError", () => {
        it("includes retry timing information", () => {
            const error = new RateLimitError(
                "Gemini API rate limit exceeded",
                60000,  // retryAfterMs
                3       // attemptsMade
            );

            expect(error.code).toBe("RATE_LIMIT");
            expect(error.retryAfterMs).toBe(60000);
            expect(error.attemptsMade).toBe(3);
            expect(error.metadata?.retryAfter).toBe(60000);
        });
    });

    describe("ApiKeyError", () => {
        it("uses API_KEY_MISSING for missing keys", () => {
            const error = new ApiKeyError("GEMINI_API_KEY not set");

            expect(error.code).toBe("API_KEY_MISSING");
        });

        it("uses API_KEY_INVALID for invalid keys", () => {
            const error = new ApiKeyError("Invalid API key format", true);

            expect(error.code).toBe("API_KEY_INVALID");
        });
    });

    describe("SchemaValidationError", () => {
        it("includes validation details", () => {
            const error = new SchemaValidationError(
                "Schema validation failed",
                [
                    { path: "items[0].price", message: "Expected number, received string" },
                    { path: "items[0].quantity", message: "Required" },
                ],
                '{"items": [{"price": "invalid"}]}'
            );

            expect(error.code).toBe("SCHEMA_VALIDATION_FAILED");
            expect(error.metadata?.validationErrors).toHaveLength(2);
            expect(error.metadata?.rawResponse).toContain("invalid");
        });
    });

    describe("InputValidationError", () => {
        it("identifies the invalid field", () => {
            const error = new InputValidationError(
                "Text cannot be empty",
                "text"
            );

            expect(error.code).toBe("INVALID_INPUT");
            expect(error.metadata?.field).toBe("text");
        });
    });
});

/**
 * Pattern: Error wrapping for consistency
 * 
 * Why: All errors thrown from the library should be ExtractionErrors
 * so consumers only need to handle one error type.
 */
describe("wrapError()", () => {
    it("wraps a regular Error in an ExtractionError", () => {
        // Arrange
        const originalError = new Error("Network timeout");

        // Act
        const wrapped = wrapError(originalError);

        // Assert
        expect(wrapped).toBeInstanceOf(ExtractionError);
        expect(wrapped.code).toBe("UNKNOWN");
        expect(wrapped.message).toBe("Network timeout");
        expect(wrapped.metadata?.cause).toBe(originalError);
    });

    it("returns ExtractionError unchanged", () => {
        // Arrange
        const original = new ExtractionError("TIMEOUT", "Timed out");

        // Act
        const result = wrapError(original);

        // Assert: Same instance returned
        expect(result).toBe(original);
    });

    it("adds context to the error message", () => {
        // Arrange
        const error = new Error("Connection refused");

        // Act
        const wrapped = wrapError(error, "Failed to call Gemini API");

        // Assert
        expect(wrapped.message).toBe("Failed to call Gemini API: Connection refused");
    });

    it("handles non-Error objects", () => {
        // Act & Assert
        expect(wrapError("string error").message).toBe("string error");
        expect(wrapError(42).message).toBe("42");
        expect(wrapError({ msg: "obj" }).message).toContain("object");
    });
});

/**
 * Type guard utility
 */
describe("isExtractionError()", () => {
    it("returns true for ExtractionError instances", () => {
        expect(isExtractionError(new ExtractionError("UNKNOWN", "test"))).toBe(true);
        expect(isExtractionError(new RateLimitError("test", 1000, 1))).toBe(true);
    });

    it("returns false for regular errors", () => {
        expect(isExtractionError(new Error("regular error"))).toBe(false);
        expect(isExtractionError(null)).toBe(false);
        expect(isExtractionError(undefined)).toBe(false);
        expect(isExtractionError("string")).toBe(false);
    });
});

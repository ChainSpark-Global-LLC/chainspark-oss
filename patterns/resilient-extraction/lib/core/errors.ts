/**
 * Structured Error System for AI Extraction
 * 
 * ## Pattern: Custom Error Classes with Error Codes
 * 
 * Why this pattern?
 * - Programmatic error handling: `if (error.code === "RATE_LIMIT")` 
 * - User-friendly messages separate from technical details
 * - Structured logging: error metadata is JSON-serializable
 * - Type safety: TypeScript knows the shape of each error
 * 
 * @example
 * ```typescript
 * try {
 *   await extractor.extract(text);
 * } catch (error) {
 *   if (error instanceof ExtractionError) {
 *     switch (error.code) {
 *       case "RATE_LIMIT":
 *         // Wait and retry
 *         await sleep(error.metadata?.retryAfter ?? 60000);
 *         break;
 *       case "API_KEY_MISSING":
 *         // Show setup instructions
 *         console.error("Set GEMINI_API_KEY in .env.local");
 *         break;
 *     }
 *   }
 * }
 * ```
 */

/**
 * Error codes for all extraction-related errors.
 * 
 * Use these codes to handle errors programmatically without
 * parsing error messages (which may change).
 */
export const ErrorCode = {
    /** API rate limit exceeded - retry after delay */
    RATE_LIMIT: "RATE_LIMIT",

    /** API key is missing or invalid */
    API_KEY_MISSING: "API_KEY_MISSING",

    /** API key is invalid or expired */
    API_KEY_INVALID: "API_KEY_INVALID",

    /** Schema validation failed on LLM response */
    SCHEMA_VALIDATION_FAILED: "SCHEMA_VALIDATION_FAILED",

    /** LLM returned unparseable response */
    PARSE_FAILED: "PARSE_FAILED",

    /** Request timed out */
    TIMEOUT: "TIMEOUT",

    /** Input validation failed */
    INVALID_INPUT: "INVALID_INPUT",

    /** Extractor type not found in registry */
    EXTRACTOR_NOT_FOUND: "EXTRACTOR_NOT_FOUND",

    /** Network or connection error */
    NETWORK_ERROR: "NETWORK_ERROR",

    /** Unknown/unexpected error */
    UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Metadata that can be attached to extraction errors.
 * Different error types may include different metadata.
 */
export interface ExtractionErrorMetadata {
    /** For RATE_LIMIT: milliseconds to wait before retry */
    retryAfter?: number;

    /** For RATE_LIMIT: number of attempts made */
    attemptsMade?: number;

    /** For SCHEMA_VALIDATION_FAILED: Zod error details */
    validationErrors?: Array<{ path: string; message: string }>;

    /** For PARSE_FAILED: the raw response that couldn't be parsed */
    rawResponse?: string;

    /** For TIMEOUT: how long we waited */
    timeoutMs?: number;

    /** For INVALID_INPUT: which field was invalid */
    field?: string;

    /** For EXTRACTOR_NOT_FOUND: available extractor names */
    availableExtractors?: string[];

    /** Page number where error occurred (for multi-page extraction) */
    pageNumber?: number;

    /** Original error if this wraps another error */
    cause?: Error;
}

/**
 * Base error class for all extraction-related errors.
 * 
 * ## Why Custom Errors?
 * 
 * 1. **Type Safety**: `instanceof ExtractionError` narrows the type
 * 2. **Error Codes**: Handle errors programmatically, not by parsing messages
 * 3. **Rich Metadata**: Include context like retry delays, page numbers
 * 4. **Structured Logging**: `JSON.stringify(error.toJSON())` works correctly
 * 
 * @example
 * ```typescript
 * throw new ExtractionError(
 *   "RATE_LIMIT",
 *   "Gemini API rate limit exceeded. Retry after 60 seconds.",
 *   { retryAfter: 60000, attemptsMade: 3 }
 * );
 * ```
 */
export class ExtractionError extends Error {
    public readonly name = "ExtractionError";

    constructor(
        public readonly code: ErrorCode,
        message: string,
        public readonly metadata?: ExtractionErrorMetadata
    ) {
        super(message);

        // Maintains proper stack trace in V8 environments
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ExtractionError);
        }
    }

    /**
     * Convert to a JSON-serializable object for logging.
     * 
     * @example
     * ```typescript
     * console.log(JSON.stringify(error.toJSON()));
     * // {"code":"RATE_LIMIT","message":"...","metadata":{...}}
     * ```
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            metadata: this.metadata,
        };
    }

    /**
     * Check if an error is an ExtractionError with a specific code.
     * 
     * @example
     * ```typescript
     * if (ExtractionError.isCode(error, "RATE_LIMIT")) {
     *   await sleep(error.metadata?.retryAfter ?? 60000);
     * }
     * ```
     */
    static isCode(error: unknown, code: ErrorCode): error is ExtractionError {
        return error instanceof ExtractionError && error.code === code;
    }
}

/**
 * Error thrown when API rate limits are exceeded.
 * 
 * Includes retry information so callers can implement backoff.
 */
export class RateLimitError extends ExtractionError {
    constructor(
        message: string,
        public readonly retryAfterMs: number,
        public readonly attemptsMade: number
    ) {
        super("RATE_LIMIT", message, { retryAfter: retryAfterMs, attemptsMade });
    }
}

/**
 * Error thrown when API key is missing or invalid.
 */
export class ApiKeyError extends ExtractionError {
    constructor(message: string, isInvalid: boolean = false) {
        super(
            isInvalid ? "API_KEY_INVALID" : "API_KEY_MISSING",
            message
        );
    }
}

/**
 * Error thrown when LLM response fails schema validation.
 */
export class SchemaValidationError extends ExtractionError {
    constructor(
        message: string,
        validationErrors: Array<{ path: string; message: string }>,
        rawResponse?: string
    ) {
        super("SCHEMA_VALIDATION_FAILED", message, { validationErrors, rawResponse });
    }
}

/**
 * Error thrown when input validation fails.
 */
export class InputValidationError extends ExtractionError {
    constructor(message: string, field?: string) {
        super("INVALID_INPUT", message, { field });
    }
}

/**
 * Wrap an unknown error in an ExtractionError.
 * 
 * Use this to ensure all errors thrown from the library are ExtractionErrors.
 * 
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   throw wrapError(error, "Failed to process document");
 * }
 * ```
 */
export function wrapError(error: unknown, context?: string): ExtractionError {
    if (error instanceof ExtractionError) {
        return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    return new ExtractionError(
        "UNKNOWN",
        context ? `${context}: ${message}` : message,
        { cause }
    );
}

/**
 * Type guard to check if an error is an ExtractionError.
 */
export function isExtractionError(error: unknown): error is ExtractionError {
    return error instanceof ExtractionError;
}

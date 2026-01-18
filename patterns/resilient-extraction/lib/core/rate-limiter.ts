/**
 * Rate-Limited AI Client
 * 
 * ## The Problem
 * 
 * LLM APIs enforce strict rate limits:
 * - Gemini: ~10 requests per minute (10 RPM)
 * - OpenAI: 60-10,000 RPM depending on tier
 * - Anthropic: 5-50 RPM depending on model
 * 
 * Without rate limiting, batch jobs that make many API calls in quick
 * succession will receive 429 (Too Many Requests) errors and fail.
 * 
 * ## The Solution
 * 
 * This module provides a `RateLimiter` class that:
 * 1. Enforces minimum delay between API calls
 * 2. Implements exponential backoff on 429 errors
 * 3. Tracks execution metrics for observability
 * 4. Provides a simple wrapper interface for any async function
 * 
 * ## Pattern: Token Bucket (Simplified)
 * 
 * We use a simplified token bucket algorithm:
 * - Track time of last API call
 * - Before each new call, wait until `delayMs` has elapsed
 * - On 429 error, wait exponentially longer (2^attempt * delay)
 * 
 * This is simpler than a full token bucket but works well for
 * sequential processing patterns.
 * 
 * @example Basic usage
 * ```typescript
 * const limiter = new RateLimiter({ delayMs: 7000 });
 * 
 * // Each call respects the rate limit
 * const result1 = await limiter.execute(() => callLLM(prompt1));
 * const result2 = await limiter.execute(() => callLLM(prompt2));
 * ```
 * 
 * @module rate-limiter
 */

import { RateLimitConfig, DEFAULT_RATE_LIMIT } from "./types";
import { RateLimitError, wrapError } from "./errors";
import { createLogger } from "./logger";

const logger = createLogger("rate-limiter");

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Sleep for a specified number of milliseconds.
 * 
 * A simple Promise wrapper around setTimeout. Used extensively
 * for rate limiting delays and exponential backoff.
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 * 
 * @example
 * ```typescript
 * console.log("Starting...");
 * await sleep(1000);
 * console.log("1 second later");
 * ```
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// METRICS
// ============================================================================

/**
 * Metrics tracked by the rate limiter.
 * 
 * Use these to understand rate limiting behavior in production:
 * - High `totalWaitTimeMs` suggests rate limits are being hit frequently
 * - High `totalRetries` indicates flaky API or too aggressive throughput
 */
export interface RateLimiterMetrics {
    /** Total number of successful executions */
    totalExecutions: number;

    /** Total time spent waiting for rate limit slots */
    totalWaitTimeMs: number;

    /** Total number of retry attempts across all executions */
    totalRetries: number;

    /** Number of executions that failed after all retries */
    totalFailures: number;

    /** Timestamp of the last successful execution */
    lastExecutionAt?: number;
}

// ============================================================================
// RATE LIMITER
// ============================================================================

/**
 * Rate limiter that enforces delays between API calls.
 * 
 * ## Why This Pattern?
 * 
 * 1. **Prevents 429 errors**: Enforces minimum delay between calls
 * 2. **Automatic retry**: Exponential backoff on rate limit errors
 * 3. **Observable**: Tracks metrics for monitoring
 * 4. **Composable**: Wrap any async function
 * 
 * ## How It Works
 * 
 * ```
 * Call 1 ─────▶ [Wait if needed] ─────▶ Execute ─────▶ Done
 *                     │
 *                     ▼
 *         (elapsed < delayMs?)
 *              │         │
 *              No        Yes
 *              │         │
 *              ▼         ▼
 *           Execute   Sleep(remaining)
 * ```
 * 
 * ## Exponential Backoff
 * 
 * When a 429 error occurs:
 * - Attempt 1: Wait 2× delayMs (14s for default)
 * - Attempt 2: Wait 4× delayMs (28s)
 * - Attempt 3: Wait 8× delayMs (56s)
 * - Give up after maxRetries
 * 
 * @example Basic usage
 * ```typescript
 * const limiter = new RateLimiter({ delayMs: 7000, maxRetries: 3 });
 * 
 * const result = await limiter.execute(
 *   () => callGeminiAPI(prompt),
 *   "Gemini extraction"
 * );
 * ```
 * 
 * @example Checking metrics
 * ```typescript
 * const limiter = new RateLimiter();
 * 
 * // After many operations...
 * const metrics = limiter.getMetrics();
 * console.log(`Total wait time: ${metrics.totalWaitTimeMs}ms`);
 * console.log(`Retry rate: ${metrics.totalRetries / metrics.totalExecutions}`);
 * ```
 */
export class RateLimiter {
    /** Timestamp of the last API call (used to calculate wait time) */
    private lastCallTime: number = 0;

    /** Configuration for delays and retries */
    private config: RateLimitConfig;

    /** Metrics tracked across all executions */
    private metrics: RateLimiterMetrics = {
        totalExecutions: 0,
        totalWaitTimeMs: 0,
        totalRetries: 0,
        totalFailures: 0,
    };

    /**
     * Create a new rate limiter.
     * 
     * @param config - Partial configuration (merged with defaults)
     * 
     * @example
     * ```typescript
     * // Use defaults (7s delay, 3 retries)
     * const limiter = new RateLimiter();
     * 
     * // Custom configuration
     * const slowLimiter = new RateLimiter({
     *   delayMs: 15000,  // 15 seconds between calls
     *   maxRetries: 5,   // More retries for flaky service
     * });
     * ```
     */
    constructor(config: Partial<RateLimitConfig> = {}) {
        this.config = { ...DEFAULT_RATE_LIMIT, ...config };
    }

    /**
     * Wait until we can make the next API call.
     * 
     * This method calculates how long to wait based on when the last
     * call was made, and sleeps for the remaining time if needed.
     * 
     * ## Why Not Just Sleep Every Time?
     * 
     * If the previous call took longer than `delayMs` to complete,
     * we don't need to wait at all. This method is smart about only
     * waiting when necessary.
     * 
     * @returns The number of milliseconds we waited (0 if no wait needed)
     * 
     * @example
     * ```typescript
     * const waited = await limiter.waitForNextSlot();
     * console.log(`Waited ${waited}ms before making the call`);
     * ```
     */
    async waitForNextSlot(): Promise<number> {
        const now = Date.now();
        const elapsed = now - this.lastCallTime;
        const remaining = this.config.delayMs - elapsed;

        if (remaining > 0) {
            // Use logger instead of direct console
            logger.info(
                `Rate limiting: waiting ${remaining}ms before next request`,
                { elapsed, remaining, delayMs: this.config.delayMs }
            );
            await sleep(remaining);
            this.metrics.totalWaitTimeMs += remaining;
        }

        this.lastCallTime = Date.now();
        return Math.max(0, remaining);
    }

    /**
     * Execute a function with rate limiting and automatic retry on 429 errors.
     * 
     * This is the main entry point for making rate-limited API calls.
     * It handles:
     * 1. Waiting for the next available slot
     * 2. Executing the provided function
     * 3. Retrying with exponential backoff on rate limit errors
     * 4. Tracking metrics
     * 
     * ## Error Handling
     * 
     * - **Rate limit errors (429)**: Automatic retry with backoff
     * - **Other errors**: Thrown immediately (no retry)
     * - **After max retries**: Throws `RateLimitError` with metadata
     * 
     * @typeParam T - The return type of the function being executed
     * @param fn - The async function to execute
     * @param operationName - Name for logging/metrics (default: "API call")
     * @returns The result of the function
     * @throws {RateLimitError} If max retries exceeded on rate limit
     * @throws {Error} If a non-rate-limit error occurs
     * 
     * @example
     * ```typescript
     * try {
     *   const result = await limiter.execute(
     *     () => gemini.generateContent(prompt),
     *     "Gemini extraction"
     *   );
     * } catch (error) {
     *   if (error instanceof RateLimitError) {
     *     console.log(`Rate limited after ${error.attemptsMade} attempts`);
     *   }
     * }
     * ```
     */
    async execute<T>(
        fn: () => Promise<T>,
        operationName: string = "API call"
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            await this.waitForNextSlot();

            try {
                const result = await fn();

                // Success! Update metrics
                this.metrics.totalExecutions++;
                this.metrics.lastExecutionAt = Date.now();

                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Check if it's a rate limit error (429)
                // Different APIs format this differently, so we check multiple patterns
                const isRateLimitError = this.isRateLimitError(lastError);

                if (isRateLimitError && attempt < this.config.maxRetries) {
                    this.metrics.totalRetries++;

                    // Exponential backoff: 2^attempt × base delay
                    // Attempt 1: 2 × 7000 = 14,000ms (14s)
                    // Attempt 2: 4 × 7000 = 28,000ms (28s)
                    // Attempt 3: 8 × 7000 = 56,000ms (56s)
                    const backoffMs = Math.pow(2, attempt) * this.config.delayMs;

                    logger.warn(
                        `${operationName} rate limited`,
                        { attempt, maxRetries: this.config.maxRetries, backoffMs }
                    );

                    await sleep(backoffMs);
                    this.metrics.totalWaitTimeMs += backoffMs;
                    continue;
                }

                // Non-rate-limit error or max retries exceeded
                this.metrics.totalFailures++;
                console.error(
                    `❌ ${operationName} failed after ${attempt} attempt(s): ${lastError.message}`
                );

                // Wrap in RateLimitError if it was a rate limit issue
                if (isRateLimitError) {
                    throw new RateLimitError(
                        `${operationName} failed: Rate limit exceeded after ${attempt} attempts. ` +
                        `Consider increasing delayMs or reducing request volume.`,
                        this.config.delayMs * Math.pow(2, attempt),
                        attempt
                    );
                }

                // Re-throw wrapped in ExtractionError for consistency
                throw wrapError(lastError, operationName);
            }
        }

        // Should not reach here, but handle edge case
        throw lastError || new Error(
            `${operationName} failed after ${this.config.maxRetries} attempts`
        );
    }

    /**
     * Check if an error is a rate limit (429) error.
     * 
     * Different APIs format rate limit errors differently:
     * - Some include "429" in the message
     * - Some say "rate limit"
     * - Some say "quota exceeded"
     * 
     * This method checks for all common patterns.
     */
    private isRateLimitError(error: Error): boolean {
        const message = error.message.toLowerCase();
        return (
            message.includes("429") ||
            message.includes("rate limit") ||
            message.includes("rate_limit") ||
            message.includes("quota") ||
            message.includes("too many requests")
        );
    }

    /**
     * Get the current rate limit configuration.
     * 
     * Returns a copy to prevent external modification.
     */
    getConfig(): RateLimitConfig {
        return { ...this.config };
    }

    /**
     * Get metrics about rate limiter usage.
     * 
     * Useful for monitoring and debugging:
     * - High `totalWaitTimeMs` suggests you're hitting limits often
     * - High `totalRetries` suggests the API is frequently throttling you
     * - `totalFailures > 0` indicates some requests couldn't be completed
     * 
     * @example
     * ```typescript
     * const metrics = limiter.getMetrics();
     * 
     * // Log to monitoring service
     * analytics.track("rate_limiter_metrics", {
     *   executions: metrics.totalExecutions,
     *   waitTimeMs: metrics.totalWaitTimeMs,
     *   retries: metrics.totalRetries,
     *   failures: metrics.totalFailures,
     * });
     * ```
     */
    getMetrics(): RateLimiterMetrics {
        return { ...this.metrics };
    }

    /**
     * Reset all metrics to zero.
     * 
     * Useful when starting a new batch of operations and you want
     * fresh metrics for that batch.
     */
    resetMetrics(): void {
        this.metrics = {
            totalExecutions: 0,
            totalWaitTimeMs: 0,
            totalRetries: 0,
            totalFailures: 0,
        };
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a rate limiter with the specified configuration.
 * 
 * This is a convenience factory function. You can also use
 * `new RateLimiter(config)` directly.
 * 
 * @param config - Partial configuration (merged with defaults)
 * @returns A new RateLimiter instance
 * 
 * @example
 * ```typescript
 * const limiter = createRateLimiter({ delayMs: 10000 });
 * ```
 */
export function createRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
    return new RateLimiter(config);
}


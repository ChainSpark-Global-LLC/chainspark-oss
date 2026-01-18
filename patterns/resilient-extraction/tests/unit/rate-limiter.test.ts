/**
 * Rate Limiter Unit Tests
 * 
 * ## Pattern: Tests as Documentation
 * 
 * Each test in this file demonstrates a specific behavior of the rate limiter.
 * Read these tests to understand:
 * 
 * 1. How the rate limiter enforces delays between calls
 * 2. How exponential backoff works on rate limit errors
 * 3. How metrics are tracked for observability
 * 
 * ## Running These Tests
 * 
 * ```bash
 * npm test                           # Run all tests
 * npm test -- tests/unit/rate-limiter.test.ts  # Run just this file
 * npm run test:watch                 # Watch mode for development
 * ```
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter, sleep, createRateLimiter } from "@/lib/core";

describe("RateLimiter", () => {
    /**
     * Pattern: Enforce minimum delay between API calls
     * 
     * Why: LLM APIs like Gemini have rate limits (e.g., 10 requests/minute).
     * This pattern prevents 429 errors by spacing out requests automatically.
     */
    describe("waitForNextSlot()", () => {
        it("waits for the configured delay between calls", async () => {
            // Arrange: Create a limiter with 100ms delay (fast for testing)
            const limiter = new RateLimiter({ delayMs: 100 });

            // Act: Make two calls in quick succession
            const start = Date.now();
            await limiter.waitForNextSlot();
            await limiter.waitForNextSlot();
            const elapsed = Date.now() - start;

            // Assert: At least 100ms should have elapsed between calls
            expect(elapsed).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
        });

        it("does not wait if enough time has already passed", async () => {
            // Arrange: Create limiter and wait longer than the delay
            const limiter = new RateLimiter({ delayMs: 50 });
            await limiter.waitForNextSlot();
            await sleep(60); // Wait longer than the delay

            // Act: Measure time for next slot
            const start = Date.now();
            await limiter.waitForNextSlot();
            const elapsed = Date.now() - start;

            // Assert: Should not wait (or wait very briefly)
            expect(elapsed).toBeLessThan(20);
        });
    });

    /**
     * Pattern: Wrap async functions with rate limiting
     * 
     * Why: Instead of manually managing delays, wrap your API calls
     * with execute() to get automatic rate limiting and retry logic.
     */
    describe("execute()", () => {
        it("executes functions with rate limiting", async () => {
            // Arrange
            const limiter = new RateLimiter({ delayMs: 50 });
            const mockFn = vi.fn().mockResolvedValue("success");

            // Act
            const result = await limiter.execute(mockFn, "test operation");

            // Assert
            expect(result).toBe("success");
            expect(mockFn).toHaveBeenCalledOnce();
        });

        it("returns the function's result", async () => {
            // Arrange
            const limiter = new RateLimiter({ delayMs: 10 });
            const expectedData = { items: [1, 2, 3], count: 3 };
            const mockFn = vi.fn().mockResolvedValue(expectedData);

            // Act
            const result = await limiter.execute(mockFn);

            // Assert
            expect(result).toEqual(expectedData);
        });
    });

    /**
     * Pattern: Exponential backoff on rate limit errors
     * 
     * Why: When you hit a 429 error, waiting a fixed time isn't optimal.
     * Exponential backoff (2^attempt × delay) spreads out retries:
     * - Attempt 1: Wait 2× delay
     * - Attempt 2: Wait 4× delay
     * - Attempt 3: Wait 8× delay
     */
    describe("retry with exponential backoff", () => {
        it("retries on rate limit errors with increasing delay", async () => {
            // Arrange: A function that fails twice then succeeds
            const limiter = new RateLimiter({ delayMs: 10, maxRetries: 3 });
            let attempt = 0;
            const mockFn = vi.fn().mockImplementation(() => {
                attempt++;
                if (attempt < 3) {
                    throw new Error("429 Too Many Requests");
                }
                return "success";
            });

            // Act
            const result = await limiter.execute(mockFn, "retry test");

            // Assert: Function was called 3 times (2 failures + 1 success)
            expect(result).toBe("success");
            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        it("gives up after max retries and throws RateLimitError", async () => {
            // Arrange: A function that always fails with rate limit
            const limiter = new RateLimiter({ delayMs: 10, maxRetries: 2 });
            const mockFn = vi.fn().mockRejectedValue(new Error("429 rate limit"));

            // Act & Assert
            await expect(limiter.execute(mockFn)).rejects.toThrow("Rate limit exceeded");
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it("does NOT retry non-rate-limit errors", async () => {
            // Arrange: A function that fails with a different error
            const limiter = new RateLimiter({ delayMs: 10, maxRetries: 3 });
            const mockFn = vi.fn().mockRejectedValue(new Error("Database connection failed"));

            // Act & Assert: Should throw immediately without retrying
            await expect(limiter.execute(mockFn)).rejects.toThrow("Database connection failed");
            expect(mockFn).toHaveBeenCalledTimes(1); // Only one attempt
        });
    });

    /**
     * Pattern: Track metrics for observability
     * 
     * Why: In production, you need to know:
     * - How much time is spent waiting for rate limits
     * - How often retries are happening
     * - Whether requests are failing
     * 
     * These metrics help you tune your rate limit configuration.
     */
    describe("metrics tracking", () => {
        it("tracks successful executions", async () => {
            // Arrange
            const limiter = new RateLimiter({ delayMs: 10 });

            // Act: Execute a few successful operations
            await limiter.execute(() => Promise.resolve("a"));
            await limiter.execute(() => Promise.resolve("b"));
            await limiter.execute(() => Promise.resolve("c"));

            // Assert
            const metrics = limiter.getMetrics();
            expect(metrics.totalExecutions).toBe(3);
            expect(metrics.totalFailures).toBe(0);
        });

        it("tracks wait time", async () => {
            // Arrange
            const limiter = new RateLimiter({ delayMs: 50 });

            // Act: Make calls that require waiting
            await limiter.execute(() => Promise.resolve("a"));
            await limiter.execute(() => Promise.resolve("b")); // Should wait ~50ms

            // Assert
            const metrics = limiter.getMetrics();
            expect(metrics.totalWaitTimeMs).toBeGreaterThan(30); // Allow tolerance
        });

        it("can reset metrics for a new batch", async () => {
            // Arrange
            const limiter = new RateLimiter({ delayMs: 10 });
            await limiter.execute(() => Promise.resolve("test"));

            // Act
            limiter.resetMetrics();

            // Assert
            const metrics = limiter.getMetrics();
            expect(metrics.totalExecutions).toBe(0);
            expect(metrics.totalWaitTimeMs).toBe(0);
        });
    });

    /**
     * Pattern: Configuration immutability
     * 
     * Why: Configuration should not be modifiable after creation
     * to prevent accidental changes during execution.
     */
    describe("configuration", () => {
        it("returns a copy of config to prevent mutation", () => {
            // Arrange
            const limiter = new RateLimiter({ delayMs: 1000 });

            // Act: Try to mutate the returned config
            const config = limiter.getConfig();
            config.delayMs = 0;

            // Assert: Original config is unchanged
            expect(limiter.getConfig().delayMs).toBe(1000);
        });

        it("uses default values when not specified", () => {
            // Arrange & Act
            const limiter = new RateLimiter();

            // Assert
            const config = limiter.getConfig();
            expect(config.delayMs).toBe(7000);
            expect(config.maxRetries).toBe(3);
        });
    });
});

/**
 * Pattern: Factory function convenience
 */
describe("createRateLimiter()", () => {
    it("creates a RateLimiter with the given config", () => {
        // Act
        const limiter = createRateLimiter({ delayMs: 5000 });

        // Assert
        expect(limiter).toBeInstanceOf(RateLimiter);
        expect(limiter.getConfig().delayMs).toBe(5000);
    });
});

/**
 * Utility function test
 */
describe("sleep()", () => {
    it("waits for the specified duration", async () => {
        const start = Date.now();
        await sleep(50);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(45);
        expect(elapsed).toBeLessThan(100);
    });
});

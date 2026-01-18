import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest Configuration
 * 
 * ## Test Organization
 * 
 * Tests are organized by type:
 * - `tests/unit/` - Fast, isolated unit tests
 * - `tests/integration/` - Tests that may use mocked external services
 * 
 * ## Running Tests
 * 
 * ```bash
 * npm test           # Run all tests
 * npm run test:watch # Watch mode for development
 * npm run test:ui    # Visual test runner
 * ```
 */
export default defineConfig({
    test: {
        // Test file patterns
        include: ["tests/**/*.test.ts"],

        // Global test setup
        globals: true,

        // Environment for DOM testing (not needed for this project)
        environment: "node",

        // Coverage configuration
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["lib/**/*.ts"],
            exclude: ["lib/**/*.test.ts", "lib/**/index.ts"],
        },

        // Timeout for slow tests (LLM calls can be slow)
        testTimeout: 30000,

        // Reporter configuration
        reporters: ["verbose"],
    },

    // Path aliases (match tsconfig.json)
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./"),
        },
    },
});

/**
 * Structured Logger
 * 
 * ## Pattern: Structured Logging
 * 
 * Why this pattern?
 * 1. **Observability**: JSON logs are easily indexed by systems like 
 *    Datadog, Elastic, or CloudWatch.
 * 2. **Context**: Allows attaching metadata (page numbers, elapsed time, 
 *    item counts) without messy string concatenation.
 * 3. **Consistency**: Unified log format across all modules.
 * 
 * @module logger
 */

/**
 * Log levels available in the system.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Configuration for the logger.
 */
export interface LoggerConfig {
    /** 
     * Enable JSON output? (Defaults to true in production)
     */
    json?: boolean;

    /** 
     * Minimum level to log.
     */
    level?: LogLevel;
}

/**
 * Base logger class.
 */
export class Logger {
    private level: LogLevel;
    private json: boolean;
    private priority: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
    };

    /**
     * Create a new logger.
     * 
     * @param name - The module name for this logger instance
     * @param config - Optional configuration
     */
    constructor(private name: string, config: LoggerConfig = {}) {
        this.level = config.level || (process.env.NODE_ENV === "production" ? "info" : "debug");
        this.json = config.json ?? (process.env.NODE_ENV === "production");
    }

    /**
     * Internal log method.
     */
    private log(level: LogLevel, message: string, metadata?: Record<string, any>) {
        if (this.priority[level] < this.priority[this.level]) return;

        if (this.json) {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level,
                module: this.name,
                message,
                ...metadata
            }));
        } else {
            const emoji = {
                debug: "🔍",
                info: "ℹ️",
                warn: "⚠️",
                error: "❌"
            }[level];

            const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : "";
            console.log(`${emoji} [${this.name}] ${message}${metaStr}`);
        }
    }

    debug(message: string, metadata?: Record<string, any>) {
        this.log("debug", message, metadata);
    }

    info(message: string, metadata?: Record<string, any>) {
        this.log("info", message, metadata);
    }

    warn(message: string, metadata?: Record<string, any>) {
        this.log("warn", message, metadata);
    }

    error(message: string, metadata?: Record<string, any>) {
        this.log("error", message, metadata);
    }
}

/**
 * Factory function to create a logger for a specific module.
 * 
 * @example
 * ```typescript
 * const logger = createLogger("extraction-pipeline");
 * logger.info("Extraction started", { pages: 5 });
 * ```
 */
export function createLogger(name: string, config?: LoggerConfig): Logger {
    return new Logger(name, config);
}

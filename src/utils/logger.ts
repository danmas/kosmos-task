// src/utils/logger.ts
// Простой логгер для проекта Kosmos Agent

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
    level?: LogLevel;
    prefix?: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';

class Logger {
    private level: LogLevel;
    private prefix: string;

    constructor(options: LoggerOptions = {}) {
        this.level = options.level ?? 'info';
        this.prefix = options.prefix ?? '';
    }

    private shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
    }

    private formatMessage(level: LogLevel, ...args: unknown[]): string {
        const timestamp = new Date().toISOString();
        const levelStr = level.toUpperCase().padEnd(5);
        const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        return `${LEVEL_COLORS[level]}[${timestamp}] ${levelStr}${RESET} ${prefixStr}${message}`;
    }

    debug(...args: unknown[]): void {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage('debug', ...args));
        }
    }

    info(...args: unknown[]): void {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', ...args));
        }
    }

    warn(...args: unknown[]): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', ...args));
        }
    }

    error(...args: unknown[]): void {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', ...args));
        }
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    child(prefix: string): Logger {
        return new Logger({
            level: this.level,
            prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix
        });
    }
}

// Экспорт по умолчанию — инстанс логгера
const logger = new Logger();

export default logger;
export { Logger };
export type { LogLevel, LoggerOptions };

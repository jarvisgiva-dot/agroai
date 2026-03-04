/**
 * Conditional logger that only logs in development
 * Prevents console pollution in production
 */

const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
    log: (...args: any[]) => {
        if (isDev) console.log(...args)
    },
    error: (...args: any[]) => {
        if (isDev) console.error(...args)
    },
    warn: (...args: any[]) => {
        if (isDev) console.warn(...args)
    },
    info: (...args: any[]) => {
        if (isDev) console.info(...args)
    },
    debug: (...args: any[]) => {
        if (isDev) console.debug(...args)
    },
}

// Always log errors (even in production)
// Always log errors (even in production)
export const logError = (context: string, error: any) => {
    if (typeof error === 'object' && error !== null) {
        console.error(`[${context}]`, JSON.stringify(error, null, 2))
        // Also log the raw error object for browser console inspection
        console.error(`[${context}] Raw:`, error)
    } else {
        console.error(`[${context}]`, error)
    }
    // TODO: Integrate with error tracking service (Sentry, etc.)
}

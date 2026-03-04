// Utilitários para tratamento de erros
import { SupabaseError } from '@/types/api';

export class AppError extends Error {
    constructor(
        message: string,
        public code?: string,
        public userMessage?: string
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export const handleError = (error: unknown): string => {
    // Erro conhecido (AppError)
    if (error instanceof AppError) {
        return error.userMessage || error.message;
    }

    // Erro padrão do JavaScript
    if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
            return 'Sem conexão com a internet. Verifique sua rede.';
        }
        if (error.message.includes('permission') || error.message.includes('unauthorized')) {
            return 'Você não tem permissão para acessar estes dados.';
        }
        return error.message;
    }

    // Erro do Supabase
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const supabaseErr = error as SupabaseError;

        switch (supabaseErr.code) {
            case 'PGRST116':
                return 'Nenhum dado encontrado para os filtros aplicados.';
            case '42P01':
                return 'Tabela não encontrada. Entre em contato com o suporte.';
            case '23505':
                return 'Este registro já existe no sistema.';
            case '23503':
                return 'Não é possível excluir. Existem registros relacionados.';
            default:
                return supabaseErr.message || 'Erro desconhecido do banco de dados.';
        }
    }

    // Erro desconhecido
    console.error('Unknown error:', error);
    return 'Erro inesperado. Tente novamente.';
};

// Logger estruturado
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
    constructor(private prefix: string) { }

    private log(level: LogLevel, message: string, data?: unknown) {
        const timestamp = new Date().toISOString();
        const formatted = `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}] ${message}`;

        if (process.env.NODE_ENV === 'production' && level === 'debug') return;

        console[level](formatted, data || '');

        // Em produção, enviar para serviço de monitoramento
        if (process.env.NODE_ENV === 'production' && level === 'error') {
            // TODO: Integrar com Sentry ou similar
        }
    }

    debug(message: string, data?: unknown) { this.log('debug', message, data); }
    info(message: string, data?: unknown) { this.log('info', message, data); }
    warn(message: string, data?: unknown) { this.log('warn', message, data); }
    error(message: string, data?: unknown) { this.log('error', message, data); }
}

export const createLogger = (prefix: string) => new Logger(prefix);

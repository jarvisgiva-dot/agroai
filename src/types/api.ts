// Tipos para APIs e respostas do servidor
import { z } from 'zod';

// ============ Chat API Types ============
export interface ChatMessage {
    role: 'user' | 'assistant' | 'model';
    content: string;
}

export interface ChatRequest {
    message: string;
    history: ChatMessage[];
    systemPrompt?: string;
}

export interface ChatResponse {
    response: string;
    error?: string;
}

// ============ Supabase Error Types ============
export interface SupabaseError {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
}

// ============ Filter Types ============
export interface DashboardFilters {
    safra: string;
    fazenda: string;
    cultura: string;
}

// ============ Recharts Custom Tooltip ============
export interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        name: string;
        value: number;
        color: string;
        dataKey: string;
    }>;
    label?: string;
}

// ============ Chart Data Types ============
export interface VarietyChartData {
    variedade: string;
    producao: number;
    produtividade: number;
    area: number;
}

export interface TalhaoChartData {
    talhao: string;
    produtividade: number;
    area: number;
    producao: number;
    fazenda: string;
}

export interface ClientChartData {
    cliente: string;
    totalPendente: number;
    totalSacas: number;
    contratos: number;
}

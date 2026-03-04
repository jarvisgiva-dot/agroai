/**
 * Type definitions for database tables
 * Provides type safety for Supabase queries
 */

export interface ProductivityRecord {
    id: number
    arquivo_origem?: string
    safra: string
    cultura: string
    fazenda_lavoura: string
    talhao: string
    variedade?: string
    area_plantada_ha?: number
    area_colhida_ha: number
    percentual_colhido?: number
    data_inicio_colheita?: string
    data_fim_colheita?: string
    producao_bruta_kg?: number
    producao_bruta_sacas?: number
    produtividade_bruta_scs_ha?: number
    descontos_total_kg?: number
    descontos_total_sacas?: number
    producao_liquida_kg?: number
    producao_liquida_sacas: number
    produtividade_liquida_scs_ha?: number
    created_at: string
}

export interface Contract {
    id: number
    arquivo_origem?: string
    numero_contrato: string
    cliente_comprador: string
    cultura: string
    safra: string
    variedade?: string
    tipo_frete?: string
    data_contrato?: string
    data_vencimento?: string
    data_prazo_entrega_inicio?: string
    data_prazo_entrega_fim?: string
    peso_saca_kg?: number
    preco_por_saca: number
    qtd_contrato_sacas: number
    qtd_contrato_peso_kg?: number
    qtd_carregada_sacas?: number
    qtd_pendente_sacas: number
    valor_total_contrato?: number
    created_at: string
}

export interface InventoryItem {
    id: number
    arquivo_origem?: string
    data_saldo?: string
    codigo_produto: string
    nome_produto: string
    categoria_linha: string
    referencia_fabricante?: string
    unidade_medida: string
    quantidade_estoque: number
    custo_medio_unitario?: number
    valor_total_estoque: number
    local_armazenagem?: string
    created_at: string
}

export interface GrainStorage {
    id: number
    arquivo_origem?: string
    data_posicao: string
    proprietario?: string
    local_armazem?: string
    cultura: string
    safra: string
    total_entrada_sacas?: number
    total_saida_sacas?: number
    saldo_fisico_sacas: number
    saldo_disponivel_venda_sacas?: number
    created_at: string
}

export interface ChatMessage {
    id: string
    session_id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    embedding?: number[]
    metadata?: Record<string, any>
    created_at: string
}

// Filter types
export interface DashboardFilters {
    safra: string
    fazenda: string
    cultura: string
}

// Aggregated data types
export interface DashboardData {
    productivity: ProductivityRecord[]
    contracts: Contract[]
    inventory: InventoryItem[]
}

export interface DashboardMetrics {
    totalProduction: number
    totalArea: number
    avgProductivity: string
    totalContracts: number
    totalPendente: number
}

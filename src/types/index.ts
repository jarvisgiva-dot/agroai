// Definições de tipos compartilhados para garantir consistência em todo o projeto

export interface InventoryItem {
    id: number
    codigo_produto: string
    nome_produto: string
    categoria_linha: string | null
    local_armazenagem: string | null
    quantidade_estoque: number
    unidade_medida: string
    custo_medio_unitario: number
    valor_total_estoque: number
}

export interface Contract {
    id: number
    numero_contrato: string
    cliente_comprador: string
    cultura: string
    safra: string
    tipo_frete: string
    qtd_contrato_sacas: number
    preco_por_saca: number
    data_vencimento: string  // Schema converts null to empty string
    qtd_pendente_sacas: number
    empresa_vendedora?: string | null

    // Novos campos do PDF atualizado
    data_venda?: string | null
    nome_vendedor?: string | null
    nome_comprador?: string | null
    cn_confirmacao_negocio?: string | null
    valor_total_bruto?: number | null
    valor_total_liquido?: number | null
    data_recebimento?: string | null
    situacao_embarque?: string | null
    created_at?: string
}

export interface ProductivityItem {
    id: number
    fazenda_lavoura: string
    talhao: string
    cultura: string
    variedade: string
    safra: string
    area_colhida_ha: number
    producao_liquida_sacas: number
    produtividade_liquida_scs_ha: number
}

export interface CustoAplicacao {
    id: number
    created_at: string
    cultura: 'SOJA' | 'MILHO'
    safra: string
    fazenda: string
    aplicacao: string
    custo_total: number
    custo_sc_ha: number
    custo_rs_ha: number
    arquivo_origem?: string
    data_upload: string
    user_id: string
}

export interface CustoCategoria {
    id: number
    created_at: string
    cultura: 'SOJA' | 'MILHO'
    safra: string
    aplicacao: string
    categoria: string
    custo_total: number
    custo_rs_ha: number
    custo_sc_ha: number
    arquivo_origem?: string
    data_upload: string
    user_id: string
}

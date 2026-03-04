import { z } from 'zod';

// ============ Inventory Schema ============
export const InventoryItemSchema = z.object({
    id: z.number(),
    codigo_produto: z.string().min(1),
    nome_produto: z.string(),
    categoria_linha: z.string().nullable(),
    local_armazenagem: z.string().nullable(),
    quantidade_estoque: z.number().nonnegative(),
    unidade_medida: z.string(),
    custo_medio_unitario: z.number().nonnegative().nullable().transform(val => val ?? 0),
    valor_total_estoque: z.number().nonnegative().nullable().transform(val => val ?? 0),
});

export const InventoryArraySchema = z.array(InventoryItemSchema);

// ============ Contract Schema ============
export const ContractSchema = z.object({
    id: z.number(),
    numero_contrato: z.string(),
    cliente_comprador: z.string().nullable().optional().transform(val => val || ''),
    cultura: z.string(),
    safra: z.string().nullable().optional().transform(val => val || ''),
    tipo_frete: z.string().nullable().optional().transform(val => val || 'FOB'),
    qtd_contrato_sacas: z.number().nonnegative().nullable().transform(val => val ?? 0),
    preco_por_saca: z.number().nonnegative().nullable().transform(val => val ?? 0),
    data_vencimento: z.string().nullable().transform(val => val || ''),
    qtd_pendente_sacas: z.number().nonnegative().nullable().transform(val => val ?? 0),
    empresa_vendedora: z.string().nullable().optional(),

    // Novos campos do PDF atualizado
    data_venda: z.string().nullable().optional(),
    nome_vendedor: z.string().nullable().optional(),
    nome_comprador: z.string().nullable().optional(),
    cn_confirmacao_negocio: z.string().nullable().optional(),
    valor_total_bruto: z.number().nonnegative().nullable().optional(),
    valor_total_liquido: z.number().nonnegative().nullable().optional(),
    data_recebimento: z.string().nullable().optional(),
    situacao_embarque: z.string().nullable().optional(),
});

export const ContractArraySchema = z.array(ContractSchema);

// ============ Productivity Schema ============
export const ProductivityItemSchema = z.object({
    id: z.number(),
    fazenda_lavoura: z.string(),
    talhao: z.string(),
    cultura: z.string(),
    variedade: z.string(),
    safra: z.string(),
    area_colhida_ha: z.number().nonnegative().nullable().transform(val => val ?? 0),
    producao_liquida_sacas: z.number().nonnegative().nullable().transform(val => val ?? 0),
    produtividade_liquida_scs_ha: z.number().nonnegative().nullable().transform(val => val ?? 0),
});

export const ProductivityArraySchema = z.array(ProductivityItemSchema);

// ============ Cost Schemas ============
export const CostCategorySchema = z.object({
    id: z.number(),
    safra: z.string(),
    cultura: z.string(),
    categoria: z.string(),
    custo_total: z.number().nonnegative().transform(val => val ?? 0),
    custo_rs_ha: z.number().nonnegative().transform(val => val ?? 0),
});

export const CostApplicationSchema = z.object({
    id: z.number(),
    safra: z.string(),
    cultura: z.string(),
    fazenda: z.string(),
    talhao: z.string().nullable().optional(),
    aplicacao: z.string(),
    categoria: z.string(),
    custo_total: z.number().nonnegative().transform(val => val ?? 0),
});

export const CostCategoryArraySchema = z.array(CostCategorySchema);
export const CostApplicationArraySchema = z.array(CostApplicationSchema);

// ============ Chat History Schema ============
export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'model']),
    content: z.string(),
});

export const ChatHistorySchema = z.array(ChatMessageSchema);

// ============ System Prompt Schema ============
export const SystemPromptSchema = z.string().max(50000).transform(prompt => {
    // Sanitização básica
    const forbidden = [
        /ignore\s+previous\s+instructions/gi,
        /disregard\s+all\s+rules/gi,
        /<script>/gi,
    ];

    let sanitized = prompt;
    forbidden.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REMOVIDO]');
    });

    return sanitized.trim();
});

// Type inference
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type Contract = z.infer<typeof ContractSchema>;
export type ProductivityItem = z.infer<typeof ProductivityItemSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

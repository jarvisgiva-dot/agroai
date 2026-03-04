/**
 * Formatação de valores para exibição
 * Centraliza a formatação de moedas, números e datas
 */

/**
 * Formata valor em moeda brasileira (BRL)
 */
export const formatCurrency = (value: number, decimals = 0): string => {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })
}

/**
 * Formata valor monetário de forma compacta (M para milhões, k para milhares)
 */
export const formatCompactCurrency = (value: number): string => {
    const absValue = Math.abs(value)

    if (absValue >= 1000000) {
        // Milhões
        return `R$ ${(value / 1000000).toFixed(1).replace('.', ',')}M`
    } else if (absValue >= 1000) {
        // Milhares
        return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}k`
    } else {
        // Menor que mil
        return formatCurrency(value, 0)
    }
}

/**
 * Formata número com separadores de milhares
 */
export const formatNumber = (value: number, decimals = 0): string => {
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })
}

/**
 * Formata data no padrão brasileiro (DD/MM/YYYY)
 */
export const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString('pt-BR')
}

/**
 * Formata data e hora no padrão brasileiro
 */
export const formatDateTime = (date: string | Date): string => {
    return new Date(date).toLocaleString('pt-BR')
}

/**
 * Formata percentual
 */
export const formatPercent = (value: number, decimals = 2): string => {
    return value.toLocaleString('pt-BR', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })
}

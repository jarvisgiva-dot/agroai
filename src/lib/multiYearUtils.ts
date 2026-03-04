
export interface ProductivityData {
    id: number
    safra: string
    cultura: string
    fazenda_lavoura: string
    talhao: string
    area_colhida_ha: number
    producao_liquida_sacas: number
    produtividade_liquida_scs_ha: number
    variedade?: string
    data_colheita?: string
}

export interface VarietyYearData {
    year: number
    productivity: number
    area: number
}

export interface VarietyComparison {
    variety: string
    data: VarietyYearData[]
    averageProductivity: number
    totalArea: number
}

export function compareVarietiesAcrossYears(
    data: ProductivityData[],
    variedades?: string[],
    years?: number[]
): VarietyComparison[] {
    // 1. Agrupar dados por variedade e ano
    const groupedData = new Map<string, Map<number, { prodSum: number, areaSum: number, count: number }>>()

    data.forEach(item => {
        if (!item.variedade || !item.safra) return

        // Extrair ano inicial da safra (ex: "2023/2024" -> 2023)
        const year = parseInt(item.safra.split('/')[0])
        if (isNaN(year)) return

        // Filtro de anos
        if (years && years.length > 0 && !years.includes(year)) return

        const variety = item.variedade.trim()

        // Filtro de variedades
        if (variedades && variedades.length > 0 && !variedades.includes(variety)) return

        if (!groupedData.has(variety)) {
            groupedData.set(variety, new Map())
        }

        const varietyMap = groupedData.get(variety)!
        if (!varietyMap.has(year)) {
            varietyMap.set(year, { prodSum: 0, areaSum: 0, count: 0 })
        }

        const yearData = varietyMap.get(year)!
        yearData.prodSum += item.produtividade_liquida_scs_ha || 0
        yearData.areaSum += item.area_colhida_ha || 0
        yearData.count += 1
    })

    // 2. Transformar em array de resultados
    const results: VarietyComparison[] = []

    groupedData.forEach((yearMap, variety) => {
        const yearDataArray: VarietyYearData[] = []
        let totalProdSum = 0
        let totalCount = 0
        let totalArea = 0

        yearMap.forEach((stats, year) => {
            const avgProd = stats.prodSum / stats.count
            yearDataArray.push({
                year,
                productivity: avgProd,
                area: stats.areaSum
            })

            totalProdSum += avgProd // Média das médias anuais para simplificar
            totalCount++
            totalArea += stats.areaSum
        })

        results.push({
            variety,
            data: yearDataArray.sort((a, b) => a.year - b.year),
            averageProductivity: totalCount > 0 ? totalProdSum / totalCount : 0,
            totalArea
        })
    })

    // Ordenar por produtividade média decrescente
    return results.sort((a, b) => b.averageProductivity - a.averageProductivity)
}

export function prepareTalhaoComparisonData(
    data: ProductivityData[],
    years: number[],
    limit: number = 10
): any[] {
    // Agrupar por Talhão e Ano
    const talhaoMap = new Map<string, Map<number, number>>()

    data.forEach(item => {
        if (!item.talhao || !item.safra) return

        const year = parseInt(item.safra.split('/')[0])
        if (isNaN(year) || !years.includes(year)) return

        const talhao = item.talhao.trim()

        if (!talhaoMap.has(talhao)) {
            talhaoMap.set(talhao, new Map())
        }

        const yearMap = talhaoMap.get(talhao)!
        // Se houver múltiplos registros para o mesmo talhão no mesmo ano (ex: variedades diferentes),
        // fazemos uma média ponderada ou simples. Aqui faremos média simples das produtividades.
        // Idealmente seria ponderada pela área, mas para simplificar:
        const current = yearMap.get(year)
        if (current) {
            yearMap.set(year, (current + (item.produtividade_liquida_scs_ha || 0)) / 2)
        } else {
            yearMap.set(year, item.produtividade_liquida_scs_ha || 0)
        }
    })

    // Filtrar talhões que aparecem em TODOS os anos selecionados (para comparação justa)
    // OU permitir talhões que aparecem em pelo menos um ano?
    // O usuário pediu "Comparativo", geralmente implica ver a evolução.
    // Vamos incluir talhões que tenham dados em pelo menos 1 dos anos, mas ordenar pelos que tem maior média.

    const result: any[] = []

    talhaoMap.forEach((yearMap, talhao) => {
        const entry: any = { name: talhao }
        let totalProd = 0
        let count = 0

        years.forEach(year => {
            const val = yearMap.get(year)
            if (val !== undefined) {
                entry[year] = val
                totalProd += val
                count++
            }
        })

        // Campo auxiliar para ordenação
        entry._avgTotal = count > 0 ? totalProd / count : 0

        // Opcional: Filtrar apenas se tiver dados em todos os anos?
        // if (count === years.length) {
        result.push(entry)
        // }
    })

    // Ordenar por média total e limitar
    return result
        .sort((a, b) => b._avgTotal - a._avgTotal)
        .slice(0, limit)
        .map(({ _avgTotal, ...rest }) => rest)
}

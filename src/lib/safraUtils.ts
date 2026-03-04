/**
 * Normaliza o formato da safra para o padrão "AAAA/AAAA"
 * Converte formatos condensados do SCADI para formato completo
 * 
 * @param safra - Safra no formato condensado (ex: "2324") ou completo (ex: "2023/2024")
 * @returns Safra no formato padronizado "AAAA/AAAA" (ex: "2023/2024")
 * 
 * @example
 * normalizeSafra("2324") // "2023/2024"
 * normalizeSafra("2425") // "2024/2025"
 * normalizeSafra("2023/2024") // "2023/2024" (já normalizado)
 */
export function normalizeSafra(safra: string | null | undefined): string {
    if (!safra) return '';

    // Remove espaços em branco
    const cleanSafra = safra.trim();

    // Se já está no formato completo "AAAA/AAAA", retorna como está
    if (cleanSafra.match(/^\d{4}\/\d{4}$/)) {
        return cleanSafra;
    }

    // Se está no formato condensado "AABB" (ex: "2324")
    if (cleanSafra.match(/^\d{4}$/)) {
        const ano1 = cleanSafra.substring(0, 2); // "23"
        const ano2 = cleanSafra.substring(2, 4); // "24"
        return `20${ano1}/20${ano2}`; // "2023/2024"
    }

    // Se está no formato de 4 dígitos sem barra, mas começando com "20" (ex: "2024")
    // Assumimos safra atual/próxima
    if (cleanSafra.match(/^20\d{2}$/)) {
        const ano = parseInt(cleanSafra);
        return `${ano}/${ano + 1}`;
    }

    // Formato não reconhecido, retorna como está
    return cleanSafra;
}

/**
 * Calcula a safra baseada em uma data de venda
 * Regra: Safra agrícola vai de julho de um ano até junho do ano seguinte
 * 
 * @param dataVenda - Data da venda no formato "YYYY-MM-DD" ou objeto Date
 * @returns Safra no formato "AAAA/AAAA"
 * 
 * @example
 * calcularSafraPorData("2024-09-15") // "2024/2025" (setembro = nova safra)
 * calcularSafraPorData("2024-03-20") // "2023/2024" (março = safra anterior)
 */
export function calcularSafraPorData(dataVenda: string | Date | null | undefined): string {
    if (!dataVenda) return '';

    const date = typeof dataVenda === 'string' ? new Date(dataVenda) : dataVenda;
    const ano = date.getFullYear();
    const mes = date.getMonth() + 1; // getMonth() retorna 0-11

    // Se a venda é de julho a dezembro, a safra inicia neste ano
    // Se a venda é de janeiro a junho, a safra iniciou no ano anterior
    if (mes >= 7) {
        return `${ano}/${ano + 1}`;
    } else {
        return `${ano - 1}/${ano}`;
    }
}

/**
 * Extrai o ano inicial de uma safra
 * 
 * @param safra - Safra no formato "AAAA/AAAA" (ex: "2023/2024")
 * @returns Ano inicial da safra (ex: 2023)
 * 
 * @example
 * extractYearFromSafra("2023/2024") // 2023
 * extractYearFromSafra("2024/2025") // 2024
 */
export function extractYearFromSafra(safra: string | null | undefined): number | null {
    if (!safra) return null;

    const normalized = normalizeSafra(safra);
    const match = normalized.match(/^(\d{4})\/\d{4}$/);

    if (match) {
        return parseInt(match[1], 10);
    }

    return null;
}

/**
 * Obtém todos os anos únicos de um array de safras
 * 
 * @param safras - Array de safras
 * @returns Array de anos únicos ordenados
 * 
 * @example
 * getAllAvailableYears(["2023/2024", "2024/2025", "2023/2024"]) // [2023, 2024]
 */
export function getAllAvailableYears(safras: (string | null | undefined)[]): number[] {
    const years = new Set<number>();

    safras.forEach(safra => {
        const year = extractYearFromSafra(safra);
        if (year !== null) {
            years.add(year);
        }
    });

    return Array.from(years).sort((a, b) => a - b);
}

/**
 * Comparador para ordenar safras
 * 
 * @param safra1 - Primeira safra
 * @param safra2 - Segunda safra
 * @returns Número negativo se safra1 < safra2, positivo se safra1 > safra2, 0 se iguais
 * 
 * @example
 * ["2024/2025", "2023/2024"].sort(compareSafras) // ["2023/2024", "2024/2025"]
 */
export function compareSafras(safra1: string, safra2: string): number {
    const year1 = extractYearFromSafra(safra1) || 0;
    const year2 = extractYearFromSafra(safra2) || 0;
    return year1 - year2;
}

/**
 * Obtém label de exibição para uma safra
 * 
 * @param safra - Safra no formato "AAAA/AAAA"
 * @returns Label formatado para exibição
 * 
 * @example
 * getSafraLabel("2023/2024") // "Safra 2023/24"
 */
export function getSafraLabel(safra: string | null | undefined): string {
    if (!safra) return 'Safra não especificada';

    const normalized = normalizeSafra(safra);
    const match = normalized.match(/^(\d{4})\/(\d{4})$/);

    if (match) {
        const ano1 = match[1];
        const ano2 = match[2].substring(2); // Pega apenas os 2 últimos dígitos
        return `Safra ${ano1}/${ano2}`;
    }

    return safra;
}

/**
 * Agrupa dados por ano da safra
 * 
 * @param data - Array de objetos com campo de safra
 * @param safraField - Nome do campo que contém a safra (padrão: 'safra')
 * @returns Objeto com anos como chaves e arrays de dados como valores
 * 
 * @example
 * groupBySafraYear([{safra: "2023/2024", value: 10}, {safra: "2024/2025", value: 20}])
 * // { 2023: [{safra: "2023/2024", value: 10}], 2024: [{safra: "2024/2025", value: 20}] }
 */
export function groupBySafraYear<T extends Record<string, any>>(
    data: T[],
    safraField: string = 'safra'
): Record<number, T[]> {
    const grouped: Record<number, T[]> = {};

    data.forEach(item => {
        const year = extractYearFromSafra(item[safraField]);
        if (year !== null) {
            if (!grouped[year]) {
                grouped[year] = [];
            }
            grouped[year].push(item);
        }
    });

    return grouped;
}

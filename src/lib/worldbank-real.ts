import { supabase } from './supabase';
import * as XLSX from 'xlsx';

export interface WorldBankPrice {
    category: 'UREIA' | 'KCL' | 'DAP' | 'TSP';
    price: number;
    unit: 'ton';
    currency: 'USD';
    date: string;
}

// URL da página principal do World Bank Commodity Markets
const WORLD_BANK_PAGE_URL = 'https://www.worldbank.org/en/research/commodity-markets';
// Fallback URL (pode estar desatualizada, mas serve de backup)
const FALLBACK_EXCEL_URL = 'https://thedocs.worldbank.org/en/doc/18675f1d1639c7a34d463f59263ba0a2-0050012025/related/CMO-Historical-Data-Monthly.xlsx';

const PRICE_RANGES = {
    UREIA: { min: 10, max: 1500 },
    KCL: { min: 10, max: 1000 },
    DAP: { min: 10, max: 1500 },
    TSP: { min: 10, max: 1200 }
};

/**
 * Scrapes the World Bank page to find the dynamic Excel file URL.
 */
async function getDynamicExcelUrl(): Promise<string> {
    try {
        console.log('Scraping World Bank page for dynamic Excel URL...');
        const response = await fetch(WORLD_BANK_PAGE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) throw new Error(`Page fetch failed: ${response.status}`);

        const html = await response.text();

        // Regex para encontrar link que termina em .xlsx e contém 'CMO-Historical-Data-Monthly'
        // Pode estar em href="https://..." ou href="/..."
        const match = html.match(/href="([^"]*CMO-Historical-Data-Monthly\.xlsx)"/i);

        if (match && match[1]) {
            let url = match[1];
            // Resolver URL relativa se necessário
            if (url.startsWith('/')) {
                // Verificar se a URL base é worldbank.org ou thedocs
                // Geralmente links de docs são absolutos, mas por segurança:
                url = 'https://www.worldbank.org' + url;
            }
            console.log('Found dynamic Excel URL:', url);
            return url;
        }

        console.warn('Could not find dynamic Excel link, using fallback.');
    } catch (e) {
        console.error('Error scraping dynamic URL:', e);
    }
    return FALLBACK_EXCEL_URL;
}

/**
 * Downloads the latest World Bank Pink Sheet Excel file.
 *
 * @returns Buffer containing the Excel file
 * @throws Error if download fails
 */
export async function downloadWorldBankExcel(): Promise<Buffer> {
    try {
        const excelUrl = await getDynamicExcelUrl();
        console.log('Downloading World Bank Excel from:', excelUrl);

        const response = await fetch(excelUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`Downloaded ${buffer.length} bytes`);
        return buffer;
    } catch (error) {
        console.error('Failed to download World Bank Excel:', error);
        throw error;
    }
}

/**
 * Parses a date string from the World Bank Excel to YYYY-MM-DD format.
 *
 * @param dateValue - Date value from Excel (can be string or Excel serial date)
 * @returns Date string in YYYY-MM-DD format
 */
function parseWorldBankDate(dateValue: any): string {
    try {
        // Se for número (Excel serial date)
        if (typeof dateValue === 'number') {
            const date = XLSX.SSF.parse_date_code(dateValue);
            const year = date.y;
            const month = String(date.m).padStart(2, '0');
            const day = String(date.d).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Se for string, tentar parsear
        if (typeof dateValue === 'string') {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        }

        // Se for Date object
        if (dateValue instanceof Date) {
            return dateValue.toISOString().split('T')[0];
        }

        throw new Error(`Unable to parse date: ${dateValue}`);
    } catch (error) {
        console.error('Error parsing date:', dateValue, error);
        throw error;
    }
}

/**
 * Validates if a price is within expected range for the category.
 *
 * @param category - Fertilizer category
 * @param price - Price in USD/ton
 * @returns true if valid, false otherwise
 */
function validatePrice(category: string, price: number): boolean {
    const range = PRICE_RANGES[category as keyof typeof PRICE_RANGES];
    if (!range) {
        console.warn(`No validation range for category: ${category}`);
        return true; // Allow unknown categories
    }

    const isValid = price >= range.min && price <= range.max;

    if (!isValid) {
        console.warn(`Price out of range for ${category}: ${price} (expected ${range.min}-${range.max})`);
    }

    return isValid;
}

/**
 * Parses the World Bank Excel file and extracts fertilizer prices.
 *
 * @param buffer - Buffer containing the Excel file
 * @returns Array of fertilizer prices
 */
export async function parseWorldBankExcel(buffer: Buffer): Promise<WorldBankPrice[]> {
    try {
        console.log('Parsing World Bank Excel...');

        const workbook = XLSX.read(buffer, { type: 'buffer' });

        // O sheet principal é "Monthly Prices"
        const sheetName = 'Monthly Prices';

        console.log('Using sheet:', sheetName);

        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
            throw new Error(`Sheet "${sheetName}" not found in Excel`);
        }

        // Converter para array de arrays (header: 1) porque o Excel tem estrutura complexa
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`Parsed ${rawData.length} rows from Excel`);

        // Estrutura do Excel:
        // Row 0-3: Cabeçalhos e descrições
        // Row 4: Nomes das commodities
        // Row 5: Unidades
        // Row 6: Códigos
        // Row 7+: Dados (formato: 1960M01, preço1, preço2, ...)

        const headers = rawData[4]; // Nomes das colunas
        const codes = rawData[6];   // Códigos das commodities

        // Encontrar índices das colunas de fertilizantes
        // Nota: World Bank fornece apenas 4 fertilizantes básicos (Urea, KCL, DAP, TSP)
        // MAP e SSP não estão disponíveis no arquivo mensal
        const columnIndices: Record<string, { index: number, category: 'UREIA' | 'KCL' | 'DAP' | 'TSP' }> = {};

        headers.forEach((col: string, i: number) => {
            if (col && typeof col === 'string') {
                const trimmed = col.trim();

                // Mapeamento baseado nos nomes reais do Excel
                if (trimmed === 'Urea' || trimmed === 'Urea ') {
                    columnIndices['UREIA'] = { index: i, category: 'UREIA' };
                } else if (trimmed.startsWith('Potassium chloride')) {
                    columnIndices['KCL'] = { index: i, category: 'KCL' };
                } else if (trimmed === 'DAP') {
                    columnIndices['DAP'] = { index: i, category: 'DAP' };
                } else if (trimmed === 'TSP') {
                    columnIndices['TSP'] = { index: i, category: 'TSP' };
                }
            }
        });

        console.log('Found fertilizer columns:', Object.keys(columnIndices));

        const prices: WorldBankPrice[] = [];

        // Processar dados a partir da linha 7 (primeiro dado real)
        for (let rowIndex = 7; rowIndex < rawData.length; rowIndex++) {
            const row = rawData[rowIndex];

            if (!row || row.length === 0) {
                continue; // Pular linhas vazias
            }

            const dateValue = row[0]; // Primeira coluna é sempre a data

            if (!dateValue) {
                continue; // Pular linhas sem data
            }

            try {
                // Datas estão no formato '1960M01', '2024M12', etc.
                const date = parseDateFromFormat(dateValue);

                // Processar cada fertilizante
                for (const [fertName, info] of Object.entries(columnIndices)) {
                    const priceValue = row[info.index];

                    if (priceValue && typeof priceValue === 'number' && priceValue > 0) {
                        // Validar preço
                        if (validatePrice(info.category, priceValue)) {
                            prices.push({
                                category: info.category,
                                price: Number(priceValue.toFixed(2)),
                                unit: 'ton',
                                currency: 'USD',
                                date
                            });
                        }
                    }
                }
            } catch (error) {
                // Log mas não para o processo
                console.error(`Error processing row ${rowIndex}:`, error);
                continue;
            }
        }

        console.log(`Extracted ${prices.length} valid fertilizer prices`);

        // Ordenar por data
        prices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // FIX: Return only the latest price for each category to prevent showing 1960s data
        const latestPrices: Record<string, WorldBankPrice> = {};
        prices.forEach(p => {
            // Because array is sorted by date ascending, the last one we see is the latest
            latestPrices[p.category] = p;
        });

        const finalPrices = Object.values(latestPrices);
        console.log(`Filtered to ${finalPrices.length} latest unique fertilizer prices`);

        return finalPrices;
    } catch (error) {
        console.error('Error parsing World Bank Excel:', error);
        throw error;
    }
}

/**
 * Parses date from World Bank format (e.g., "1960M01", "2024M12") to YYYY-MM-DD.
 *
 * @param dateStr - Date string in format YYYYMDD or similar
 * @returns Date string in YYYY-MM-DD format
 */
function parseDateFromFormat(dateStr: string): string {
    // Formato esperado: "1960M01", "2024M12", etc.
    const str = String(dateStr).trim();

    // Remover o 'M' e extrair ano e mês
    const match = str.match(/(\d{4})M(\d{2})/);

    if (match) {
        const year = match[1];
        const month = match[2];
        return `${year}-${month}-01`; // Usar dia 1 de cada mês
    }

    // Fallback: tentar parseWorldBankDate original
    return parseWorldBankDate(dateStr);
}

/**
 * Gets the latest date of World Bank data in the database.
 *
 * @returns Latest date string or null if no data exists
 */
export async function getLatestWorldBankDate(): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('market_prices')
            .select('date')
            .eq('source_type', 'WORLD_BANK')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            console.log('No World Bank data found in database');
            return null;
        }

        console.log('Latest World Bank data date:', data.date);
        return data.date;
    } catch (error) {
        console.error('Error getting latest World Bank date:', error);
        return null;
    }
}

/**
 * Determines if World Bank data should be updated.
 *
 * @returns true if update is needed, false otherwise
 */
export async function shouldUpdateWorldBank(): Promise<boolean> {
    const latestDate = await getLatestWorldBankDate();

    if (!latestDate) {
        console.log('No existing World Bank data - update needed');
        return true; // Nunca atualizou
    }

    const latest = new Date(latestDate);
    const now = new Date();

    // Calcular diferença em meses
    const monthsDiff = (now.getFullYear() - latest.getFullYear()) * 12
        + (now.getMonth() - latest.getMonth());

    console.log(`Months since last World Bank update: ${monthsDiff}`);

    // Atualizar se 1+ meses desatualizados (World Bank atualiza mensalmente)
    return monthsDiff >= 1;
}

/**
 * Fetches the most recent prices stored in the database for each category.
 */
export async function getStoredWorldBankPrices(): Promise<WorldBankPrice[]> {
    try {
        // Get the latest date first
        const latestDate = await getLatestWorldBankDate();
        if (!latestDate) return [];

        const { data, error } = await supabase
            .from('market_prices')
            .select('*')
            .eq('source_type', 'WORLD_BANK')
            .eq('date', latestDate);

        if (error) {
            console.error('Error fetching stored prices:', error);
            return [];
        }

        return (data || []).map(item => ({
            category: item.category as any,
            price: item.price,
            unit: item.unit as any,
            currency: item.currency as any,
            date: item.date
        }));
    } catch (error) {
        console.error('Error in getStoredWorldBankPrices:', error);
        return [];
    }
}

/**
 * Fetches the latest commodity prices from the World Bank.
 *
 * This is the main function that replaces the simulated version.
 * It downloads the Excel file, parses it, and returns fertilizer prices.
 *
 * @returns Array of fertilizer prices, or empty array if no update needed or on error
 */
export async function getLatestWorldBankPrices(): Promise<WorldBankPrice[]> {
    try {
        // Verificar se precisa atualizar
        const shouldUpdate = await shouldUpdateWorldBank();

        if (!shouldUpdate) {
            console.log('World Bank data is up to date, fetching from database');
            return await getStoredWorldBankPrices();
        }

        console.log('Updating World Bank fertilizer prices...');

        // Download do Excel
        const buffer = await downloadWorldBankExcel();

        // Parse dos dados
        const prices = await parseWorldBankExcel(buffer);

        if (prices.length === 0) {
            console.warn('No prices extracted from World Bank Excel, falling back to database');
            return await getStoredWorldBankPrices();
        }

        console.log(`Successfully fetched ${prices.length} World Bank prices`);
        console.log(`Date range: ${prices[0].date} to ${prices[prices.length - 1].date}`);

        return prices;

    } catch (error) {
        console.error('Error fetching World Bank prices:', error);

        // FALLBACK: Retornar dados do banco ao invés de vazio
        console.log('Falling back to stored database prices due to error');
        return await getStoredWorldBankPrices();
    }
}

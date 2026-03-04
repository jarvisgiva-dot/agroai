
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DATA_DIR = path.join(process.cwd(), 'historic_fertilizer_price');

const MONTH_MAP: { [key: string]: string } = {
    'Jan': '01', 'Fev': '02', 'Mar': '03', 'Abr': '04', 'Mai': '05', 'Jun': '06',
    'Jul': '07', 'Ago': '08', 'Set': '09', 'Out': '10', 'Nov': '11', 'Dez': '12'
};

async function getExchangeRate(date: string): Promise<number> {
    // 1. Try DB
    const { data, error } = await supabase
        .from('exchange_rates')
        .select('rate_sell')
        .eq('date_reference', date)
        .single();

    if (data) return data.rate_sell;

    // 2. Fetch from API
    console.log(`Fetching exchange rate for ${date}...`);
    const formattedDate = date.replace(/-/g, '');
    try {
        const res = await fetch(`https://economia.awesomeapi.com.br/json/daily/USD-BRL/?start_date=${formattedDate}&end_date=${formattedDate}`);
        const apiData = await res.json();

        if (apiData && apiData.length > 0) {
            const rate = parseFloat(apiData[0].ask);

            // Save to DB
            await supabase.from('exchange_rates').upsert({
                date_reference: date,
                rate_buy: parseFloat(apiData[0].bid),
                rate_sell: rate,
                currency_pair: 'USD-BRL'
            });

            return rate;
        }
    } catch (e) {
        console.error(`Failed to fetch rate for ${date}:`, e);
    }

    // Fallback: Try next few days in DB first
    let currentDay = new Date(date);
    for (let i = 0; i < 5; i++) {
        currentDay.setDate(currentDay.getDate() + 1);
        const nextDate = currentDay.toISOString().split('T')[0];

        const { data: fallbackData } = await supabase
            .from('exchange_rates')
            .select('rate_sell')
            .eq('date_reference', nextDate)
            .single();

        if (fallbackData) {
            console.log(`Found rate in DB for fallback date ${nextDate}: ${fallbackData.rate_sell}`);
            return fallbackData.rate_sell;
        }
    }

    console.warn(`Could not find exchange rate for ${date}, using 5.0 fallback.`);
    return 5.0;
}

async function processFile(filename: string) {
    const yearMatch = filename.match(/202[0-5]/);
    if (!yearMatch) return;
    const year = yearMatch[0];

    const content = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');

    // Header: Mês,Ureia,MAP (11-52),Super Simples (SSP),Sulfato de Amônio,Cloreto de Potássio (KCl)
    // Indices: 0,   1,    2,           3,                   4,                 5

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        const cols = line.split(',');

        if (cols.length < 6) continue;

        const monthName = cols[0].trim();
        const month = MONTH_MAP[monthName];
        if (!month) continue;

        const date = `${year}-${month}-01`;
        const rate = await getExchangeRate(date);

        const products = [
            { name: 'UREIA', price: cols[1] },
            { name: 'MAP', price: cols[2] },
            { name: 'SSP', price: cols[3] },
            { name: 'SULFATO_AMONIO', price: cols[4] },
            { name: 'KCL', price: cols[5] }
        ];

        for (const prod of products) {
            const priceUsd = parseFloat(prod.price);
            if (isNaN(priceUsd)) continue;

            const priceBrl = priceUsd * rate;

            // Map product names to DB allowed values
            let dbProduct = prod.name;
            if (prod.name === 'SSP') dbProduct = 'SUPER_SIMPLES';

            // Delete existing records to avoid duplicates
            await supabase.from('market_prices')
                .delete()
                .eq('date', date)
                .eq('category', dbProduct)
                .eq('source_type', 'WORLD_BANK');

            const payloadUsd = {
                date: date,
                category: dbProduct,
                price: priceUsd,
                currency: 'USD',
                unit: 'ton',
                source_type: 'WORLD_BANK'
            };
            const { error: errorUsd } = await supabase.from('market_prices').insert(payloadUsd);

            if (errorUsd) {
                const logMsg = `Error inserting USD for ${dbProduct} on ${date}: ${JSON.stringify(errorUsd)}\nPayload: ${JSON.stringify(payloadUsd)}\n\n`;
                fs.appendFileSync('import_errors.log', logMsg);
            }

            // Insert BRL
            const { error: errorBrl } = await supabase.from('market_prices').insert({
                date: date,
                category: dbProduct,
                price: parseFloat(priceBrl.toFixed(2)),
                currency: 'BRL',
                unit: 'ton',
                source_type: 'WORLD_BANK'
            });

            if (errorBrl) console.error(`Error inserting BRL for ${dbProduct} on ${date}:`, errorBrl.message);
        }
        console.log(`Processed ${date}: Rate ${rate}`);
    }
}

async function main() {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
        if (file.endsWith('.csv')) {
            console.log(`Processing ${file}...`);
            await processFile(file);
        }
    }
    console.log('Import completed!');
}

main().catch(console.error);

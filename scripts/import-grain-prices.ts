
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

const DATA_DIR = path.join(process.cwd(), 'historic_soja_milho_2020_2025');

const MONTH_MAP: { [key: string]: string } = {
    'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06',
    'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12'
};

async function getExchangeRate(date: string): Promise<number> {
    // 1. Try DB
    const { data, error } = await supabase
        .from('exchange_rates')
        .select('rate_sell')
        .eq('date_reference', date)
        .single();

    if (data) return data.rate_sell;

    // 2. Fetch from API (Fallback logic similar to previous script)
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
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');

    // Determine category from filename
    let category = '';
    if (filename.includes('SOJA')) category = 'SOJA';
    else if (filename.includes('MILHO')) category = 'MILHO';
    else {
        console.warn(`Unknown category for file: ${filename}`);
        return;
    }

    console.log(`Processing ${category} from ${filename}...`);

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        const cols = line.split(';');

        if (cols.length < 2) continue;

        // Parse Date: "JAN-2020" -> "2020-01-01"
        const rawDate = cols[0].replace(/"/g, '').trim(); // Remove quotes
        const [monthAbbr, year] = rawDate.split('-');
        const month = MONTH_MAP[monthAbbr.toUpperCase()];

        if (!month || !year) {
            console.warn(`Invalid date format: ${rawDate}`);
            continue;
        }

        const date = `${year}-${month}-01`;
        const priceBrl = parseFloat(cols[1].replace(',', '.')); // Ensure dot decimal

        if (isNaN(priceBrl)) continue;

        const rate = await getExchangeRate(date);
        const priceUsd = priceBrl / rate;

        // Delete existing records to avoid duplicates
        await supabase.from('market_prices')
            .delete()
            .eq('date', date)
            .eq('category', category)
            .eq('source_type', 'HISTORICO_IMPORT');

        // Insert BRL
        const { error: errorBrl } = await supabase.from('market_prices').insert({
            date: date,
            category: category,
            price: priceBrl,
            currency: 'BRL',
            unit: 'sc_60kg',
            source_type: 'HISTORICO_IMPORT'
        });

        if (errorBrl) console.error(`Error inserting BRL for ${category} on ${date}:`, errorBrl.message);

        // Insert USD
        const { error: errorUsd } = await supabase.from('market_prices').insert({
            date: date,
            category: category,
            price: parseFloat(priceUsd.toFixed(2)),
            currency: 'USD',
            unit: 'sc_60kg',
            source_type: 'HISTORICO_IMPORT'
        });

        if (errorUsd) console.error(`Error inserting USD for ${category} on ${date}:`, errorUsd.message);
    }
    console.log(`Finished processing ${filename}`);
}

async function run() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
    for (const file of files) {
        await processFile(file);
    }
}

run();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) { console.error("Missing keys"); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function importCsv(year: string) {
    const filePath = path.join(process.cwd(), 'historic_fertilizer_price', `HISTORICO-PRECOS-FERTILIZANTES-${year}.csv`);

    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(','); // Mes,Ureia,MAP,Super Simples,Sulfato de Amonio,Cloreto de Potassio

    const months = {
        'Jan': '01', 'Fev': '02', 'Mar': '03', 'Abr': '04', 'Mai': '05', 'Jun': '06',
        'Jul': '07', 'Ago': '08', 'Set': '09', 'Out': '10', 'Nov': '11', 'Dez': '12'
    };

    console.log(`Importing ${year}...`);

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');
        const monthName = cols[0];
        const monthNum = months[monthName as keyof typeof months];

        if (!monthNum) continue;

        const date = `${year}-${monthNum}-01`;

        const prices = [
            { cat: 'UREIA', price: cols[1] },
            { cat: 'MAP', price: cols[2] },
            { cat: 'SUPER_SIMPLES', price: cols[3] },
            { cat: 'SULFATO_AMONIO', price: cols[4] },
            { cat: 'KCL', price: cols[5] }
        ];

        for (const p of prices) {
            if (p.price && !isNaN(parseFloat(p.price))) {
                const payload = {
                    date: date,
                    category: p.cat,
                    price: parseFloat(p.price),
                    currency: 'USD', // Assuming CSV is USD based on World Bank style, but user context implies needed check. Usually fertilizer global prices are USD.
                    unit: 'ton',
                    source_type: 'HISTORICO_IMPORT'
                };

                const { error } = await supabase
                    .from('market_prices')
                    .upsert(payload, { onConflict: 'date,category,source_type' });

                if (error) console.error(`Error ${date} ${p.cat}:`, error.message);
            }
        }
    }
    console.log(`Done ${year}`);
}

async function main() {
    const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
    for (const y of years) {
        await importCsv(y);
    }
}

main();

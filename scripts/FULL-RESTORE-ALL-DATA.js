const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MONTH_MAP_PT = {
    'Jan': '01', 'Fev': '02', 'Mar': '03', 'Abr': '04', 'Mai': '05', 'Jun': '06',
    'Jul': '07', 'Ago': '08', 'Set': '09', 'Out': '10', 'Nov': '11', 'Dez': '12'
};

const MONTH_MAP_EN = {
    'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06',
    'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12'
};

async function clearDatabase() {
    console.log('🗑️  LIMPANDO BANCO DE DADOS COMPLETO...');

    // Delete ALL market_prices
    const { error: priceError } = await supabase.from('market_prices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (priceError) console.error('Error deleting market_prices:', priceError.message);
    else console.log('✅ market_prices limpo');

    // Delete ALL exchange_rates
    const { error: rateError } = await supabase.from('exchange_rates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (rateError) console.error('Error deleting exchange_rates:', rateError.message);
    else console.log('✅ exchange_rates limpo');
}

async function importExchangeRates() {
    console.log('\n💱 IMPORTANDO CÂMBIO (historic_usd_real)...');
    const dir = path.join(process.cwd(), 'historic_usd_real');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

    let totalRates = 0;
    for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() !== '');

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Format: "01/01/2020";"R$ 4,0307";"R$ 4,0313"
            const parts = line.split(';');
            if (parts.length < 3) continue;

            const dateStr = parts[0].replace(/"/g, '');
            const buyStr = parts[1].replace(/"/g, '').replace('R$ ', '').replace(',', '.');
            const sellStr = parts[2].replace(/"/g, '').replace('R$ ', '').replace(',', '.');

            const [day, month, year] = dateStr.split('/');
            const date = `${year}-${month}-${day}`;
            const rateBuy = parseFloat(buyStr);
            const rateSell = parseFloat(sellStr);

            if (isNaN(rateBuy) || isNaN(rateSell)) continue;

            await supabase.from('exchange_rates').insert({
                date_reference: date,
                rate_buy: rateBuy,
                rate_sell: rateSell,
                currency_pair: 'USD-BRL'
            });
            totalRates++;
        }
    }
    console.log(`✅ ${totalRates} exchange rates importados`);
}

async function importFertilizersCONAB() {
    console.log('\n🌱 IMPORTANDO FERTILIZANTES CONAB (historic_fertilizer_price)...');
    const dir = path.join(process.cwd(), 'historic_fertilizer_price');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

    let totalRecords = 0;
    for (const file of files) {
        const yearMatch = file.match(/202[0-5]/);
        if (!yearMatch) continue;
        const year = yearMatch[0];

        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() !== '');

        // Header: Mes,Ureia,MAP,Super Simples,Sulfato de Amonio,Cloreto de Potassio
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length < 6) continue;

            const month = MONTH_MAP_PT[parts[0]];
            if (!month) continue;

            const date = `${year}-${month}-01`;
            const products = [
                { name: 'UREIA', price: parts[1] },
                { name: 'MAP', price: parts[2] },
                { name: 'SUPER_SIMPLES', price: parts[3] },
                { name: 'SULFATO_AMONIO', price: parts[4] },
                { name: 'KCL', price: parts[5] }
            ];

            for (const prod of products) {
                const price = parseFloat(prod.price);
                if (isNaN(price)) continue;

                await supabase.from('market_prices').insert({
                    date: date,
                    category: prod.name,
                    price: price,
                    currency: 'USD',
                    unit: 'ton',
                    source_type: 'CONAB_HISTORICO'
                });
                totalRecords++;
            }
        }
    }
    console.log(`✅ ${totalRecords} registros CONAB importados`);
}

async function importWorldBank() {
    console.log('\n🌍 IMPORTANDO WORLD BANK (historic_wb_prices_kcl_map_ureia)...');
    const file = path.join(process.cwd(), 'historic_wb_prices_kcl_map_ureia', 'historico-precos-world-bank-kcl-map-ureia.csv');
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');

    let totalRecords = 0;
    // Header: "Ano,Mes,Ureia_E_Europe_USD_mt,Potassio_KCl_USD_mt,DAP_Proxy_MAP_USD_mt"
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim().replace(/"/g, '');
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 5) continue;

        const year = parts[0];
        const month = MONTH_MAP_PT[parts[1]];
        if (!month) continue;

        const date = `${year}-${month}-01`;
        const products = [
            { name: 'UREIA', price: parts[2] },
            { name: 'KCL', price: parts[3] },
            { name: 'MAP', price: parts[4] }
        ];

        for (const prod of products) {
            const price = parseFloat(prod.price);
            if (isNaN(price)) continue;

            await supabase.from('market_prices').insert({
                date: date,
                category: prod.name,
                price: price,
                currency: 'USD',
                unit: 'ton',
                source_type: 'WORLD_BANK'
            });
            totalRecords++;
        }
    }
    console.log(`✅ ${totalRecords} registros WORLD BANK importados`);
}

async function importSojaMillho() {
    console.log('\n🌾 IMPORTANDO SOJA E MILHO (historic_soja_milho_2020_2025)...');
    const dir = path.join(process.cwd(), 'historic_soja_milho_2020_2025');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

    let totalRecords = 0;
    for (const file of files) {
        const product = file.includes('SOJA') ? 'SOJA' : 'MILHO';
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() !== '');

        // Header: "Ano Mes.Ano Mes";SOJA/EM GRÃOS/PRIMAVERA DO LESTE-MT/Preco Medio Comercializado
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(';');
            if (parts.length < 2) continue;

            const dateStr = parts[0].replace(/"/g, ''); // "JAN-2020"
            const priceStr = parts[1].replace(/"/g, '');

            const [monthName, year] = dateStr.split('-');
            const month = MONTH_MAP_EN[monthName];
            if (!month) continue;

            const date = `${year}-${month}-01`;
            const price = parseFloat(priceStr);
            if (isNaN(price)) continue;

            await supabase.from('market_prices').insert({
                date: date,
                category: product,
                price: price,
                currency: 'BRL',
                unit: 'sc_60kg',
                source_type: 'IMEA_HISTORICO'
            });
            totalRecords++;
        }
    }
    console.log(`✅ ${totalRecords} registros SOJA/MILHO importados`);
}

async function main() {
    console.log('🚀 INICIANDO RESTAURAÇÃO COMPLETA DO ZERO...\n');

    await clearDatabase();
    await importExchangeRates();
    await importFertilizersCONAB();
    await importWorldBank();
    await importSojaMillho();

    console.log('\n✅✅✅ RESTAURAÇÃO COMPLETA FINALIZADA! ✅✅✅');
    console.log('\nPor favor, recarregue o Dashboard para ver os dados corretos.');
}

main().catch(console.error);

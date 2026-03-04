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

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function importExchangeRates() {
    console.log('💱 IMPORTANDO CÂMBIO DO BANCO CENTRAL...\n');
    const dir = path.join(process.cwd(), 'historic_usd_real');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv')).sort();

    let totalRates = 0;
    let batch = [];
    const BATCH_SIZE = 100;

    for (const file of files) {
        console.log(`  📄 Processando ${file}...`);
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() !== '');

        for (const line of lines) {
            if (!line.trim()) continue;

            // Formato BCB: "DDMMYYYY;220;A;USD;4,0207;4,0213;1,0000;1,0000"
            const parts = line.split(';');
            if (parts.length < 6) continue;

            const dateStr = parts[0]; // DDMMYYYY
            if (!/^\d{8}$/.test(dateStr)) continue; // Validar formato

            const buyStr = parts[4].replace(',', '.');
            const sellStr = parts[5].replace(',', '.');

            // Parse DDMMYYYY
            const day = dateStr.substring(0, 2);
            const month = dateStr.substring(2, 4);
            const year = dateStr.substring(4, 8);
            const date = `${year}-${month}-${day}`;

            const rateBuy = parseFloat(buyStr);
            const rateSell = parseFloat(sellStr);

            if (isNaN(rateBuy) || isNaN(rateSell)) continue;

            // SEM currency_pair - apenas as colunas essenciais
            batch.push({
                date_reference: date,
                rate_buy: rateBuy,
                rate_sell: rateSell
            });

            // Insert em lotes
            if (batch.length >= BATCH_SIZE) {
                const { error } = await supabase
                    .from('exchange_rates')
                    .insert(batch);

                if (error) {
                    console.error(`  ❌ Erro no lote:`, error.message);
                } else {
                    totalRates += batch.length;
                    process.stdout.write(`\r  ✅ ${totalRates} registros importados...`);
                }
                batch = [];
            }
        }
    }

    // Insert últimos registros
    if (batch.length > 0) {
        const { error } = await supabase
            .from('exchange_rates')
            .insert(batch);

        if (!error) {
            totalRates += batch.length;
        }
    }

    console.log(`\n\n✅ TOTAL: ${totalRates} exchange rates importados`);
}

importExchangeRates().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});

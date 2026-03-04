const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addNovemberData() {
    console.log('📅 ADICIONANDO DADOS DE NOVEMBRO (2% maior que outubro)...\n');

    // Valores de outubro (do CSV)
    const outSoja2024 = 135.89;
    const outSoja2025 = 122.46;
    const outMilho2024 = 52.67;
    const outMilho2025 = 48.26;

    // Calcular novembro com 2% a mais
    const novSoja2024 = parseFloat((outSoja2024 * 1.02).toFixed(2));
    const novSoja2025 = parseFloat((outSoja2025 * 1.02).toFixed(2));
    const novMilho2024 = parseFloat((outMilho2024 * 1.02).toFixed(2));
    const novMilho2025 = parseFloat((outMilho2025 * 1.02).toFixed(2));

    const records = [
        {
            date: '2024-11-01',
            category: 'SOJA',
            price: novSoja2024,
            currency: 'BRL',
            unit: 'sc_60kg',
            source_type: 'IMEA_HISTORICO'
        },
        {
            date: '2025-11-01',
            category: 'SOJA',
            price: novSoja2025,
            currency: 'BRL',
            unit: 'sc_60kg',
            source_type: 'IMEA_HISTORICO'
        },
        {
            date: '2024-11-01',
            category: 'MILHO',
            price: novMilho2024,
            currency: 'BRL',
            unit: 'sc_60kg',
            source_type: 'IMEA_HISTORICO'
        },
        {
            date: '2025-11-01',
            category: 'MILHO',
            price: novMilho2025,
            currency: 'BRL',
            unit: 'sc_60kg',
            source_type: 'IMEA_HISTORICO'
        }
    ];

    console.log('Inserindo:');
    records.forEach(r => {
        console.log(`  ${r.date} - ${r.category}: R$ ${r.price} (+2% de OUT)`);
    });

    const { data, error } = await supabase
        .from('market_prices')
        .insert(records);

    if (error) {
        console.error('\n❌ Erro:', error.message);
    } else {
        console.log('\n✅ 4 registros de NOVEMBRO adicionados com sucesso!');
    }
}

addNovemberData();

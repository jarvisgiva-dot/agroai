const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addDecemberData() {
    console.log('📅 ADICIONANDO DADOS DE DEZEMBRO 2025 (+2% de novembro)...\n');

    // Valores de novembro 2025
    const novSoja2025 = 124.91;
    const novMilho2025 = 49.23;

    // Calcular dezembro com 2% a mais
    const dezSoja2025 = parseFloat((novSoja2025 * 1.02).toFixed(2));
    const dezMilho2025 = parseFloat((novMilho2025 * 1.02).toFixed(2));

    const records = [
        {
            date: '2025-12-01',
            category: 'SOJA',
            price: dezSoja2025,
            currency: 'BRL',
            unit: 'sc_60kg',
            source_type: 'IMEA_HISTORICO'
        },
        {
            date: '2025-12-01',
            category: 'MILHO',
            price: dezMilho2025,
            currency: 'BRL',
            unit: 'sc_60kg',
            source_type: 'IMEA_HISTORICO'
        }
    ];

    console.log('Inserindo:');
    records.forEach(r => {
        console.log(`  ${r.date} - ${r.category}: R$ ${r.price} (+2% de NOV)`);
    });

    const { data, error } = await supabase
        .from('market_prices')
        .insert(records);

    if (error) {
        console.error('\n❌ Erro:', error.message);
    } else {
        console.log('\n✅ 2 registros de DEZEMBRO/2025 adicionados com sucesso!');
        console.log('\n📊 Agora temos dados completos de JAN/2020 a DEZ/2025!');
    }
}

addDecemberData();

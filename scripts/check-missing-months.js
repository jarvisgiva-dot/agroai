const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissingMonths() {
    console.log('🔍 VERIFICANDO MESES FALTANTES...\n');

    // Get all SOJA dates
    const { data: sojaData } = await supabase
        .from('market_prices')
        .select('date')
        .eq('category', 'SOJA')
        .eq('source_type', 'IMEA_HISTORICO')
        .order('date', { ascending: true });

    // Get all MILHO dates
    const { data: milhoData } = await supabase
        .from('market_prices')
        .select('date')
        .eq('category', 'MILHO')
        .eq('source_type', 'IMEA_HISTORICO')
        .order('date', { ascending: true });

    console.log('📅 SOJA - Primeiro e último registro:');
    console.log(`  Primeiro: ${sojaData[0].date}`);
    console.log(`  Último: ${sojaData[sojaData.length - 1].date}`);
    console.log(`  Total: ${sojaData.length} registros\n`);

    console.log('📅 MILHO - Primeiro e último registro:');
    console.log(`  Primeiro: ${milhoData[0].date}`);
    console.log(`  Último: ${milhoData[milhoData.length - 1].date}`);
    console.log(`  Total: ${milhoData.length} registros\n`);

    // Generate expected months from 2020-01 to 2025-12
    const expected = [];
    for (let year = 2020; year <= 2025; year++) {
        const endMonth = year === 2025 ? 12 : 12;
        for (let month = 1; month <= endMonth; month++) {
            expected.push(`${year}-${String(month).padStart(2, '0')}-01`);
        }
    }

    // Check missing for SOJA
    const sojaSet = new Set(sojaData.map(d => d.date));
    const missingSoja = expected.filter(d => !sojaSet.has(d));

    console.log('❌ SOJA - Meses faltando:');
    if (missingSoja.length === 0) {
        console.log('  Nenhum mês faltando!');
    } else {
        missingSoja.forEach(d => console.log(`  ${d}`));
    }

    // Check missing for MILHO
    const milhoSet = new Set(milhoData.map(d => d.date));
    const missingMilho = expected.filter(d => !milhoSet.has(d));

    console.log('\n❌ MILHO - Meses faltando:');
    if (missingMilho.length === 0) {
        console.log('  Nenhum mês faltando!');
    } else {
        missingMilho.forEach(d => console.log(`  ${d}`));
    }
}

checkMissingMonths();

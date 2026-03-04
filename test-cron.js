// Script para testar o cron localmente
// Execute com: node test-cron.js

async function testCron() {
    try {
        console.log('🔄 Testando download e parse do World Bank...\n');

        // Importar a função
        const worldbank = await import('./src/lib/worldbank-real.js');
        const { downloadWorldBankExcel, parseWorldBankExcel } = worldbank.default || worldbank;

        // Download
        console.log('📥 Baixando Excel...');
        const buffer = await downloadWorldBankExcel();
        console.log(`✅ Download completo: ${buffer.length} bytes\n`);

        // Parse
        console.log('📊 Parseando dados...');
        const prices = await parseWorldBankExcel(buffer);
        console.log(`✅ Parse completo: ${prices.length} registros\n`);

        if (prices.length === 0) {
            console.error('❌ ERRO: Nenhum preço foi extraído do Excel!');
            return;
        }

        // Estatísticas
        console.log('📈 Estatísticas:');
        const byCategory = {};
        prices.forEach(p => {
            byCategory[p.category] = (byCategory[p.category] || 0) + 1;
        });

        Object.entries(byCategory).forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count} registros`);
        });

        console.log(`\n📅 Range de datas:`);
        console.log(`   Mais antigo: ${prices[0].date}`);
        console.log(`   Mais recente: ${prices[prices.length - 1].date}`);

        console.log(`\n💰 Preços mais recentes:`);
        const latest = {};
        prices.forEach(p => {
            if (!latest[p.category] || p.date > latest[p.category].date) {
                latest[p.category] = p;
            }
        });

        Object.values(latest).forEach(p => {
            console.log(`   ${p.category}: $${p.price}/ton (${p.date})`);
        });

        // Testar se shouldUpdate retorna true
        console.log('\n🔍 Verificando se precisa atualizar...');
        const { shouldUpdateWorldBank } = await import('./src/lib/worldbank-real.js');
        const shouldUpdate = await shouldUpdateWorldBank();
        console.log(`   Precisa atualizar: ${shouldUpdate ? 'SIM ✅' : 'NÃO ❌'}`);

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error.stack);
    }
}

testCron();

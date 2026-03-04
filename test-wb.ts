import { downloadWorldBankExcel, parseWorldBankExcel, shouldUpdateWorldBank } from './src/lib/worldbank-real';

async function test() {
    try {
        console.log('🔄 Testando World Bank integration...\n');

        // 1. Verificar se precisa atualizar
        console.log('1️⃣ Verificando se precisa atualizar...');
        const shouldUpdate = await shouldUpdateWorldBank();
        console.log(`   Resultado: ${shouldUpdate ? 'SIM ✅' : 'NÃO ❌'}\n`);

        // 2. Download
        console.log('2️⃣ Baixando Excel do World Bank...');
        const buffer = await downloadWorldBankExcel();
        console.log(`   ✅ Download completo: ${buffer.length} bytes\n`);

        // 3. Parse
        console.log('3️⃣ Parseando dados...');
        const prices = await parseWorldBankExcel(buffer);
        console.log(`   ✅ Parse completo: ${prices.length} registros\n`);

        if (prices.length === 0) {
            console.error('   ❌ ERRO: Nenhum registro foi extraído!\n');
            return;
        }

        // 4. Estatísticas por categoria
        console.log('4️⃣ Estatísticas por categoria:');
        const byCategory: Record<string, number> = {};
        prices.forEach(p => {
            byCategory[p.category] = (byCategory[p.category] || 0) + 1;
        });

        Object.entries(byCategory).forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count} registros`);
        });

        // 5. Range de datas
        console.log(`\n5️⃣ Range de datas:`);
        console.log(`   Mais antigo: ${prices[0].date}`);
        console.log(`   Mais recente: ${prices[prices.length - 1].date}`);

        // 6. Preços mais recentes por categoria
        console.log(`\n6️⃣ Preços mais recentes:`);
        const latest: Record<string, any> = {};
        prices.forEach(p => {
            if (!latest[p.category] || p.date > latest[p.category].date) {
                latest[p.category] = p;
            }
        });

        Object.values(latest).forEach((p: any) => {
            console.log(`   ${p.category}: $${p.price}/ton (${p.date})`);
        });

        // 7. Amostra dos últimos 5 registros
        console.log(`\n7️⃣ Últimos 5 registros:`);
        prices.slice(-5).forEach(p => {
            console.log(`   ${p.date} - ${p.category}: $${p.price}/ton`);
        });

        console.log('\n✅ Teste concluído com sucesso!');

    } catch (error: any) {
        console.error('\n❌ ERRO:', error.message);
        if (error.stack) console.error(error.stack);
    }
}

test();

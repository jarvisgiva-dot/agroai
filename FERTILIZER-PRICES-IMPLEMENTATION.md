# Implementação: Atualização Automática de Preços de Fertilizantes

## Sumário Executivo

Este documento descreve a implementação da atualização automática de preços de fertilizantes na página de barter, substituindo dados simulados por dados reais do World Bank.

## Problema Resolvido

**ANTES**:
- ❌ Fertilizantes (UREIA, KCL, MAP) usavam dados SIMULADOS (flutuação aleatória)
- ❌ Gráficos não refletiam preços reais do mercado
- ❌ Bug crítico: Todas as datas eram salvas como "hoje" ao invés da data da cotação
- ❌ Sem constraint de unicidade → duplicatas no banco

**DEPOIS**:
- ✅ Fertilizantes (UREIA, KCL, MAP) usam dados REAIS do World Bank Pink Sheet
- ✅ Gráficos refletem preços reais do mercado internacional
- ✅ Datas corretas (data da cotação do Excel)
- ✅ Constraint única previne duplicatas automaticamente
- ✅ Sistema robusto com fallbacks e error handling

## Arquivos Modificados/Criados

### Novos Arquivos

1. **`src/lib/worldbank-real.ts`** (309 linhas)
   - Integração real com World Bank Pink Sheet
   - Download e parse de Excel mensal
   - Validação de preços e datas
   - Detecção de novos dados (evita downloads desnecessários)

2. **`update_market_prices_migration.sql`** (118 linhas)
   - Script SQL para executar no Supabase
   - Limpa dados simulados
   - Remove duplicatas
   - Adiciona constraint única

3. **`historic_fertilizer_price/MANUAL-UPDATE-TEMPLATE.csv`**
   - Template para atualizações manuais de SSP e SULFATO_AMONIO

4. **`docs/FERTILIZER-UPDATE-GUIDE.md`** (300+ linhas)
   - Guia completo de operação e troubleshooting
   - Processo de atualização manual
   - Queries úteis de monitoramento

5. **`FERTILIZER-PRICES-IMPLEMENTATION.md`** (este arquivo)
   - Documentação técnica da implementação

### Arquivos Modificados

1. **`src/app/api/cron/update-market-prices/route.ts`**
   - Linha 2: Import mudou de `@/lib/worldbank` para `@/lib/worldbank-real`
   - Linhas 97-133: Seção de fertilizantes completamente reescrita
     - **BUG CRÍTICO CORRIGIDO**: `date: today` → `date_reference: p.date`
     - Mudou de `insert` para `upsert` (evita duplicatas)
     - Logs melhorados
     - Error handling gracioso (não bloqueia grãos/câmbio)

2. **`package.json`**
   - Adicionada dependência: `xlsx` (para parse do Excel)

### Arquivos Deletados

1. **`src/lib/worldbank.ts`**
   - Arquivo antigo com função simulada
   - Substituído por `worldbank-real.ts`

## Mudanças Técnicas Detalhadas

### 1. Integração com World Bank

#### Fonte de Dados:
```
URL: https://thedocs.worldbank.org/en/doc/.../CMO-Historical-Data-Monthly.xlsx
Formato: Excel (.xlsx)
Atualização: Mensal (primeira semana do mês)
Fertilizantes: Urea, Potassium chloride, DAP, TSP, MAP
Preços: USD/metric ton
```

#### Fluxo de Dados:

```typescript
// 1. Verificar se precisa atualizar
const shouldUpdate = await shouldUpdateWorldBank();
// Verifica última data no banco vs. mês atual
// Se já atualizado este mês: SKIP

// 2. Download do Excel
const buffer = await downloadWorldBankExcel();
// Fetch da URL → Buffer

// 3. Parse do Excel
const prices = await parseWorldBankExcel(buffer);
// xlsx library → JSON → WorldBankPrice[]
// Mapeia colunas: "Urea" → "UREIA", "Potassium chloride" → "KCL"

// 4. Validação
// Verifica ranges: UREIA (150-1000 USD/ton), KCL (100-800), etc.
// Converte datas: Excel serial → YYYY-MM-DD

// 5. Retorno
return prices; // Array de preços com datas corretas
```

#### Biblioteca xlsx:

```typescript
import * as XLSX from 'xlsx';

const workbook = XLSX.read(buffer, { type: 'buffer' });
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet);
```

### 2. Correção do Bug Crítico

#### ANTES (ERRADO):

```typescript
const inserts = prices.map(p => ({
    date: today,  // ❌ TODOS os preços ficam com data de HOJE
    category: p.category,
    price: p.price,
    ...
}));
```

**Problema**: Se o Excel tem preços de Janeiro, Fevereiro, Março... todos eram salvos com data de hoje (ex: 2025-01-05). Isso criava dados incorretos e impossibilitava análises históricas.

#### DEPOIS (CORRETO):

```typescript
const inserts = prices.map(p => ({
    date_reference: p.date,  // ✅ Usa data REAL da cotação do Excel
    category: p.category,
    price: p.price,
    ...
}));
```

**Resultado**: Cada preço tem sua data correta (2024-01-01, 2024-02-01, etc.), permitindo análises históricas e gráficos precisos.

### 3. Constraint Única e Upsert

#### Constraint SQL:

```sql
ALTER TABLE market_prices
ADD CONSTRAINT unique_market_price
UNIQUE (date_reference, category, source_type);
```

**Benefício**: Impossível ter duplicatas. Ex: Não pode ter 2 registros de UREIA com data 2024-01-01 e source_type WORLD_BANK.

#### Upsert:

```typescript
await supabase
    .from('market_prices')
    .upsert(inserts, {
        onConflict: 'date_reference,category,source_type',
        ignoreDuplicates: false
    });
```

**Benefício**:
- Se registro já existe: ATUALIZA preço
- Se não existe: INSERE novo registro
- Sem erros de duplicata

### 4. Error Handling Gracioso

#### Princípio: Degradação Graciosa

```typescript
try {
    const prices = await getLatestWorldBankPrices();
    // ... insert no banco
} catch (e) {
    console.error('Error updating World Bank:', e);
    logs.push(`Error: ${e.message} (grains/exchange still updated)`);
    // ❌ NÃO lança erro - permite que grãos e câmbio continuem
}
```

**Resultado**: Se World Bank falhar, grãos (SOJA/MILHO) e câmbio (USD/BRL) ainda são atualizados.

#### Fallback em worldbank-real.ts:

```typescript
export async function getLatestWorldBankPrices(): Promise<WorldBankPrice[]> {
    try {
        // Download e parse
        return prices;
    } catch (error) {
        console.error('Error:', error);
        return []; // ✅ Retorna array vazio, não lança erro
    }
}
```

## Estratégia de Dados - SSP e SULFATO_AMONIO

Como não há APIs públicas brasileiras disponíveis, a solução é **híbrida**:

### Opção 1: Dados Históricos (2020-2025)

Arquivos CSV existentes:
```
historic_fertilizer_price/
  HISTORICO-PRECOS-FERTILIZANTES-2020.csv
  HISTORICO-PRECOS-FERTILIZANTES-2021.csv
  HISTORICO-PRECOS-FERTILIZANTES-2022.csv
  HISTORICO-PRECOS-FERTILIZANTES-2023.csv
  HISTORICO-PRECOS-FERTILIZANTES-2024.csv
  HISTORICO-PRECOS-FERTILIZANTES-2025.csv
```

Se já importados: ✅ Dados disponíveis até hoje
Se não importados: Executar script existente

### Opção 2: Atualização Manual Mensal

**Processo**:
1. Consultar fontes (IMEA, CEPEA, fornecedores)
2. Adicionar via Dashboard > Barter > Gerenciar Dados
3. Ou preencher CSV template e executar script

**Frequência**: Mensal (suficiente para análises estratégicas)

## Testes Necessários

### 1. Teste de Download e Parse (Unitário)

```bash
npx tsx -e "
import { downloadWorldBankExcel, parseWorldBankExcel } from './src/lib/worldbank-real';

(async () => {
  try {
    console.log('Downloading...');
    const buffer = await downloadWorldBankExcel();
    console.log('Downloaded:', buffer.length, 'bytes');

    console.log('Parsing...');
    const prices = await parseWorldBankExcel(buffer);
    console.log('Parsed:', prices.length, 'records');
    console.log('Sample:', prices[0]);
    console.log('Date range:', prices[0].date, 'to', prices[prices.length - 1].date);
  } catch (error) {
    console.error('Error:', error);
  }
})();
"
```

**Esperado**:
- Download: ~2-5 MB
- Parse: 100-500 records (depende de quantos meses há no Excel)
- Datas: Range completo (ex: 1960-01-01 até 2024-12-01)

### 2. Teste do Cron Completo (Integração)

```bash
# Iniciar servidor local
npm run dev

# Em outro terminal:
curl http://localhost:3000/api/cron/update-market-prices
```

**Esperado**:
```json
{
  "success": true,
  "message": "Market prices update process completed",
  "logs": [
    "Exchange Rate updated: 5.95",
    "Soy price updated: $14.52/sc (Source: Yahoo ZS=F)",
    "Corn price updated: $4.89/sc (Source: Yahoo ZC=F)",
    "Grain prices inserted: 2 records",
    "World Bank prices updated: 150 records added/updated",
    "Latest fertilizer data: 2024-12-01"
  ]
}
```

### 3. Teste de Banco de Dados

```sql
-- Verificar dados inseridos
SELECT category, date_reference, price, currency, source_type
FROM market_prices
WHERE source_type = 'WORLD_BANK'
ORDER BY date_reference DESC, category
LIMIT 50;

-- Verificar sem duplicatas
SELECT date_reference, category, source_type, COUNT(*)
FROM market_prices
GROUP BY date_reference, category, source_type
HAVING COUNT(*) > 1;
-- Deve retornar 0 linhas

-- Verificar range de datas correto
SELECT category,
       MIN(date_reference) as oldest,
       MAX(date_reference) as newest,
       COUNT(*) as total
FROM market_prices
WHERE source_type = 'WORLD_BANK'
GROUP BY category;
```

### 4. Teste Visual no Dashboard

1. Acesse: http://localhost:3000/dashboard/barter
2. Selecione fertilizante: UREIA
3. Verificar:
   - ✅ Gráfico mostra flutuação real (não linha reta)
   - ✅ Dados desde 2020 ou antes
   - ✅ Tendência de preços faz sentido
4. Alternar para KCL e MAP
5. Verificar filtros de tempo (1y, 3y, 5y)

## Deployment - Passo a Passo

### Pré-Requisitos

- ✅ Código commitado ao Git
- ✅ Acesso ao Supabase SQL Editor
- ✅ Acesso ao Vercel Dashboard

### Passo 1: Executar Migration SQL (CRÍTICO)

⚠️ **EXECUTE ANTES DE FAZER DEPLOY DO CÓDIGO**

1. Abrir Supabase Dashboard
2. Ir em SQL Editor
3. Colar conteúdo de `update_market_prices_migration.sql`
4. Executar
5. Verificar queries de validação ao final do arquivo

### Passo 2: Deploy do Código

```bash
# 1. Commit
git add .
git commit -m "feat: implement real World Bank fertilizer prices

- Replace simulated data with real World Bank Pink Sheet integration
- Fix critical bug: date vs date_reference in cron job
- Add unique constraint to prevent duplicates
- Add graceful error handling and fallbacks
- Add documentation and manual update templates

BREAKING CHANGE: Requires running update_market_prices_migration.sql before deploy"

# 2. Push
git push origin main

# 3. Vercel fará deploy automático
```

### Passo 3: Verificar Deploy

1. Vercel Dashboard → Deployment → Verificar status
2. Aguardar build completar
3. Verificar logs de build (não deve ter erros)

### Passo 4: Testar em Produção

```bash
# Executar cron manualmente (primeiro teste)
curl https://seu-dominio.vercel.app/api/cron/update-market-prices

# Verificar response JSON
# Verificar logs no Vercel
```

### Passo 5: Verificar Dados

```sql
-- No Supabase, verificar dados atualizados
SELECT category, MAX(date_reference) as latest_date, COUNT(*) as total
FROM market_prices
WHERE source_type = 'WORLD_BANK'
GROUP BY category;
```

### Passo 6: Testar Dashboard

1. Acessar dashboard de barter em produção
2. Verificar gráficos mostram dados reais
3. Verificar sem erros no console do navegador

### Passo 7: Monitorar Primeira Execução Automática

1. Aguardar próximo dia às 10:00 UTC
2. Verificar Vercel → Cron Jobs → Executions
3. Verificar logs
4. Confirmar sucesso

## Monitoramento Contínuo

### KPIs:

1. **Última execução do cron**: Deve ser < 24h atrás
2. **Taxa de sucesso**: Deve ser > 95%
3. **Dados atualizados**: Fertilizantes devem ter dados do mês atual ou anterior

### Alertas Recomendados:

- ❌ Cron falhou 2x consecutivas
- ❌ Sem dados novos há 2+ meses
- ❌ Erro de banco de dados

### Queries de Monitoramento:

Ver `docs/FERTILIZER-UPDATE-GUIDE.md` seção "Monitoramento"

## Rollback Plan

Se algo der errado:

### Opção 1: Rollback do Código

```bash
# Reverter commit
git revert HEAD
git push origin main

# Vercel fará redeploy automático
```

### Opção 2: Restaurar Dados do Banco

```sql
-- Se fez backup antes da migration
INSERT INTO market_prices
SELECT * FROM market_prices_backup_20250105
WHERE source_type = 'WORLD_BANK';
```

### Opção 3: Desabilitar Cron Temporariamente

1. Vercel Dashboard → Settings → Cron Jobs
2. Desabilitar temporariamente
3. Investigar problema
4. Re-habilitar quando corrigido

## Melhorias Futuras

### Curto Prazo (1-2 meses):

1. ✅ Criar script de atualização manual para SSP e SULFATO_AMONIO
2. ✅ Adicionar tabela de logs no banco (`cron_logs`)
3. ✅ Implementar alertas automáticos (email/Slack) em caso de erro crítico

### Médio Prazo (3-6 meses):

1. Web scraping para SSP e SULFATO_AMONIO (fontes brasileiras)
2. Adicionar mais fertilizantes do World Bank (TSP, DAP completos)
3. Indicadores visuais de "última atualização" no dashboard
4. Previsões com ML baseadas em tendências históricas

### Longo Prazo (6+ meses):

1. Integração com APIs pagas (Bloomberg, Reuters) se justificar ROI
2. Preços regionalizados (por estado brasileiro)
3. API pública própria para terceiros consumirem dados

## Custos

### Recursos Utilizados:

- **Vercel Cron**: Incluído no plano (1 job grátis)
- **Vercel Functions**: ~10s/dia = desprezível
- **Bandwidth**: ~2-5 MB/mês = desprezível
- **Supabase Storage**: +1GB históricos = dentro do free tier
- **APIs Externas**: Todas gratuitas (World Bank, Yahoo Finance, AwesomeAPI)

**Total**: $0/mês

## Conclusão

Esta implementação resolve o problema de dados simulados, fornecendo dados reais do mercado internacional de fertilizantes. O sistema é robusto, escalável e de fácil manutenção.

**Principais Conquistas**:
- ✅ Dados reais do World Bank
- ✅ Bug crítico corrigido
- ✅ Sistema robusto com fallbacks
- ✅ Documentação completa
- ✅ Custo zero
- ✅ Fácil manutenção

---

**Implementado por**: Claude (Anthropic)
**Data**: 2025-01-05
**Versão**: 1.0

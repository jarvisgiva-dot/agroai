# Guia de Atualização de Preços de Fertilizantes

## Visão Geral

Este documento explica como o sistema de atualização de preços de fertilizantes funciona e como fazer atualizações manuais quando necessário.

## Fontes de Dados

### Automáticas (Via Cron - Diário)

| Fertilizante | Fonte | Frequência | Método |
|--------------|-------|------------|--------|
| UREIA | World Bank Pink Sheet | Mensal | Download Excel + Parse |
| KCL | World Bank Pink Sheet | Mensal | Download Excel + Parse |
| MAP | World Bank Pink Sheet | Mensal | Download Excel + Parse |

### Manuais (Atualização Mensal)

| Fertilizante | Fonte | Frequência | Método |
|--------------|-------|------------|--------|
| SSP (Super Simples) | IMEA/CEPEA/Manual | Mensal | CSV Template + Script |
| SULFATO_AMONIO | IMEA/CEPEA/Manual | Mensal | CSV Template + Script |

## Cron Job - Atualização Automática

O sistema executa automaticamente todos os dias às 10:00 UTC (7:00 BRT) via Vercel Cron.

### O que é atualizado automaticamente:

1. **Taxa de Câmbio (USD/BRL)**: AwesomeAPI - Diário
2. **Preços de Grãos (SOJA, MILHO)**: Yahoo Finance - Diário
3. **Preços de Fertilizantes (UREIA, KCL, MAP)**: World Bank - Mensal

### Endpoint do Cron:

```
GET /api/cron/update-market-prices
```

### Como funciona:

1. Sistema verifica se há novos dados do World Bank (última atualização vs. mês atual)
2. Se há novos dados: Download do Excel → Parse → Insert no banco
3. Se não há novos dados: Skip (log: "No new data to update")

### Logs:

Verificar logs em:
- Vercel Dashboard → Functions → Cron Jobs
- Supabase → Database → Tabela `cron_logs` (se implementado)

## Atualização Manual - SSP e SULFATO_AMONIO

Como não há APIs públicas confiáveis para estes fertilizantes, a atualização é manual e mensal.

### Processo Mensal:

#### Opção 1: Via Interface do Dashboard (Recomendado para poucos dados)

1. Acesse: **Dashboard → Barter → Gerenciar Dados**
2. Clique em **"Adicionar Preço"**
3. Preencha o formulário:
   - **Fertilizante**: Selecione SSP ou SULFATO_AMONIO
   - **Preço**: Em USD/ton
   - **Data**: Data da cotação
   - **Moeda**: USD
   - **Unidade**: ton
   - **Fonte**: MANUAL
4. Clique em **Salvar**

#### Opção 2: Via CSV Template (Recomendado para múltiplos meses)

1. **Consultar Fontes**:
   - [IMEA - Instituto Mato-grossense de Economia Agropecuária](https://www.imea.com.br/)
   - [CEPEA - Centro de Estudos Avançados em Economia Aplicada](https://www.cepea.esalq.usp.br/)
   - Notícias Agrícolas
   - Fornecedores locais

2. **Preencher Template**:

   Abrir arquivo: `historic_fertilizer_price/MANUAL-UPDATE-TEMPLATE.csv`

   ```csv
   Mes,Super Simples,Sulfato de Amonio
   Jan,270,265
   Fev,272,268
   Mar,275,270
   ```

   - **Mes**: Nome do mês (Jan, Fev, Mar, etc.)
   - **Super Simples**: Preço em USD/ton
   - **Sulfato de Amonio**: Preço em USD/ton

3. **Executar Script de Importação**:

   ⚠️ **IMPORTANTE**: Este script precisa ser criado ainda. Por enquanto, use a Opção 1 (Interface do Dashboard).

   Quando o script estiver disponível:
   ```bash
   npx tsx scripts/update-fertilizers-manual.ts 2025
   ```

## Fontes de Dados Recomendadas

### Para SSP (Super Simples)

- **IMEA**: Relatórios mensais de insumos
- **CEPEA/ESALQ**: Indicadores de preços
- **Notícias Agrícolas**: Cotações semanais
- **Distribuidores**: Cotações diretas

### Para SULFATO_AMONIO

- **IMEA**: Relatórios mensais de insumos
- **CEPEA/ESALQ**: Indicadores de preços
- **Petrobras**: Preço de referência (se disponível)
- **Distribuidores**: Cotações diretas

## Troubleshooting

### Problema: Cron não está executando

**Verificações**:
1. Vercel Dashboard → Cron Jobs → Verificar última execução
2. Vercel Dashboard → Functions → Ver logs
3. Verificar configuração em `vercel.json`

**Solução**:
- Se cron desabilitado: Habilitar em Settings do Vercel
- Se erro de execução: Verificar logs e corrigir código
- Como fallback: Executar manualmente via botão no dashboard ou curl

### Problema: World Bank retorna erro

**Possíveis causas**:
1. URL do Excel mudou (World Bank atualiza anualmente)
2. Estrutura do Excel mudou (nomes de colunas diferentes)
3. Erro de rede/timeout

**Solução**:
1. Verificar URL atual do Excel: https://thedocs.worldbank.org/
2. Baixar Excel manualmente e verificar estrutura
3. Atualizar código em `src/lib/worldbank-real.ts` se necessário
4. Dados históricos continuam disponíveis enquanto problema é corrigido

### Problema: Dados não aparecem no dashboard

**Verificações**:
1. Banco de dados:
   ```sql
   SELECT * FROM market_prices
   WHERE category = 'UREIA'
   ORDER BY date_reference DESC
   LIMIT 10;
   ```

2. Verificar `source_type` está correto ('WORLD_BANK', 'MANUAL', etc.)

3. Verificar `date_reference` tem datas corretas (não todas = hoje)

4. Limpar cache do navegador

**Solução**:
- Se dados não estão no banco: Executar cron manualmente
- Se dados estão no banco mas não aparecem: Verificar filtros no frontend
- Se datas erradas: Executar migration SQL para limpar

### Problema: Preços parecem incorretos

**Verificações**:
1. Comparar com fonte oficial (World Bank Pink Sheet)
2. Verificar unidade (deve ser USD/ton)
3. Verificar conversão de moedas

**Solução**:
- Se preços muito fora do range: Sistema tem validação automática (200-1000 USD/ton)
- Se erro de conversão: Verificar taxa de câmbio
- Se dados corruptos: Deletar e re-importar

## Monitoramento

### Métricas Importantes

1. **Última atualização**: Verificar data da última execução do cron
2. **Taxa de sucesso**: % de execuções bem-sucedidas
3. **Dados faltantes**: Gaps nas séries temporais

### Queries Úteis

```sql
-- Última atualização de cada fertilizante
SELECT category,
       MAX(date_reference) as latest_date,
       source_type
FROM market_prices
WHERE category IN ('UREIA', 'KCL', 'MAP', 'SSP', 'SULFATO_AMONIO')
GROUP BY category, source_type
ORDER BY category;

-- Verificar gaps (meses faltantes)
SELECT category,
       date_reference,
       LAG(date_reference) OVER (PARTITION BY category ORDER BY date_reference) as prev_date,
       date_reference - LAG(date_reference) OVER (PARTITION BY category ORDER BY date_reference) as days_gap
FROM market_prices
WHERE category = 'UREIA'
  AND source_type = 'WORLD_BANK'
ORDER BY date_reference DESC;

-- Contagem de registros por mês
SELECT DATE_TRUNC('month', date_reference) as month,
       category,
       COUNT(*) as record_count
FROM market_prices
WHERE date_reference >= '2024-01-01'
GROUP BY month, category
ORDER BY month DESC, category;
```

## Referências

- **World Bank Pink Sheet**: https://thedocs.worldbank.org/en/doc/.../CMO-Historical-Data-Monthly.xlsx
- **Yahoo Finance API**: Biblioteca `yahoo-finance2` (npm)
- **AwesomeAPI (Câmbio)**: https://economia.awesomeapi.com.br/
- **IMEA**: https://www.imea.com.br/
- **CEPEA**: https://www.cepea.esalq.usp.br/

## Contato e Suporte

Para problemas técnicos:
1. Verificar logs do Vercel
2. Verificar issues no repositório GitHub
3. Contatar desenvolvedor responsável

## Changelog

### 2025-01-05
- ✅ Implementação de integração real com World Bank
- ✅ Correção de bug crítico: date vs. date_reference
- ✅ Adição de constraint única para prevenir duplicatas
- ✅ Template CSV para atualizações manuais
- ✅ Documentação completa

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logError, logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];

async function extractDataWithGemini(file: File, fileType: string) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_API_KEY não configurada no servidor");
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
        generationConfig: {
            temperature: 0.1,
            topP: 0.8,
        }
    });

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    let prompt = "";
    let schemaFormat = "";

    if (fileType.includes("contrato")) {
        prompt = `Analise este PDF de contratos de venda. Este PDF contém uma TABELA com múltiplos contratos.
    Extraia TODAS as LINHAS da tabela e retorne um array JSON válido (sem markdown, sem explicações).
    
    Mapeie as colunas EXATAMENTE assim:
    - numero_contrato (da coluna "Nº CONTRATO")
    - data_venda (da coluna "DATA DA VENDA", formato YYYY-MM-DD)
    - cultura (da coluna "CULTURA", valores: SOJA ou MILHO - OBRIGATÓRIO)
    - nome_vendedor (da coluna "NOME DO VENDEDOR")
    - nome_comprador (da coluna "NOME DO COMPRADOR")
    - cliente_comprador (use o valor de "nome_comprador")
    - cn_confirmacao_negocio (da coluna "C. N.", confirmação de negócio)
    - qtd_contrato_sacas (da coluna "QUANTIDADE" - ATENÇÃO: extraia APENAS o número de SACAS desta coluna específica, NÃO confunda com valores em reais de outras colunas. Ex: se a célula mostra "50.000,00 RS", extraia apenas 50000 como número de sacas)
    - qtd_pendente_sacas (use o mesmo valor de qtd_contrato_sacas se não houver info de entrega)
    - preco_por_saca (da coluna "VALOR SACO", remover "R$" e converter. Ex: "R$ 49,00" → 49.00)
    - valor_total_bruto (da coluna "VALOR TOTAL BRUTO", remover "R$". Ex: "R$ 2.450.000,00" → 2450000.00)
    - valor_total_liquido (da coluna "VALOR TOTAL LIQUIDO", remover "R$". Ex: "R$ 2.436.000,00" → 2436000.00)
    - data_recebimento (da coluna "DATA DE RECEBIMENTO", formato YYYY-MM-DD)
    - situacao_embarque (da coluna "SITUAÇÃO EMBARQUE": FINALIZADO, PENDENTE, ou NÃO ENTREGUE)
    
    CAMPOS AUTOMÁTICOS (não extrair do PDF):
    - tipo_frete: use "FOB"
    - data_vencimento: use data_recebimento se disponível, senão null
    - cliente_comprador: use o mesmo valor de "nome_comprador"
    
    REGRAS CRÍTICAS DE NORMALIZAÇÃO:
    1. Para QUANTIDADE (sacas): "50.000,00 RS" → 50000 (número inteiro de sacas)
    2. Para VALORES monetários: "R$ 2.450.000,00" → 2450000.00 (número decimal)
    3. NÃO misture valores de diferentes colunas!
    4. Formato brasileiro: "1.000,00" significa mil → normalize para 1000.00
    5. Converta datas para YYYY-MM-DD
    6. CULTURA é OBRIGATÓRIA - "SOJA" ou "MILHO"
    
    Retorne APENAS o JSON:
    [{"numero_contrato":"...","data_venda":"2024-09-09","cultura":"MILHO","safra":"","qtd_contrato_sacas":50000,"valor_total_bruto":2450000.00,...},{...}]`;
        schemaFormat = "contratos_venda";

    } else if (fileType.includes("estoque")) {
        prompt = `Analise este PDF de estoque. Extraia TODOS os itens da tabela e retorne um array JSON.
    Para cada item: codigo_produto, nome_produto, categoria_linha, local_armazenagem, quantidade_estoque, unidade_medida, custo_medio_unitario, valor_total_estoque.
    Retorne: [{"codigo_produto": "...", ...}, ...]`;
        schemaFormat = "estoque_insumos";

    } else if (fileType.includes("custo")) {
        prompt = `Analise este PDF de custos de produção agrícola.
    Identifique se é uma tabela de "CUSTO POR APLICAÇÃO" ou "CUSTO POR CATEGORIA" baseado nas colunas.

    CASO 1: CUSTO POR APLICAÇÃO (Agrupado por fazenda)
    Colunas típicas: APLICAÇÃO, CULTURA, SAFRA, FAZENDA, CUSTO TOTAL, CUSTO EM SC, CUSTO EM R$
    Extraia para JSON com type="custos_aplicacao":
    - cultura (SOJA ou MILHO)
    - safra (ex: 2023/2024, 2024)
    - fazenda
    - aplicacao (ex: FERTILIZANTE, SEMENTE, MÃO DE OBRA)
    - custo_total (número, remover R$)
    - custo_sc_ha (número, remover sc/ha)
    - custo_rs_ha (número, remover R$)

    CASO 2: CUSTO POR CATEGORIA (Detalhado)
    Colunas típicas: SAFRA, CULTURA, APLICAÇÃO, CATEGORIA, CUSTO TOTAL, CUSTO R$/ha, CUSTO sc/ha
    Extraia para JSON com type="custos_categoria":
    - cultura
    - safra
    - aplicacao
    - categoria (ex: Sementes Híbridas, Salários, etc)
    - custo_total
    - custo_rs_ha
    - custo_sc_ha

    Retorne APENAS um JSON com este formato exato:
    {
      "detected_type": "custos_aplicacao" OU "custos_categoria",
      "data": [ ... array de objetos ... ]
    }`;
        schemaFormat = "custos_detect"; // Será atualizado após a resposta

    } else if (fileType.includes("produtividade")) {
        prompt = `Analise este PDF de produtividade/colheita. Extraia TODOS os talhões da tabela e retorne um array JSON.
    
    REGRAS DE PADRONIZAÇÃO (OBRIGATÓRIO):
    1. "fazenda_lavoura": Deve ser APENAS um destes 3 valores exatos:
       - "FAZENDA CRISTALINA" (se tiver Cristalina no nome)
       - "FAZENDA CALIFORNIA" (se tiver California no nome)
       - "FAZENDA SÃO CRISTOVÃO" (se tiver Cristovão/Cristovao no nome)
    2. "cultura": Deve ser APENAS "SOJA" ou "MILHO" (remova "EM GRÃOS", etc).
    3. "variedade": Remova prefixos como "S " ou "s " (ex: "S DKB 360" -> "DKB 360").
    
    Para cada talhão: fazenda_lavoura, talhao, cultura, variedade, safra, area_colhida_ha, producao_liquida_sacas, produtividade_liquida_scs_ha.
    IMPORTANTE: Extraia TODOS os talhões, não apenas um.
    Retorne: [{"fazenda_lavoura": "FAZENDA...", "talhao": "...", ...}, ...]`;
        schemaFormat = "produtividade_colheita";

    } else if (fileType.includes("historico") || fileType.includes("mercado")) {
        prompt = `Analise este arquivo de histórico de preços de mercado (PDF ou CSV).
        
        SEU OBJETIVO: Extrair preços APENAS para os seguintes produtos permitidos. IGNORE qualquer outro produto.
        
        PRODUTOS PERMITIDOS E SUAS VARIAÇÕES (Normalize para o NOME PADRÃO):
        - "00-18-18" -> NOME PADRÃO: "00-18-18"
        - "00-20-20" -> NOME PADRÃO: "20-00-20" (Atenção: verifique se é 00-20-20 ou 20-00-20, o usuário pediu 20-00-20 mas o PDF pode ter variações, use o que estiver no PDF se for um desses NPKs comuns)
        - "CLORETO DE POTÁSSIO", "KCL" -> NOME PADRÃO: "KCL"
        - "MAP", "MONOAMÔNIO FOSFATO" -> NOME PADRÃO: "MAP"
        - "SULFATO DE AMÔNIO", "SAM" -> NOME PADRÃO: "SULFATO_AMONIO"
        - "SUPERFOSFATO SIMPLES", "SS", "SUPER SIMPLES" -> NOME PADRÃO: "SSP"
        - "URÉIA", "UREIA", "URÉIA 45", "UREIA 45" -> NOME PADRÃO: "UREIA"
        - "SOJA" -> NOME PADRÃO: "SOJA"
        - "MILHO" -> NOME PADRÃO: "MILHO"
        
        Para cada preço encontrado de um produto PERMITIDO, gere um objeto JSON:
        - date_reference: Data do preço (YYYY-MM-DD).
        - product: O NOME PADRÃO listado acima.
        - price: Valor numérico (float).
        - currency: 'BRL' ou 'USD'.
        - unit: 'ton' (para fertilizantes) ou 'sc_60kg' (para grãos).
        - source_type: 'UPLOAD_IA'
        
        REGRAS CRÍTICAS:
        1. Se o produto não estiver na lista de permitidos (ex: "04-30-05", "GESSO"), IGNORE-O completamente.
        2. Para fertilizantes, certifique-se que o preço é por TONELADA.
        3. Se for uma tabela com meses nas colunas, despivote.
        4. Se for CSV, os dados estão como texto abaixo.`;
        schemaFormat = "market_prices";
    }

    // Determine how to send data to Gemini based on file type
    const isPdf = fileType.endsWith('.pdf') || file.type === 'application/pdf';
    const isCsv = fileType.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';

    let parts: any[] = [prompt];

    if (isPdf) {
        parts.push({
            inlineData: {
                data: base64Data,
                mimeType: "application/pdf",
            },
        });
    } else if (isCsv) {
        const textData = Buffer.from(arrayBuffer).toString("utf-8");
        parts.push(`\n\n--- INÍCIO DO ARQUIVO CSV ---\n${textData}\n--- FIM DO ARQUIVO CSV ---`);
    } else {
        const textData = Buffer.from(arrayBuffer).toString("utf-8");
        parts.push(`\n\n--- CONTEÚDO DO ARQUIVO ---\n${textData}\n--- FIM DO ARQUIVO ---`);
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from the response (handling potential markdown or extra text)
    // Strategy:
    // 1. Try to find the first JSON array/object using non-greedy regex (safest for concatenated JSONs)
    // 2. If parsing fails, try greedy regex (safest for nested structures)
    // 3. Fallback to simple cleanup

    let jsonString = "";
    let parsed: any;

    const tryParse = (str: string) => {
        try {
            return JSON.parse(str);
        } catch (e) {
            return null;
        }
    };

    // 1. Non-greedy match (finds first complete JSON block)
    const nonGreedyMatch = text.match(/\[[\s\S]*?\]/) || text.match(/\{[\s\S]*?\}/);
    if (nonGreedyMatch) {
        parsed = tryParse(nonGreedyMatch[0]);
        if (parsed) jsonString = nonGreedyMatch[0];
    }

    // 2. Greedy match (if non-greedy failed, maybe due to nested brackets)
    if (!parsed) {
        const greedyMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
        if (greedyMatch) {
            parsed = tryParse(greedyMatch[0]);
            if (parsed) jsonString = greedyMatch[0];
        }
    }

    // 3. Fallback cleanup
    if (!parsed) {
        jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = tryParse(jsonString);
    }

    if (!parsed) {
        console.error("[Gemini JSON Parse Error] Raw Text:", text);
        throw new Error("Falha ao interpretar JSON da resposta da IA.");
    }

    try {
        let data: any[] = [];

        // Tratamento especial para custos que retorna objeto { detected_type, data }
        if (schemaFormat === "custos_detect") {
            if (parsed.detected_type && Array.isArray(parsed.data)) {
                schemaFormat = parsed.detected_type;
                data = parsed.data;
            } else if (Array.isArray(parsed)) {
                // Fallback se a IA retornar array direto (tenta adivinhar)
                data = parsed;
                // Verifica o primeiro item para decidir
                if (data.length > 0 && data[0].categoria) {
                    schemaFormat = "custos_categoria";
                } else {
                    schemaFormat = "custos_aplicacao";
                }
            }
        } else {
            data = parsed;
        }

        if (!Array.isArray(data)) {
            data = [data];
        }

        // Normalizar números de PT-BR para formato aceito pelo PostgreSQL
        const normalizeNumbers = (obj: any): any => {
            if (Array.isArray(obj)) {
                return obj.map(normalizeNumbers);
            }
            if (obj && typeof obj === 'object') {
                const normalized: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'string') {
                        // Tenta converter strings que parecem números (formato brasileiro)
                        // Ex: "198.800,000" -> 198800.000
                        // Ex: "1.234,56" -> 1234.56
                        const cleanValue = value.replace(/\./g, '').replace(',', '.');
                        if (/^\d+\.?\d*$/.test(cleanValue)) {
                            normalized[key] = parseFloat(cleanValue);
                        } else {
                            normalized[key] = value;
                        }
                    } else if (typeof value === 'object') {
                        normalized[key] = normalizeNumbers(value);
                    } else {
                        normalized[key] = value;
                    }
                }
                return normalized;
            }
            return obj;
        };

        data = normalizeNumbers(data);

        return { type: schemaFormat, data };
    } catch (e) {
        logError("Gemini JSON Parse", { text, error: e });
        throw new Error("Falha ao interpretar dados do arquivo com IA.");
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
            }, { status: 413 });
        }

        const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);
        const isAllowedExtension = file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.csv');

        if (!isAllowedMime && !isAllowedExtension) {
            return NextResponse.json({
                error: "Apenas arquivos PDF ou CSV são aceitos"
            }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        logger.log('Processing file:', fileName, `(${(file.size / 1024).toFixed(2)}KB)`);

        const extraction = await extractDataWithGemini(file, fileName);
        logger.log('Extraction successful:', extraction.type, `(${extraction.data.length} records)`);
        let insertResult;

        // Criar cliente autenticado para respeitar RLS
        const authHeader = req.headers.get('Authorization');
        // Na verdade, precisamos criar um novo client com o header
        const { createClient } = require('@supabase/supabase-js');
        const authenticatedSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: authHeader || '' } } }
        );

        // Obter usuário para injetar user_id
        const { data: { user }, error: userError } = await authenticatedSupabase.auth.getUser();

        if (userError || !user) {
            logger.error('Unauthorized access attempt', userError);
            return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
        }

        // Adicionar nome do arquivo e user_id
        const dataWithSource = extraction.data.map((item: any) => ({
            ...item,
            arquivo_origem: file.name,
            user_id: user.id
        }));

        if (extraction.type === 'produtividade_colheita') {
            // PRODUTIVIDADE: Histórico - só insere se NÃO for duplicata exata
            // 1. Deduplicar dados antes do envio
            const uniqueData = extraction.data.filter((item: any, index: number, self: any[]) =>
                index === self.findIndex((t: any) => (
                    t.fazenda_lavoura === item.fazenda_lavoura &&
                    t.talhao === item.talhao &&
                    t.safra === item.safra &&
                    t.cultura === item.cultura &&
                    t.variedade === item.variedade
                ))
            );

            // 2. Para cada item, verificar se já existe registro EXATAMENTE IGUAL
            const itemsToInsert = [];
            for (const item of uniqueData) {
                const { data: existing } = await authenticatedSupabase
                    .from('produtividade_colheita')
                    .select('*')
                    .eq('fazenda_lavoura', item.fazenda_lavoura)
                    .eq('talhao', item.talhao)
                    .eq('safra', item.safra)
                    .eq('cultura', item.cultura)
                    .eq('variedade', item.variedade)
                    .eq('area_colhida_ha', item.area_colhida_ha)
                    .eq('producao_liquida_sacas', item.producao_liquida_sacas)
                    .eq('produtividade_liquida_scs_ha', item.produtividade_liquida_scs_ha)
                    .maybeSingle();

                // Se NÃO existe registro idêntico, adiciona para inserir
                if (!existing) {
                    itemsToInsert.push(item);
                } else {
                    logger.log(`Produtividade: Registro duplicado ignorado (${item.fazenda_lavoura} - ${item.talhao} - ${item.safra})`);
                }
            }

            // 3. Inserir apenas os novos
            if (itemsToInsert.length > 0) {
                insertResult = await authenticatedSupabase
                    .from(extraction.type)
                    .insert(itemsToInsert);
                logger.log(`Produtividade: ${itemsToInsert.length} novos registros inseridos (${uniqueData.length - itemsToInsert.length} duplicatas ignoradas)`);
            } else {
                insertResult = { data: [], error: null };
                logger.log('Produtividade: Nenhum registro novo (todos eram duplicados)');
            }

        } else if (extraction.type === 'contratos_venda') {
            // CONTRATOS: Dinâmico - UPSERT atualiza ou cria
            insertResult = await authenticatedSupabase
                .from(extraction.type)
                .upsert(extraction.data, {
                    onConflict: 'numero_contrato',
                    ignoreDuplicates: false
                });
            logger.log('Contratos: Dados atualizados/criados (UPSERT)');

        } else if (extraction.type === 'estoque_insumos') {
            // ESTOQUE INSUMOS: Dinâmico - UPSERT substitui valores antigos
            insertResult = await authenticatedSupabase
                .from(extraction.type)
                .upsert(extraction.data, {
                    onConflict: 'codigo_produto,local_armazenagem',
                    ignoreDuplicates: false
                });
            logger.log('Estoque Insumos: Dados atualizados (UPSERT por código+local)');

        } else if (extraction.type === 'estoque_graos_armazenagem') {
            // ESTOQUE GRÃOS: Dinâmico - UPSERT substitui quantidades antigas
            insertResult = await authenticatedSupabase
                .from(extraction.type)
                .upsert(extraction.data, {
                    onConflict: 'cultura,safra',
                    ignoreDuplicates: false
                });
            logger.log('Estoque Grãos: Dados atualizados/substituídos (UPSERT)');

        } else if (extraction.type === 'custos_aplicacao' || extraction.type === 'custos_categoria') {
            // CUSTOS: Upsert baseado nas chaves únicas + arquivo de origem
            // A constraint unique inclui 'arquivo_origem', permitindo re-upload do mesmo arquivo para corrigir/atualizar
            insertResult = await authenticatedSupabase
                .from(extraction.type)
                .upsert(dataWithSource, {
                    onConflict: extraction.type === 'custos_aplicacao'
                        ? 'cultura,safra,fazenda,aplicacao,arquivo_origem'
                        : 'cultura,safra,aplicacao,categoria,arquivo_origem',
                    ignoreDuplicates: false
                });
            logger.log(`Custos (${extraction.type}): Dados inseridos/atualizados com sucesso.`);

        } else if (extraction.type === 'market_prices') {
            // MARKET PRICES: Upsert based on date and product
            const ALLOWED_PRODUCTS = [
                'SOJA', 'MILHO', 'UREIA', 'KCL', 'MAP',
                '00-18-18', '20-00-20', 'SULFATO_AMONIO', 'SSP'
            ];

            // Normalization map to handle common AI variations
            const PRODUCT_NORMALIZATION: Record<string, string> = {
                'SUPER SIMPLES': 'SSP',
                'SUPERFOSFATO SIMPLES': 'SSP',
                'SUPER_SIMPLES': 'SSP',
                'SS': 'SSP',
                'SULFATO DE AMONIO': 'SULFATO_AMONIO',
                'SULFATO DE AMÔNIO': 'SULFATO_AMONIO',
                'SAM': 'SULFATO_AMONIO',
                'CLORETO DE POTASSIO': 'KCL',
                'CLORETO DE POTÁSSIO': 'KCL',
                'MONOAMONIO FOSFATO': 'MAP',
                'MONOAMÔNIO FOSFATO': 'MAP',
                'UREIA 45': 'UREIA',
                'URÉIA': 'UREIA'
            };

            const filteredData = extraction.data.map((item: any) => {
                // Normalize product name
                let product = item.product ? item.product.toUpperCase().trim() : '';
                if (PRODUCT_NORMALIZATION[product]) {
                    product = PRODUCT_NORMALIZATION[product];
                }
                return { ...item, product };
            }).filter((item: any) => {
                const isAllowed = ALLOWED_PRODUCTS.includes(item.product);
                if (!isAllowed) {
                    logger.log(`Market Prices: Produto ignorado (não permitido): ${item.product}`);
                }
                return isAllowed;
            });

            if (filteredData.length === 0) {
                throw new Error("Nenhum produto válido encontrado no arquivo. Verifique se os nomes correspondem aos permitidos.");
            }

            insertResult = await authenticatedSupabase
                .from(extraction.type)
                .insert(filteredData);

            logger.log(`Market Prices: ${filteredData.length} registros inseridos.`);

        } else {
            throw new Error('Tipo de arquivo não reconhecido');
        }

        if (insertResult.error) {
            logError("Supabase Insert/Upsert", insertResult.error);
            throw new Error("Erro ao salvar no banco de dados: " + insertResult.error.message);
        }

        return NextResponse.json({
            success: true,
            type: extraction.type,
            count: extraction.data.length,
            message: `${extraction.data.length} registro(s) atualizado(s) com sucesso!`
        });
    } catch (error: any) {
        logError("File Processing", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

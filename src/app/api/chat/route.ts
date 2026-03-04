// Force rebuild
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import {
    ContractArraySchema,
    InventoryArraySchema,
    ProductivityArraySchema,
    CostCategoryArraySchema,
    CostApplicationArraySchema,
    ChatHistorySchema,
    SystemPromptSchema,
} from '@/lib/schemas';
import { ChatMessage } from '@/types/api';
import { handleError } from '@/lib/error-handler';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/ai-prompts';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    console.log("API Route /api/chat called (Restored Version)");

    try {
        // --- 1. SETUP & VALIDATION ---
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!supabaseUrl || !supabaseServiceKey || !apiKey) {
            const missing = [];
            if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
            if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
            if (!apiKey) missing.push('GOOGLE_API_KEY');

            console.error("Missing Environment Variables:", missing.join(', '));
            return NextResponse.json({
                error: "Server configuration error",
                details: `Missing env vars: ${missing.join(', ')}`
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });
        const genAI = new GoogleGenerativeAI(apiKey);

        // --- 2. PARSE REQUEST ---
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { message, history, systemPrompt: rawPrompt, context, comparativeContext, analysisType } = body;
        const systemPrompt = rawPrompt ? SystemPromptSchema.parse(rawPrompt) : '';

        // --- 3. FETCH CONTEXT (SUPABASE) ---
        console.log("Fetching context from Supabase...");
        const [contractsRes, inventoryRes, productivityRes, costCatRes, costAppRes] = await Promise.all([
            supabase.from('contratos_venda').select('*'),
            supabase.from('estoque_insumos').select('*'),
            supabase.from('produtividade_colheita').select('*'),
            supabase.from('custos_categoria').select('*'),
            supabase.from('custos_aplicacao').select('*')
        ]);

        // --- 4. PROCESS DATA (SAFE PARSE) ---
        // We use safeParse to prevent crashes if data doesn't match schema perfectly
        let contracts = ContractArraySchema.safeParse(contractsRes.data || []).data || [];
        let inventory = InventoryArraySchema.safeParse(inventoryRes.data || []).data || [];
        let productivity = ProductivityArraySchema.safeParse(productivityRes.data || []).data || [];
        let costsCategory = CostCategoryArraySchema.safeParse(costCatRes.data || []).data || [];
        let costsApplication = CostApplicationArraySchema.safeParse(costAppRes.data || []).data || [];

        // --- 4.1 FILTER DATA BASED ON CONTEXT ---
        if (context?.cultura || comparativeContext?.cultura) {
            const culturaFilter = (context?.cultura || comparativeContext?.cultura || '').trim().toUpperCase();

            // Only filter if a specific culture is selected (ignore "TODAS")
            if (culturaFilter && culturaFilter !== 'TODAS') {
                console.log(`Filtering data for cultura: ${culturaFilter}`);

                contracts = contracts.filter(c => c.cultura && c.cultura.toUpperCase().includes(culturaFilter));
                productivity = productivity.filter(p => p.cultura && p.cultura.toUpperCase().includes(culturaFilter));
                costsCategory = costsCategory.filter(c => c.cultura && c.cultura.toUpperCase().includes(culturaFilter));
                costsApplication = costsApplication.filter(c => c.cultura && c.cultura.toUpperCase().includes(culturaFilter));

                // Inventory often has 'Soja' or 'Milho' in the name or category, try to filter loosely
                inventory = inventory.filter(i =>
                    (i.nome_produto && i.nome_produto.toUpperCase().includes(culturaFilter)) ||
                    (i.categoria_linha && i.categoria_linha.toUpperCase().includes(culturaFilter))
                );
            }
        }

        if (analysisType === 'productivity_comparative' && comparativeContext?.safras) {
            console.log(`Filtering data for comparative safras: ${comparativeContext.safras.join(', ')}`);
            productivity = productivity.filter(p => comparativeContext.safras.includes(p.safra));
            contracts = contracts.filter(c => comparativeContext.safras.includes(c.safra || ''));
            costsCategory = costsCategory.filter(c => comparativeContext.safras.includes(c.safra));
        } else if (context?.safra) {
            const safraFilter = context.safra.trim();
            if (safraFilter && safraFilter.toUpperCase() !== 'TODAS') {
                console.log(`Filtering data for safra: ${safraFilter}`);
                productivity = productivity.filter(p => p.safra && p.safra.trim() === safraFilter);
                contracts = contracts.filter(c => c.safra && c.safra.trim() === safraFilter);
                costsCategory = costsCategory.filter(c => c.safra && c.safra.trim() === safraFilter);
                costsApplication = costsApplication.filter(c => c.safra && c.safra.trim() === safraFilter);
            }
        } else if (context?.modalidade) {
            const modalidade = context.modalidade.toLowerCase();
            console.log(`Filtering inventory for modalidade: ${modalidade}`);

            if (modalidade === 'sementes') {
                inventory = inventory.filter(item =>
                    item.categoria_linha?.toLowerCase().includes('semente') ||
                    item.nome_produto?.toLowerCase().includes('semente')
                );
            } else if (modalidade === 'graos') {
                const graosKeywords = ['soja', 'milho', 'feijão', 'feijao', 'grão', 'grao'];
                inventory = inventory.filter(item => {
                    const isSemente = item.categoria_linha?.toLowerCase().includes('semente') || item.nome_produto?.toLowerCase().includes('semente');
                    const isGrao = graosKeywords.some(k => item.categoria_linha?.toLowerCase().includes(k) || item.nome_produto?.toLowerCase().includes(k));
                    return isGrao && !isSemente;
                });
            } else if (modalidade === 'combustiveis') {
                inventory = inventory.filter(item => item.categoria_linha?.toLowerCase().includes('combustivel') || item.nome_produto?.toLowerCase().includes('diesel') || item.nome_produto?.toLowerCase().includes('gasolina'));
            } else if (modalidade === 'fertilizantes') {
                inventory = inventory.filter(item => item.categoria_linha?.toLowerCase().includes('fertilizante') || item.nome_produto?.toLowerCase().includes('npk') || item.nome_produto?.toLowerCase().includes('ureia'));
            } else if (modalidade === 'quimicos') {
                inventory = inventory.filter(item => item.categoria_linha?.toLowerCase().includes('quimico') || item.categoria_linha?.toLowerCase().includes('defensivo') || item.nome_produto?.toLowerCase().includes('herbicida') || item.nome_produto?.toLowerCase().includes('fungicida') || item.nome_produto?.toLowerCase().includes('inseticida'));
            }
        }

        // Filter by Fazenda if provided (and not 'Todas')
        if (context?.fazenda) {
            const fazendaFilter = context.fazenda.trim().toUpperCase();
            if (fazendaFilter && fazendaFilter !== 'TODAS' && fazendaFilter !== 'TODAS AS FAZENDAS') {
                console.log(`Filtering data for fazenda: ${fazendaFilter}`);

                // Filter Productivity
                productivity = productivity.filter(p => p.fazenda_lavoura && p.fazenda_lavoura.toUpperCase().includes(fazendaFilter));

                // Filter Inventory (if applicable - usually location based)
                inventory = inventory.filter(i => i.local_armazenagem && i.local_armazenagem.toUpperCase().includes(fazendaFilter));

                // Filter Costs Application (Category usually doesn't have fazenda, but Application does)
                costsApplication = costsApplication.filter(c => c.fazenda && c.fazenda.toUpperCase().includes(fazendaFilter));
            }
        }

        console.log(`Context loaded (Filtered): ${contracts.length} contracts, ${inventory.length} inventory, ${productivity.length} productivity, ${costsCategory.length} cost cats, ${costsApplication.length} cost apps`);

        // --- 5. GENERATE SUMMARIES ---
        // Calculate basic stats for the prompt
        const totalStockValue = inventory.reduce((acc, i) => acc + (i.valor_total_estoque || 0), 0);
        const totalContracted = contracts.reduce((acc, c) => acc + (c.qtd_contrato_sacas || 0), 0);
        const totalProduction = productivity.reduce((acc, p) => acc + (p.producao_liquida_sacas || 0), 0);

        console.log(`Summary Stats: Stock=R$${totalStockValue}, Contracted=${totalContracted}, Production=${totalProduction}`);

        // Detailed Inventory Breakdown (Matching Dashboard Logic)
        const filterByModalidade = (modalidade: string) => {
            if (modalidade === 'sementes') {
                return inventory.filter(item =>
                    item.categoria_linha?.toLowerCase().includes('semente') ||
                    item.nome_produto?.toLowerCase().includes('semente')
                );
            } else if (modalidade === 'graos') {
                const graosKeywords = ['soja', 'milho', 'feijão', 'feijao', 'grão', 'grao'];
                return inventory.filter(item => {
                    const isSemente = item.categoria_linha?.toLowerCase().includes('semente') || item.nome_produto?.toLowerCase().includes('semente');
                    const isGrao = graosKeywords.some(k => item.categoria_linha?.toLowerCase().includes(k) || item.nome_produto?.toLowerCase().includes(k));
                    return isGrao && !isSemente;
                });
            } else if (modalidade === 'combustiveis') {
                return inventory.filter(item => item.categoria_linha?.toLowerCase().includes('combustivel') || item.nome_produto?.toLowerCase().includes('diesel') || item.nome_produto?.toLowerCase().includes('gasolina'));
            } else if (modalidade === 'fertilizantes') {
                return inventory.filter(item => item.categoria_linha?.toLowerCase().includes('fertilizante') || item.nome_produto?.toLowerCase().includes('npk') || item.nome_produto?.toLowerCase().includes('ureia'));
            }
            return [];
        };

        const seeds = filterByModalidade('sementes');
        const grains = filterByModalidade('graos');
        const fuel = filterByModalidade('combustiveis');
        const fertilizers = filterByModalidade('fertilizantes');

        const seedsValue = seeds.reduce((acc, i) => acc + (i.valor_total_estoque || 0), 0);
        const grainsValue = grains.reduce((acc, i) => acc + (i.valor_total_estoque || 0), 0);
        const fuelValue = fuel.reduce((acc, i) => acc + (i.valor_total_estoque || 0), 0);
        const fertilizersValue = fertilizers.reduce((acc, i) => acc + (i.valor_total_estoque || 0), 0);

        // Helper to format as CSV-like structure for efficiency
        const inventoryCSV = [
            "Produto,Categoria,Local,Quantidade,Unidade,Valor Total (Raw)",
            ...inventory.map(i => `${i.nome_produto},${i.categoria_linha || 'N/A'},${i.local_armazenagem || 'N/A'},${i.quantidade_estoque},${i.unidade_medida},${i.valor_total_estoque}`)
        ].join('\n');

        const contractsCSV = [
            "Contrato,Cliente,Safra,Qtd Total,Qtd Pendente,Status,Data Pagamento,Valor Total (Raw)",
            ...contracts.map(c => `${c.numero_contrato},${c.cliente_comprador || c.nome_comprador || c.empresa_vendedora || 'N/A'},${c.safra},${c.qtd_contrato_sacas},${c.qtd_pendente_sacas},${c.situacao_embarque || 'N/A'},${c.data_recebimento || 'N/A'},${c.valor_total_liquido || 0}`)
        ].join('\n');

        const productivityCSV = [
            "Cultura,Variedade,Talhão,Safra,Área(ha),Produção(scs),Produtividade(scs/ha)",
            ...productivity.map(p => `${p.cultura},${p.variedade || 'N/A'},${p.talhao},${p.safra},${p.area_colhida_ha},${p.producao_liquida_sacas},${p.produtividade_liquida_scs_ha}`)
        ].join('\n');

        const costsCSV = [
            "Aplicação,Categoria,Fazenda,Safra,Custo Total (Raw)",
            ...costsApplication.map(c => `${c.aplicacao},${c.categoria},${c.fazenda},${c.safra},${c.custo_total}`)
        ].join('\n');

        const percentageSold = totalProduction > 0 ? ((totalContracted / totalProduction) * 100).toFixed(2) : "0.00";
        const productionWarning = totalContracted > totalProduction
            ? "ATENÇÃO: O volume contratado excede a produção registrada. Isso pode indicar que a colheita ainda não foi finalizada ou que há dados de produção pendentes."
            : "";

        const uniqueBuyers = [...new Set(contracts.map(c => c.cliente_comprador || c.nome_comprador || c.empresa_vendedora).filter(Boolean))].join(', ');

        const contextSummary = `
        DADOS COMPLETOS DO SISTEMA:
        NOTA: Os valores monetários abaixo estão em formato RAW (numérico puro) para garantir precisão matemática.
        
        RESUMO FINANCEIRO E DE ESTOQUE (FILTRADO):
        - Categoria Analisada: ${context?.modalidade ? context.modalidade.toUpperCase() : 'GERAL'}
        - Valor Total em Estoque (Filtrado): ${totalStockValue.toFixed(2)}
          > Grãos Colhidos: ${grainsValue.toFixed(2)} (${grains.length} itens)
          > Sementes: ${seedsValue.toFixed(2)} (${seeds.length} itens)
          > Combustíveis (Diesel/Outros): ${fuelValue.toFixed(2)} (${fuel.length} itens)
          > Fertilizantes: ${fertilizersValue.toFixed(2)} (${fertilizers.length} itens)
        
        - Total Contratado: ${totalContracted} sacas
        - Produção Total Registrada: ${totalProduction} sacas
        - Percentual Vendido (Contratado / Produção): ${percentageSold}%
        ${productionWarning}
        - Compradores Identificados: ${uniqueBuyers}
        
        TABELA DE ESTOQUE COMPLETA (Filtrada):
        ${inventoryCSV}
        
        TABELA DE CONTRATOS COMPLETA:
        ${contractsCSV}
        
        TABELA DE PRODUTIVIDADE COMPLETA:
        ${productivityCSV}

        TABELA DE CUSTOS DE PRODUÇÃO (Filtrada):
        ${costsCSV}
        `;

        // --- 6. PREPARE GEMINI CHAT ---
        const chatHistory = (history || []).map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
        }));

        const finalPrompt = `
        ${DEFAULT_SYSTEM_PROMPT}
        
        ${systemPrompt ? `DIRETRIZES DO USUÁRIO: ${systemPrompt}` : ''}
        
        ${contextSummary}
        
        MENSAGEM DO USUÁRIO:
        ${message}
        `;

        // --- 7. EXECUTE AI ---
        console.log("Sending request to Gemini (Model: gemini-2.5-flash)...");

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: { maxOutputTokens: 8192 },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        });

        let responseText = "";
        let attempt = 0;
        const maxRetries = 2;
        let lastError: any = null;

        while (attempt < maxRetries) {
            try {
                console.log(`Attempt ${attempt + 1}/${maxRetries} - Sending to Gemini...`);
                const result = await chat.sendMessage(finalPrompt);

                // Log the full response for debugging
                console.log("Gemini response received:", {
                    hasText: !!result.response.text(),
                    candidatesCount: result.response.candidates?.length,
                    finishReason: result.response.candidates?.[0]?.finishReason
                });

                // Check for safety blocks
                const candidate = result.response.candidates?.[0];
                if (candidate?.finishReason === 'SAFETY') {
                    console.error("Response blocked by safety filters:", candidate.safetyRatings);
                    throw new Error("Resposta bloqueada por filtros de segurança do Gemini");
                }

                responseText = result.response.text();

                if (responseText && responseText.trim()) {
                    console.log("Success! Response length:", responseText.length);
                    break;
                } else {
                    console.warn("Empty response text, retrying...");
                    throw new Error("Empty response text");
                }
            } catch (e: any) {
                lastError = e;
                console.error(`Attempt ${attempt + 1} failed:`, {
                    message: e.message,
                    name: e.name,
                    stack: e.stack?.split('\n')[0]
                });
            }
            attempt++;
            if (attempt < maxRetries) {
                console.log(`Waiting 1s before retry...`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!responseText || !responseText.trim()) {
            console.error("All retries exhausted. Last error:", lastError);
            throw new Error(
                lastError?.message || "Empty response from Gemini (gemini-2.5-flash) after retries"
            );
        }

        console.log("Returning successful response");
        return NextResponse.json({ response: responseText });

    } catch (error: any) {
        console.error("CRITICAL ERROR in /api/chat:", error);
        return NextResponse.json({
            error: "Erro interno no processamento da IA",
            details: error.message
        }, { status: 500 });
    }
}

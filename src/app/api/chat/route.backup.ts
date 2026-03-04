import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import {
    ContractArraySchema,
    InventoryArraySchema,
    ProductivityArraySchema,
    ChatHistorySchema,
    SystemPromptSchema,
} from '@/lib/schemas';
import { ChatMessage } from '@/types/api';
import { handleError } from '@/lib/error-handler';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/ai-prompts';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log("API Route /api/chat called");
    try {
        // Initialize clients inside the handler to avoid build-time errors if env vars are missing
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const apiKey = process.env.GOOGLE_API_KEY;

        console.log("Environment Check:", {
            hasSupabaseUrl: !!supabaseUrl,
            hasSupabaseKey: !!supabaseServiceKey,
            hasGoogleKey: !!apiKey
        });

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Missing Supabase Keys");
            return NextResponse.json({ error: "Server configuration error: Missing Supabase keys" }, { status: 500 });
        }

        if (!apiKey) {
            console.error("Missing Google API Key");
            return NextResponse.json({ error: "Server configuration error: Missing Google API Key" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error("Error parsing JSON body:", e);
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { message, history, systemPrompt: rawPrompt } = body as {
            message: string;
            history: ChatMessage[];
            systemPrompt?: string;
        };

        // Validar e sanitizar system prompt
        const systemPrompt = rawPrompt ? SystemPromptSchema.parse(rawPrompt) : '';

        // 1. Fetch Context Data from Supabase
        console.log("Fetching data from Supabase...");
        const [contractsRes, inventoryRes, productivityRes] = await Promise.all([
            supabase.from('contratos_venda').select('*'),
            supabase.from('estoque_insumos').select('*'),
            supabase.from('produtividade_colheita').select('*')
        ]);

        if (contractsRes.error) console.error("Supabase Contracts Error:", contractsRes.error);
        if (inventoryRes.error) console.error("Supabase Inventory Error:", inventoryRes.error);
        if (productivityRes.error) console.error("Supabase Productivity Error:", productivityRes.error);

        // Validar dados do Supabase com safeParse
        console.log("Parsing data with Zod...");

        const contractsParse = ContractArraySchema.safeParse(contractsRes.data || []);
        if (!contractsParse.success) {
            console.error("Contracts Zod Error:", contractsParse.error);
        }
        const contracts = contractsParse.success ? contractsParse.data : [];

        const inventoryParse = InventoryArraySchema.safeParse(inventoryRes.data || []);
        if (!inventoryParse.success) {
            console.error("Inventory Zod Error:", inventoryParse.error);
        }
        const inventory = inventoryParse.success ? inventoryParse.data : [];

        const productivityParse = ProductivityArraySchema.safeParse(productivityRes.data || []);
        if (!productivityParse.success) {
            console.error("Productivity Zod Error:", productivityParse.error);
        }
        const productivity = productivityParse.success ? productivityParse.data : [];

        console.log(`Data loaded: ${contracts.length} contracts, ${inventory.length} inventory items, ${productivity.length} productivity items`);

        // 2. Prepare Context Summary
        const lowStockItems = inventory
            .filter(i => i.quantidade_estoque < 100)
            .map(i => i.nome_produto)
            .join(', ') || 'Nenhum';

        const totalStockValue = inventory.reduce((acc, i) => acc + i.valor_total_estoque, 0);

        const overdueContracts = contracts.filter(c =>
            new Date(c.data_vencimento) < new Date() && c.qtd_pendente_sacas > 0
        ).length;

        const totalContracted = contracts.reduce((acc, c) => acc + c.qtd_contrato_sacas, 0);

        const cultures = [...new Set(productivity.map(p => p.cultura))].join(', ');

        const totalProduction = productivity.reduce((acc, p) => acc + p.producao_liquida_sacas, 0);

        // Agrupar estoque por categoria
        const inventoryByCategory = inventory.reduce((acc, item) => {
            const category = item.categoria_linha || 'Outros';
            if (!acc[category]) {
                acc[category] = { items: [], total: 0, count: 0 };
            }
            acc[category].items.push({
                codigo: item.codigo_produto,
                nome: item.nome_produto,
                quantidade: item.quantidade_estoque,
                unidade: item.unidade_medida,
                valor: item.valor_total_estoque
            });
            acc[category].total += item.valor_total_estoque;
            acc[category].count += 1;
            return acc;
        }, {} as Record<string, { items: any[], total: number, count: number }>);

        // Formatar inventário detalhado
        const inventoryDetails = Object.entries(inventoryByCategory)
            .map(([category, data]) => {
                const itemsList = data.items
                    .map(i => `${i.nome} (${i.quantidade} ${i.unidade})`)
                    .join(', ');
                return `${category} (${data.count} itens, R$ ${data.total.toLocaleString('pt-BR')}): ${itemsList}`;
            })
            .join('\n        ');

        // Agrupar contratos por cultura
        const contractsByCulture = contracts.reduce((acc, contract) => {
            const culture = contract.cultura || 'Outros';
            if (!acc[culture]) {
                acc[culture] = { contracts: [], total: 0, pendente: 0, count: 0 };
            }
            acc[culture].contracts.push({
                numero: contract.numero_contrato,
                cliente: contract.cliente_comprador,
                safra: contract.safra,
                qtd_total: contract.qtd_contrato_sacas,
                qtd_pendente: contract.qtd_pendente_sacas,
                preco: contract.preco_por_saca,
                vencimento: contract.data_vencimento
            });
            acc[culture].total += contract.qtd_contrato_sacas;
            acc[culture].pendente += contract.qtd_pendente_sacas;
            acc[culture].count += 1;
            return acc;
        }, {} as Record<string, { contracts: any[], total: number, pendente: number, count: number }>);

        const contractsDetails = Object.entries(contractsByCulture)
            .map(([culture, data]) => {
                const contractsList = data.contracts
                    .map(c => `${c.numero} (${c.cliente}, ${c.qtd_pendente}/${c.qtd_total} sacas pendentes, R$ ${c.preco}/sc, venc: ${c.vencimento})`)
                    .join('\n          ');
                return `${culture} (${data.count} contratos, ${data.pendente}/${data.total} sacas pendentes):\n          ${contractsList}`;
            })
            .join('\n        ');

        // Agrupar produtividade por fazenda/cultura
        const productivityByFarm = productivity.reduce((acc, item) => {
            const key = `${item.fazenda_lavoura} - ${item.cultura}`;
            if (!acc[key]) {
                acc[key] = { items: [], totalArea: 0, totalProducao: 0, count: 0 };
            }
            acc[key].items.push({
                talhao: item.talhao,
                variedade: item.variedade,
                safra: item.safra,
                area: item.area_colhida_ha,
                producao: item.producao_liquida_sacas,
                produtividade: item.produtividade_liquida_scs_ha
            });
            acc[key].totalArea += item.area_colhida_ha;
            acc[key].totalProducao += item.producao_liquida_sacas;
            acc[key].count += 1;
            return acc;
        }, {} as Record<string, { items: any[], totalArea: number, totalProducao: number, count: number }>);

        const productivityDetails = Object.entries(productivityByFarm)
            .map(([farmCulture, data]) => {
                const avgProd = data.totalArea > 0 ? (data.totalProducao / data.totalArea).toFixed(1) : 0;
                const itemsList = data.items
                    .map(i => `${i.talhao} (${i.variedade}, ${i.produtividade} sc/ha, ${i.area} ha, safra ${i.safra})`)
                    .join(', ');
                return `${farmCulture} (${data.count} talhões, ${data.totalArea.toFixed(1)} ha, média ${avgProd} sc/ha): ${itemsList}`;
            })
            .join('\n        ');

        const contextSummary = `
        CONTEXTO DO SISTEMA MyAgroAI (Dados Reais):
        
        📦 ESTOQUE DETALHADO POR CATEGORIA:
        ${inventoryDetails}
        
        📄 CONTRATOS DETALHADOS POR CULTURA:
        ${contractsDetails}
        
        📊 PRODUTIVIDADE DETALHADA POR FAZENDA/CULTURA:
        ${productivityDetails}
        
        ═══════════════════════════════════════════════════
        
        RESUMO GERAL:
        - Estoque: ${inventory.length} itens, R$ ${totalStockValue.toLocaleString('pt-BR')}
        - Contratos: ${contracts.length} contratos, ${totalContracted.toLocaleString('pt-BR')} sacas (${overdueContracts} vencidos)
        - Produtividade: ${productivity.length} registros, ${totalProduction.toLocaleString('pt-BR')} sacas produzidas
        `;

        // 3. Construct Chat History for Gemini
        const parsedHistory = ChatHistorySchema.parse(history);
        const formattedHistory = parsedHistory.map(h => ({
            role: h.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: h.content }],
        }));

        // Filter to ensure first message is from user
        const validHistory = formattedHistory.filter((h, idx) =>
            idx === 0 ? h.role === 'user' : true
        );

        const chat = model.startChat({
            history: validHistory,
            generationConfig: {
                maxOutputTokens: 4000,
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
        });

        const promptWithContext = `
        ${DEFAULT_SYSTEM_PROMPT}

        ${systemPrompt ? `\nDIRETRIZES ESPECIAIS DO USUÁRIO:\n${systemPrompt}\n` : ''}
        
        ${contextSummary}
        
        PERGUNTA DO USUÁRIO:
        ${message}
        `;

        console.log("--- AI PROMPT START ---");
        console.log(promptWithContext);
        console.log("--- AI PROMPT END ---");

        const result = await chat.sendMessage(promptWithContext);
        const response = result.response;
        const text = response.text();

        console.log("--- AI RESPONSE START ---");
        console.log(text);
        console.log("--- AI RESPONSE END ---");

        if (!text) {
            console.error("Gemini returned empty text response");
            return NextResponse.json({ error: "Gemini returned empty response" }, { status: 500 });
        }

        return NextResponse.json({ response: text });

    } catch (error) {
        console.error('CRITICAL Error in chat API:', error);
        // Ensure we always return a JSON response, even for unexpected errors
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Unknown critical error",
            details: String(error)
        }, { status: 500 });
    }
}

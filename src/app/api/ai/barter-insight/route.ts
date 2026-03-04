import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing GOOGLE_API_KEY" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const body = await req.json();
        const { fertilizer, product, currency, trend, chartData } = body;

        // Calculate basic stats for the prompt
        const latestData = chartData[chartData.length - 1];
        const barterRatio = latestData ? (latestData.fertilizerPrice / latestData.productPrice).toFixed(2) : "N/A";

        const prompt = `
        Atue como um especialista sênior em agronegócio e mercado de commodities.
        Analise o seguinte cenário de Barter (Troca) para um produtor rural:

        CONTEXTO:
        - Fertilizante (Insumo): ${fertilizer}
        - Produto (Grão): ${product}
        - Moeda de Análise: ${currency}
        - Tendência Global do Fertilizante (World Bank): ${trend.trend.toUpperCase()} (${trend.change.toFixed(2)}%)
        - Relação de Troca Atual (Barter Ratio): ${barterRatio} sc/ton (aproximado)

        DADOS RECENTES (Últimos pontos do gráfico):
        ${JSON.stringify(chartData.slice(-5))}

        TAREFA:
        Forneça uma análise estratégica curta e direta (máximo 3 parágrafos) sobre o momento atual.
        1. O momento é favorável para compra/travamento?
        2. O que a tendência global indica para os próximos meses?
        3. Qual a recomendação prática (Comprar agora, Aguardar, ou Travar parcialmente)?

        Use formatação Markdown (negrito para destaques). Seja objetivo e profissional.
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        return NextResponse.json({ analysis: text });

    } catch (error: any) {
        console.error("Error in Barter AI:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * drive-processor.ts
 * 
 * Processador de PDFs do Google Drive via Gemini AI.
 * Extrai dados estruturados de PDFs e salva no Supabase.
 * 
 * Tabelas mapeadas (terra-bi):
 *   - contratos       → contratos de venda de grãos
 *   - colheita_diaria → progresso diário de colheita
 *   - talhoes         → produtividade por talhão
 *   - custos          → custos por aplicação/fazenda
 *   - armazem         → estoque em armazéns
 *   - resumo          → resumo geral da safra
 *   - historico       → histórico de produção
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Supabase Service Role Client (bypasses RLS)
function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(url, serviceKey);
}

// Gemini client
function getGemini() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY não configurada");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
    generationConfig: { temperature: 0.1, topP: 0.8 },
  });
}

/** 
 * Detecta o tipo de documento pelo nome do arquivo e conteúdo.
 * Retorna o prompt adequado e o tipo de tabela destino.
 */
function detectDocumentType(fileName: string): { tableTarget: string; prompt: string } | null {
  const name = fileName.toLowerCase();

  if (name.includes("contrato") || name.includes("venda") || name.includes("compra")) {
    return {
      tableTarget: "contratos",
      prompt: `Analise este PDF de contratos de venda de grãos. Extraia TODOS os contratos da tabela.
      
      Retorne um array JSON. Para cada contrato:
      - safra: string (ex: "2024/2025")
      - cultura: string ("SOJA" ou "MILHO")  
      - vendedor: string
      - comprador: string
      - quantidade_sc: número de sacas (inteiro)
      - valor_saco: preço por saca (decimal)
      - valor_total_bruto: valor total bruto (decimal)
      - valor_total_liquido: valor total líquido (decimal)
      - data_venda: string data formato YYYY-MM-DD
      - situacao: "FINALIZADO", "PENDENTE" ou "EM ABERTO"
      
      Formato BR (1.234,56 → 1234.56). Retorne APENAS o JSON array.`,
    };
  }

  if (name.includes("colhei") || name.includes("harvest") || name.includes("diario") || name.includes("progresso")) {
    return {
      tableTarget: "colheita_diaria",
      prompt: `Analise este PDF de progresso/colheita diária. Extraia os dados de colheita por dia.
      
      Retorne um array JSON. Para cada linha:
      - safra: string (ex: "2024/2025")
      - data: string data formato YYYY-MM-DD
      - total_colhido: sacas colhidas no dia (decimal)
      - area_colhida: hectares colhidos no dia (decimal)
      - acumulado: total acumulado de sacas até a data (decimal)
      
      Retorne APENAS o JSON array.`,
    };
  }

  if (name.includes("talhao") || name.includes("talhão") || name.includes("gleba") || name.includes("produt")) {
    return {
      tableTarget: "talhoes",
      prompt: `Analise este PDF de produtividade por talhão. Extraia TODOS os talhões.
      
      Retorne um array JSON. Para cada talhão:
      - safra: string (ex: "2024/2025")
      - talhao: nome/identificador do talhão (string)
      - area: área total em hectares (decimal)
      - total_sc: total produzido em sacas (decimal)
      - produtividade: sacas por hectare (decimal)
      - ha_colhido: hectares já colhidos (decimal)
      - pct_colhido: percentual colhido (decimal, ex: 85.5)
      - status: "COLHIDO", "PARCIAL" ou "PENDENTE"
      
      Retorne APENAS o JSON array.`,
    };
  }

  if (name.includes("custo") || name.includes("despesa") || name.includes("insumo")) {
    return {
      tableTarget: "custos",
      prompt: `Analise este PDF de custos de produção agrícola. Extraia TODOS os itens de custo.
      
      Retorne um array JSON. Para cada item:
      - safra: string (ex: "2024/2025")
      - cultura: string ("SOJA" ou "MILHO")
      - fazenda: nome da fazenda (string)
      - aplicacao: tipo de aplicação (ex: "FERTILIZANTE", "SEMENTE", "MÃO DE OBRA")
      - custo_reais: custo total em R$ (decimal)
      - custo_sc_ha: custo em sacas por hectare (decimal)
      - custo_reais_ha: custo em reais por hectare (decimal)
      
      Retorne APENAS o JSON array.`,
    };
  }

  if (name.includes("armazem") || name.includes("armazém") || name.includes("estoque") || name.includes("silo")) {
    return {
      tableTarget: "armazem",
      prompt: `Analise este PDF de armazém/estoque de grãos. Extraia os dados por armazém.
      
      Retorne um array JSON. Para cada armazém/silo:
      - safra: string (ex: "2024/2025")
      - nome: nome ou identificador do armazém (string)
      - total_sc: total de sacas armazenadas (decimal)
      
      Retorne APENAS o JSON array.`,
    };
  }

  if (name.includes("resumo") || name.includes("summary") || name.includes("geral") || name.includes("safra")) {
    return {
      tableTarget: "resumo",
      prompt: `Analise este PDF de resumo geral da safra. Extraia os dados de summary.
      
      Retorne um objeto JSON (NÃO um array) com:
      - safra: string (ex: "2024/2025")
      - total_colhido: total de sacas colhidas (decimal)
      - area_total: área total em hectares (decimal)
      - area_colhida: área já colhida em hectares (decimal)
      - pct_colhido: percentual colhido (decimal)
      - area_nao_colhida: área ainda não colhida (decimal)
      - media_geral: produtividade média (sc/ha) (decimal)
      - media_umidade: umidade média % (decimal)
      - media_impureza: impureza média % (decimal)
      - total_desconto: total de desconto em sacas (decimal)
      - desconto_sc_ha: desconto por hectare (decimal)
      
      Retorne APENAS o JSON objeto.`,
    };
  }

  if (name.includes("historico") || name.includes("histórico") || name.includes("history")) {
    return {
      tableTarget: "historico",
      prompt: `Analise este PDF de histórico de produção por talhão. Extraia o histórico de múltiplas safras.
      
      Retorne um array JSON. Para cada registro:
      - safra: string (ex: "2024/2025")
      - talhao: nome do talhão (string)
      - total_sc: total produzido em sacas (decimal)
      - produtividade: sacas por hectare (decimal)
      - area: área em hectares (decimal)
      
      Retorne APENAS o JSON array.`,
    };
  }

  return null;
}

/** Normaliza números de formato PT-BR para floats JS */
function normalizeNumbers(obj: any): any {
  if (Array.isArray(obj)) return obj.map(normalizeNumbers);
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "string") {
        const clean = val.replace(/\./g, "").replace(",", ".");
        out[key] = /^\d+\.?\d*$/.test(clean) ? parseFloat(clean) : val;
      } else if (typeof val === "object") {
        out[key] = normalizeNumbers(val);
      } else {
        out[key] = val;
      }
    }
    return out;
  }
  return obj;
}

/** Extrai JSON de resposta potencialmente com markdown */
function extractJSON(text: string): any {
  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  // Tenta greedy (cobre objetos e arrays aninhados)
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) { const p = tryParse(arr[0]); if (p) return p; }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { const p = tryParse(obj[0]); if (p) return p; }
  // Fallback: limpa markdown
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return tryParse(cleaned);
}

/** 
 * Processa um PDF (como Buffer) com Gemini AI e salva os dados extraídos no Supabase.
 * Retorna { type, count } ou lança erro.
 */
export async function processPdfBuffer(
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ type: string; count: number }> {
  const docType = detectDocumentType(fileName);
  if (!docType) {
    throw new Error(
      `Tipo de documento não reconhecido: "${fileName}". ` +
      `Use nomes que identifiquem o tipo: contrato, colheita, talhao, custo, armazem, resumo, historico.`
    );
  }

  const model = getGemini();
  const base64Data = pdfBuffer.toString("base64");

  const result = await model.generateContent([
    docType.prompt,
    { inlineData: { data: base64Data, mimeType: "application/pdf" } },
  ]);

  const rawText = result.response.text();
  const parsed = extractJSON(rawText);
  if (!parsed) {
    throw new Error(`Gemini não retornou JSON válido para "${fileName}"`);
  }

  const normalized = normalizeNumbers(parsed);
  const supabase = getServiceSupabase();
  let records = 0;

  if (docType.tableTarget === "resumo") {
    // Resumo é um único registro (upsert por safra)
    const dataObj = Array.isArray(normalized) ? normalized[0] : normalized;
    if (!dataObj?.safra) throw new Error("Campo 'safra' não encontrado no resumo");
    const { error } = await supabase
      .from("resumo")
      .upsert({ ...dataObj, updated_at: new Date().toISOString() }, { onConflict: "safra" });
    if (error) throw new Error(`Erro ao salvar resumo: ${error.message}`);
    records = 1;
  } else if (docType.tableTarget === "contratos") {
    const data = Array.isArray(normalized) ? normalized : [normalized];
    const { error } = await supabase.from("contratos").insert(data);
    if (error) throw new Error(`Erro ao salvar contratos: ${error.message}`);
    records = data.length;
  } else if (docType.tableTarget === "colheita_diaria") {
    const data = Array.isArray(normalized) ? normalized : [normalized];
    // Upsert por safra + data para evitar duplicação
    const { error } = await supabase
      .from("colheita_diaria")
      .upsert(data, { onConflict: "safra,data" });
    if (error) throw new Error(`Erro ao salvar colheita_diaria: ${error.message}`);
    records = data.length;
  } else if (docType.tableTarget === "talhoes") {
    const data = Array.isArray(normalized) ? normalized : [normalized];
    const { error } = await supabase
      .from("talhoes")
      .upsert(data, { onConflict: "safra,talhao" });
    if (error) throw new Error(`Erro ao salvar talhoes: ${error.message}`);
    records = data.length;
  } else if (docType.tableTarget === "custos") {
    const data = Array.isArray(normalized) ? normalized : [normalized];
    const { error } = await supabase
      .from("custos")
      .upsert(data, { onConflict: "safra,cultura,fazenda,aplicacao" });
    if (error) throw new Error(`Erro ao salvar custos: ${error.message}`);
    records = data.length;
  } else if (docType.tableTarget === "armazem") {
    const data = Array.isArray(normalized) ? normalized : [normalized];
    const { error } = await supabase
      .from("armazem")
      .upsert(data, { onConflict: "safra,nome" });
    if (error) throw new Error(`Erro ao salvar armazem: ${error.message}`);
    records = data.length;
  } else if (docType.tableTarget === "historico") {
    const data = Array.isArray(normalized) ? normalized : [normalized];
    const { error } = await supabase
      .from("historico")
      .upsert(data, { onConflict: "safra,talhao" });
    if (error) throw new Error(`Erro ao salvar historico: ${error.message}`);
    records = data.length;
  }

  return { type: docType.tableTarget, count: records };
}

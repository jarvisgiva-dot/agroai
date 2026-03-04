import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Carregar variáveis do .env.local garantindo que o root path seja pego certo
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// ─── UTILS DE AMBIENTE ───────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const geminiKey = process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !anonKey || !folderId || !clientId || !clientSecret || !geminiKey) {
    console.error("ERRO FATAL: Variáveis de ambiente faltando no .env.local");
    process.exit(1);
}

// ─── CLIENTS ─────────────────────────────────────────────────────────────

// O adminSupabase bypassa RLS usando anonKey caso o serviceRole falhe e as grants existam
const adminSupabase = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ')
        ? process.env.SUPABASE_SERVICE_ROLE_KEY
        : anonKey
);

const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    generationConfig: { temperature: 0.1, topP: 0.8 },
});

// ─── GOOGLE DRIVE API ───────────────────────────────────────────────────

async function getStoredRefreshToken(): Promise<string> {
    const { data } = await adminSupabase
        .from("app_settings")
        .select("value")
        .eq("key", "google_drive_refresh_token")
        .single();

    if (data?.value) return data.value;
    if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN) return process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    throw new Error("Refresh Token do Google Drive não encontrado no Supabase ou env");
}

async function getAccessToken(refreshToken: string): Promise<string> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    const data = await res.json();
    if (!data.access_token) {
        throw new Error(`Falha ao renovar token Google: ${data.error_description || data.error}`);
    }
    return data.access_token;
}

/** Varredura recursiva de pastas em busca de PDFs */
async function listDriveFiles(folderId: string, accessToken: string, allFiles: any[] = []) {
    // Busca PDFs
    const pdfQuery = encodeURIComponent(`'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
    const pdfFields = encodeURIComponent("files(id,name,modifiedTime,size)");

    const pdfRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${pdfQuery}&fields=${pdfFields}&pageSize=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (pdfRes.ok) {
        const data = await pdfRes.json();
        if (data.files?.length) {
            console.log(`[Drive] +${data.files.length} PDFs encontrados numa subpasta.`);
            allFiles.push(...data.files);
        }
    }

    // Busca Pastas Filhas
    const folderQuery = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=files(id,name)&pageSize=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (folderRes.ok) {
        const data = await folderRes.json();
        if (data.files?.length) {
            for (const sub of data.files) {
                await listDriveFiles(sub.id, accessToken, allFiles);
            }
        }
    }

    return allFiles;
}

async function downloadDriveFile(fileId: string, accessToken: string): Promise<Buffer> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Erro no download: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
}

// ─── GEMINI OCR PROCESSADOR ──────────────────────────────────────────────

function extractJSON(text: string): any {
    const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
    const arr = text.match(/\[[\s\S]*\]/);
    if (arr) { const p = tryParse(arr[0]); if (p) return p; }
    const obj = text.match(/\{[\s\S]*\}/);
    if (obj) { const p = tryParse(obj[0]); if (p) return p; }
    return tryParse(text.replace(/```json/g, "").replace(/```/g, "").trim());
}

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

function detectDocumentType(fileName: string): { tableTarget: string; prompt: string } | null {
    const name = fileName.toLowerCase();
    if (name.includes("contrato") || name.includes("venda")) return {
        tableTarget: "contratos",
        prompt: `Retorne um array JSON dos contratos. Campos: safra, cultura, vendedor, comprador, quantidade_sc, valor_saco, valor_total_bruto, valor_total_liquido, data_venda (YYYY-MM-DD), situacao ("FINALIZADO", "PENDENTE", "EM ABERTO"). Limpo de formatações br (1.234,00 -> 1234.00)`,
    };
    if (name.includes("colhei") || name.includes("diario")) return {
        tableTarget: "colheita_diaria",
        prompt: `Retorne um array JSON da colheita diaria. Campos: safra, data (YYYY-MM-DD), total_colhido, area_colhida, acumulado`,
    };
    if (name.includes("talhao") || name.includes("produt")) return {
        tableTarget: "talhoes",
        prompt: `Retorne um array JSON dos prod/talhao. Campos: safra, talhao, area, total_sc, produtividade, ha_colhido, pct_colhido, status ("COLHIDO", "PARCIAL", "PENDENTE")`,
    };
    if (name.includes("custo")) return {
        tableTarget: "custos",
        prompt: `Retorne um array JSON dos custos. Campos: safra, cultura, fazenda, aplicacao, custo_reais, custo_sc_ha, custo_reais_ha`,
    };
    if (name.includes("armazem") || name.includes("estoque")) return {
        tableTarget: "armazem",
        prompt: `Retorne um array JSON de armazens. Campos: safra, nome, total_sc`,
    };
    if (name.includes("resumo") || name.includes("safra")) return {
        tableTarget: "resumo",
        prompt: `Retorne UM objeto JSON (NÃO array) do resumo safra. Campos: safra, total_colhido, area_total, area_colhida, pct_colhido, area_nao_colhida, media_geral, media_umidade, media_impureza, total_desconto, desconto_sc_ha`,
    };
    if (name.includes("historico")) return {
        tableTarget: "historico",
        prompt: `Retorne um array JSON do historico. Campos: safra, talhao, total_sc, produtividade, area`,
    };
    return null;
}

// ─── DAEMON LOOP ────────────────────────────────────────────────────────

async function startDaemon() {
    console.log("==================================================");
    console.log("🚀 AGRO AI - BACKGROUND SYNC DAEMON STARTED");
    console.log("==================================================");

    try {
        console.log("[1] Autenticando com Google Drive...");
        const refreshToken = await getStoredRefreshToken();
        const accessToken = await getAccessToken(refreshToken);

        console.log("[2] Varrimento Recursivo de Pastas (Root ID: " + folderId + ")...");
        const files = await listDriveFiles(folderId!, accessToken);
        console.log(`=> Encontrados ${files.length} PDFs na árvore total.`);

        if (files.length === 0) return;

        console.log("\n[3] Comparando Histórico do Banco de Dados...");
        const { data: existingLogs } = await adminSupabase.from("drive_sync_log").select("file_id, modified_time, status");
        const logMap = new Map((existingLogs || []).map((l: any) => [l.file_id, l]));

        let processed = 0, errors = 0, skipped = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const existing = logMap.get(file.id);
            const fileModified = new Date(file.modifiedTime);
            const alreadyProcessed = existing?.status === "success" && existing?.modified_time && new Date(existing.modified_time) >= fileModified;

            if (alreadyProcessed) {
                skipped++;
                continue;
            }

            console.log(`\n⏳ [${i + 1}/${files.length}] Baixando PDF editado/novo: ${file.name}`);

            await adminSupabase.from("drive_sync_log").upsert({
                file_id: file.id, file_name: file.name, modified_time: file.modifiedTime, status: "processing",
                drive_folder_id: folderId, file_size: parseInt(file.size || "0"), updated_at: new Date().toISOString()
            }, { onConflict: "file_id" });

            try {
                // 1. Download
                const pdfBuffer = await downloadDriveFile(file.id, accessToken);
                const docType = detectDocumentType(file.name);
                if (!docType) throw new Error("Documento não mapeado pelas regras nominais");

                console.log(`   🧠 Lendo com Inteligência Artificial Gemini (Alvo: ${docType.tableTarget})...`);

                // 2. Gemini Parse
                const result = await model.generateContent([
                    docType.prompt,
                    { inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } },
                ]);

                const parsed = extractJSON(result.response.text());
                if (!parsed) throw new Error("Gemini retornou lixo/unparsable");

                const normalized = normalizeNumbers(parsed);

                // 3. Insert in Supabase
                console.log(`   💾 Executando Inserção Supabase...`);
                let records = 0;

                if (docType.tableTarget === "resumo") {
                    const dataObj = Array.isArray(normalized) ? normalized[0] : normalized;
                    if (!dataObj?.safra) throw new Error("Safra não preenchida");
                    const { error } = await adminSupabase.from("resumo").upsert({ ...dataObj, updated_at: new Date().toISOString() }, { onConflict: "safra" });
                    if (error) throw error;
                    records = 1;
                } else {
                    const data = Array.isArray(normalized) ? normalized : [normalized];
                    let conflictKey = "safra";
                    if (docType.tableTarget === "colheita_diaria") conflictKey = "safra,data";
                    if (docType.tableTarget === "talhoes" || docType.tableTarget === "historico") conflictKey = "safra,talhao";
                    if (docType.tableTarget === "custos") conflictKey = "safra,cultura,fazenda,aplicacao";
                    if (docType.tableTarget === "armazem") conflictKey = "safra,nome";

                    const { error } = await adminSupabase.from(docType.tableTarget).upsert(data, { onConflict: conflictKey });
                    // Tratando contratos separadamente pois insert simples
                    if (docType.tableTarget === 'contratos') {
                        const { error: errInsert } = await adminSupabase.from("contratos").insert(data);
                        if (errInsert) throw errInsert;
                    } else if (error) throw error;

                    records = data.length;
                }

                // 4. Mark Success
                await adminSupabase.from("drive_sync_log").upsert({
                    file_id: file.id, file_name: file.name, modified_time: file.modifiedTime, status: "success",
                    records_processed: records, file_type: docType.tableTarget, error_message: null,
                    drive_folder_id: folderId, file_size: parseInt(file.size || "0"), processed_at: new Date().toISOString(), updated_at: new Date().toISOString()
                }, { onConflict: "file_id" });

                console.log(`   ✅ SUCESSO! ${records} linhas injetadas no banco de dados.`);
                processed++;

            } catch (err: any) {
                console.error(`   ❌ ERRO: ${err.message}`);
                errors++;
                await adminSupabase.from("drive_sync_log").upsert({
                    file_id: file.id, file_name: file.name, modified_time: file.modifiedTime, status: "error",
                    error_message: err.message, drive_folder_id: folderId, file_size: parseInt(file.size || "0"), updated_at: new Date().toISOString()
                }, { onConflict: "file_id" });
            }
        }

        console.log(`\n==================================================`);
        console.log(`🏁 DAEMON FINALIZADO - Resumo do Turno:`);
        console.log(`   ⏭️ Ignorados (Inalterados) : ${skipped}`);
        console.log(`   ✅ Processados com Sucesso : ${processed}`);
        console.log(`   ❌ Falhas                  : ${errors}`);
        console.log(`==================================================\n`);

    } catch (gErr: any) {
        console.error("ERRO CRÍTICO NO DAEMON:", gErr.message || gErr);
    }
}

// Execute daemon
startDaemon().then(() => process.exit(0)).catch(() => process.exit(1));

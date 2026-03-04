/**
 * /api/drive/sync/route.ts  (v2 - OAuth via conta Google do admin)
 *
 * Esta versão usa o OAuth da conta Google do admin (jarvisgiva@gmail.com)
 * em vez de Service Account. O refresh_token é salvo automaticamente
 * quando o admin faz login com Google no app.
 *
 * COMO FUNCIONA:
 * 1. Admin faz login no app com Google → NextAuth salva o refresh_token no Supabase
 * 2. Este endpoint usa o refresh_token para obter um novo access_token
 * 3. Usa o access_token para listar e baixar PDFs da pasta do Drive
 * 4. Processa cada PDF com Gemini AI e salva no Supabase
 *
 * VARIÁVEIS DE AMBIENTE NECESSÁRIAS (.env.local):
 * - GOOGLE_CLIENT_ID         → Google OAuth Client ID (já deve existir para o login Google)
 * - GOOGLE_CLIENT_SECRET     → Google OAuth Client Secret (já deve existir)
 * - GOOGLE_DRIVE_FOLDER_ID   → ID da pasta "fazendas" no Google Drive
 *                              (extraiu da URL: drive.google.com/drive/folders/ESSE_ID_AQUI)
 * - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → já configurados
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processPdfBuffer } from "@/lib/drive-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── Supabase Service Client ───────────────────────────────────────────────────

function getServiceSupabase() {
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50)
        ? process.env.SUPABASE_SERVICE_ROLE_KEY
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey
    );
}

// ─── OAuth Token Management ────────────────────────────────────────────────────

/** 
 * Busca o refresh_token do admin salvo no Supabase (gravado pelo NextAuth no login).
 * Se não encontrar no Supabase, tenta usar a variável de ambiente como fallback.
 */
async function getStoredRefreshToken(): Promise<string> {
    const supabase = getServiceSupabase();

    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "google_drive_refresh_token")
        .single();

    if (data?.value) return data.value;

    // Fallback: variável de ambiente (caso o admin não tenha logado ainda)
    const envToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    if (envToken) return envToken;

    throw new Error(
        "Token do Google Drive não encontrado. " +
        "Faça login no app com sua conta Google (jarvisgiva@gmail.com) para autorizar o acesso ao Drive, " +
        "ou adicione GOOGLE_DRIVE_REFRESH_TOKEN no .env.local."
    );
}

/** Troca o refresh_token por um novo access_token usando o OAuth do Google */
async function getAccessToken(refreshToken: string): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados no .env.local");
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    const data = await res.json();

    if (!data.access_token) {
        const err = data.error_description || data.error || JSON.stringify(data);
        throw new Error(`Falha ao renovar token Google: ${err}`);
    }

    return data.access_token;
}

// ─── Google Drive API ───────────────────────────────────────────────────────────

/** Lista recursivamente todos os PDFs na hierarquia da pasta especificada */
async function listDriveFiles(folderId: string, accessToken: string, allFiles: any[] = []) {
    // 1. Busca todos os PDFs nesta pasta
    const pdfQuery = encodeURIComponent(
        `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`
    );
    const pdfFields = encodeURIComponent("files(id,name,modifiedTime,size)");

    const pdfRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${pdfQuery}&fields=${pdfFields}&pageSize=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (pdfRes.ok) {
        const data = await pdfRes.json();
        if (data.files && data.files.length > 0) {
            allFiles.push(...data.files);
        }
    } else {
        const err = await pdfRes.text();
        console.error(`Erro ao listar PDFs do Drive: ${err}`);
    }

    // 2. Busca subpastas
    const folderQuery = encodeURIComponent(
        `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const folderFields = encodeURIComponent("files(id,name)");

    const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=${folderFields}&pageSize=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (folderRes.ok) {
        const data = await folderRes.json();
        if (data.files && data.files.length > 0) {
            // Recursividade sequencial (pode ser paralisada com Promise.all para performance)
            for (const subFolder of data.files) {
                await listDriveFiles(subFolder.id, accessToken, allFiles);
            }
        }
    }

    return allFiles as Array<{
        id: string;
        name: string;
        modifiedTime: string;
        size: string;
    }>;
}

/** Baixa um arquivo do Drive como Buffer */
async function downloadDriveFile(fileId: string, accessToken: string): Promise<Buffer> {
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Erro ao baixar arquivo ${fileId}: ${err}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// ─── Main Handlers ───────────────────────────────────────────────────────────────

/** POST: Executa a sincronização */
export async function POST(req: NextRequest) {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        return NextResponse.json(
            {
                error: "GOOGLE_DRIVE_FOLDER_ID não configurado",
                help: "Adicione o ID da pasta 'fazendas' no .env.local. Exemplo: GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOp",
                howToFind: "Abra a pasta no Google Drive. O ID está na URL: drive.google.com/drive/folders/ESSE_VALOR",
            },
            { status: 500 }
        );
    }

    const supabase = getServiceSupabase();
    const results: any[] = [];
    let processed = 0, errors = 0, skipped = 0;

    try {
        // 1. Obtém token de acesso do Google
        const refreshToken = await getStoredRefreshToken();
        const accessToken = await getAccessToken(refreshToken);

        // 2. Lista PDFs na pasta
        const files = await listDriveFiles(folderId, accessToken);

        if (files.length === 0) {
            return NextResponse.json({
                success: true,
                message: "Nenhum PDF encontrado na pasta do Drive",
                processed: 0, skipped: 0, errors: 0, results: [],
            });
        }

        // 3. Busca log existente
        const { data: existingLogs } = await supabase
            .from("drive_sync_log")
            .select("file_id, modified_time, status");

        const logMap = new Map(
            (existingLogs || []).map((l: any) => [l.file_id, l])
        );

        // 4. Processa cada arquivo
        for (const file of files) {
            const existing = logMap.get(file.id);
            const fileModified = new Date(file.modifiedTime);
            const alreadyProcessed =
                existing?.status === "success" &&
                existing?.modified_time &&
                new Date(existing.modified_time) >= fileModified;

            if (alreadyProcessed) {
                skipped++;
                results.push({ file: file.name, status: "skipped", reason: "sem alterações" });
                continue;
            }

            // Marca como "processing"
            await supabase.from("drive_sync_log").upsert(
                {
                    file_id: file.id,
                    file_name: file.name,
                    modified_time: file.modifiedTime,
                    status: "processing",
                    drive_folder_id: folderId,
                    file_size: parseInt(file.size || "0"),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "file_id" }
            );

            try {
                const pdfBuffer = await downloadDriveFile(file.id, accessToken);
                const { type, count } = await processPdfBuffer(pdfBuffer, file.name);

                await supabase.from("drive_sync_log").upsert(
                    {
                        file_id: file.id,
                        file_name: file.name,
                        modified_time: file.modifiedTime,
                        status: "success",
                        records_processed: count,
                        file_type: type,
                        error_message: null,
                        drive_folder_id: folderId,
                        file_size: parseInt(file.size || "0"),
                        processed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "file_id" }
                );

                processed++;
                results.push({ file: file.name, status: "success", type, records: count });
            } catch (fileError: any) {
                errors++;
                await supabase.from("drive_sync_log").upsert(
                    {
                        file_id: file.id,
                        file_name: file.name,
                        modified_time: file.modifiedTime,
                        status: "error",
                        error_message: fileError.message,
                        drive_folder_id: folderId,
                        file_size: parseInt(file.size || "0"),
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "file_id" }
                );
                results.push({ file: file.name, status: "error", error: fileError.message });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sync concluído: ${processed} processados, ${skipped} ignorados, ${errors} erros`,
            processed, skipped, errors, total: files.length, results,
        });
    } catch (error: any) {
        console.error("[Drive Sync] Erro:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/** GET: Status do sync */
export async function GET() {
    const supabase = getServiceSupabase();

    const { data: logs, error } = await supabase
        .from("drive_sync_log")
        .select("*")
        .order("processed_at", { ascending: false })
        .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const stats = {
        total: logs?.length || 0,
        success: logs?.filter((l: any) => l.status === "success").length || 0,
        error: logs?.filter((l: any) => l.status === "error").length || 0,
        processing: logs?.filter((l: any) => l.status === "processing").length || 0,
        lastSync: logs?.[0]?.processed_at || null,
    };

    return NextResponse.json({ stats, logs });
}

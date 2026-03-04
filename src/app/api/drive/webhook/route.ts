import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processPdfBuffer } from "@/lib/drive-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Tempo máximo permitido pela Vercel Pro/Hobby

// ─── UTILS DE AMBIENTE ───────────────────────────────────────────────────

function getServiceSupabase() {
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50)
        ? process.env.SUPABASE_SERVICE_ROLE_KEY
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey
    );
}

// ─── OAUTH E ACESSO ──────────────────────────────────────────────────────

async function getStoredRefreshToken(): Promise<string> {
    const supabase = getServiceSupabase();
    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "google_drive_refresh_token")
        .single();

    if (data?.value) return data.value;

    const envToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    if (envToken) return envToken;

    throw new Error("Token do Google Drive não encontrado. O Webhook falhou por falta de Refresh Token.");
}

async function getAccessToken(refreshToken: string): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados.");
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
    if (!data.access_token) throw new Error("Falha ao renovar token Google via Webhook");
    return data.access_token;
}

// ─── VARREDURA DO GOOGLE DRIVE ──────────────────────────────────────────

async function listDriveFiles(folderId: string, accessToken: string, allFiles: any[] = []) {
    const pdfQuery = encodeURIComponent(`'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
    const pdfFields = encodeURIComponent("files(id,name,modifiedTime,size)");

    const pdfRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${pdfQuery}&fields=${pdfFields}&pageSize=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (pdfRes.ok) {
        const data = await pdfRes.json();
        if (data.files?.length > 0) allFiles.push(...data.files);
    }

    const folderQuery = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const folderFields = encodeURIComponent("files(id,name)");

    const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=${folderFields}&pageSize=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (folderRes.ok) {
        const data = await folderRes.json();
        if (data.files?.length > 0) {
            for (const subFolder of data.files) {
                await listDriveFiles(subFolder.id, accessToken, allFiles);
            }
        }
    }

    return allFiles;
}

async function downloadDriveFile(fileId: string, accessToken: string): Promise<Buffer> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Google Drive rejeitou o download do arquivo ID: ${fileId}`);
    return Buffer.from(await res.arrayBuffer());
}

// ─── ENDPOINT PRINCIPAL (WEBHOOK) ──────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        // 1. Verificação de Segurança (Impede acesso indevido da internet)
        const secretHeader = req.headers.get("x-webhook-secret");
        const configuredSecret = process.env.WEBHOOK_SECRET;

        if (!configuredSecret || secretHeader !== configuredSecret) {
            return NextResponse.json({ error: "Acesso Negado. Falha na autenticação do Webhook." }, { status: 401 });
        }

        const supabase = getServiceSupabase();

        // 2. Renovar Credenciais em Background
        const refreshToken = await getStoredRefreshToken();
        const accessToken = await getAccessToken(refreshToken);

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) return NextResponse.json({ error: "ID da pasta raiz ausente" }, { status: 500 });

        // 3. Varrer Árvore Inteira
        const files = await listDriveFiles(folderId, accessToken);
        if (files.length === 0) {
            return NextResponse.json({ message: "Nenhum PDF encontrado na árvore", processed: 0 });
        }

        // 4. Checar Banco e Filtrar APENAS o que for novo/editado
        const { data: logsData } = await supabase.from("drive_sync_log").select("file_id, modified_time, status, error_message");
        const handledMap = new Map((logsData || []).map((l) => [l.file_id, l]));

        const toProcess = files.filter(f => {
            const history = handledMap.get(f.id);
            const driveDate = new Date(f.modifiedTime);

            // Re-tenta se deu erro antes
            if (history?.status === 'error') return true;
            // Pula se já foi salvo e a data no drive ainda é velha
            const historyDate = new Date(history?.modified_time || 0);
            return historyDate < driveDate;
        });

        if (toProcess.length === 0) {
            return NextResponse.json({ message: "Todos os arquivos já estão sincronizados.", processed: 0, scanned: files.length });
        }

        let successCount = 0;
        let errorsCount = 0;
        const processDetails = [];

        // 5. Ingerir Dados Novos/Modificados via OCR Gemini
        for (const file of toProcess) {
            try {
                // Marca como 'processing' pra evitar duplo webhook atacando o mesmo arquivo
                await supabase.from("drive_sync_log").upsert({
                    file_id: file.id, file_name: file.name, modified_time: file.modifiedTime, status: "processing",
                    drive_folder_id: folderId, file_size: parseInt(file.size || "0"), updated_at: new Date().toISOString()
                }, { onConflict: "file_id" });

                const pdfBuffer = await downloadDriveFile(file.id, accessToken);
                const result = await processPdfBuffer(pdfBuffer, file.name);

                // Marca sucesso 
                await supabase.from("drive_sync_log").upsert({
                    file_id: file.id, file_name: file.name, modified_time: file.modifiedTime, status: "success",
                    records_processed: result.count, file_type: result.type, error_message: null,
                    drive_folder_id: folderId, file_size: parseInt(file.size || "0"), processed_at: new Date().toISOString(), updated_at: new Date().toISOString()
                }, { onConflict: "file_id" });

                successCount++;
                processDetails.push({ file: file.name, status: 'ok', records: result.count });
            } catch (err: any) {
                // Marca erro
                await supabase.from("drive_sync_log").upsert({
                    file_id: file.id, file_name: file.name, modified_time: file.modifiedTime, status: "error",
                    error_message: err.message, drive_folder_id: folderId, file_size: parseInt(file.size || "0"), updated_at: new Date().toISOString()
                }, { onConflict: "file_id" });

                errorsCount++;
                processDetails.push({ file: file.name, status: 'error', reason: err.message });
            }
        }

        // Return do Webhook (Resposta vai pro Google Apps Script)
        return NextResponse.json({
            message: "Webhook executado com sucesso",
            scanned: files.length,
            processed: successCount,
            errors: errorsCount,
            details: processDetails
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Falha estrutural no Webhook" }, { status: 500 });
    }
}

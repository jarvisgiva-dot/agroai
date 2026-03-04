/**
 * /api/drive/connect/route.ts
 *
 * API para gerenciar a conexão com o Google Drive do admin.
 * 
 * GET  → Retorna o status da conexão atual
 * POST → Salva manualmente um refresh_token fornecido
 * DELETE → Remove a conexão (apaga o token)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService as supabase } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

// GET: Verifica se já existe token salvo e se ele é válido

/** GET: Verifica se já existe token salvo e se ele é válido */
export async function GET() {
    // Verifica token no banco
    const { data: dbToken } = await supabase
        .from("app_settings")
        .select("value, updated_at")
        .eq("key", "google_drive_refresh_token")
        .single();

    const hasDbToken = !!dbToken?.value;
    const hasEnvToken = !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    const hasFolderId = !!process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Se temos um token, tenta validá-lo buscando o perfil do usuário
    if (hasDbToken || hasEnvToken) {
        try {
            const refreshToken = dbToken?.value || process.env.GOOGLE_DRIVE_REFRESH_TOKEN!;
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID || "",
                    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
                    refresh_token: refreshToken,
                    grant_type: "refresh_token",
                }),
            });
            const tokenData = await tokenRes.json();

            if (tokenData.access_token) {
                // Token válido — busca info do usuário conectado
                const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                });
                const userInfo = await userRes.json();

                return NextResponse.json({
                    connected: true,
                    source: hasDbToken ? "database" : "env",
                    email: userInfo.email || "desconhecido",
                    name: userInfo.name || "",
                    picture: userInfo.picture || null,
                    hasFolderId,
                    tokenUpdatedAt: dbToken?.updated_at || null,
                });
            }
        } catch (e) {
            // Token inválido
        }
    }

    return NextResponse.json({
        connected: false,
        hasFolderId,
        source: null,
        email: null,
        instructions: [
            "Faça login no app com Google (usando jarvisgiva@gmail.com)",
            "O sistema salvará o token de acesso automaticamente",
            "Então adicione GOOGLE_DRIVE_FOLDER_ID no .env.local",
        ],
    });
}

/** POST: Salva um refresh_token manualmente */
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
        return NextResponse.json({ error: "refreshToken é obrigatório" }, { status: 400 });
    }

    const { error } = await supabase.from("app_settings").upsert({
        key: "google_drive_refresh_token",
        value: refreshToken,
        updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: "Token salvo com sucesso" });
}

/** DELETE: Remove o token de conexão */
export async function DELETE() {
    await supabase.from("app_settings").delete().eq("key", "google_drive_refresh_token");
    return NextResponse.json({ success: true, message: "Conexão Drive removida" });
}

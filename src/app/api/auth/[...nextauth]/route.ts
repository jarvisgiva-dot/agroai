import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Force Node.js runtime (NextAuth doesn't work with Edge)
export const runtime = 'nodejs';

export const authOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: [
                        "openid",
                        "email",
                        "profile",
                        "https://www.googleapis.com/auth/calendar",
                        "https://www.googleapis.com/auth/drive.readonly",  // Ler arquivos do Drive
                    ].join(" "),
                    access_type: "offline",
                    prompt: "consent", // Força envio de refreshToken em todas as tentativas
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account }: any) {
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
                // Salva o refreshToken do Drive para uso em sync automático
                if (account.refresh_token) {
                    // console.log("SALVANDO NOVO REFRESH TOKEN NO BANCO", account.refresh_token.substring(0, 10))
                    const { createClient } = await import('@supabase/supabase-js');
                    // Use a Anon Key publicamente caso a Role Key ainda esteja com o template do .env.local
                    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ')
                        ? process.env.SUPABASE_SERVICE_ROLE_KEY
                        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

                    const adminSupabase = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        serviceKey
                    );

                    // Salva o token em uma tabela de configurações
                    try {
                        await adminSupabase.from('app_settings').upsert({
                            key: 'google_drive_refresh_token',
                            value: account.refresh_token,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'key' });
                    } catch (e) {
                        console.error('Falha silenciosa ao salvar refresh token no bd:', e);
                    }
                } else {
                    // console.log("GOOGLE NÃO DEVOLVEU REFRESH TOKEN! (O usuário já havia autorizado e não usamos consent: true)")
                }
            }
            return token;
        },
        async session({ session, token }: any) {
            session.accessToken = token.accessToken;
            session.refreshToken = token.refreshToken;
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

import { createClient } from '@supabase/supabase-js';

/**
 * Utilitário centralizado para criar um cliente Supabase com a Service Role Key.
 * Inclui fallbacks para evitar erros "supabaseUrl is required" durante o build da Vercel.
 */
export function getServiceSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Se estivermos em build e as chaves não existirem, usamos placeholders
    // Isso evita que o Next.js quebre ao tentar coletar metadados das páginas
    const finalUrl = supabaseUrl || 'https://placeholder-url.supabase.co';
    const finalKey = supabaseServiceKey || 'placeholder-key';

    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('⚠️ Supabase Service Role config missing - using placeholders for build time.');
    }

    return createClient(finalUrl, finalKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
}

// Cliente padrão para uso geral no backend
export const supabaseService = getServiceSupabase();

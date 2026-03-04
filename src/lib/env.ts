/**
 * Environment variables validation and type-safe access
 * This ensures all required env vars exist at startup and provides type safety
 */

import { z } from 'zod'

// Client-side schema (only NEXT_PUBLIC_ vars available)
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY é obrigatória'),
  GEMINI_MODEL: z.string().optional().default('gemini-2.0-flash-exp'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
})

// Server-side schema (all vars available)
const serverEnvSchema = clientEnvSchema.extend({
  GOOGLE_API_KEY: z.string().min(1, 'GOOGLE_API_KEY é obrigatória'),
})

function validateEnv() {
  const isServer = typeof window === 'undefined'
  const schema = isServer ? serverEnvSchema : clientEnvSchema

  const result = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    NODE_ENV: process.env.NODE_ENV,
  })

  if (!result.success) {
    console.error('❌ Erro de configuração de variáveis de ambiente:')
    console.error(result.error.flatten().fieldErrors)
    throw new Error(
      '❌ Variáveis de ambiente não configuradas!\n\n' +
      'Crie um arquivo .env.local na raiz do projeto com:\n\n' +
      'NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima\n' +
      (isServer ? 'GOOGLE_API_KEY=sua-chave-do-google\n' : '') +
      'GEMINI_MODEL=gemini-2.0-flash-exp (opcional)\n'
    )
  }

  return result.data
}

export const env = validateEnv()

// Type-safe environment variables
export type Env = z.infer<typeof serverEnvSchema>

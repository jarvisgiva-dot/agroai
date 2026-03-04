
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env vars manually since we are running a standalone script
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath))
    for (const k in envConfig) {
        process.env[k] = envConfig[k]
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function calculateProduction() {
    const { data: production, error } = await supabase
        .from('produtividade_colheita')
        .select('*')
        .eq('safra', '2024/2025')

    if (error) {
        console.error('Error fetching production:', error)
        return
    }

    const sojaProduction = production.filter((p: any) =>
        p.cultura?.toLowerCase().includes('soja')
    )

    const totalSacas = sojaProduction.reduce((sum: number, p: any) => sum + (p.producao_liquida_sacas || 0), 0)

    console.log(`Safra 2024/2025 - Soja:`)
    console.log(`  Total Produzido: ${Math.round(totalSacas).toLocaleString('pt-BR')} sacas`)
}

calculateProduction()

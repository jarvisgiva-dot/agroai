
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

async function calculateAvg() {
    const { data: contracts, error } = await supabase
        .from('contratos_venda')
        .select('*')

    if (error) {
        console.error('Error fetching contracts:', error)
        return
    }

    const sojaContracts = contracts.filter((c: any) =>
        c.cultura?.toLowerCase().includes('soja') &&
        c.preco_por_saca &&
        c.qtd_contrato_sacas
    )

    // Group by Safra
    const safras = [...new Set(sojaContracts.map((c: any) => c.safra))]

    safras.forEach(safra => {
        const safraContracts = sojaContracts.filter((c: any) => c.safra === safra)
        const totalQuantity = safraContracts.reduce((sum: number, c: any) => sum + (c.qtd_contrato_sacas || 0), 0)
        const weightedSum = safraContracts.reduce((sum: number, c: any) => sum + ((c.preco_por_saca || 0) * (c.qtd_contrato_sacas || 0)), 0)

        const avgPrice = totalQuantity > 0 ? weightedSum / totalQuantity : 0

        console.log(`Safra ${safra}:`)
        console.log(`  Total Sacas: ${totalQuantity.toLocaleString()}`)
        console.log(`  Preço Médio Ponderado: ${avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
    })
}

calculateAvg()

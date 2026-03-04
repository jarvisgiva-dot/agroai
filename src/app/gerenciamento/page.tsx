import { createClient } from '@supabase/supabase-js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientWrapper } from './ClientWrapper'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const dynamic = 'force-dynamic'

async function getData() {
    const [produtividade, contratos, estoqueInsumos, estoqueGraos, marketPrices] = await Promise.all([
        supabase.from('produtividade_colheita').select('*').order('id', { ascending: false }),
        supabase.from('contratos_venda').select('*').order('id', { ascending: false }),
        supabase.from('estoque_insumos').select('*').order('id', { ascending: false }),
        supabase.from('estoque_graos_armazenagem').select('*').order('id', { ascending: false }),
        supabase.from('market_prices').select('*').order('date_reference', { ascending: false }),
    ])

    return {
        produtividade: produtividade.data || [],
        contratos: contratos.data || [],
        estoqueInsumos: estoqueInsumos.data || [],
        estoqueGraos: estoqueGraos.data || [],
        marketPrices: marketPrices.data || [],
    }
}

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

// ... imports

export default async function GerenciamentoPage() {
    const data = await getData()

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div className="flex flex-col space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Gerenciamento de Dados</h1>
                    <p className="text-gray-500">
                        Visualize, adicione ou remova registros manualmente do banco de dados.
                    </p>
                </div>

                <ClientWrapper data={data} />
            </div>
        </DashboardLayout>
    )
}

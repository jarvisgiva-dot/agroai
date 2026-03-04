import { NextResponse } from 'next/server';
import { supabaseService as supabase } from '@/lib/supabase-service';

export async function GET() {
    // Get ALL contracts to debug connection
    console.log("Debug Route: Fetching contracts...");

    const { data: contracts, error } = await supabase
        .from('contratos_venda')
        .select('*')
        .limit(10);

    if (error) {
        console.error("Debug Route Error:", error);
    } else {
        console.log("Debug Route Success:", contracts?.length, "contracts found");
    }

    // Filter for 2025 (rough check)
    const contracts2025 = contracts?.filter(c => c.data_recebimento?.includes('2025')) || [];

    return NextResponse.json({
        total: contracts?.length || 0,
        contracts2025: contracts2025.map(c => ({
            numero: c.numero_contrato,
            cliente: c.cliente_comprador,
            nome_comprador: c.nome_comprador,
            nome_vendedor: c.nome_vendedor,
            empresa: c.empresa_vendedora,
            recebimento: c.data_recebimento,
            valor: c.valor_total_liquido
        }))
    });
}

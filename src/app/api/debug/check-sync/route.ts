import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get ALL contracts to debug connection
    console.log("Debug Route: Fetching contracts...");
    console.log("Supabase URL:", supabaseUrl ? "Defined" : "Missing");

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

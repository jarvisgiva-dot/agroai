import { NextResponse } from 'next/server';
import { supabaseService as supabase } from '@/lib/supabase-service';

export async function GET() {
    // Get all unique cultura values
    const { data: allContracts } = await supabase
        .from('contratos_venda')
        .select('cultura, numero_contrato, data_vencimento')
        .not('data_vencimento', 'is', null);

    const uniqueCulturas = [...new Set(allContracts?.map(c => c.cultura) || [])];

    return NextResponse.json({
        total: allContracts?.length || 0,
        uniqueCulturas,
        sampleContracts: allContracts?.slice(0, 5).map(c => ({
            numero: c.numero_contrato,
            cultura: c.cultura,
            culturaTipo: typeof c.cultura,
            vencimento: c.data_vencimento
        }))
    });
}

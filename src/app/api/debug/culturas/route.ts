import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

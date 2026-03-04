import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: allContracts } = await supabase
        .from('contratos_venda')
        .select('numero_contrato, data_recebimento, cliente_comprador, preco_por_saca, qtd_contrato_sacas');

    const contractsWithDates = allContracts?.filter(c => c.data_recebimento) || [];

    return NextResponse.json({
        total: allContracts?.length || 0,
        withPaymentDate: contractsWithDates.length,
        contracts: contractsWithDates.map(c => ({
            numero: c.numero_contrato,
            data: c.data_recebimento,
            cliente: c.cliente_comprador,
            valor: (c.preco_por_saca || 0) * (c.qtd_contrato_sacas || 0)
        }))
    });
}

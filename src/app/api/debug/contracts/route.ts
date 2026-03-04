import { NextResponse } from 'next/server';
import { supabaseService as supabase } from '@/lib/supabase-service';

export async function GET() {
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

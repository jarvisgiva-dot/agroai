
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: inventory, error } = await supabase
        .from('estoque_insumos')
        .select('id, nome_produto')
        .order('id', { ascending: true });

    if (error) return NextResponse.json({ error });

    const dieselItem = inventory.find(i => i.nome_produto.toLowerCase().includes('diesel'));
    const index = dieselItem ? inventory.findIndex(i => i.id === dieselItem.id) : -1;

    return NextResponse.json({
        total: inventory.length,
        dieselFound: !!dieselItem,
        dieselIndex: index,
        dieselItem
    });
}

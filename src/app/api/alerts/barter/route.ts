import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ error: 'Email is required to fetch alerts' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('barter_alerts')
            .select('*')
            .eq('email', email);

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching barter alerts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { input_product, commodity_product, target_ratio, email, is_active } = body;

        if (!input_product || !commodity_product || !target_ratio || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if alert already exists for this combination
        const { data: existing } = await supabase
            .from('barter_alerts')
            .select('id')
            .eq('input_product', input_product)
            .eq('commodity_product', commodity_product)
            .eq('email', email)
            .single();

        let result;
        if (existing) {
            // Update
            result = await supabase
                .from('barter_alerts')
                .update({ target_ratio, is_active, created_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            // Insert
            result = await supabase
                .from('barter_alerts')
                .insert({ input_product, commodity_product, target_ratio, email, is_active: is_active ?? true })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Error saving barter alert:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

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
            .from('price_alerts')
            .select('*')
            .eq('email', email);

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching alerts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { product, threshold_percent, email, is_active } = body;

        if (!product || !threshold_percent || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if alert already exists for this product/email
        const { data: existing } = await supabase
            .from('price_alerts')
            .select('id')
            .eq('product', product)
            .eq('email', email)
            .single();

        let result;
        if (existing) {
            // Update
            result = await supabase
                .from('price_alerts')
                .update({ threshold_percent, is_active, created_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            // Insert
            result = await supabase
                .from('price_alerts')
                .insert({ product, threshold_percent, email, is_active: is_active ?? true })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Error saving alert:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

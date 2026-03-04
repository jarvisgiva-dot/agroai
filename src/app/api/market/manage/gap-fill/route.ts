import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { product } = body;

        if (!product) {
            return NextResponse.json({ error: 'Product is required' }, { status: 400 });
        }

        // 1. Fetch all existing data for the product
        const { data: existingData, error } = await supabase
            .from('market_prices')
            .select('*')
            .eq('product', product)
            .order('date_reference', { ascending: true });

        if (error) throw error;
        if (!existingData || existingData.length < 2) {
            return NextResponse.json({ message: 'Not enough data to fill gaps' });
        }

        const dataMap = new Map();
        existingData.forEach(item => {
            // Normalize date to YYYY-MM-DD
            const dateStr = new Date(item.date_reference).toISOString().split('T')[0];
            dataMap.set(dateStr, item);
        });

        const startDate = new Date(existingData[0].date_reference);
        const endDate = new Date(existingData[existingData.length - 1].date_reference);

        const toInsert = [];
        const currentDate = new Date(startDate);

        // 2. Iterate through all days
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];

            if (!dataMap.has(dateStr)) {
                // Gap found! Find prev and next
                let prevItem = null;
                let nextItem = null;

                // Search backwards
                const tempPrev = new Date(currentDate);
                while (!prevItem && tempPrev >= startDate) {
                    tempPrev.setDate(tempPrev.getDate() - 1);
                    const prevStr = tempPrev.toISOString().split('T')[0];
                    if (dataMap.has(prevStr)) prevItem = dataMap.get(prevStr);
                }

                // Search forwards
                const tempNext = new Date(currentDate);
                while (!nextItem && tempNext <= endDate) {
                    tempNext.setDate(tempNext.getDate() + 1);
                    const nextStr = tempNext.toISOString().split('T')[0];
                    if (dataMap.has(nextStr)) nextItem = dataMap.get(nextStr);
                }

                if (prevItem && nextItem) {
                    // Linear Interpolation
                    const prevDate = new Date(prevItem.date_reference);
                    const nextDate = new Date(nextItem.date_reference);
                    const totalDays = (nextDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);
                    const daysFromPrev = (currentDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);

                    const priceDiff = nextItem.price - prevItem.price;
                    const interpolatedPrice = prevItem.price + (priceDiff * (daysFromPrev / totalDays));

                    toInsert.push({
                        date_reference: dateStr,
                        product: product,
                        price: Number(interpolatedPrice.toFixed(2)),
                        currency: prevItem.currency, // Assume same currency
                        unit: prevItem.unit,         // Assume same unit
                        source_type: 'MANUAL'
                    });
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // 3. Insert filled gaps
        if (toInsert.length > 0) {
            // Insert in batches of 100 to be safe
            for (let i = 0; i < toInsert.length; i += 100) {
                const batch = toInsert.slice(i, i + 100);
                const { error: insertError } = await supabase
                    .from('market_prices')
                    .insert(batch);

                if (insertError) throw insertError;
            }
        }

        return NextResponse.json({
            message: 'Gaps filled successfully',
            count: toInsert.length
        });

    } catch (error: any) {
        console.error('Gap fill error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

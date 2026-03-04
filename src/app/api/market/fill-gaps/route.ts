import { NextResponse } from 'next/server';
import { addMonths, differenceInMonths, parseISO, format } from 'date-fns';
import { supabaseService as supabase } from '@/lib/supabase-service';

export async function POST() {
    try {
        // 1. Fetch all market prices
        const { data: allPrices, error } = await supabase
            .from('market_prices')
            .select('*')
            .order('date_reference', { ascending: true });

        if (error) throw error;

        // 2. Group by product
        const pricesByProduct: Record<string, any[]> = {};
        allPrices.forEach(item => {
            if (!pricesByProduct[item.product]) {
                pricesByProduct[item.product] = [];
            }
            pricesByProduct[item.product].push(item);
        });

        const newRecords = [];

        // 3. Iterate products and find gaps
        for (const product in pricesByProduct) {
            const prices = pricesByProduct[product];

            for (let i = 0; i < prices.length - 1; i++) {
                const current = prices[i];
                const next = prices[i + 1];

                const currentDate = parseISO(current.date_reference);
                const nextDate = parseISO(next.date_reference);

                const monthsDiff = differenceInMonths(nextDate, currentDate);

                // If gap is greater than 1 month (e.g., Jan to Mar is 2 months diff, so 1 missing month)
                if (monthsDiff > 1) {
                    const avgPrice = (Number(current.price) + Number(next.price)) / 2;

                    // Fill all missing months
                    for (let j = 1; j < monthsDiff; j++) {
                        const missingDate = addMonths(currentDate, j);

                        // Check if record already exists (double check to avoid duplicates)
                        const exists = prices.find(p => p.date_reference === format(missingDate, 'yyyy-MM-dd'));

                        if (!exists) {
                            newRecords.push({
                                product: product,
                                date_reference: format(missingDate, 'yyyy-MM-dd'),
                                price: avgPrice,
                                currency: current.currency, // Assume same currency
                                unit: current.unit,
                                source_type: 'ESTIMATED'
                            });
                        }
                    }
                }
            }
        }

        // 4. Insert new records
        if (newRecords.length > 0) {
            const { error: insertError } = await supabase
                .from('market_prices')
                .insert(newRecords);

            if (insertError) throw insertError;
        }

        return NextResponse.json({
            success: true,
            message: `Filled ${newRecords.length} missing records.`,
            count: newRecords.length
        });

    } catch (error: any) {
        console.error('Error filling gaps:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch prices and exchange rates in parallel
        const [pricesRes, ratesRes] = await Promise.all([
            supabase.from('market_prices').select('*').order('date_reference', { ascending: true }),
            supabase.from('exchange_rates').select('*').order('date', { ascending: true })
        ]);

        if (pricesRes.error) throw pricesRes.error;
        if (ratesRes.error) throw ratesRes.error;

        const prices = pricesRes.data;
        const rates = ratesRes.data;

        // Create Exchange Rate Map (Date -> Rate)
        const ratesMap = new Map<string, number>();
        rates.forEach(r => {
            const d = new Date(r.date).toISOString().split('T')[0];
            ratesMap.set(d, r.rate_sell);
        });

        // Helper to get rate (with simple fallback to previous known rate)
        let lastKnownRate = 5.0; // Fallback default
        const getRate = (date: string) => {
            if (ratesMap.has(date)) {
                lastKnownRate = ratesMap.get(date)!;
                return lastKnownRate;
            }
            return lastKnownRate;
        };

        // Process data
        const rawDataByDate: Record<string, any> = {};
        const allDatesSet = new Set<string>();

        // 1. Add dates from prices
        prices.forEach((item: any) => {
            const date = new Date(item.date_reference).toISOString().split('T')[0];
            allDatesSet.add(date);

            if (!rawDataByDate[date]) rawDataByDate[date] = {};

            // We use getRate here just to calculate the conversion for this specific item
            // BUT we must be careful not to rely on it for the global "DOLLAR" line yet
            // because we want the DOLLAR line to be continuous.
            const rate = getRate(date);
            const price = Number(item.price);

            // Store original
            rawDataByDate[date][item.product] = price;
            rawDataByDate[date][`${item.product}_currency`] = item.currency;

            // Calculate conversions
            if (item.currency === 'BRL') {
                rawDataByDate[date][`${item.product}_BRL`] = price;
                rawDataByDate[date][`${item.product}_USD`] = price / rate;
            } else {
                rawDataByDate[date][`${item.product}_USD`] = price;
                rawDataByDate[date][`${item.product}_BRL`] = price * rate;
            }
        });

        // 2. Add dates from exchange rates (ensure we have points even if no crop price)
        rates.forEach(r => {
            const date = new Date(r.date_reference).toISOString().split('T')[0];
            allDatesSet.add(date);
            if (!rawDataByDate[date]) rawDataByDate[date] = {};
            rawDataByDate[date]['DOLLAR'] = r.rate_sell;
        });

        const sortedDates = Array.from(allDatesSet).sort();

        // Forward fill
        const chartData: any[] = [];
        const lastKnownValues: Record<string, any> = {};

        // Reset lastKnownRate for the forward fill loop to ensure it starts clean
        // We try to find the first valid rate in the sorted list to initialize if possible
        const firstValidRate = sortedDates.find(d => rawDataByDate[d]['DOLLAR'])
            ? rawDataByDate[sortedDates.find(d => rawDataByDate[d]['DOLLAR'])!]['DOLLAR']
            : 5.0;

        let currentRate = firstValidRate;

        sortedDates.forEach(date => {
            const dayData = rawDataByDate[date];

            // 1. Handle Dollar Rate Logic
            // If we have a rate for this day (from exchange_rates table), use it and update currentRate
            if (dayData['DOLLAR'] !== undefined && dayData['DOLLAR'] !== null && dayData['DOLLAR'] > 0) {
                currentRate = dayData['DOLLAR'];
            } else {
                // If missing, use the last known rate
                dayData['DOLLAR'] = currentRate;
            }

            // 2. Handle Prices Forward Fill
            Object.keys(dayData).forEach(key => {
                lastKnownValues[key] = dayData[key];
            });

            chartData.push({
                date,
                ...lastKnownValues
            });
        });

        return NextResponse.json({
            data: chartData,
            averages: {}
        });

    } catch (error: any) {
        console.error('Internal server error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

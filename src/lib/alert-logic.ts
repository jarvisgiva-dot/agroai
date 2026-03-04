import { supabase } from './supabase';

/**
 * Calculates a recommended price alert threshold based on historical volatility.
 * Formula: Average(Month-over-Month Absolute Variation) + 1.0% Safety Margin.
 */
export async function calculateRecommendedThreshold(product: string): Promise<number> {
    // 1. Fetch historical prices for the last 24 months
    const { data: prices, error } = await supabase
        .from('market_prices')
        .select('price, date_reference')
        .eq('product', product)
        .order('date_reference', { ascending: true })
        .limit(24);

    if (error || !prices || prices.length < 2) {
        console.warn(`Insufficient data for ${product} to calculate recommendation. Defaulting to 5%.`, error);
        return 5.0; // Default fallback
    }

    // 2. Calculate month-over-month variations
    let totalVariation = 0;
    let count = 0;

    for (let i = 1; i < prices.length; i++) {
        const prevPrice = prices[i - 1].price;
        const currPrice = prices[i].price;

        if (prevPrice > 0) {
            const variation = Math.abs((currPrice - prevPrice) / prevPrice) * 100;
            totalVariation += variation;
            count++;
        }
    }

    if (count === 0) return 5.0;

    // 3. Calculate Average Variation
    const avgVariation = totalVariation / count;

    // 4. Add Safety Margin (1.0%)
    const recommended = avgVariation + 1.0;

    // Round to 1 decimal place
    return Math.round(recommended * 10) / 10;
}

/**
 * Calculates a recommended barter ratio based on historical data.
 * Formula: Average(Input Price / Commodity Price) over last 24 months.
 * Handles currency conversion using a simplified approach (assuming current rate if historical missing).
 */
export async function calculateBarterRecommendation(input: string, commodity: string): Promise<number> {
    // 1. Fetch prices
    const { data: inputPrices } = await supabase
        .from('market_prices')
        .select('price, date_reference, currency')
        .eq('product', input)
        .order('date_reference', { ascending: true })
        .limit(24);

    const { data: commodityPrices } = await supabase
        .from('market_prices')
        .select('price, date_reference, currency')
        .eq('product', commodity)
        .order('date_reference', { ascending: true })
        .limit(24);

    if (!inputPrices || !commodityPrices || inputPrices.length < 2 || commodityPrices.length < 2) {
        return 20.0; // Default fallback
    }

    // 2. Fetch Exchange Rates (for simplicity, getting a recent batch to approximate)
    // Ideally we join, but for this logic we'll fetch a range
    const { data: rates } = await supabase
        .from('exchange_rates')
        .select('rate_sell, date')
        .order('date', { ascending: false })
        .limit(300); // Last ~year of rates

    const getRate = (date: string) => {
        const r = rates?.find(r => r.date === date);
        return r ? r.rate_sell : 5.5; // Fallback rate
    };

    // 3. Calculate Ratios
    let totalRatio = 0;
    let count = 0;

    // Map commodity prices by date for O(1) lookup
    const commodityMap = new Map(commodityPrices.map(c => [c.date_reference, c]));

    for (const inputItem of inputPrices) {
        const commodityItem = commodityMap.get(inputItem.date_reference);
        if (commodityItem) {
            let inputP = inputItem.price;
            let commodityP = commodityItem.price;
            const rate = getRate(inputItem.date_reference);

            // Normalize to BRL
            if (inputItem.currency === 'USD') inputP *= rate;
            if (commodityItem.currency === 'USD') commodityP *= rate;

            // Calculate Ratio (Input / Commodity)
            // e.g. Ureia (3000 BRL) / Soja (120 BRL) = 25 sc/ton
            if (commodityP > 0) {
                const ratio = inputP / commodityP;
                totalRatio += ratio;
                count++;
            }
        }
    }

    if (count === 0) return 20.0;

    const avgRatio = totalRatio / count;
    return Math.round(avgRatio * 10) / 10;
}

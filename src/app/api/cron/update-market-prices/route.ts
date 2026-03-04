import { NextResponse } from 'next/server';
import { getLatestWorldBankPrices } from '@/lib/worldbank-real';
import { supabase } from '@/lib/supabase';
import yahooFinance from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const logs: string[] = [];

        // 1. Fetch Exchange Rates (USD/BRL)
        try {
            const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
            const data = await res.json();
            const rate = data.USDBRL;

            if (rate) {
                const { error } = await supabase
                    .from('exchange_rates')
                    .upsert({
                        date: today,
                        rate_buy: parseFloat(rate.bid),
                        rate_sell: parseFloat(rate.ask)
                    }, { onConflict: 'date' });

                if (error) throw error;
                logs.push(`Exchange Rate updated: ${rate.ask}`);
            }
        } catch (e: any) {
            console.error('Error updating exchange rates:', e);
            logs.push(`Error updating exchange rates: ${e.message}`);
        }

        // 2. Fetch Grain Prices (Yahoo Finance)
        try {
            const yf = new (yahooFinance as any)();
            const results = await yf.quote(['ZS=F', 'ZC=F']) as any[];

            const soy = results.find((item: any) => item.symbol === 'ZS=F');
            const corn = results.find((item: any) => item.symbol === 'ZC=F');

            const grainInserts = [];

            // SAVE AS-IS: Yahoo returns Cents/Bushel, MarketTicker expects Cents/Bushel
            // NO CONVERSION NEEDED! MarketTicker divides by 100 for display
            // Example: Yahoo returns 1200 (cents/bu) → MarketTicker shows $12.00/bu
            if (soy && soy.regularMarketPrice) {
                grainInserts.push({
                    date: today,
                    category: 'SOJA',
                    price: soy.regularMarketPrice, // Store as Cents/Bushel
                    currency: 'USD',
                    unit: 'cents_bu', // Correct unit!
                    source_type: 'YAHOO_FINANCE'
                });
                logs.push(`Soy price updated: ${soy.regularMarketPrice} cents/bu → $${(soy.regularMarketPrice/100).toFixed(2)}/bu (Source: Yahoo ZS=F)`);
            }

            // CORN - Same logic
            if (corn && corn.regularMarketPrice) {
                grainInserts.push({
                    date: today,
                    category: 'MILHO',
                    price: corn.regularMarketPrice, // Store as Cents/Bushel
                    currency: 'USD',
                    unit: 'cents_bu', // Correct unit!
                    source_type: 'YAHOO_FINANCE'
                });
                logs.push(`Corn price updated: ${corn.regularMarketPrice} cents/bu → $${(corn.regularMarketPrice/100).toFixed(2)}/bu (Source: Yahoo ZC=F)`);
            }

            if (grainInserts.length > 0) {
                // Use upsert to prevent unique constraint violations
                const { error } = await supabase
                    .from('market_prices')
                    .upsert(grainInserts, { onConflict: 'date,category,source_type' });

                if (error) {
                    console.error('Supabase upsert error (grains):', error);
                    throw error;
                }
                logs.push(`Grain prices updated: ${grainInserts.length} records added/updated`);
            }

        } catch (e: any) {
            console.error('Error updating grains:', e);
            logs.push(`Error updating grains: ${e.message}`);
        }

        // 3. Fetch Local Prices (Primavera do Leste - IMEA)
        try {
            const scrapeImea = async (url: string) => {
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                    next: { revalidate: 0 } // No cache for cron
                });
                if (!res.ok) return null;
                const text = await res.text();
                const match = text.match(/Primavera do Leste[\s\S]*?<td[^>]*>([\d,]+)/);
                if (match && match[1]) return parseFloat(match[1].replace(',', '.'));
                return null;
            };

            const [soyPrice, cornPrice] = await Promise.all([
                scrapeImea('https://www.noticiasagricolas.com.br/cotacoes/soja/soja-disponivel-imea'),
                scrapeImea('https://www.noticiasagricolas.com.br/cotacoes/milho/milho-disponivel-imea')
            ]);

            const localInserts = [];
            const today = new Date().toISOString().split('T')[0];

            if (soyPrice) {
                localInserts.push({ date: today, category: 'SOJA', price: soyPrice, currency: 'BRL', unit: 'sc_60kg', source_type: 'IMEA_LOCAL' });
                logs.push(`Local Soy (IMEA) updated: R$${soyPrice}`);
            }
            if (cornPrice) {
                localInserts.push({ date: today, category: 'MILHO', price: cornPrice, currency: 'BRL', unit: 'sc_60kg', source_type: 'IMEA_LOCAL' });
                logs.push(`Local Corn (IMEA) updated: R$${cornPrice}`);
            }

            if (localInserts.length > 0) {
                const { error } = await supabase.from('market_prices').upsert(localInserts, { onConflict: 'date,category,source_type' });
                if (error) throw error;
            } else {
                logs.push('Local IMEA: Failed to scrape prices (no match found)');
            }

        } catch (e: any) {
            console.error('Error updating local IMEA:', e);
            logs.push(`Error updating local IMEA: ${e.message}`);
        }

        // 4. Scrape Premium (Paranaguá) - NEW PERSISTENCE
        try {
            const premiumRes = await fetch('https://www.noticiasagricolas.com.br/cotacoes/soja/premio-soja-paranagua-pr', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                next: { revalidate: 0 }
            });

            if (premiumRes.ok) {
                const text = await premiumRes.text();
                const match = text.match(/<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/);
                if (match && match.length >= 4) {
                    const month = match[1].trim();
                    const price = parseFloat(match[2].replace(',', '.').trim());
                    // const changePercent = parseFloat(match[3].replace(',', '.').replace('%', '').trim());

                    // Upsert Premium
                    // Note: Premium is in Cents/Bushel, but we store as 'cents_bu' to distinguish from sc_60kg
                    // If DB constraint doesn't allow 'cents_bu', update schema to add it
                    const { error } = await supabase
                        .from('market_prices')
                        .upsert({
                            date: today,
                            category: 'PREMIO_SOJA',
                            price: price,
                            currency: 'USD',
                            unit: 'cents_bu', // Correctly identifies unit as Cents/Bushel
                            source_type: 'NOTICIAS_AGRICOLAS'
                        }, { onConflict: 'date,category,source_type' });

                    if (error) {
                        console.error('Supabase upsert error (Premium):', error);
                        logs.push(`Error updating Premium: ${error.message}`);
                    } else {
                        logs.push(`Premium Paranagua updated: ${price} (Month: ${month})`);
                    }
                } else {
                    logs.push('Premium: Scrape regex mismatch');
                }
            } else {
                logs.push(`Premium: Access failed (${premiumRes.status})`);
            }
        } catch (e: any) {
            console.error('Error updating Premium:', e);
            logs.push(`Error updating Premium: ${e.message}`);
        }

        // 5. Fetch World Bank Prices (Fertilizers)
        try {
            const prices = await getLatestWorldBankPrices();

            if (prices.length === 0) {
                logs.push('World Bank: No new data to update (already current or fallback used)');
            } else {
                const inserts = prices.map(p => ({
                    date: p.date,  // CRÍTICO: Usar data da cotação, não hoje
                    category: p.category,
                    price: p.price,
                    currency: p.currency,
                    unit: p.unit,
                    source_type: 'WORLD_BANK'
                }));

                // Usar upsert para evitar duplicatas se a constraint existir
                const { error } = await supabase
                    .from('market_prices')
                    .upsert(inserts, {
                        onConflict: 'date,category,source_type',
                        ignoreDuplicates: false
                    });

                if (error) {
                    console.error('Supabase upsert error (World Bank):', error);
                    throw error;
                }

                logs.push(`World Bank prices updated: ${inserts.length} records added/updated`);
                logs.push(`Latest fertilizer data: ${prices[prices.length - 1].date}`);
            }
        } catch (e: any) {
            console.error('Error updating World Bank:', e);
            logs.push(`Error updating World Bank: ${e.message} (grains/exchange still updated)`);
            // NÃO lançar erro - permitir que grãos e câmbio continuem funcionando
        }

        // Cache control para evitar cache de resposta do cron
        return NextResponse.json({
            success: true,
            message: 'Market prices update process completed',
            logs
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            }
        });

    } catch (error: any) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

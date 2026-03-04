import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { getLatestWorldBankPrices } from '@/lib/worldbank-real';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Simple in-memory cache
let cache = {
    premium: null as any,
    local: { soy: null as number | null, corn: null as number | null },
    yahoo: {
        soy: null as any,
        corn: null as any,
        usdBrl: null as any
    },
    worldBank: null as any,
    lastUpdated: 0
};

const CACHE_DURATION = 1000 * 60 * 60 * 6; // 6 hours

// Helper to fetch latest local price from DB
async function getStoredLocalPrice(category: string): Promise<number | null> {
    try {
        const { data } = await supabase
            .from('market_prices')
            .select('price')
            .eq('category', category)
            .eq('source_type', 'IMEA_LOCAL')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        return data?.price || null;
    } catch (e) {
        return null;
    }
}

// Helper to fetch latest Yahoo price from DB (Fallback)
async function getStoredYahooPrice(category: string, currency: string = 'USD'): Promise<any | null> {
    try {
        if (category === 'USD-BRL') {
            const { data } = await supabase
                .from('exchange_rates')
                .select('rate_sell, date')
                .eq('currency_pair', 'USD-BRL')
                .order('date', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                return {
                    regularMarketPrice: data.rate_sell,
                    regularMarketChange: 0, // Not stored
                    regularMarketChangePercent: 0, // Not stored
                    currency: 'BRL',
                    symbol: 'BRL=X'
                };
            }
        } else {
            const { data } = await supabase
                .from('market_prices')
                .select('price, currency, date, unit')
                .eq('category', category)
                .eq('source_type', 'YAHOO_FINANCE')
                .order('date', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                // Yahoo Finance data is stored as-is (Cents/Bushel)
                // MarketTicker will divide by 100 to show $/Bushel
                // NO CONVERSION NEEDED - just return as stored
                return {
                    regularMarketPrice: data.price,
                    regularMarketChange: 0,
                    regularMarketChangePercent: 0,
                    currency: data.currency,
                    symbol: category === 'SOJA' ? 'ZS=F' : 'ZC=F',
                    source: 'DB_CACHE'
                };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Helper to scrape CBOT from Noticias Agricolas (Fallback for Yahoo API)
async function scrapeCBOT(url: string, symbol: string): Promise<any | null> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            next: { revalidate: 300 } // 5 mins cache
        });
        if (!res.ok) return null;

        const html = await res.text();
        let price = null;

        // Strategy 1: Look for the main content table "table.cot-fisicas"
        // This usually contains "Fechamento (US$ / Bushel)" formatted as "10,3300" (USD)
        const mainTableMatch = html.match(/<table class="cot-fisicas">([\s\S]*?)<\/table>/);
        if (mainTableMatch) {
            const tableHtml = mainTableMatch[1];
            // Match the first row's price: <td>10,3300</td>
            // Regex: <td>(\d+,\d+)<\/td>
            const rowMatch = tableHtml.match(/<td>(\d{1,3}(?:\.\d{3})*,\d{4})<\/td>/);
            if (rowMatch && rowMatch[1]) {
                const rawPrice = rowMatch[1].replace(/\./g, '').replace(',', '.');
                price = parseFloat(rawPrice);
                // Convert USD to Cents if needed
                // If price is small (e.g. 10.33 or 4.21), it's USD. Yahoo expects Cents.
                if (price < 100) {
                    price = price * 100;
                }
            }
        }

        // Strategy 2: Fallback to "CHICAGO (CME)" widget (only for Soy mostly)
        if (!price && symbol === 'ZS=F') {
            const cbatSectionMatch = html.match(/<h2>CHICAGO \(CME\)<\/h2>([\s\S]*?)<\/table>/);
            if (cbatSectionMatch) {
                const tableHtml = cbatSectionMatch[1];
                const priceMatch = tableHtml.match(/<div>(\d{1,3}(?:\.\d{3})*,\d{2})<\/div>/);
                if (priceMatch && priceMatch[1]) {
                    const rawPrice = priceMatch[1].replace(/\./g, '').replace(',', '.');
                    price = parseFloat(rawPrice);
                    // This format (1.030,50) usually comes as Cents/Bushel directly or weird scaling.
                    // If it's > 200, assume it's Cents.
                }
            }
        }

        if (price && !isNaN(price) && price > 0) {
            // Sanity Check
            // Soy (ZS=F) should be > 800 cents (approx $8.00)
            // Corn (ZC=F) should be < 800 cents (approx $8.00 - usually $4-5) 
            if (symbol === 'ZS=F' && price < 800) return null; // Too low for Soy
            if (symbol === 'ZC=F' && price > 800) return null; // Too high for Corn (likely Soy data)

            console.log(`API: Scraped CBOT ${symbol} price: ${price}`);
            return {
                regularMarketPrice: price,
                regularMarketChange: 0,
                regularMarketChangePercent: 0,
                currency: 'USD',
                symbol: symbol,
                source: 'NOTICIAS_AGRICOLAS'
            };
        }

        return null;
    } catch (e) {
        console.error(`API: CBOT scrape failed for ${symbol}`, e);
        return null;
    }
}

export async function GET() {
    try {
        const now = Date.now();

        // Check if we need to update cache (Time-based only to prevent 429 loops on failure)
        if (now - cache.lastUpdated > CACHE_DURATION) {
            console.log('API: Creating/Updating cache...');

            // --- 1. Fetch Yahoo Finance (MOVED INSIDE CACHE CHECK) ---
            const yf = new (yahooFinance as any)();
            try {
                // Add a small delay/jitter or just try fetch
                const results = await yf.quote(['ZS=F', 'ZC=F', 'BRL=X']) as any[];
                if (results && Array.isArray(results)) {
                    cache.yahoo.soy = results.find((item: any) => item.symbol === 'ZS=F');
                    cache.yahoo.corn = results.find((item: any) => item.symbol === 'ZC=F');
                    cache.yahoo.usdBrl = results.find((item: any) => item.symbol === 'BRL=X');
                }
            } catch (yfError) {
                console.error('Yahoo Finance Error (Rate Limit or Fail):', yfError);
                // Fallback will be handled after trying to fetch
            }

            // Fallback for Yahoo: If still null after fetch attempt, try Scraper, then DB
            if (!cache.yahoo.soy) {
                cache.yahoo.soy = await scrapeCBOT('https://www.noticiasagricolas.com.br/cotacoes/soja/soja-bolsa-de-chicago-cme-group', 'ZS=F');
                if (!cache.yahoo.soy) cache.yahoo.soy = await getStoredYahooPrice('SOJA');
            }
            if (!cache.yahoo.corn) {
                cache.yahoo.corn = await scrapeCBOT('https://www.noticiasagricolas.com.br/cotacoes/milho/milho-bolsa-de-chicago-cme-group', 'ZC=F');
                if (!cache.yahoo.corn) cache.yahoo.corn = await getStoredYahooPrice('MILHO');
            }
            if (!cache.yahoo.usdBrl) cache.yahoo.usdBrl = await getStoredYahooPrice('USD-BRL');


            // --- 2. Scrape Premium (Paranaguá) ---
            try {
                const premiumRes = await fetch('https://www.noticiasagricolas.com.br/cotacoes/soja/premio-soja-paranagua-pr', {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                    next: { revalidate: 3600 }
                });

                if (premiumRes.ok) {
                    const text = await premiumRes.text();
                    const match = text.match(/<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/);
                    if (match && match.length >= 4) {
                        cache.premium = {
                            month: match[1].trim(),
                            price: parseFloat(match[2].replace(',', '.').trim()),
                            changePercent: parseFloat(match[3].replace(',', '.').replace('%', '').trim())
                        };
                    }
                }
            } catch (e) { console.error('API: Premium scrape failed', e); }

            // Fallback for Premium: If scrape failed, try DB
            if (!cache.premium) {
                try {
                    const { data } = await supabase
                        .from('market_prices')
                        .select('price, date')
                        .eq('category', 'PREMIO_SOJA')
                        .order('date', { ascending: false })
                        .limit(1)
                        .single();

                    if (data) {
                        // Assuming price in DB is what we want (e.g. 55)
                        const date = new Date(data.date);
                        // Convert month number to name if possible, or just show 'Salvo'
                        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        const monthName = months[date.getMonth()];

                        cache.premium = {
                            month: monthName,
                            price: data.price,
                            changePercent: 0, // Not stored
                            isFallback: true // Flag to show user
                        };
                    }
                } catch (e) { }
            }

            // --- 3. Scrape Local Prices (Primavera do Leste - IMEA) ---
            let soyPrice = null;
            let cornPrice = null;

            try {
                const scrapeImea = async (url: string) => {
                    const res = await fetch(url, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                        next: { revalidate: 3600 }
                    });
                    if (!res.ok) return null;
                    const text = await res.text();
                    const match = text.match(/Primavera do Leste[\s\S]*?<td[^>]*>([\d,]+)/);
                    if (match && match[1]) return parseFloat(match[1].replace(',', '.'));
                    return null;
                };

                [soyPrice, cornPrice] = await Promise.all([
                    scrapeImea('https://www.noticiasagricolas.com.br/cotacoes/soja/soja-disponivel-imea'),
                    scrapeImea('https://www.noticiasagricolas.com.br/cotacoes/milho/milho-disponivel-imea')
                ]);

                // If scrape success, persist to DB
                const today = new Date().toISOString().split('T')[0];
                const localInserts = [];

                if (soyPrice) {
                    localInserts.push({ date: today, category: 'SOJA', price: soyPrice, currency: 'BRL', unit: 'sc_60kg', source_type: 'IMEA_LOCAL' });
                }
                if (cornPrice) {
                    localInserts.push({ date: today, category: 'MILHO', price: cornPrice, currency: 'BRL', unit: 'sc_60kg', source_type: 'IMEA_LOCAL' });
                }

                if (localInserts.length > 0) {
                    await supabase.from('market_prices').upsert(localInserts, { onConflict: 'date,category,source_type' });
                    console.log('API: Persisted local prices to DB');
                }

            } catch (e) {
                console.error('API: Local scrape failed', e);
            }

            // Fallback for Local: If scraping failed, try to get from DB
            if (!soyPrice) soyPrice = await getStoredLocalPrice('SOJA');
            if (!cornPrice) cornPrice = await getStoredLocalPrice('MILHO');

            cache.local = { soy: soyPrice, corn: cornPrice };

            // --- 4. Fetch World Bank Data ---
            try {
                const wbPrices = await getLatestWorldBankPrices();
                cache.worldBank = wbPrices;
            } catch (e) { console.error('API: WB fetch failed', e); }

            cache.lastUpdated = now;

            // --- PERSISTENCE FOR YAHOO & WB ---
            // (Only runs if cache updates/refreshes)
            try {
                const today = new Date().toISOString().split('T')[0];
                const entriesToInsert = [];

                if (cache.yahoo.soy && cache.yahoo.soy.regularMarketPrice) {
                    entriesToInsert.push({ date: today, category: 'SOJA', price: cache.yahoo.soy.regularMarketPrice, currency: cache.yahoo.soy.currency, unit: 'cents_bu', source_type: 'YAHOO_FINANCE' });
                }
                if (cache.yahoo.corn && cache.yahoo.corn.regularMarketPrice) {
                    entriesToInsert.push({ date: today, category: 'MILHO', price: cache.yahoo.corn.regularMarketPrice, currency: cache.yahoo.corn.currency, unit: 'cents_bu', source_type: 'YAHOO_FINANCE' });
                }

                if (cache.worldBank && Array.isArray(cache.worldBank)) {
                    cache.worldBank.forEach((item: any) => {
                        entriesToInsert.push({ date: today, category: item.category, price: item.price, currency: item.currency, unit: item.unit, source_type: 'WORLD_BANK' });
                    });
                }

                if (entriesToInsert.length > 0) {
                    await supabase.from('market_prices').upsert(entriesToInsert, { onConflict: 'date,category,source_type' });
                }

                if (cache.yahoo.usdBrl && cache.yahoo.usdBrl.regularMarketPrice) {
                    await supabase.from('exchange_rates').upsert({
                        date: today,
                        rate_buy: cache.yahoo.usdBrl.regularMarketPrice,
                        rate_sell: cache.yahoo.usdBrl.regularMarketPrice
                    }, { onConflict: 'date' });
                }

            } catch (err) { console.error('API: Persistence error', err); }
        }

        // Return from cache (or whatever we managed to get)
        return NextResponse.json({
            soy: cache.yahoo.soy ? {
                price: cache.yahoo.soy.regularMarketPrice,
                change: cache.yahoo.soy.regularMarketChange,
                changePercent: cache.yahoo.soy.regularMarketChangePercent,
                currency: cache.yahoo.soy.currency,
                symbol: 'ZS=F',
                source: cache.yahoo.soy.source || 'YAHOO' // Add Source
            } : null,
            corn: cache.yahoo.corn ? {
                price: cache.yahoo.corn.regularMarketPrice,
                change: cache.yahoo.corn.regularMarketChange,
                changePercent: cache.yahoo.corn.regularMarketChangePercent,
                currency: cache.yahoo.corn.currency,
                symbol: 'ZC=F',
                source: cache.yahoo.corn.source || 'YAHOO' // Add Source
            } : null,
            dollar: cache.yahoo.usdBrl ? {
                price: cache.yahoo.usdBrl.regularMarketPrice,
                change: cache.yahoo.usdBrl.regularMarketChange,
                changePercent: cache.yahoo.usdBrl.regularMarketChangePercent,
                currency: cache.yahoo.usdBrl.currency,
                symbol: 'BRL=X'
            } : null,
            premium: cache.premium,
            local: cache.local,
            worldBank: cache.worldBank,
            lastUpdated: cache.lastUpdated
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0', // Prevent Vercel edge caching of the API response itself
            }
        });
    } catch (error: any) {
        console.error('API Critical Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch market data',
            details: error.message,
            local: cache.local, // Try to return whatever is in cache
            worldBank: cache.worldBank,
            // Try to return partial yahoo data if exists in cache
            soy: cache.yahoo.soy,
            corn: cache.yahoo.corn,
            dollar: cache.yahoo.usdBrl
        }, { status: 200 } // Return 200 with error structure to avoid breaking UI completely
        );
    }
}


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking latest Yahoo Finance prices...");

    const { data, error } = await supabase
        .from('market_prices')
        .select('*')
        .eq('source_type', 'YAHOO_FINANCE')
        .order('date', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("=== YAHOO FINANCE DATA START ===");
        if (data && data.length > 0) {
            data.forEach((row, index) => {
                console.log(`Row ${index}:`, JSON.stringify(row));
            });
        } else {
            console.log("No Yahoo Finance data found.");
        }
        console.log("=== YAHOO FINANCE DATA END ===");
    }

    console.log("\nChecking Exchange Rates...");
    const { data: rates, error: ratesError } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('date', { ascending: false })
        .limit(5);

    if (ratesError) {
        console.log("Error rates:", ratesError);
        // Fallback check for old column if rename failed
        const { data: ratesOld, error: ratesOldError } = await supabase
            .from('exchange_rates')
            .select('*')
            .order('date_reference', { ascending: false })
            .limit(5);
        if (ratesOld) console.log("Exchange Rates (Old Column):", ratesOld);
    } else {
        console.log("Exchange Rates:", rates);
    }
}

main();

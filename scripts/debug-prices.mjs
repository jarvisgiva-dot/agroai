
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Manual config since we are in ES module
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    fs.writeFileSync('scripts/output.txt', 'Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    let output = "=== START ===\n";

    // 1. Check Yahoo Finance Data
    const { data, error } = await supabase
        .from('market_prices')
        .select('*')
        .eq('source_type', 'YAHOO_FINANCE')
        .order('date', { ascending: false })
        .limit(10);

    if (error) {
        output += "Error fetching prices: " + JSON.stringify(error) + "\n";
    } else {
        output += "YAHOO PRICES:\n" + JSON.stringify(data, null, 2) + "\n";
    }

    fs.writeFileSync('scripts/output.txt', output);
    console.log("Done writing to scripts/output.txt");
}

main();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) { console.error("Missing keys"); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const categories = ['SUPER_SIMPLES', 'SSP', 'SULFATO_AMONIO', 'SULFATO', 'UREIA']; // Added Ureia for comparison

    console.log("=== CHECKING FERTILIZER SOURCES ===");

    for (const cat of categories) {
        const { data, error } = await supabase
            .from('market_prices')
            .select('date, category, price, source_type')
            .eq('category', cat)
            .order('date', { ascending: false })
            .limit(3);

        console.log(`\n--- ${cat} ---`);
        if (data && data.length > 0) {
            data.forEach(row => console.log(JSON.stringify(row)));
        } else {
            console.log("No records found.");
        }
    }
}

main();

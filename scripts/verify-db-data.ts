
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
    console.log('--- Verifying Market Prices ---');

    // Check counts by category and source
    const { data: counts, error } = await supabase
        .from('market_prices')
        .select('category, source_type, date');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const summary: any = {};
    counts?.forEach(row => {
        const key = `${row.category}|${row.source_type}`;
        if (!summary[key]) summary[key] = { count: 0, minDate: row.date, maxDate: row.date };
        summary[key].count++;
        if (row.date < summary[key].minDate) summary[key].minDate = row.date;
        if (row.date > summary[key].maxDate) summary[key].maxDate = row.date;
    });

    // console.table(summary);

    const { count } = await supabase
        .from('market_prices')
        .select('*', { count: 'exact', head: true });
    console.log('Total rows in market_prices:', count);

    const { data: dateRange } = await supabase
        .from('market_prices')
        .select('date')
        .eq('source_type', 'WORLD_BANK')
        .order('date', { ascending: true });

    if (dateRange && dateRange.length > 0) {
        console.log('Min Date:', dateRange[0].date);
        console.log('Max Date:', dateRange[dateRange.length - 1].date);
    } else {
        console.log('No WORLD_BANK data found.');
    }

    const { data: sourceTypes } = await supabase
        .from('market_prices')
        .select('source_type');

    const uniqueSources = [...new Set(sourceTypes?.map(s => s.source_type))];
    console.log('ALL Unique Source Types in DB:', uniqueSources);

    const { count: specificCount } = await supabase
        .from('market_prices')
        .select('*', { count: 'exact', head: true })
        .eq('source_type', 'WORLD_BANK')
        .in('category', ['UREIA', 'MAP', 'KCL', 'SUPER_SIMPLES', 'SULFATO_AMONIO']);
    console.log('Total count for ALL 5 FERTILIZERS:', specificCount);

    const { count: grainCount } = await supabase
        .from('market_prices')
        .select('*', { count: 'exact', head: true })
        .eq('source_type', 'HISTORICO_IMPORT')
        .in('category', ['SOJA', 'MILHO']);
    console.log('Total count for SOJA/MILHO (HISTORICO_IMPORT):', grainCount);
}

verify();

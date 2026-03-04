import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { parse, format } from 'date-fns';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const text = await file.text();
        const lines = text.split('\n');
        const records = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            // BCB Format: Data;Cod;Tipo;Moeda;TaxaCompra;TaxaVenda;...
            // Example: 02012023;220;A;USD;5,3430;5,3436;1;0000;1;0000
            const cols = line.split(';');

            if (cols.length < 6) continue;

            const dateStr = cols[0]; // 02012023
            const buyStr = cols[4];  // 5,3430
            const sellStr = cols[5]; // 5,3436

            // Validate date format (simple check)
            if (dateStr.length !== 8) continue;

            try {
                // Parse Date: ddMMyyyy -> yyyy-MM-dd
                // Using manual substring is safer/faster for fixed format than date-fns parse here
                const day = dateStr.substring(0, 2);
                const month = dateStr.substring(2, 4);
                const year = dateStr.substring(4, 8);
                const dateReference = `${year}-${month}-${day}`;

                // Parse Numbers: Replace comma with dot
                const rateBuy = parseFloat(buyStr.replace(',', '.'));
                const rateSell = parseFloat(sellStr.replace(',', '.'));

                if (!isNaN(rateBuy) && !isNaN(rateSell)) {
                    records.push({
                        date: dateReference,
                        rate_buy: rateBuy,
                        rate_sell: rateSell
                    });
                }
            } catch (e) {
                console.warn('Skipping invalid line:', line);
            }
        }

        if (records.length > 0) {
            const { error } = await supabase
                .from('exchange_rates')
                .upsert(records, { onConflict: 'date' });

            if (error) throw error;
        }

        return NextResponse.json({
            success: true,
            message: `Imported ${records.length} rates successfully.`,
            count: records.length
        });

    } catch (error: any) {
        console.error('Error uploading exchange rates:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

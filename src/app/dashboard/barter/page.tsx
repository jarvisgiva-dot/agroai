import { supabase } from '@/lib/supabase';

import { BarterDashboard } from '@/components/barter/BarterDashboard';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

export const dynamic = 'force-dynamic';

export default async function BarterPage() {
    // Helper to fetch all rows with pagination
    const fetchAllMarketPrices = async () => {
        let allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('market_prices')
                .select('*')
                .gte('date', '2018-01-01')
                .order('date', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;

            if (data) {
                allData = [...allData, ...data];
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
            page++;
        }
        return { data: allData, error: null };
    };

    const [marketPricesRes, exchangeRatesRes, purchaseEventsRes] = await Promise.all([
        fetchAllMarketPrices(),
        supabase
            .from('exchange_rates')
            .select('*')
            .order('date', { ascending: true })
            .limit(5000),
        supabase
            .from('purchase_events')
            .select('*')
            .order('date', { ascending: true })
    ]);

    const marketPrices = marketPricesRes.data;
    const exchangeRates = exchangeRatesRes.data;
    const purchaseEvents = purchaseEventsRes.data;
    const error = marketPricesRes.error || exchangeRatesRes.error; // Ignore purchaseEvents error for now in case table doesn't exist (though user said they ran SQL)

    if (error) {
        console.error('Error fetching data:', error);
        return (
            <DashboardLayout>
                <div className="p-8 text-red-500">Erro ao carregar dados de mercado.</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Inteligência de Mercado & Barter</h1>
                    <p className="text-gray-500 mt-2">
                        Monitore tendências globais e calcule o melhor momento para compra de insumos.
                    </p>
                </div>

                <BarterDashboard
                    initialData={marketPrices || []}
                    exchangeRates={exchangeRates || []}
                    purchaseEvents={purchaseEvents || []}
                />
            </div>
        </DashboardLayout>
    );
}

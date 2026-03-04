'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    ComposedChart,
    Scatter
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    DollarSign,
    Sprout,
    Tractor,
    ShoppingCart,
    Settings,
    Bell,
    Calendar,
    ArrowRightLeft,
    Loader2,
    Calculator,
    Save
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useRouter } from 'next/navigation';
import { MarketDataManager } from './MarketDataManager';
import { PriceAlertConfigModal } from '../alerts/PriceAlertConfigModal';
import { BarterAlertConfigModal } from '../alerts/BarterAlertConfigModal';
import { BarterAIInsights } from './BarterAIInsights';
import { QuickPriceEntryModal } from './QuickPriceEntryModal';

// ============================================================================
// CONVERSION CONSTANTS
// ============================================================================
// These constants are used for converting Yahoo Finance data from Cents/Bushel to USD/Sack
const BUSHELS_PER_SACK = {
    SOJA: 2.20462,  // 60kg sack ÷ 27.2155kg per bushel = 2.20462 bushels
    MILHO: 2.3622   // 60kg sack ÷ 25.4012kg per bushel = 2.3622 bushels
} as const;

// Price range thresholds for Yahoo Finance data interpretation
const YAHOO_PRICE_THRESHOLDS = {
    CENTS_THRESHOLD: 500,     // If price > 500, likely in cents (divide by 100)
    DOLLAR_PER_BUSHEL_MAX: 20, // If price < 20, likely $/Bu (needs conversion to $/Sack)
    DOLLAR_PER_BUSHEL_MIN_CORN: 10 // Corn specific threshold
} as const;

interface MarketPrice {
    id: string;
    date: string;
    category: string;
    price: number;
    currency: 'USD' | 'BRL';
    unit: 'ton' | 'sc_60kg';
    source_type: 'LOCAL_IMEA' | 'WORLD_BANK' | 'SIMULACAO_USER' | 'HISTORICO_IMPORT' | 'YAHOO_FINANCE';
}

interface ExchangeRate {
    id: string;
    date: string;
    rate_buy: number;
    rate_sell: number;
}

interface BarterScenario {
    id: string;
    name: string;
    fertilizer_type: string;
    product_type: string;
    sim_price: number;
    sim_freight: number;
    sim_dollar: number;
    sim_soy_price: number;
    currency: string;
    application_rate: number;
    created_at: string;
}

interface PurchaseEvent {
    id: string;
    date: string;
    category: string;
    price: number;
    quantity: number;
    currency: 'USD' | 'BRL';
    unit: 'ton' | 'sc_60kg';
    notes: string;
}

interface BarterDashboardProps {
    initialData: MarketPrice[];
    exchangeRates: ExchangeRate[];
    purchaseEvents: PurchaseEvent[];
}

type FertilizerType = 'UREIA' | 'KCL' | 'MAP' | 'SSP' | 'SULFATO_AMONIO' | 'TSP' | 'DAP';
type ProductType = 'SOJA' | 'MILHO';
type CurrencyType = 'BRL' | 'USD';

const DEFAULT_SCENARIO: BarterScenario = {
    id: 'default-example',
    name: 'Exemplo: Barter Padrão',
    fertilizer_type: 'UREIA',
    product_type: 'SOJA',
    sim_price: 3200,
    sim_freight: 150,
    sim_dollar: 5.80,
    sim_soy_price: 120,
    currency: 'BRL',
    application_rate: 150,
    created_at: new Date().toISOString()
};

export function BarterDashboard({ initialData, exchangeRates, purchaseEvents }: BarterDashboardProps) {
    // State
    const [selectedFertilizer, setSelectedFertilizer] = useState<FertilizerType>('UREIA');
    const [selectedProduct, setSelectedProduct] = useState<ProductType>('SOJA');
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>('USD');
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [isBarterAlertModalOpen, setIsBarterAlertModalOpen] = useState(false);
    const [timeRange, setTimeRange] = useState<'1y' | '3y' | '5y'>('3y'); // Default to 3y to show more data context
    const router = useRouter();

    // Simulation State
    const [simPrice, setSimPrice] = useState<number>(3200); // BRL/ton or USD/ton
    const [simFreight, setSimFreight] = useState<number>(150); // BRL/ton or USD/ton
    const [simDollar, setSimDollar] = useState<number>(5.80); // BRL/USD
    const [simSoyPrice, setSimSoyPrice] = useState<number>(120); // BRL/sc or USD/sc
    const [simCurrency, setSimCurrency] = useState<CurrencyType>('BRL'); // Currency for simulation inputs

    // Scenario Management
    const [scenarios, setScenarios] = useState<BarterScenario[]>([]);
    const [scenarioName, setScenarioName] = useState('');
    const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
    const [isSavingScenario, setIsSavingScenario] = useState(false);

    // Fetch Scenarios on Mount
    // Fetch Scenarios on Mount
    useEffect(() => {
        fetchScenarios();
    }, []);

    const fetchScenarios = async () => {
        const { data } = await supabase
            .from('barter_scenarios')
            .select('*')
            .order('created_at', { ascending: false });

        if (data && data.length > 0) {
            setScenarios(data);
        } else {
            setScenarios([DEFAULT_SCENARIO]);
        }
    };

    const handleSaveScenario = async () => {
        if (!scenarioName.trim()) {
            // toast({ title: "Nome obrigatório", description: "Digite um nome para o cenário.", variant: "destructive" });
            alert("Nome obrigatório");
            return;
        }
        setIsSavingScenario(true);
        try {
            const { error } = await supabase.from('barter_scenarios').insert([{
                name: scenarioName,
                fertilizer_type: selectedFertilizer,
                product_type: selectedProduct,
                sim_price: simPrice,
                sim_freight: simFreight,
                sim_dollar: simDollar,
                sim_product_price: simSoyPrice, // Note: DB column is sim_product_price? No I checked SQL file, wait.
                // In SQL file I created: "sim_product_price" NUMERIC NOT NULL
                // Then I did: ALTER TABLE ... RENAME COLUMN "sim_product_price" TO "sim_soy_price";
                // So the DB column is sim_soy_price.
                sim_soy_price: simSoyPrice,
                currency: simCurrency,
                application_rate: applicationRate
            }]);

            if (error) throw error;

            // toast({ title: "Cenário Salvo", description: "Simulação salva com sucesso." });
            alert("Cenário Salvo!");
            setScenarioName('');
            fetchScenarios();
        } catch (error: any) {
            console.error(error);
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsSavingScenario(false);
        }
    };

    const handleLoadScenario = (scenarioId: string) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;

        setSelectedScenarioId(scenarioId);
        setSelectedFertilizer(scenario.fertilizer_type as any);
        setSelectedProduct(scenario.product_type as any);
        setSimPrice(scenario.sim_price);
        setSimFreight(scenario.sim_freight);
        setSimDollar(scenario.sim_dollar);
        setSimSoyPrice(scenario.sim_soy_price);
        setSimCurrency(scenario.currency as any);
        setApplicationRate(scenario.application_rate);
    };

    const handleDeleteScenario = async (scenarioId: string) => {
        if (scenarioId === DEFAULT_SCENARIO.id) {
            alert("Este é um cenário de exemplo e não pode ser excluído.");
            return;
        }
        if (!confirm('Excluir este cenário?')) return;
        const { error } = await supabase.from('barter_scenarios').delete().eq('id', scenarioId);
        if (!error) {
            fetchScenarios();
            if (selectedScenarioId === scenarioId) setSelectedScenarioId('');
        }
    };

    // Separate Data Sources
    const localData = useMemo(() => initialData.filter(d => d.source_type !== 'WORLD_BANK'), [initialData]);
    const wbData = useMemo(() => initialData.filter(d => d.source_type === 'WORLD_BANK'), [initialData]);

    // Helper for deterministic date formatting (avoids hydration mismatch)
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        // Assuming date comes as YYYY-MM-DD
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const monthIndex = parseInt(parts[1]) - 1;
            const yearShort = parts[0].slice(2);
            return `${months[monthIndex]}/${yearShort}`;
        }
        return dateStr;
    }

    // Initial Data Merging and Conversion (Using LOCAL DATA for Chart)
    const chartData = useMemo(() => {
        // Filter data by selected types
        // Allow World Bank data for fertilizers (fallback), but prioritize Local/User data
        const fertilizerData = initialData
            .filter(d => d.category === selectedFertilizer)
            .sort((a, b) => (a.source_type === 'WORLD_BANK' ? -1 : 1));

        const productData = localData.filter(d => d.category === selectedProduct);

        // Create a map of Year-Month to merge data (Monthly Average for Products)
        // Key: "YYYY-MM"
        const dateMap = new Map<string, {
            date: string,
            rawDate: string, // Changes to YYYY-MM-01
            fertilizerPrice: number | null,
            productPrices: number[], // Temporary array to average
            productPrice: number | null
        }>();

        // Helper to get exchange rate for a date
        const getRate = (date: string) => {
            const rate = exchangeRates.find(r => r.date === date);
            return rate ? rate.rate_sell : simDollar; // Fallback to simDollar if not found
        };

        // Process Fertilizer Data (Already Monthly)
        fertilizerData.forEach(d => {
            const monthKey = d.date.substring(0, 7); // YYYY-MM
            const dateStr = formatDate(d.date);
            const rate = getRate(d.date);

            let price = d.price;
            // Convert to selected currency
            if (selectedCurrency === 'BRL' && d.currency === 'USD') price *= rate;
            if (selectedCurrency === 'USD' && d.currency === 'BRL') price /= rate;

            if (!dateMap.has(monthKey)) {
                // Use the 1st of the month as rawDate for consistency
                dateMap.set(monthKey, {
                    date: dateStr,
                    rawDate: `${monthKey}-01`,
                    fertilizerPrice: price,
                    productPrices: [],
                    productPrice: null
                });
            } else {
                const entry = dateMap.get(monthKey)!;
                entry.fertilizerPrice = price;
            }
        });

        // Process Product Data (Daily/Weekly -> Monthly Average)
        // Groups by Month first, then picks the best source for that month.
        const monthlyProductData = new Map<string, MarketPrice[]>();

        productData.forEach(d => {
            const monthKey = d.date.substring(0, 7);
            if (!monthlyProductData.has(monthKey)) {
                monthlyProductData.set(monthKey, []);
            }
            monthlyProductData.get(monthKey)!.push(d);
        });

        // Iterate through months to find the "Best" price
        monthlyProductData.forEach((prices, monthKey) => {
            // Priority: IMEA_LOCAL > YAHOO_FINANCE > SIMULACAO_USER > Others
            // Sort by source priority
            const getPriority = (source: string) => {
                if (source === 'IMEA_LOCAL') return 1;
                if (source === 'SIMULACAO_USER') return 2;
                if (source === 'YAHOO_FINANCE') return 3;
                return 4;
            };

            // additional sort by date descending (latest in month preferred?) or average?
            // Let's settle for taking the average of the HIGHEST PRIORITY source available in that month.
            // e.g. if we have IMEA days, use average IMEA. If only Yahoo, use average Yahoo.

            prices.sort((a, b) => getPriority(a.source_type) - getPriority(b.source_type));
            const bestSource = prices[0].source_type;
            const bestSourcePrices = prices.filter(p => p.source_type === bestSource);

            // Compute average for this source
            let totalConvertedPrice = 0;

            bestSourcePrices.forEach(d => {
                const rate = getRate(d.date);
                let price = d.price;

                // SPECIAL HANDLING: YAHOO_FINANCE CONVERSION
                // Yahoo Finance typically returns price in USD/Bushel (e.g. 12.00) or Cents/Bushel.
                // But our chart expects USD/Sack (60kg).
                if (d.source_type === 'YAHOO_FINANCE') {
                    const originalPrice = price;

                    if (d.category === 'SOJA' && d.currency === 'USD') {
                        // SOJA: 1 Sack (60kg) = 2.20462 Bushels
                        // Thresholds:
                        // > 500: Cents/Bu (e.g. 1200) -> Convert to $/Bu -> Convert to $/Sack
                        // < 20: $/Bu (e.g. 12) -> Convert to $/Sack
                        // 20-500: Likely already $/Sack -> Leave alone
                        if (price > YAHOO_PRICE_THRESHOLDS.CENTS_THRESHOLD) {
                            price = price / 100; // Cents -> $
                            console.log(`[YAHOO SOJA] Converted cents to dollars: ${originalPrice} -> ${price}`);
                        }
                        if (price < YAHOO_PRICE_THRESHOLDS.DOLLAR_PER_BUSHEL_MAX) {
                            price = price * BUSHELS_PER_SACK.SOJA; // $/Bu -> $/Sack
                            console.log(`[YAHOO SOJA] Converted $/Bu to $/Sack: ${originalPrice} -> ${price}`);
                        }
                    } else if (d.category === 'MILHO' && d.currency === 'USD') {
                        // MILHO: 1 Sack (60kg) = 2.3622 Bushels (56lbs per bushel)
                        // > 500: Cents/Bu (e.g. 600) -> Convert to $/Bu -> Convert to $/Sack
                        // < 10: $/Bu (e.g. 5) -> Convert to $/Sack
                        // 10-500: Likely already $/Sack -> Leave alone
                        if (price > YAHOO_PRICE_THRESHOLDS.CENTS_THRESHOLD) {
                            price = price / 100; // Cents -> $
                            console.log(`[YAHOO MILHO] Converted cents to dollars: ${originalPrice} -> ${price}`);
                        }
                        if (price < YAHOO_PRICE_THRESHOLDS.DOLLAR_PER_BUSHEL_MIN_CORN) {
                            price = price * BUSHELS_PER_SACK.MILHO; // $/Bu -> $/Sack
                            console.log(`[YAHOO MILHO] Converted $/Bu to $/Sack: ${originalPrice} -> ${price}`);
                        }
                    }

                    // Log if price was in ambiguous range (no conversion applied)
                    if (price === originalPrice) {
                        console.log(`[YAHOO ${d.category}] Price in ambiguous range, assumed already in $/Sack: ${price}`);
                    }
                }

                // Normal Currency Conversion
                if (selectedCurrency === 'BRL' && d.currency === 'USD') price *= rate;
                if (selectedCurrency === 'USD' && d.currency === 'BRL') price /= rate;

                totalConvertedPrice += price;
            });

            const avgPrice = totalConvertedPrice / bestSourcePrices.length;
            const dateStr = formatDate(bestSourcePrices[0].date); // Use one of the dates

            if (!dateMap.has(monthKey)) {
                dateMap.set(monthKey, {
                    date: dateStr,
                    rawDate: `${monthKey}-01`,
                    fertilizerPrice: null,
                    productPrices: [], // Legacy logic
                    productPrice: avgPrice
                });
            } else {
                const entry = dateMap.get(monthKey)!;
                entry.productPrice = avgPrice;
            }
        });

        // Convert map to array and sort
        let merged = Array.from(dateMap.values())
            .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

        // Forward Fill Fertilizer Price to extend the line to the future matches (Soy Futures)
        let lastFertPrice: number | null = null;
        merged = merged.map(item => {
            if (item.fertilizerPrice !== null) {
                lastFertPrice = item.fertilizerPrice;
                return item;
            } else if (lastFertPrice !== null) {
                // Project the last known price forward
                return { ...item, fertilizerPrice: lastFertPrice };
            }
            return item;
        });

        // Filter by Time Range
        const now = new Date();
        let cutoffDate = new Date();

        switch (timeRange) {
            case '1y': cutoffDate.setFullYear(now.getFullYear() - 1); break;
            case '3y': cutoffDate.setFullYear(now.getFullYear() - 3); break;
            case '5y': cutoffDate.setFullYear(now.getFullYear() - 6); break; // Increased to 6 to ensure full 2020 data is shown
        }

        return merged.filter(d => new Date(d.rawDate) >= cutoffDate);
    }, [localData, exchangeRates, selectedFertilizer, selectedProduct, selectedCurrency, timeRange, simDollar]);

    // Filter Purchase Events
    const filteredPurchases = useMemo(() => {
        return purchaseEvents.filter(p => p.category === selectedFertilizer).map(p => {
            // Convert purchase price to selected currency for display
            const rate = exchangeRates.find(r => r.date === p.date)?.rate_sell || simDollar;
            let displayPrice = p.price;
            if (selectedCurrency === 'BRL' && p.currency === 'USD') displayPrice *= rate;
            if (selectedCurrency === 'USD' && p.currency === 'BRL') displayPrice /= rate;

            return {
                ...p,
                displayPrice,
                dateStr: formatDate(p.date)
            };
        });
    }, [purchaseEvents, selectedFertilizer, selectedCurrency, exchangeRates, simDollar]);


    // Derived Calculations for Simulation
    const totalCostRaw = simPrice + simFreight;
    const totalCostBrl = simCurrency === 'BRL' ? totalCostRaw : totalCostRaw * simDollar;
    const totalCostUsd = simCurrency === 'USD' ? totalCostRaw : totalCostRaw / simDollar;
    const barterRatio = totalCostRaw / simSoyPrice; // sc/ton (works for both if inputs are consistent)

    // Trend Analysis (Using WORLD BANK Data)
    const analyzeTrend = () => {
        // Filter WB data for selected fertilizer
        const fertilizerWbData = wbData
            .filter(d => d.category === selectedFertilizer)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (fertilizerWbData.length < 2) return { trend: 'neutral', change: 0 };

        // Find last two points
        const last = fertilizerWbData[fertilizerWbData.length - 1].price;
        const prev = fertilizerWbData[fertilizerWbData.length - 2].price;
        const change = ((last - prev) / prev) * 100;
        return {
            trend: change < -2 ? 'down' : change > 2 ? 'up' : 'neutral',
            change
        };
    };

    const wbTrend = analyzeTrend();

    // Smart Alerts Logic
    const getAlert = () => {
        // 1. Global Trend Alert
        if (wbTrend.trend === 'down' && wbTrend.change < -5) {
            return {
                type: 'warning',
                message: '📉 Tendência de Baixa Global detectada. Considere aguardar o repasse para o mercado interno.',
                color: 'bg-yellow-100 text-yellow-800 border-yellow-300'
            };
        }

        // 2. Buy Opportunity (Good Barter + Rising Global)
        const threshold = selectedFertilizer === 'UREIA' ? 28 : selectedFertilizer === 'KCL' ? 20 : 35;
        const isBarterGood = barterRatio < threshold;
        if (isBarterGood && wbTrend.trend === 'up') {
            return {
                type: 'success',
                message: 'COMPRA FORTE IMEDIATA: Barter favorável e tendência de alta global.',
                color: 'bg-green-100 text-green-800 border-green-300'
            };
        }

        // 3. Wait (Bad Barter + Falling Global)
        if (!isBarterGood && wbTrend.trend === 'down') {
            return {
                type: 'caution',
                message: 'AGUARDE - QUEDA PROVÁVEL: Barter desfavorável e preços globais caindo.',
                color: 'bg-red-100 text-red-800 border-red-300'
            };
        }

        return null;
    };

    const smartAlert = getAlert();

    // 4. Historical Barter Ratio Data
    const barterChartData = useMemo(() => {
        return chartData.map(d => {
            if (d.productPrice && d.fertilizerPrice) {
                return {
                    date: d.date,
                    rawDate: d.rawDate,
                    ratio: d.fertilizerPrice / d.productPrice
                };
            }
            return null;
        }).filter(d => d !== null);
    }, [chartData]);

    // 5. Sensitivity Analysis Matrix
    const sensitivityMatrix = useMemo(() => {
        const variations = [-10, -5, 0, 5, 10]; // Percentage variations
        return variations.map(soyVar => {
            const soyP = simSoyPrice * (1 + soyVar / 100);
            return {
                soyVariation: soyVar,
                ratios: variations.map(fertVar => {
                    const fertP = (simPrice + simFreight) * (1 + fertVar / 100);
                    return {
                        fertVariation: fertVar,
                        ratio: fertP / soyP
                    };
                })
            };
        });
    }, [simPrice, simFreight, simSoyPrice]);

    // 7. Seasonality Analysis
    const seasonalityData = useMemo(() => {
        const monthlyData: { [key: number]: number[] } = {};
        const currentYearData: { [key: number]: number } = {};
        const currentYear = new Date().getFullYear();

        chartData.forEach(d => {
            if (d.fertilizerPrice) {
                const date = new Date(d.rawDate);
                const month = date.getMonth();
                const year = date.getFullYear();

                if (year === currentYear) {
                    currentYearData[month] = d.fertilizerPrice;
                }

                if (!monthlyData[month]) monthlyData[month] = [];
                monthlyData[month].push(d.fertilizerPrice);
            }
        });

        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return months.map((name, index) => {
            const prices = monthlyData[index] || [];
            const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
            return {
                month: name,
                average: avg,
                current: currentYearData[index] || null
            };
        });
    }, [chartData]);

    // 6. Cost per Hectare
    const [applicationRate, setApplicationRate] = useState<number>(150); // kg/ha
    const costPerHa = (totalCostRaw / 1000) * applicationRate; // in simCurrency
    const costPerHaBrl = simCurrency === 'BRL' ? costPerHa : costPerHa * simDollar;
    const costPerHaUsd = simCurrency === 'USD' ? costPerHa : costPerHa / simDollar;

    // Sync simulation state with global filters
    useEffect(() => {
        setSimCurrency(selectedCurrency);
    }, [selectedCurrency]);

    return (
        <div className="space-y-6 p-6">
            {/* Top Controls Section */}
            <div className="flex flex-col gap-4 bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-gray-800">Barter Dashboard</h2>
                        <p className="text-sm text-gray-500">Análise de Troca e Mercado</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 mr-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2 text-gray-600"
                                onClick={() => setIsAlertModalOpen(true)}
                            >
                                <Bell className="h-4 w-4 text-yellow-600" />
                                <span className="hidden sm:inline">Alertas de Preço</span>
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2 text-gray-600"
                                onClick={() => setIsBarterAlertModalOpen(true)}
                            >
                                <ArrowRightLeft className="h-4 w-4 text-purple-600" />
                                <span className="hidden sm:inline">Alertas de Troca</span>
                            </Button>
                        </div>

                        <MarketDataManager
                            customTrigger={
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:bg-gray-100" title="Gerenciar Dados">
                                    <Settings className="h-5 w-5" />
                                </Button>
                            }
                            defaultTab="prices"
                        />
                    </div>
                </div>

                <div className="h-px bg-gray-100 w-full" />

                <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
                    <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                        <div className="flex flex-col gap-1.5 w-full md:w-auto">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Fertilizante</Label>
                            <div className="flex gap-2">
                                <Select value={selectedFertilizer} onValueChange={(v) => setSelectedFertilizer(v as FertilizerType)}>
                                    <SelectTrigger className="w-[200px] h-10 bg-gray-50/50 border-gray-200">
                                        <SelectValue placeholder="Insumo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UREIA">Ureia</SelectItem>
                                        <SelectItem value="KCL">Cloreto de Potássio (KCL)</SelectItem>
                                        <SelectItem value="MAP">MAP (11-52)</SelectItem>
                                        <SelectItem value="TSP">Super Triplo (TSP)</SelectItem>
                                        <SelectItem value="DAP">DAP (18-46-0)</SelectItem>
                                        <SelectItem value="SSP">Super Simples (SSP)</SelectItem>
                                        <SelectItem value="SULFATO_AMONIO">Sulfato de Amônio</SelectItem>
                                    </SelectContent>
                                </Select>
                                <QuickPriceEntryModal defaultCategory={selectedFertilizer} onSuccess={() => router.refresh()} />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 w-1/2 md:w-auto">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</Label>
                            <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v as ProductType)}>
                                <SelectTrigger className="w-full md:w-[140px] h-10 bg-gray-50/50 border-gray-200">
                                    <SelectValue placeholder="Produto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SOJA">Soja</SelectItem>
                                    <SelectItem value="MILHO">Milho</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5 w-1/3 md:w-auto">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Moeda</Label>
                            <Select value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as CurrencyType)}>
                                <SelectTrigger className="w-full md:w-[110px] h-10 bg-gray-50/50 border-gray-200">
                                    <SelectValue placeholder="Moeda" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">Dólar (USD)</SelectItem>
                                    <SelectItem value="BRL">Real (BRL)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <MarketDataManager
                        customTrigger={
                            <Button className="bg-purple-600 hover:bg-purple-700 h-10 gap-2 shadow-sm whitespace-nowrap px-6 w-full md:w-auto">
                                <ShoppingCart className="h-4 w-4" />
                                Minhas Compras
                            </Button>
                        }
                        defaultTab="purchases"
                        hideTabs={true}
                    />
                </div>
            </div>

            <BarterAIInsights
                fertilizer={selectedFertilizer}
                product={selectedProduct}
                currency={selectedCurrency}
                trend={wbTrend as { trend: 'up' | 'down' | 'neutral'; change: number }}
            />

            <div className="flex flex-col md:flex-row gap-6">
                <Card className="flex-1 border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader>
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-blue-600" />
                                        Análise Harmonizada de Mercado
                                    </CardTitle>
                                    <CardDescription>
                                        Comparativo {selectedProduct} vs {selectedFertilizer} ({selectedCurrency})
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2 items-center">
                                    {/* Filters moved to top */}
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                {['1y', '3y', '5y'].map((range) => (
                                    <Badge
                                        key={range}
                                        variant={timeRange === range ? "default" : "outline"}
                                        className="cursor-pointer hover:bg-primary/90"
                                        onClick={() => setTimeRange(range as any)}
                                    >
                                        {range.toUpperCase()}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="rawDate"
                                        tickFormatter={(val) => formatDate(val)}
                                        minTickGap={40}
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    {/* Left Axis: Product (Grain) */}
                                    <YAxis
                                        yAxisId="left"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => selectedCurrency === 'USD' ? `$${value}` : `R$${value}`}
                                        label={{ value: `${selectedProduct} (${selectedCurrency}/sc)`, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#10b981' } }}
                                    />
                                    {/* Right Axis: Fertilizer */}
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => selectedCurrency === 'USD' ? `$${value}` : `R$${value}`}
                                        label={{ value: `${selectedFertilizer} (${selectedCurrency}/ton)`, angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#2563eb' } }}
                                    />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-white p-3 border rounded-lg shadow-lg text-sm z-50">
                                                        <p className="font-semibold mb-2">{label}</p>
                                                        {payload.map((entry: any, index: number) => {
                                                            if (entry.name === 'Minhas Compras') {
                                                                const data = entry.payload;
                                                                return (
                                                                    <div key={index} className="text-purple-600 mt-2 pt-2 border-t border-gray-100">
                                                                        <p className="font-bold flex items-center gap-1">
                                                                            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                                                                            Minha Compra
                                                                        </p>
                                                                        <p>Preço: {selectedCurrency === 'USD' ? '$' : 'R$'}{Number(entry.value).toFixed(2)}</p>
                                                                        <p>Qtd: {data.quantity} {data.unit}</p>
                                                                        {data.notes && <p className="text-xs text-gray-500 italic max-w-[200px]">{data.notes}</p>}
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <p key={index} style={{ color: entry.color }}>
                                                                    {entry.name}: {selectedCurrency === 'USD' ? '$' : 'R$'}{Number(entry.value).toFixed(2)}
                                                                </p>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="fertilizerPrice"
                                        name={selectedFertilizer}
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                        dot={false}
                                        connectNulls
                                    />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="productPrice"
                                        name={selectedProduct}
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        dot={false}
                                        connectNulls
                                    />
                                    <Scatter
                                        yAxisId="right"
                                        data={filteredPurchases}
                                        dataKey="displayPrice"
                                        name="Minhas Compras"
                                        fill="#9333ea"
                                        shape="star"
                                        r={6}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">Tendência {selectedFertilizer}:</span>
                                <Badge variant={wbTrend.trend === 'up' ? 'destructive' : wbTrend.trend === 'down' ? 'default' : 'secondary'} className={wbTrend.trend === 'down' ? 'bg-green-500 hover:bg-green-600' : ''}>
                                    {wbTrend.change > 0 ? '+' : ''}{wbTrend.change.toFixed(1)}%
                                </Badge>
                            </div>
                            <div className="text-xs text-gray-400">
                                Fonte: World Bank & IMEA
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Section B: Local Reality & Simulation */}
                <Card className="flex-1 border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5 text-green-600" />
                                    Realidade Local & Simulação
                                </CardTitle>
                                <CardDescription>
                                    Calcule sua relação de troca atual
                                </CardDescription>
                            </div>
                            <Select value={simCurrency} onValueChange={(v) => setSimCurrency(v as CurrencyType)}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="Moeda" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="BRL">BRL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Scenario Manager */}
                        <div className="bg-gray-50 p-3 rounded-lg border flex flex-col gap-3 mb-6">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs font-semibold text-gray-500 uppercase">Cenários Salvos</Label>
                                {selectedScenarioId && (
                                    <Button variant="ghost" size="sm" className="h-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteScenario(selectedScenarioId)}>Excluir Atual</Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Select value={selectedScenarioId} onValueChange={handleLoadScenario}>
                                    <SelectTrigger className="flex-1 h-9 bg-white">
                                        <SelectValue placeholder="Carregar cenário..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {scenarios.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name} ({new Date(s.created_at).toLocaleDateString()})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2 items-center border-t border-gray-200 pt-2 mt-1">
                                <Input
                                    placeholder="Nome para salvar novo cenário..."
                                    value={scenarioName}
                                    onChange={e => setScenarioName(e.target.value)}
                                    className="h-9 bg-white text-sm"
                                />
                                <Button size="sm" onClick={handleSaveScenario} disabled={isSavingScenario} className="h-9 bg-green-600 hover:bg-green-700 text-white gap-2">
                                    {isSavingScenario ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    <span className="sr-only sm:not-sr-only sm:inline-block">Salvar</span>
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <Label htmlFor="price">Preço {selectedFertilizer} ({simCurrency === 'USD' ? 'USD' : 'R$'}/ton)</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    value={simPrice}
                                    onChange={(e) => setSimPrice(Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="freight">Frete ({simCurrency === 'USD' ? 'USD' : 'R$'}/ton)</Label>
                                <Input
                                    id="freight"
                                    type="number"
                                    value={simFreight}
                                    onChange={(e) => setSimFreight(Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dollar">Dólar (R$)</Label>
                                <Input
                                    id="dollar"
                                    type="number"
                                    step="0.01"
                                    value={simDollar}
                                    onChange={(e) => setSimDollar(Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="soy">Soja ({simCurrency === 'USD' ? 'USD' : 'R$'}/sc)</Label>
                                <Input
                                    id="soy"
                                    type="number"
                                    value={simSoyPrice}
                                    onChange={(e) => setSimSoyPrice(Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="appRate">Taxa de Aplicação (kg/ha)</Label>
                                <Input
                                    id="appRate"
                                    type="number"
                                    value={applicationRate}
                                    onChange={(e) => setApplicationRate(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Custo Final ({simCurrency === 'USD' ? 'USD' : 'R$'}/ton):</span>
                                <span className="font-bold text-lg">
                                    {simCurrency === 'USD' ? '$' : 'R$'}{simCurrency === 'USD' ? totalCostUsd.toFixed(2) : totalCostBrl.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Custo por Hectare:</span>
                                <span className="font-bold text-lg text-orange-600">
                                    {simCurrency === 'USD' ? '$' : 'R$'}{simCurrency === 'USD' ? costPerHaUsd.toFixed(2) : costPerHaBrl.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center border-t pt-2">
                                <span className="text-sm text-gray-600 font-medium">Relação de Troca:</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-extrabold text-blue-600">{barterRatio.toFixed(1)}</span>
                                    <span className="text-sm text-gray-500">sc/ton</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Smart Alert Section */}
            {smartAlert && (
                <div className={`p-4 rounded-lg border flex items-start gap-3 ${smartAlert.color} animate-in fade-in slide-in-from-bottom-2`}>
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold">Análise de Inteligência</h4>
                        <p className="text-sm opacity-90">{smartAlert.message}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Comparative Chart (Legacy / Simplified) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico Local vs. Simulação Atual ({selectedCurrency})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={[...chartData.map(d => ({ date: d.date, price: d.fertilizerPrice, isSimulation: false })), { date: 'Hoje', price: selectedCurrency === 'USD' ? totalCostUsd : totalCostBrl, rawDate: new Date().toISOString(), isSimulation: true }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => selectedCurrency === 'USD' ? `$${value}` : `R$${value}`}
                                    />
                                    <Tooltip
                                        cursor={{ strokeDasharray: '3 3' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-2 border rounded shadow-sm text-sm">
                                                        <p className="font-bold">{data.date}</p>
                                                        <p className="text-blue-600">
                                                            {data.isSimulation ? 'Sua Simulação: ' : 'Histórico: '}
                                                            {selectedCurrency === 'USD' ? '$' : 'R$'}{Number(data.price).toFixed(2)}
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        name={`Histórico ${selectedFertilizer} (${selectedCurrency})`}
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                    <Scatter
                                        dataKey="price"
                                        name="Sua Simulação"
                                        fill="#ef4444"
                                        shape="circle"
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Historical Barter Ratio Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico da Relação de Troca</CardTitle>
                        <CardDescription>Sacas de {selectedProduct} necessárias para comprar 1 ton de {selectedFertilizer}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={barterChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [`${value.toFixed(1)} sc/ton`, 'Relação de Troca']}
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="ratio"
                                        name="Relação de Troca (sc/ton)"
                                        stroke="#f59e0b"
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                    {/* Current Simulation Reference Line */}
                                    <ReferenceLine y={barterRatio} label="Sua Simulação" stroke="red" strokeDasharray="3 3" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Sensitivity Analysis Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Matriz de Sensibilidade: Relação de Troca</CardTitle>
                        <CardDescription>Como a variação de preços afeta seu poder de compra</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-center">
                                <thead>
                                    <tr>
                                        <th className="p-2 bg-slate-100 rounded-tl-lg">Soja \ Insumo</th>
                                        {sensitivityMatrix[0].ratios.map((r, i) => (
                                            <th key={i} className="p-2 bg-slate-100 font-semibold">
                                                {r.fertVariation > 0 ? '+' : ''}{r.fertVariation}%
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sensitivityMatrix.map((row, i) => (
                                        <tr key={i} className="border-b last:border-0">
                                            <td className="p-2 font-semibold bg-slate-50">
                                                {row.soyVariation > 0 ? '+' : ''}{row.soyVariation}%
                                            </td>
                                            {row.ratios.map((cell, j) => (
                                                <td key={j} className={`p-2 ${cell.ratio < barterRatio ? 'text-green-600 font-bold' : 'text-slate-600'}`}>
                                                    {cell.ratio.toFixed(1)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Seasonality Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Sazonalidade de Preços ({selectedFertilizer})</CardTitle>
                        <CardDescription>Média histórica mensal vs. Ano Atual</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={seasonalityData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => selectedCurrency === 'USD' ? `$${value}` : `R$${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [
                                            selectedCurrency === 'USD' ? `$${value.toFixed(2)}` : `R$${value.toFixed(2)}`,
                                        ]}
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="average"
                                        name="Média Histórica"
                                        stroke="#94a3b8"
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={{ r: 4 }}
                                        connectNulls
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="current"
                                        name={`Ano ${new Date().getFullYear()}`}
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                        dot={{ r: 4 }}
                                        connectNulls
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <PriceAlertConfigModal
                isOpen={isAlertModalOpen}
                onClose={() => setIsAlertModalOpen(false)}
            />
            <BarterAlertConfigModal
                isOpen={isBarterAlertModalOpen}
                onClose={() => setIsBarterAlertModalOpen(false)}
            />
        </div>
    );
}

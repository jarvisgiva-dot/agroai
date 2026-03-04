'use client';

import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

interface BarterChartProps {
    data: any[];
    simulationPoint?: {
        date: string;
        ratio: number;
    } | null;
    inputName: string;
    selectedCrop: 'SOJA' | 'MILHO';
    currency: 'BRL' | 'USD';
    onCurrencyChange: (currency: 'BRL' | 'USD') => void;
}

export function BarterChart({ data, simulationPoint, inputName, selectedCrop, currency, onCurrencyChange }: BarterChartProps) {
    // Transform data
    const chartData = data.map(item => {
        const cropKey = `${selectedCrop}_${currency}`;
        const inputKey = `${inputName}_${currency}`;

        let cropPrice = item[cropKey];
        let inputPrice = item[inputKey];

        // Fallback logic
        if (cropPrice === undefined) cropPrice = item[selectedCrop];
        if (inputPrice === undefined) inputPrice = item[inputName];

        const dollarRate = item['DOLLAR'] || 0;

        const ratio = cropPrice > 0 ? inputPrice / cropPrice : 0;

        let formattedDate = '';
        try {
            if (item.date) {
                formattedDate = format(new Date(item.date), 'MMM/yy', { locale: ptBR });
            } else {
                formattedDate = 'N/A';
            }
        } catch (e) {
            formattedDate = 'Inv';
        }

        return {
            ...item,
            ratio: Number(ratio.toFixed(2)),
            cropPrice: Number(cropPrice || 0),
            inputPrice: Number(inputPrice || 0),
            dollarRate: Number(dollarRate || 0),
            formattedDate
        };
    });

    // Add simulation point
    const finalData = [...chartData];
    if (simulationPoint) {
        finalData.push({
            date: simulationPoint.date,
            formattedDate: 'Simulação',
            ratio: simulationPoint.ratio,
            isSimulation: true
        });
    }

    const currencySymbol = currency === 'BRL' ? 'R$' : '$';

    return (
        <div className="h-[550px] w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Histórico da Relação de Troca</h3>
                    <p className="text-sm text-gray-500">
                        {inputName} vs {selectedCrop} (Sacas/Ton)
                    </p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <Button
                        variant={currency === 'BRL' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onCurrencyChange('BRL')}
                        className="h-8 text-xs"
                    >
                        R$ (Reais)
                    </Button>
                    <Button
                        variant={currency === 'USD' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onCurrencyChange('USD')}
                        className="h-8 text-xs"
                    >
                        $ (Dólar)
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={finalData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRatio" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

                        <XAxis
                            dataKey="formattedDate"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />

                        <YAxis
                            yAxisId="left"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value} scs`}
                        />

                        <YAxis
                            yAxisId="right_price"
                            orientation="right"
                            stroke="#10b981"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            hide={true}
                        />

                        <YAxis
                            yAxisId="right_dollar"
                            orientation="right"
                            stroke="#ef4444"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            hide={true}
                            domain={[4, 6]}
                        />

                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                            }}
                            itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                            labelStyle={{ color: '#64748b', marginBottom: '8px', fontSize: '12px' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'Relação de Troca') return [`${value} sacas/ton`, name];
                                if (name === 'Dólar (PTAX)') return [`R$ ${value}`, name];
                                if (name.includes('Preço')) return [`${currencySymbol} ${value}`, name];
                                return [value, name];
                            }}
                        />

                        <Legend
                            verticalAlign="top"
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
                        />

                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="ratio"
                            name="Relação de Troca"
                            stroke="#0ea5e9"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRatio)"
                            connectNulls={true}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />

                        <Line
                            yAxisId="right_price"
                            type="monotone"
                            dataKey="cropPrice"
                            name={`Preço ${selectedCrop}`}
                            stroke={selectedCrop === 'SOJA' ? '#10b981' : '#f59e0b'}
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="5 5"
                            connectNulls={true}
                        />

                        <Line
                            yAxisId="right_price"
                            type="monotone"
                            dataKey="inputPrice"
                            name={`Preço ${inputName}`}
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="3 3"
                            connectNulls={true}
                        />

                        <Line
                            yAxisId="right_dollar"
                            type="monotone"
                            dataKey="dollarRate"
                            name="Dólar (PTAX)"
                            stroke="#ef4444"
                            strokeWidth={1}
                            dot={false}
                            connectNulls={true}
                            strokeOpacity={0.7}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

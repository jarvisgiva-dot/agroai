"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown } from "lucide-react"
import { prepareTalhaoComparisonData, ProductivityData } from "@/lib/multiYearUtils"
import { getSafraLabel } from "@/lib/safraUtils"

// Cores dinâmicas para anos
const YEAR_COLORS = [
    '#6366f1', // indigo
    '#10b981', // green
    '#f59e0b', // orange
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#ef4444', // red
    '#ec4899', // pink
]

interface YearOverYearTalhaoChartProps {
    data: ProductivityData[]
    selectedYears: number[]
    cultura?: string
    fazenda?: string
    limit?: number
}

const ModernTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20">
                <p className="font-bold text-gray-900 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-gray-600">{entry.name}:</span>
                        </div>
                        <span className="font-bold text-gray-900">
                            {entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} sc/ha
                        </span>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

export function YearOverYearTalhaoChart({
    data,
    selectedYears,
    cultura,
    fazenda,
    limit = 10
}: YearOverYearTalhaoChartProps) {
    const filteredData = useMemo(() => {
        let filtered = data

        if (cultura && cultura !== 'todas') {
            filtered = filtered.filter(item =>
                item.cultura?.toUpperCase().trim() === cultura.toUpperCase().trim()
            )
        }

        if (fazenda && fazenda !== 'todas') {
            filtered = filtered.filter(item => item.fazenda_lavoura === fazenda)
        }

        return filtered
    }, [data, cultura, fazenda])

    const chartData = useMemo(() => {
        if (selectedYears.length === 0) return []
        return prepareTalhaoComparisonData(filteredData, selectedYears, limit)
    }, [filteredData, selectedYears, limit])

    const years = useMemo(() => selectedYears.sort((a, b) => a - b), [selectedYears])

    if (selectedYears.length === 0) {
        return (
            <Card className="border-0 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-xl">Comparação de Talhões entre Safras</CardTitle>
                    <CardDescription>Selecione pelo menos um ano para comparar</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex items-center justify-center">
                    <p className="text-gray-400">Nenhum ano selecionado</p>
                </CardContent>
            </Card>
        )
    }

    if (chartData.length === 0) {
        return (
            <Card className="border-0 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-xl">Comparação de Talhões entre Safras</CardTitle>
                    <CardDescription>
                        Comparando {years.length} ano(s) selecionado(s)
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex items-center justify-center">
                    <p className="text-gray-400">
                        Nenhum talhão comum encontrado entre os anos selecionados
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                    Comparação de Talhões entre Safras
                    <span className="text-sm font-normal text-gray-500">
                        (Top {chartData.length} talhões)
                    </span>
                </CardTitle>
                <CardDescription>
                    Produtividade dos mesmos talhões em {years.length} safra(s) diferente(s)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            label={{ value: 'sc/ha', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                        />
                        <Tooltip content={<ModernTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            formatter={(value) => getSafraLabel(`${value}/${parseInt(value) + 1}`)}
                        />
                        {years.map((year, index) => (
                            <Bar
                                key={year}
                                dataKey={year.toString()}
                                fill={YEAR_COLORS[index % YEAR_COLORS.length]}
                                radius={[4, 4, 0, 0]}
                                name={year.toString()}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>

                {/* Insights */}
                <div className="mt-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl">
                    <p className="text-sm font-medium text-gray-700 mb-2">💡 Insights:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                        <li>• {chartData.length} talhões aparecem em todas as safras selecionadas</li>
                        <li>• Compare a performance de cada talhão ao longo dos anos</li>
                        <li>• Identifique talhões com melhoria ou queda de produtividade</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    )
}

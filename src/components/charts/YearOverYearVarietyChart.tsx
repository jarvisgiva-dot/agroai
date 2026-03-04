"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'
import { compareVarietiesAcrossYears, ProductivityData } from "@/lib/multiYearUtils"

// Cores para variedades
const VARIETY_COLORS = [
    '#6366f1', // indigo
    '#10b981', // green
    '#f59e0b', // orange
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#ef4444', // red
    '#ec4899', // pink
    '#14b8a6', // teal
]

interface YearOverYearVarietyChartProps {
    data: ProductivityData[]
    selectedYears: number[]
    cultura?: string
    fazenda?: string
}

const ModernTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20">
                <p className="font-bold text-gray-900 mb-2">Safra {label}/{parseInt(label) + 1}</p>
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

export function YearOverYearVarietyChart({
    data,
    selectedYears,
    cultura,
    fazenda
}: YearOverYearVarietyChartProps) {
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

    const varietyData = useMemo(() => {
        if (selectedYears.length === 0) return []
        return compareVarietiesAcrossYears(filteredData, undefined, selectedYears)
    }, [filteredData, selectedYears])

    // Formata dados para o gráfico de linhas
    const chartData = useMemo(() => {
        if (varietyData.length === 0) return []

        const yearSet = new Set<number>()
        varietyData.forEach(v => v.data.forEach(d => yearSet.add(d.year)))
        const years = Array.from(yearSet).sort((a, b) => a - b)

        return years.map(year => {
            const point: any = { year }
            varietyData.forEach(variety => {
                const yearData = variety.data.find(d => d.year === year)
                if (yearData) {
                    point[variety.variety] = yearData.productivity
                }
            })
            return point
        })
    }, [varietyData])

    if (selectedYears.length === 0) {
        return (
            <Card className="border-0 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-xl">Evolução de Variedades entre Safras</CardTitle>
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
                    <CardTitle className="text-xl">Evolução de Variedades entre Safras</CardTitle>
                    <CardDescription>
                        Comparando {selectedYears.length} ano(s) selecionado(s)
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex items-center justify-center">
                    <p className="text-gray-400">Nenhum dado disponível para os anos selecionados</p>
                </CardContent>
            </Card>
        )
    }

    // Calcula média geral
    const overallAverage = useMemo(() => {
        if (chartData.length === 0 || varietyData.length === 0) return 0

        const allValues: number[] = []
        varietyData.forEach(v => v.data.forEach(d => allValues.push(d.productivity)))

        return allValues.reduce((sum, val) => sum + val, 0) / allValues.length
    }, [varietyData, chartData])

    // Calcula média por ano
    const yearAverages = useMemo(() => {
        const averages: Record<number, number> = {}

        chartData.forEach(point => {
            const year = point.year
            const values: number[] = []

            varietyData.forEach(variety => {
                if (point[variety.variety] !== undefined) {
                    values.push(point[variety.variety])
                }
            })

            if (values.length > 0) {
                averages[year] = values.reduce((sum, val) => sum + val, 0) / values.length
            }
        })

        return averages
    }, [chartData, varietyData])

    // Cores para médias por ano
    const YEAR_COLORS = ['#94a3b8', '#64748b', '#475569']

    return (
        <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                    Evolução de Variedades entre Safras
                    <span className="text-sm font-normal text-gray-500">
                        ({varietyData.length} variedade{varietyData.length !== 1 ? 's' : ''})
                    </span>
                </CardTitle>
                <CardDescription>
                    Performance das variedades ao longo de {selectedYears.length} safra(s)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="year"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}/${value + 1}`}
                        />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            label={{ value: 'sc/ha', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                            domain={['dataMin - 10', 'dataMax + 10']}
                        />
                        <Tooltip content={<ModernTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        {/* Linha de média geral */}
                        <Line
                            type="monotone"
                            dataKey={() => overallAverage}
                            stroke="#cbd5e1"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            name="Média Geral"
                        />

                        {/* Linhas de média por ano */}
                        {Object.entries(yearAverages).map(([year, avg], index) => (
                            <Line
                                key={`avg-${year}`}
                                type="monotone"
                                dataKey={() => avg}
                                stroke={YEAR_COLORS[index % YEAR_COLORS.length]}
                                strokeWidth={2}
                                strokeDasharray="3 3"
                                dot={false}
                                name={`Média ${year}/${parseInt(year) + 1}`}
                            />
                        ))}

                        {/* Linhas das variedades */}
                        {varietyData.map((variety, index) => (
                            <Line
                                key={variety.variety}
                                type="monotone"
                                dataKey={variety.variety}
                                stroke={VARIETY_COLORS[index % VARIETY_COLORS.length]}
                                strokeWidth={3}
                                dot={{ r: 5, strokeWidth: 2, fill: 'white' }}
                                activeDot={{ r: 7 }}
                                name={variety.variety}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>

                {/* Insights */}
                <div className="mt-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl">
                    <p className="text-sm font-medium text-gray-700 mb-2">💡 Insights:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                        <li>• Média geral de produtividade: {overallAverage.toFixed(2)} sc/ha</li>
                        <li>• {varietyData.length} variedade(s) encontrada(s) nos anos selecionados</li>
                        <li>• Linha tracejada mostra a média geral de todas as variedades</li>
                        <li>• Identifique variedades consistentes ou com tendência de melhoria</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    )
}

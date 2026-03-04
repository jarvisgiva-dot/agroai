"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, Sprout, Package, Layers, CalendarRange, ArrowDownWideNarrow, ArrowUpWideNarrow, CalendarRange as CalendarIcon, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { YearOverYearVarietyChart } from "@/components/charts/YearOverYearVarietyChart"
import { YearOverYearTalhaoChart } from "@/components/charts/YearOverYearTalhaoChart"
import { MultiSelect } from "@/components/ui/multi-select"
import { AIInsights } from "@/components/dashboard/AIInsights"

// Modern Tooltip
const ModernTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 animate-in fade-in-0 zoom-in-95">
                <p className="font-bold text-gray-900 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                            <span className="text-gray-600">{entry.name}:</span>
                        </div>
                        <span className="font-bold text-gray-900">
                            {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

// KPI Card Component
const KPICard = ({ title, value, subtitle, icon: Icon, color = "indigo" }: any) => {
    const colorClasses = {
        indigo: "from-indigo-500 to-purple-600",
        green: "from-green-500 to-emerald-600",
        blue: "from-blue-500 to-cyan-600",
        orange: "from-orange-500 to-red-600",
    }

    return (
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} opacity-10`} />
            <CardContent className="p-4 relative">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-600 mb-0.5">{title}</p>
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                    </div>
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]}`}>
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// Utility
const normalizeCultura = (cultura: string) => {
    if (!cultura) return ""
    return cultura.toUpperCase().trim()
        .replace(/\s+EM\s+GR[ÃA]OS/g, "")
        .replace(/\s+EM$/g, "")
        .trim()
}

export function ProductivityCharts() {
    const [activeTab, setActiveTab] = useState("analise-safra")

    // Single Safra State
    const [selectedCultura, setSelectedCultura] = useState<string>("soja")
    const [selectedSafra, setSelectedSafra] = useState<string>("")
    const [selectedFazenda, setSelectedFazenda] = useState<string>("todas")
    const [selectedTalhaoDetail, setSelectedTalhaoDetail] = useState<string>("todos")

    // Multi Safra State
    const [selectedMultiCultura, setSelectedMultiCultura] = useState<string>("soja")
    const [selectedComparisonYears, setSelectedComparisonYears] = useState<string[]>([])

    const [productivityData, setProductivityData] = useState<any[]>([])
    const [sortVariedadeDesc, setSortVariedadeDesc] = useState(true)
    const [sortTalhaoDesc, setSortTalhaoDesc] = useState(true)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase.from('produtividade_colheita').select('*')
            if (error) throw error
            setProductivityData(data || [])
        } catch (error: any) {
            console.error('Error fetching data:', error)
            setError(error.message || 'Erro desconhecido ao carregar dados')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // --- FILTERS ---

    const availableCulturas = useMemo(() => {
        const culturas = new Set<string>()
        productivityData.forEach(item => item.cultura && culturas.add(normalizeCultura(item.cultura)))
        return Array.from(culturas).sort()
    }, [productivityData])

    // Auto-select SOJA or first available cultura
    useEffect(() => {
        if (availableCulturas.length > 0) {
            // Find "soja" in a case-insensitive way
            const sojaMatch = availableCulturas.find(c => c.toLowerCase() === 'soja')

            // For Single Safra Tab
            if (selectedCultura === "" || selectedCultura === "soja") {
                if (sojaMatch) {
                    if (selectedCultura !== sojaMatch) setSelectedCultura(sojaMatch)
                } else if (selectedCultura === "" || selectedCultura === "soja") {
                    setSelectedCultura(availableCulturas[0])
                }
            }

            // For Multi Safra Tab
            if (selectedMultiCultura === "" || selectedMultiCultura === "soja") {
                if (sojaMatch) {
                    if (selectedMultiCultura !== sojaMatch) setSelectedMultiCultura(sojaMatch)
                } else if (selectedMultiCultura === "" || selectedMultiCultura === "soja") {
                    setSelectedMultiCultura(availableCulturas[0])
                }
            }
        }
    }, [availableCulturas, selectedCultura, selectedMultiCultura])

    const availableSafras = useMemo(() => {
        if (!selectedCultura) return []
        const safras = new Set<string>()
        productivityData
            .filter(item => normalizeCultura(item.cultura) === selectedCultura)
            .forEach(item => item.safra && safras.add(item.safra))
        return Array.from(safras).sort().reverse()
    }, [productivityData, selectedCultura])

    // Auto-select most recent safra
    useEffect(() => {
        if (availableSafras.length > 0) {
            setSelectedSafra(availableSafras[0])
        } else {
            setSelectedSafra("")
        }
    }, [availableSafras])

    // Reset multi-safra selection when culture changes
    useEffect(() => {
        setSelectedComparisonYears([])
    }, [selectedMultiCultura])

    const availableFazendas = useMemo(() => {
        if (!selectedCultura) return []
        const fazendas = new Set<string>()
        productivityData
            .filter(item => {
                if (normalizeCultura(item.cultura) !== selectedCultura) return false
                if (selectedSafra && item.safra !== selectedSafra) return false
                return true
            })
            .forEach(item => item.fazenda_lavoura && fazendas.add(item.fazenda_lavoura))
        return Array.from(fazendas).sort()
    }, [productivityData, selectedCultura, selectedSafra])

    const availableTalhoes = useMemo(() => {
        if (!selectedCultura || !selectedSafra) return []
        const talhoes = new Set<string>()
        productivityData
            .filter(item => {
                if (normalizeCultura(item.cultura) !== selectedCultura) return false
                if (item.safra !== selectedSafra) return false
                if (selectedFazenda !== "todas" && item.fazenda_lavoura !== selectedFazenda) return false
                return true
            })
            .forEach(item => item.talhao && talhoes.add(item.talhao))
        return Array.from(talhoes).sort()
    }, [productivityData, selectedCultura, selectedSafra, selectedFazenda])

    // --- MULTI-SAFRA FILTERS ---

    const availableMultiSafras = useMemo(() => {
        if (!selectedMultiCultura) return []
        const safras = new Set<string>()
        productivityData
            .filter(item => normalizeCultura(item.cultura) === selectedMultiCultura)
            .forEach(item => item.safra && safras.add(item.safra))
        return Array.from(safras).sort().reverse()
    }, [productivityData, selectedMultiCultura])

    // --- DATA PROCESSING ---

    const filteredProductivity = useMemo(() => {
        return productivityData.filter(item => {
            if (!selectedCultura || normalizeCultura(item.cultura) !== selectedCultura) return false
            if (selectedSafra && item.safra !== selectedSafra) return false
            if (selectedFazenda !== "todas" && item.fazenda_lavoura !== selectedFazenda) return false
            if (selectedTalhaoDetail !== "todos" && item.talhao !== selectedTalhaoDetail) return false
            return true
        })
    }, [productivityData, selectedCultura, selectedSafra, selectedFazenda, selectedTalhaoDetail])

    // KPIs
    const totalProducao = filteredProductivity.reduce((acc, item) => acc + (item.producao_liquida_sacas || 0), 0)
    const totalArea = filteredProductivity.reduce((acc, item) => acc + (item.area_colhida_ha || 0), 0)
    const avgProductivity = totalArea > 0 ? totalProducao / totalArea : 0

    // Charts
    const productivityByVariety = useMemo(() => {
        const grouped = filteredProductivity.reduce((acc: any, item) => {
            const key = item.variedade || 'Não especificado'
            if (!acc[key]) {
                acc[key] = { name: key, produtividade: 0, area: 0, count: 0 }
            }
            acc[key].produtividade += item.produtividade_liquida_scs_ha || 0
            acc[key].area += item.area_colhida_ha || 0
            acc[key].count += 1
            return acc
        }, {})

        return Object.values(grouped).map((item: any) => ({
            ...item,
            produtividade: item.produtividade / item.count,
        })).sort((a: any, b: any) => sortVariedadeDesc ? b.produtividade - a.produtividade : a.produtividade - b.produtividade)
    }, [filteredProductivity, sortVariedadeDesc])

    const areaByVariety = useMemo(() => {
        const grouped = filteredProductivity.reduce((acc: any, item) => {
            const key = item.variedade || 'Não especificado'
            if (!acc[key]) acc[key] = 0
            acc[key] += item.area_colhida_ha || 0
            return acc
        }, {})

        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a: any, b: any) => b.value - a.value)
    }, [filteredProductivity])

    const productivityByTalhao = useMemo(() => {
        // Group by Talhão to handle multiple entries per talhão (e.g. different varieties)
        const grouped = filteredProductivity.reduce((acc: any, item) => {
            const key = item.talhao || 'Não especificado'
            if (!acc[key]) {
                acc[key] = { talhao: key, produtividade: 0, area: 0, count: 0 }
            }
            // Weighted average by area would be better, but simple average for now
            acc[key].produtividade += item.produtividade_liquida_scs_ha || 0
            acc[key].count += 1
            return acc
        }, {})

        return Object.values(grouped)
            .map((item: any) => ({
                talhao: item.talhao,
                produtividade: item.produtividade / item.count
            }))
            .sort((a: any, b: any) => sortTalhaoDesc ? b.produtividade - a.produtividade : a.produtividade - b.produtividade)
    }, [filteredProductivity, sortTalhaoDesc])

    // Comparative Data Preparation for AI
    const comparativeData = useMemo(() => {
        if (selectedComparisonYears.length < 2) return null

        // Filter data for selected years
        const filtered = productivityData.filter(item =>
            normalizeCultura(item.cultura) === selectedMultiCultura &&
            selectedComparisonYears.includes(item.safra)
        )

        // Group by Variety and Year
        const varietyStats: Record<string, any> = {}
        filtered.forEach(item => {
            const key = item.variedade || 'Outros'
            if (!varietyStats[key]) varietyStats[key] = {}
            if (!varietyStats[key][item.safra]) {
                varietyStats[key][item.safra] = { sum: 0, count: 0 }
            }
            varietyStats[key][item.safra].sum += item.produtividade_liquida_scs_ha || 0
            varietyStats[key][item.safra].count += 1
        })

        const varietyEvolution = Object.entries(varietyStats)
            .map(([variety, safras]: [string, any]) => {
                const evolution: any = { variety }
                let total = 0
                let count = 0
                selectedComparisonYears.forEach(year => {
                    if (safras[year]) {
                        const val = safras[year].sum / safras[year].count
                        evolution[year] = val.toFixed(1)
                        total += val
                        count++
                    } else {
                        evolution[year] = 'N/A'
                    }
                })
                return { ...evolution, avg: count > 0 ? total / count : 0 }
            })
            .sort((a: any, b: any) => b.avg - a.avg)

        // Group by Talhão and Year (Top 10 variance)
        const talhaoStats: Record<string, any> = {}
        filtered.forEach(item => {
            const key = item.talhao || 'Outros'
            if (!talhaoStats[key]) talhaoStats[key] = {}
            if (!talhaoStats[key][item.safra]) {
                talhaoStats[key][item.safra] = { sum: 0, count: 0 }
            }
            talhaoStats[key][item.safra].sum += item.produtividade_liquida_scs_ha || 0
            talhaoStats[key][item.safra].count += 1
        })

        const talhaoEvolution = Object.entries(talhaoStats)
            .map(([talhao, safras]: [string, any]) => {
                const evolution: any = { talhao }
                let hasAllYears = true
                let totalProd = 0
                selectedComparisonYears.forEach(year => {
                    if (safras[year]) {
                        evolution[year] = (safras[year].sum / safras[year].count).toFixed(1)
                        totalProd += safras[year].sum / safras[year].count
                    } else {
                        evolution[year] = 'N/A'
                        hasAllYears = false
                    }
                })
                return { ...evolution, avg: totalProd / selectedComparisonYears.length, hasAllYears }
            })
            .filter(t => t.hasAllYears) // Only analyze talhões present in all selected years for better comparison
            .sort((a: any, b: any) => b.avg - a.avg)

        return {
            varieties: varietyEvolution,
            talhoes: talhaoEvolution
        }
    }, [productivityData, selectedMultiCultura, selectedComparisonYears])

    // Multi-Year Data Preparation
    const selectedYearsNumbers = useMemo(() => {
        return selectedComparisonYears.map(s => parseInt(s.split('/')[0])).filter(n => !isNaN(n))
    }, [selectedComparisonYears])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-lg text-gray-600 animate-pulse">Carregando análises...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in-0 duration-700">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-white border border-gray-200 p-1 rounded-2xl shadow-sm w-full md:w-auto grid grid-cols-2 md:inline-flex h-16">
                    <TabsTrigger value="analise-safra" className="rounded-xl h-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white gap-2 text-base font-medium">
                        <Layers className="h-5 w-5" />
                        Análise de Safra
                    </TabsTrigger>
                    <TabsTrigger value="comparativo" className="rounded-xl h-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white gap-2 text-base font-medium">
                        <CalendarRange className="h-5 w-5" />
                        Comparativo Multissafra
                    </TabsTrigger>
                </TabsList>

                {/* --- TAB 1: ANÁLISE DE SAFRA --- */}
                <TabsContent value="analise-safra" className="space-y-2">
                    {/* Filters */}
                    {/* Filters - Compact Standardized */}
                    {/* Header Row: Title + Filters */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2">
                        <h2 className="text-2xl font-bold tracking-tight text-gray-700">Análise de Safra</h2>

                        <div className="flex-shrink-0">
                            <Card className="border-none shadow-sm bg-gradient-to-r from-emerald-50/40 via-teal-50/40 to-emerald-50/40">
                                <CardContent className="p-1 px-3">
                                    <div className="flex flex-wrap gap-3 items-center">
                                        <div className="flex items-center gap-2 text-emerald-900/60 bg-white/50 px-3 py-1.5 rounded-full ring-1 ring-emerald-100">
                                            <Filter className="h-3.5 w-3.5" />
                                            <span className="text-xs font-semibold uppercase tracking-wide">Filtros</span>
                                        </div>

                                        <Select value={selectedCultura} onValueChange={setSelectedCultura}>
                                            <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-emerald-100 focus:ring-emerald-100 rounded-xl">
                                                <SelectValue placeholder="Cultura" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableCulturas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Select value={selectedSafra} onValueChange={setSelectedSafra} disabled={!selectedCultura}>
                                            <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-emerald-100 focus:ring-emerald-100 rounded-xl">
                                                <SelectValue placeholder="Safra" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSafras.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Select value={selectedFazenda} onValueChange={setSelectedFazenda} disabled={!selectedCultura}>
                                            <SelectTrigger className="w-[180px] h-8 text-sm bg-white/60 border-emerald-100 focus:ring-emerald-100 rounded-xl">
                                                <SelectValue placeholder="Fazenda" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todas">Todas</SelectItem>
                                                {availableFazendas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Select value={selectedTalhaoDetail} onValueChange={setSelectedTalhaoDetail} disabled={!selectedCultura}>
                                            <SelectTrigger className="w-[180px] h-8 text-sm bg-white/60 border-emerald-100 focus:ring-emerald-100 rounded-xl">
                                                <SelectValue placeholder="Talhão" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos</SelectItem>
                                                {availableTalhoes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* AI Insights - Single Safra */}
                    <AIInsights
                        context={{
                            cultura: selectedCultura,
                            safra: selectedSafra,
                            fazenda: selectedFazenda
                        }}
                        analysisType="productivity_safra"
                        data={{
                            varieties: productivityByVariety, // Full list
                            area: areaByVariety,
                            talhoes: productivityByTalhao // Full list
                        }}
                    />

                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KPICard title="Produção Total" value={totalProducao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} subtitle="sacas" icon={Package} color="indigo" />
                        <KPICard title="Área Colhida" value={totalArea.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} subtitle="hectares" icon={Sprout} color="green" />
                        <KPICard title="Produtividade Média" value={avgProductivity.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} subtitle="sc/ha" icon={TrendingUp} color="blue" />
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Produtividade por Variedade */}
                        <Card className="border-0 shadow-xl">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Performance por Variedade</CardTitle>
                                    <CardDescription>Produtividade média (sc/ha)</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSortVariedadeDesc(!sortVariedadeDesc)}>
                                    {sortVariedadeDesc ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={productivityByVariety} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                        <Tooltip content={<ModernTooltip />} />
                                        <Bar dataKey="produtividade" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                                            {productivityByVariety.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#818cf8'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Distribuição de Área */}
                        <Card className="border-0 shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-lg">Distribuição de Área</CardTitle>
                                <CardDescription>Hectares por variedade</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={areaByVariety}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {areaByVariety.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ec4899'][index % 4]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ModernTooltip />} />
                                        <Legend layout="vertical" verticalAlign="middle" align="right" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row 2: Produtividade por Talhão */}
                    <Card className="border-0 shadow-xl">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Produtividade por Talhão</CardTitle>
                                <CardDescription>Performance individual de cada talhão (sc/ha)</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSortTalhaoDesc(!sortTalhaoDesc)}>
                                {sortTalhaoDesc ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={productivityByTalhao} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="talhao" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'sc/ha', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip content={<ModernTooltip />} />
                                    <Bar dataKey="produtividade" fill="#10b981" radius={[4, 4, 0, 0]} name="Produtividade">
                                        {productivityByTalhao.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#34d399'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- TAB 2: COMPARATIVO MULTISSAFRA --- */}
                <TabsContent value="comparativo" className="space-y-6">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50">
                        <CardContent className="p-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                                <div>
                                    <Select value={selectedMultiCultura} onValueChange={setSelectedMultiCultura}>
                                        <SelectTrigger className="bg-white border-blue-200 h-9"><SelectValue placeholder="Selecione a cultura" /></SelectTrigger>
                                        <SelectContent>{availableCulturas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <MultiSelect
                                        options={availableMultiSafras.map(s => ({ label: s, value: s }))}
                                        selected={selectedComparisonYears}
                                        onChange={setSelectedComparisonYears}
                                        placeholder="Selecione safras para comparar..."
                                        className="bg-white border-blue-200"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Insights - Comparative */}
                    {selectedComparisonYears.length >= 2 && (
                        <AIInsights
                            mode="comparative"
                            comparativeContext={{
                                cultura: selectedMultiCultura,
                                safras: selectedComparisonYears
                            }}
                            analysisType="productivity_comparative"
                            data={comparativeData}
                        />
                    )}

                    {selectedComparisonYears.length < 2 ? (
                        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                            <CalendarIcon className="h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">Selecione pelo menos 2 safras para gerar o comparativo</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Comparativo de Variedades */}
                            <YearOverYearVarietyChart
                                data={productivityData}
                                selectedYears={selectedYearsNumbers}
                                cultura={selectedMultiCultura}
                            />

                            {/* Comparativo de Talhões */}
                            <YearOverYearTalhaoChart
                                data={productivityData}
                                selectedYears={selectedYearsNumbers}
                                cultura={selectedMultiCultura}
                                limit={15}
                            />
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

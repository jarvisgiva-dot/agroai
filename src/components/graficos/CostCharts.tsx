"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ComposedChart, Area, AreaChart, Cell, Treemap, ScatterChart, Scatter, ZAxis
} from 'recharts'
import { Loader2, DollarSign, TrendingDown, TrendingUp, PieChart as PieChartIcon, Layers, CalendarRange, ArrowRight, Filter, ArrowDownWideNarrow, ArrowUpWideNarrow, LayoutGrid, Activity, ChevronDown, ChevronUp } from "lucide-react"
import { CustoAplicacao, CustoCategoria, ProductivityItem } from "@/types"
import { MultiSelect } from "@/components/ui/multi-select"
import { AIInsights } from "@/components/dashboard/AIInsights"

// --- UTILS & COMPONENTS ---

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const ModernTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 animate-in fade-in-0 zoom-in-95 z-50">
                <p className="font-bold text-gray-900 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                            <span className="text-gray-600">{entry.name}:</span>
                        </div>
                        <span className="font-bold text-gray-900">
                            {formatter ? formatter(entry.value) : formatCurrency(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

const KPICard = ({ title, value, subtitle, icon: Icon, color = "indigo", trend }: any) => {
    const colorClasses = {
        indigo: "from-indigo-500 to-purple-600",
        emerald: "from-emerald-500 to-teal-600",
        blue: "from-blue-500 to-cyan-600",
        amber: "from-amber-500 to-orange-600",
        rose: "from-rose-500 to-pink-600",
    }

    return (
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} opacity-10`} />
            <CardContent className="p-4 relative">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-600 mb-0.5 uppercase tracking-wider">{title}</p>
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
                    </div>
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} shadow-md`}>
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                </div>
                {trend && (
                    <div className={`mt-2 flex items-center text-xs font-medium ${trend > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {Math.abs(trend)}% vs anterior
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// Custom Treemap Content with Interactive Hover
const CustomizedTreemapContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name, value, activeName, onHover, onLeave, containerWidth } = props;
    const safeName = name || (payload && payload.name) || '';
    const isActive = safeName === activeName;

    // Tooltip dimensions
    const tooltipWidth = 220;
    const tooltipHeight = 80;

    // Calculate tooltip position with boundary checks
    let tooltipX = x + width / 2 - tooltipWidth / 2;
    let tooltipY = y + height / 2 - tooltipHeight / 2;

    if (containerWidth) {
        // Right edge check
        if (tooltipX + tooltipWidth > containerWidth) {
            tooltipX = containerWidth - tooltipWidth - 10;
        }
        // Left edge check
        if (tooltipX < 0) {
            tooltipX = 10;
        }
    }

    return (
        <g
            onMouseEnter={() => onHover(safeName)}
            onMouseLeave={onLeave}
        >
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: depth < 2 ? colors[index % colors.length] : 'none',
                    stroke: '#fff',
                    strokeWidth: isActive ? 3 : 2 / (depth + 1e-10),
                    strokeOpacity: 1,
                    transition: 'all 0.2s ease-out',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                    filter: isActive ? 'drop-shadow(0px 4px 8px rgba(0,0,0,0.3))' : 'none',
                    cursor: 'pointer',
                    zIndex: isActive ? 10 : 1
                }}
            />
            {/* Text Logic: Show if large enough OR if Active */}
            {(isActive || (depth === 1 && width > 60 && height > 30)) ? (
                <g style={{ pointerEvents: 'none' }}>
                    {isActive ? (
                        // Active State: Fixed size popover with smart positioning
                        <g>
                            <rect
                                x={tooltipX}
                                y={tooltipY}
                                width={tooltipWidth}
                                height={tooltipHeight}
                                rx={8}
                                fill="rgba(0,0,0,0.9)"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth={1}
                            />
                            <text
                                x={tooltipX + tooltipWidth / 2}
                                y={tooltipY + 35}
                                textAnchor="middle"
                                fill="#fff"
                                fontSize={16}
                                fontWeight={600}
                                style={{ textShadow: 'none' }}
                            >
                                {safeName.length > 25 ? `${safeName.substring(0, 22)}...` : safeName}
                            </text>
                            <text
                                x={tooltipX + tooltipWidth / 2}
                                y={tooltipY + 65}
                                textAnchor="middle"
                                fill="#fbbf24" // Amber-400 for value
                                fontSize={18}
                                fontWeight={700}
                                style={{ textShadow: 'none' }}
                            >
                                {formatCurrency(value || 0)}
                            </text>
                        </g>
                    ) : (
                        // Normal State: Text constrained to cell
                        <text
                            x={x + width / 2}
                            y={y + height / 2 + 7}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={12}
                            fontWeight={500}
                            style={{ textShadow: '0px 0px 3px rgba(0,0,0,0.5)' }}
                        >
                            {safeName.length > width / 7 ? `${safeName.substring(0, Math.floor(width / 7))}...` : safeName}
                        </text>
                    )}
                </g>
            ) : null}
        </g>
    );
};

export function CostCharts() {
    const [loading, setLoading] = useState(true)
    const [custosAplicacao, setCustosAplicacao] = useState<CustoAplicacao[]>([])
    const [custosCategoria, setCustosCategoria] = useState<CustoCategoria[]>([])
    const [productivityData, setProductivityData] = useState<ProductivityItem[]>([])

    const [activeTab, setActiveTab] = useState("safra")

    // Filters
    const [selectedCultura, setSelectedCultura] = useState<string>("SOJA")
    const [selectedSafra, setSelectedSafra] = useState<string>("")
    const [selectedFazenda, setSelectedFazenda] = useState<string>("Todas")
    const [viewMode, setViewMode] = useState<'categoria' | 'aplicacao'>('categoria')
    const [multiSafraViewMode, setMultiSafraViewMode] = useState<'categoria' | 'aplicacao'>('categoria')
    const [selectedComparisonYears, setSelectedComparisonYears] = useState<string[]>([])
    // Sorting & Display State
    const [sortDesc, setSortDesc] = useState(true)
    const [showAllPareto, setShowAllPareto] = useState(false)
    const [treemapLimit, setTreemapLimit] = useState(true) // Default to Top 30
    const [treemapSortAsc, setTreemapSortAsc] = useState(false) // Default Descending (Larger to Smaller)

    // Interactive State
    const [activeName, setActiveName] = useState<string | null>(null)
    const [chartWidth, setChartWidth] = useState(0)
    const chartRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (chartRef.current) {
            setChartWidth(chartRef.current.offsetWidth)
        }
        const handleResize = () => {
            if (chartRef.current) {
                setChartWidth(chartRef.current.offsetWidth)
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const { data: appData } = await supabase.from('custos_aplicacao').select('*').order('safra', { ascending: true })
            const { data: catData } = await supabase.from('custos_categoria').select('*').order('safra', { ascending: true })
            const { data: prodData } = await supabase.from('produtividade_colheita').select('*')

            setCustosAplicacao(appData || [])
            setCustosCategoria(catData || [])
            setProductivityData(prodData || [])
        } catch (error) {
            console.error("Erro ao carregar dados:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // --- DERIVED DATA ---

    const availableSafras = useMemo(() => {
        const safras = new Set<string>()
        // Filter safras based on selected Cultura to ensure relevance
        custosAplicacao
            .filter(item => item.cultura === selectedCultura)
            .forEach(item => safras.add(item.safra))
        return Array.from(safras).sort().reverse()
    }, [custosAplicacao, selectedCultura])

    const availableFazendas = useMemo(() => {
        const fazendas = new Set<string>()
        custosAplicacao
            .filter(item => item.cultura === selectedCultura && (!selectedSafra || item.safra === selectedSafra))
            .forEach(item => fazendas.add(item.fazenda))
        return Array.from(fazendas).sort()
    }, [custosAplicacao, selectedCultura, selectedSafra])

    // Auto-select most recent safra when culture changes
    useEffect(() => {
        if (availableSafras.length > 0) {
            setSelectedSafra(availableSafras[0])
        } else {
            setSelectedSafra("")
        }
    }, [availableSafras, selectedCultura])

    // Enforce View Mode Logic: Category View is only available for "Todas" farms
    useEffect(() => {
        if (viewMode === 'categoria' && selectedFazenda !== 'Todas') {
            setSelectedFazenda('Todas')
        }
    }, [viewMode])

    useEffect(() => {
        if (selectedFazenda !== 'Todas' && viewMode === 'categoria') {
            setViewMode('aplicacao')
        }
    }, [selectedFazenda])

    // --- ANALYSIS LOGIC ---

    const getProduction = (safra: string, cultura: string, fazenda: string) => {
        return productivityData
            .filter(p =>
                p.safra === safra &&
                p.cultura?.toUpperCase().includes(cultura) &&
                (fazenda === "Todas" || p.fazenda_lavoura === fazenda)
            )
            .reduce((acc, curr) => acc + (curr.producao_liquida_sacas || 0), 0)
    }

    const getArea = (safra: string, cultura: string, fazenda: string) => {
        return productivityData
            .filter(p =>
                p.safra === safra &&
                p.cultura?.toUpperCase().includes(cultura) &&
                (fazenda === "Todas" || p.fazenda_lavoura === fazenda)
            )
            .reduce((acc, curr) => acc + (curr.area_colhida_ha || 0), 0)
    }

    // 1. Single Safra Analysis Data
    const safraAnalysis = useMemo(() => {
        if (!selectedSafra) return null

        // Filter Data based on selection
        const filteredCat = custosCategoria.filter(c =>
            c.safra === selectedSafra &&
            c.cultura === selectedCultura
        )

        const filteredApp = custosAplicacao.filter(c =>
            c.safra === selectedSafra &&
            c.cultura === selectedCultura &&
            (selectedFazenda === "Todas" || c.fazenda === selectedFazenda)
        )

        const useAppData = viewMode === 'aplicacao' || selectedFazenda !== "Todas"

        const totalCost = useAppData
            ? filteredApp.reduce((acc, curr) => acc + (curr.custo_total || 0), 0)
            : filteredCat.reduce((acc, curr) => acc + (curr.custo_total || 0), 0)

        const totalProduction = getProduction(selectedSafra, selectedCultura, selectedFazenda)
        const totalArea = getArea(selectedSafra, selectedCultura, selectedFazenda)

        const costPerHa = totalArea > 0 ? totalCost / totalArea : 0
        const costPerSc = totalProduction > 0 ? totalCost / totalProduction : 0

        // --- CHART DATA PREPARATION ---

        let mainChartData: any[] = []
        let treemapData: any[] = []

        if (viewMode === 'categoria') {
            // Group by Category
            // We rely on useEffect to ensure selectedFazenda is "Todas" when in Category view
            const categoryData = filteredCat.reduce((acc: any, curr) => {
                const key = curr.categoria || 'Outros'
                if (!acc[key]) acc[key] = 0
                acc[key] += curr.custo_total
                return acc
            }, {})

            mainChartData = Object.entries(categoryData)
                .map(([name, value]: [string, any]) => ({
                    name,
                    value,
                    valueSc: totalProduction > 0 ? value / totalProduction : 0,
                    percentage: totalCost > 0 ? (value / totalCost) * 100 : 0
                }))
                .sort((a, b) => sortDesc ? b.value - a.value : a.value - b.value)

            // Treemap Data (Category -> Application)
            const sourceData = filteredCat

            const hierarchy = sourceData.reduce((acc: any, curr: any) => {
                const cat = curr.categoria || 'Outros'
                const app = curr.aplicacao || 'Outros'
                if (!acc[cat]) acc[cat] = { total: 0, children: {} }
                acc[cat].total += curr.custo_total
                if (!acc[cat].children[app]) acc[cat].children[app] = 0
                acc[cat].children[app] += curr.custo_total
                return acc
            }, {})

            treemapData = Object.entries(hierarchy).map(([catName, catData]: [string, any]) => ({
                name: catName,
                size: catData.total,
                value: catData.total,
                children: Object.entries(catData.children).map(([appName, appValue]: [string, any]) => ({
                    name: appName,
                    size: appValue,
                    value: appValue
                }))
            }))

        } else {
            // Group by Application
            const appData = filteredApp.reduce((acc: any, curr) => {
                const key = curr.aplicacao || 'Outros'
                if (!acc[key]) acc[key] = 0
                acc[key] += curr.custo_total
                return acc
            }, {})

            mainChartData = Object.entries(appData)
                .map(([name, value]: [string, any]) => ({
                    name,
                    value,
                    valueSc: totalProduction > 0 ? value / totalProduction : 0,
                    percentage: totalCost > 0 ? (value / totalCost) * 100 : 0
                }))
                .sort((a, b) => sortDesc ? b.value - a.value : a.value - b.value)

            // Treemap Data (Application -> Category? Or just Application flat?)
            // Let's do Application -> Category for context
            const hierarchy = filteredApp.reduce((acc: any, curr: any) => {
                const app = curr.aplicacao || 'Outros'
                const cat = curr.categoria || 'Outros'
                if (!acc[app]) acc[app] = { total: 0, children: {} }
                acc[app].total += curr.custo_total
                if (!acc[app].children[cat]) acc[app].children[cat] = 0
                acc[app].children[cat] += curr.custo_total
                return acc
            }, {})

            treemapData = Object.entries(hierarchy).map(([appName, appData]: [string, any]) => ({
                name: appName,
                size: appData.total,
                value: appData.total,
                children: Object.entries(appData.children).map(([catName, catValue]: [string, any]) => ({
                    name: catName,
                    size: catValue,
                    value: catValue
                }))
            }))
        }

        // Sort Treemap
        treemapData.sort((a: any, b: any) => treemapSortAsc ? a.size - b.size : b.size - a.size)

        // Limit Treemap
        if (treemapLimit) {
            treemapData = treemapData.slice(0, 30)
        }

        return {
            totalCost,
            costPerHa,
            costPerSc,
            totalProduction,
            mainChartData,
            treemapData
        }
    }, [selectedSafra, selectedCultura, selectedFazenda, viewMode, custosCategoria, custosAplicacao, productivityData, sortDesc, treemapLimit, treemapSortAsc])

    // 2. Comparative Analysis Data
    const comparativeAnalysis = useMemo(() => {
        const safrasToCompare = selectedComparisonYears.length > 0 ? selectedComparisonYears : availableSafras.slice(0, 5)

        const data = safrasToCompare.map(safra => {
            let totalCost = 0
            let costPerHa = 0

            if (multiSafraViewMode === 'categoria') {
                const filteredCat = custosCategoria.filter(c => c.safra === safra && c.cultura === selectedCultura)
                totalCost = filteredCat.reduce((acc, curr) => acc + curr.custo_total, 0)
                // For category, we might use pre-calculated rs_ha or calculate manually
                const totalArea = getArea(safra, selectedCultura, "Todas")
                costPerHa = totalArea > 0 ? totalCost / totalArea : (filteredCat.reduce((acc, curr) => acc + curr.custo_rs_ha, 0))
            } else {
                const filteredApp = custosAplicacao.filter(c => c.safra === safra && c.cultura === selectedCultura)
                totalCost = filteredApp.reduce((acc, curr) => acc + curr.custo_total, 0)
                const totalArea = getArea(safra, selectedCultura, "Todas")
                costPerHa = totalArea > 0 ? totalCost / totalArea : 0
            }

            const totalProd = getProduction(safra, selectedCultura, "Todas")
            const costPerSc = totalProd > 0 ? totalCost / totalProd : 0
            const avgProd = getArea(safra, selectedCultura, "Todas") > 0 ? totalProd / getArea(safra, selectedCultura, "Todas") : 0

            return {
                safra,
                totalCost,
                costPerHa,
                costPerSc,
                avgProd
            }
        }).sort((a, b) => a.safra.localeCompare(b.safra))

        return data
    }, [selectedComparisonYears, availableSafras, selectedCultura, custosCategoria, custosAplicacao, productivityData, multiSafraViewMode])

    // 3. Stacked Category/Application Evolution (Enhanced)
    const stackedCategoryData = useMemo(() => {
        const safrasToCompare = selectedComparisonYears.length > 0 ? selectedComparisonYears : availableSafras.slice(0, 5)
        const isAppMode = multiSafraViewMode === 'aplicacao'

        // Get top 12 items overall
        let allItems: any[] = []
        if (isAppMode) {
            allItems = custosAplicacao.filter(c => c.cultura === selectedCultura)
        } else {
            allItems = custosCategoria.filter(c => c.cultura === selectedCultura)
        }

        const itemTotals = allItems.reduce((acc: any, curr: any) => {
            const key = isAppMode ? curr.aplicacao : curr.categoria
            if (!acc[key]) acc[key] = 0
            acc[key] += curr.custo_total
            return acc
        }, {})

        const topItems = Object.entries(itemTotals)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 12)
            .map(x => x[0])

        // Data for R$/ha
        const dataHa = safrasToCompare.map(safra => {
            const filtered = isAppMode
                ? custosAplicacao.filter(c => c.safra === safra && c.cultura === selectedCultura)
                : custosCategoria.filter(c => c.safra === safra && c.cultura === selectedCultura)

            const row: any = { safra }
            let others = 0

            // Calculate total area for this safra to compute /ha if needed for application
            const totalArea = getArea(safra, selectedCultura, "Todas")

            filtered.forEach((item: any) => {
                const key = isAppMode ? item.aplicacao : item.categoria
                let val = 0

                if (isAppMode) {
                    // Application table might not have custo_rs_ha pre-calculated or reliable, calculate it
                    val = totalArea > 0 ? item.custo_total / totalArea : 0
                } else {
                    val = item.custo_rs_ha
                }

                if (topItems.includes(key)) {
                    if (!row[key]) row[key] = 0
                    row[key] += val
                } else {
                    others += val
                }
            })
            row['Outros'] = others
            return row
        }).sort((a: any, b: any) => a.safra.localeCompare(b.safra))

        // Data for R$/sc
        const dataSc = safrasToCompare.map(safra => {
            const filtered = isAppMode
                ? custosAplicacao.filter(c => c.safra === safra && c.cultura === selectedCultura)
                : custosCategoria.filter(c => c.safra === safra && c.cultura === selectedCultura)

            const totalProd = getProduction(safra, selectedCultura, "Todas")
            const row: any = { safra }
            let others = 0

            if (totalProd > 0) {
                filtered.forEach((item: any) => {
                    const key = isAppMode ? item.aplicacao : item.categoria
                    const val = item.custo_total / totalProd
                    if (topItems.includes(key)) {
                        if (!row[key]) row[key] = 0
                        row[key] += val
                    } else {
                        others += val
                    }
                })
            }
            row['Outros'] = others
            return row
        }).sort((a: any, b: any) => a.safra.localeCompare(b.safra))

        return { dataHa, dataSc, keys: [...topItems, 'Outros'] }
    }, [selectedComparisonYears, availableSafras, selectedCultura, custosCategoria, custosAplicacao, productivityData, multiSafraViewMode])

    // 4. Multi-Safra AI Insights Data
    const multiSafraInsightsData = useMemo(() => {
        return {
            view_mode: multiSafraViewMode,
            trends: comparativeAnalysis.map(d => ({
                safra: d.safra,
                total_cost: d.totalCost,
                cost_per_ha: d.costPerHa,
                cost_per_sc: d.costPerSc
            })),
            composition: {
                keys: stackedCategoryData.keys,
                data_ha: stackedCategoryData.dataHa
            }
        }
    }, [multiSafraViewMode, comparativeAnalysis, stackedCategoryData])


    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
    }

    return (
        <div className="space-y-6 animate-in fade-in-0 duration-500">

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-white border border-gray-200 p-1 rounded-2xl shadow-sm w-full md:w-auto grid grid-cols-2 md:inline-flex h-14">
                    <TabsTrigger value="safra" className="rounded-xl h-full data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2 text-base font-medium">
                        <Layers className="h-5 w-5" />
                        Análise de Safra
                    </TabsTrigger>
                    <TabsTrigger value="comparativo" className="rounded-xl h-full data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2 text-base font-medium">
                        <CalendarRange className="h-5 w-5" />
                        Comparativo Multissafra
                    </TabsTrigger>
                </TabsList>

                {/* --- TAB 1: ANÁLISE DE SAFRA --- */}
                <TabsContent value="safra" className="space-y-6">
                    {/* Filters */}
                    {/* Filters - Compact Standardized */}
                    {/* Header Row: Title + Filters */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2">
                        <h2 className="text-2xl font-bold tracking-tight text-gray-700">Análise de Custos da Safra</h2>

                        <div className="flex-shrink-0">
                            <Card className="border-none shadow-sm bg-gradient-to-r from-blue-50/40 via-indigo-50/40 to-blue-50/40">
                                <CardContent className="p-1 px-3">
                                    <div className="flex flex-wrap gap-3 items-center">
                                        <div className="flex items-center gap-2 text-indigo-900/60 bg-white/50 px-3 py-1.5 rounded-full ring-1 ring-indigo-100">
                                            <Filter className="h-3.5 w-3.5" />
                                            <span className="text-xs font-semibold uppercase tracking-wide">Filtros</span>
                                        </div>

                                        <Select value={selectedCultura} onValueChange={setSelectedCultura}>
                                            <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-indigo-100 focus:ring-indigo-100 rounded-xl">
                                                <SelectValue placeholder="Cultura" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SOJA">Soja</SelectItem>
                                                <SelectItem value="MILHO">Milho</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select value={selectedSafra} onValueChange={setSelectedSafra}>
                                            <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-indigo-100 focus:ring-indigo-100 rounded-xl">
                                                <SelectValue placeholder="Safra" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSafras.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Select value={selectedFazenda} onValueChange={setSelectedFazenda}>
                                            <SelectTrigger className="w-[180px] h-8 text-sm bg-white/60 border-indigo-100 focus:ring-indigo-100 rounded-xl">
                                                <SelectValue placeholder="Fazenda" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Todas">Todas as Fazendas</SelectItem>
                                                {availableFazendas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        {/* View Mode Toggle */}
                                        <div className="flex bg-white/50 p-1 rounded-lg ml-auto border border-indigo-100">
                                            <button
                                                onClick={() => setViewMode('categoria')}
                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'categoria'
                                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-50'
                                                    : 'text-gray-500 hover:text-indigo-600'
                                                    }`}
                                            >
                                                Categoria
                                            </button>
                                            <button
                                                onClick={() => setViewMode('aplicacao')}
                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'aplicacao'
                                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-50'
                                                    : 'text-gray-500 hover:text-indigo-600'
                                                    }`}
                                            >
                                                Aplicação
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* AI Insights - Cost Analysis */}
                    <AIInsights
                        context={{
                            cultura: selectedCultura,
                            safra: selectedSafra,
                            fazenda: selectedFazenda
                        }}
                        analysisType="costs_analysis"
                        data={{
                            financial: {
                                total_cost: safraAnalysis?.totalCost,
                                cost_per_ha: safraAnalysis?.costPerHa,
                                cost_per_sc: safraAnalysis?.costPerSc,
                            },
                            breakdown: safraAnalysis?.mainChartData.slice(0, 10).map((i: any) => ({
                                category: i.name,
                                value: i.value,
                                percentage: i.percentage
                            }))
                        }}
                    />

                    {safraAnalysis && (
                        <>
                            {/* KPIs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <KPICard
                                    title="Custo Total"
                                    value={formatCurrency(safraAnalysis.totalCost)}
                                    subtitle={selectedFazenda !== "Todas" ? `Investimento em ${selectedFazenda}` : "Investimento total na safra"}
                                    icon={DollarSign}
                                    color="indigo"
                                />
                                <KPICard
                                    title="Custo por Hectare"
                                    value={formatCurrency(safraAnalysis.costPerHa)}
                                    subtitle="Custo médio por área"
                                    icon={TrendingUp}
                                    color="emerald"
                                />
                                <KPICard
                                    title="Custo por Saca"
                                    value={formatCurrency(safraAnalysis.costPerSc)}
                                    subtitle={safraAnalysis.totalProduction > 0 ? "Baseado na produção realizada" : "Aguardando dados de colheita"}
                                    icon={PieChartIcon}
                                    color="amber"
                                />
                            </div>

                            {/* Main Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Composition by Category/Application - Horizontal Bar */}
                                <Card className="border-0 shadow-lg col-span-1 lg:col-span-2">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-gray-800">
                                                {viewMode === 'categoria' ? 'Detalhamento por Categoria (Pareto)' : 'Detalhamento por Aplicação (Pareto)'}
                                            </CardTitle>
                                            <CardDescription>
                                                {showAllPareto
                                                    ? `Exibindo todos os ${safraAnalysis.mainChartData.length} itens`
                                                    : `Exibindo Top 15 de ${safraAnalysis.mainChartData.length} itens`}
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setShowAllPareto(!showAllPareto)}>
                                                {showAllPareto ? (
                                                    <>
                                                        <ChevronUp className="h-4 w-4 mr-2" />
                                                        Mostrar Menos
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="h-4 w-4 mr-2" />
                                                        Ver Todos
                                                    </>
                                                )}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setSortDesc(!sortDesc)}>
                                                {sortDesc ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent style={{ height: showAllPareto ? Math.max(500, safraAnalysis.mainChartData.length * 40) : 500 }} className="transition-all duration-500 ease-in-out">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                layout="vertical"
                                                data={showAllPareto ? safraAnalysis.mainChartData : safraAnalysis.mainChartData.slice(0, 15)}
                                                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                                <XAxis type="number" tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
                                                <YAxis
                                                    dataKey="name"
                                                    type="category"
                                                    width={150}
                                                    tick={{ fontSize: 11, fill: '#4b5563' }}
                                                    interval={0}
                                                />
                                                <Tooltip content={<ModernTooltip />} />
                                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                                    {(showAllPareto ? safraAnalysis.mainChartData : safraAnalysis.mainChartData.slice(0, 15)).map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#059669' : '#34d399'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                {/* Cost per Bag Breakdown */}
                                <Card className="border-0 shadow-lg col-span-1 lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-semibold text-gray-800">
                                            {viewMode === 'categoria' ? 'Custo por Saca por Categoria (R$/sc)' : 'Custo por Saca por Aplicação (R$/sc)'}
                                        </CardTitle>
                                        <CardDescription>Quanto cada item custa por saca produzida</CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-[400px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={safraAnalysis.mainChartData.slice(0, 15)}
                                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={80} />
                                                <YAxis tickFormatter={(val) => `R$ ${val.toFixed(2)}`} />
                                                <Tooltip content={<ModernTooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />} />
                                                <Bar dataKey="valueSc" name="R$/sc" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                {/* Treemap - Hierarchical View */}
                                <Card className="border-0 shadow-lg col-span-1 lg:col-span-2">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-gray-800">Mapa de Calor de Custos</CardTitle>
                                            <CardDescription>
                                                {treemapLimit ? "Exibindo Top 30 itens" : "Exibindo todos os itens"}
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setTreemapSortAsc(!treemapSortAsc)}>
                                                <LayoutGrid className="h-4 w-4 mr-2" />
                                                Reorganizar
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="h-[500px]">
                                        <div className="h-full w-full" ref={chartRef}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <Treemap
                                                    data={safraAnalysis.treemapData}
                                                    dataKey="size"
                                                    aspectRatio={4 / 3}
                                                    stroke="#fff"
                                                    fill="#8884d8"
                                                    content={
                                                        <CustomizedTreemapContent
                                                            activeName={activeName}
                                                            onHover={setActiveName}
                                                            onLeave={() => setActiveName(null)}
                                                            colors={[
                                                                '#059669', '#10b981', '#34d399', '#6ee7b7', // Greens
                                                                '#d97706', '#f59e0b', '#fbbf24', '#fcd34d', // Ambers
                                                                '#dc2626', '#ef4444', '#f87171', '#fca5a5', // Reds
                                                                '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', // Violets
                                                                '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', // Blues
                                                                '#db2777', '#ec4899', '#f472b6', '#fbcfe8'  // Pinks
                                                            ]}
                                                            containerWidth={chartWidth}
                                                        />
                                                    }
                                                >
                                                    <Tooltip content={<ModernTooltip formatter={(val: number) => formatCurrency(val)} />} />
                                                </Treemap>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </TabsContent>

                {/* --- TAB 2: COMPARATIVO MULTISSAFRA --- */}
                <TabsContent value="comparativo" className="space-y-6">
                    {/* Filters */}
                    <Card className="border-0 shadow-sm bg-white">
                        <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex flex-wrap gap-4 items-center">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-700">Filtros:</span>
                                </div>
                                <Select value={selectedCultura} onValueChange={setSelectedCultura}>
                                    <SelectTrigger className="w-[180px] h-9 bg-gray-50 border-gray-200"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="SOJA">Soja</SelectItem><SelectItem value="MILHO">Milho</SelectItem></SelectContent>
                                </Select>
                                <div className="w-[300px]">
                                    <MultiSelect
                                        options={availableSafras.map(s => ({ label: s, value: s }))}
                                        selected={selectedComparisonYears}
                                        onChange={setSelectedComparisonYears}
                                        placeholder="Selecione safras..."
                                        className="bg-gray-50 border-gray-200"
                                    />
                                </div>
                            </div>

                            {/* View Mode Toggle */}
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setMultiSafraViewMode('categoria')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${multiSafraViewMode === 'categoria'
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Por Categoria
                                </button>
                                <button
                                    onClick={() => setMultiSafraViewMode('aplicacao')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${multiSafraViewMode === 'aplicacao'
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Por Aplicação
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Insights - Multi Safra */}
                    <AIInsights
                        context={{
                            cultura: selectedCultura,
                            safra: `Comparativo: ${selectedComparisonYears.length > 0 ? selectedComparisonYears.join(', ') : 'Últimas 5 safras'}`,
                            fazenda: selectedFazenda
                        }}
                        analysisType="multi_safra_costs"
                        data={multiSafraInsightsData}
                    />

                    {/* Comparative Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Cost Evolution (Total & /ha) */}
                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold text-gray-800">Evolução de Custos (Total e por Hectare)</CardTitle>
                                <CardDescription>Custo Total vs Custo por Hectare</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={comparativeAnalysis} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="safra" tick={{ fontSize: 12 }} />
                                        <YAxis yAxisId="left" orientation="left" tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} stroke="#059669" />
                                        <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `R$ ${val}`} stroke="#f59e0b" />
                                        <Tooltip content={<ModernTooltip />} />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="totalCost" name="Custo Total" fill="#059669" radius={[4, 4, 0, 0]} barSize={40} />
                                        <Line yAxisId="right" type="monotone" dataKey="costPerHa" name="R$/ha" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* NEW: Cost per Bag Evolution */}
                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold text-gray-800">Evolução do Custo por Saca</CardTitle>
                                <CardDescription>Variação do custo de produção por saca ao longo dos anos</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={comparativeAnalysis} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <defs>
                                            <linearGradient id="colorCostSc" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="safra" tick={{ fontSize: 12 }} />
                                        <YAxis tickFormatter={(val) => `R$ ${val.toFixed(2)}`} />
                                        <Tooltip content={<ModernTooltip />} />
                                        <Legend />
                                        <Area type="monotone" dataKey="costPerSc" name="Custo por Saca (R$/sc)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorCostSc)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Stacked Category Evolution (R$/ha) */}
                        <Card className="border-0 shadow-lg lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold text-gray-800">
                                    {multiSafraViewMode === 'categoria' ? 'Composição de Custos por Hectare (R$/ha)' : 'Composição de Custos por Aplicação (R$/ha)'}
                                </CardTitle>
                                <CardDescription>Detalhamento expandido das {multiSafraViewMode === 'categoria' ? 'categorias' : 'aplicações'} ao longo do tempo</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[500px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stackedCategoryData.dataHa} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="safra" />
                                        <YAxis tickFormatter={(val) => `R$ ${val}`} />
                                        <Tooltip content={<ModernTooltip />} />
                                        <Legend />
                                        {stackedCategoryData.keys.map((key, index) => (
                                            <Bar
                                                key={key}
                                                dataKey={key}
                                                stackId="a"
                                                fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#d946ef'][index % 12]}
                                                radius={index === stackedCategoryData.keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                            />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* NEW: Stacked Category Evolution (R$/sc) */}
                        <Card className="border-0 shadow-lg lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold text-gray-800">
                                    {multiSafraViewMode === 'categoria' ? 'Composição de Custos por Saca (R$/sc)' : 'Composição de Custos por Aplicação (R$/sc)'}
                                </CardTitle>
                                <CardDescription>Impacto de cada {multiSafraViewMode === 'categoria' ? 'categoria' : 'aplicação'} no custo final da saca</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[500px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stackedCategoryData.dataSc} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="safra" />
                                        <YAxis tickFormatter={(val) => `R$ ${val.toFixed(2)}`} />
                                        <Tooltip content={<ModernTooltip />} />
                                        <Legend />
                                        {stackedCategoryData.keys.map((key, index) => (
                                            <Bar
                                                key={key}
                                                dataKey={key}
                                                stackId="a"
                                                fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#d946ef'][index % 12]}
                                                radius={index === stackedCategoryData.keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                            />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

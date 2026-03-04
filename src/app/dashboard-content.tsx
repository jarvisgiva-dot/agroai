"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Leaf, TrendingUp, DollarSign, Wheat, Fuel, FlaskConical, Sprout, Flower2, Receipt, BarChart3, Percent, Coins, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MODALIDADES, CHART_COLORS as COLORS } from "@/constants"
import { AIInsights } from "@/components/dashboard/AIInsights"
import { useDashboardFilters } from "@/hooks/useDashboardFilters"
import { useDashboardData } from "@/hooks/useDashboardData"

export default function DashboardPage() {
    const [selectedSafra, setSelectedSafra] = useState<string>("todas")
    const [selectedFazenda, setSelectedFazenda] = useState<string>("todas")
    const [selectedCultura, setSelectedCultura] = useState<string>("soja")

    // React Query hooks
    const { data: rawFilterData = [] } = useDashboardFilters()
    const { data: dashboardData, isLoading: loading } = useDashboardData({
        cultura: selectedCultura,
        safra: selectedSafra,
        fazenda: selectedFazenda
    })

    // Extract data from React Query response
    const productivityData = dashboardData?.productivity || []
    const contractData = dashboardData?.contracts || []
    const inventoryData = dashboardData?.inventory || []
    const costCategoriaData = dashboardData?.costCategoria || []
    const costAplicacaoData = dashboardData?.costAplicacao || []

    // Validate and adjust selected cultura when filter data loads
    useEffect(() => {
        if (rawFilterData.length > 0) {
            const uniqueCulturas = [...new Set(rawFilterData.map((item: any) => item.cultura).filter(Boolean))].sort() as string[]

            // Find "soja" in a case-insensitive way
            const sojaMatch = uniqueCulturas.find(c => c.toLowerCase() === 'soja')

            if (sojaMatch) {
                // If "soja" exists (in any case), select it explicitly to match the Select option value
                // This fixes the issue where "soja" (lowercase) doesn't match "SOJA" (uppercase) in the Select
                if (selectedCultura.toLowerCase() === 'soja') {
                    setSelectedCultura(sojaMatch)
                }
            } else if (selectedCultura === "soja" && uniqueCulturas.length > 0) {
                // If "soja" doesn't exist but is selected, fallback to first available
                setSelectedCultura(uniqueCulturas[0])
            }
        }
    }, [rawFilterData])

    // Derived Filters
    const availableCulturas = useMemo(() => {
        return [...new Set(rawFilterData.map((item: any) => item.cultura).filter(Boolean))].sort() as string[]
    }, [rawFilterData])

    const availableSafras = useMemo(() => {
        let filtered = rawFilterData
        if (selectedCultura !== "todas") {
            filtered = filtered.filter((item: any) => item.cultura === selectedCultura)
        }
        return [...new Set(filtered.map((item: any) => item.safra).filter(Boolean))].sort().reverse() as string[]
    }, [rawFilterData, selectedCultura])

    const availableFazendas = useMemo(() => {
        let filtered = rawFilterData
        if (selectedCultura !== "todas") {
            filtered = filtered.filter((item: any) => item.cultura === selectedCultura)
        }
        if (selectedSafra !== "todas") {
            filtered = filtered.filter((item: any) => item.safra === selectedSafra)
        }
        return [...new Set(filtered.map((item: any) => item.fazenda_lavoura).filter(Boolean))].sort() as string[]
    }, [rawFilterData, selectedCultura, selectedSafra])

    // Auto-select Safra when Cultura changes
    useEffect(() => {
        if (selectedCultura !== "todas" && availableSafras.length > 0) {
            // If current selected safra is not in the new available list, select the most recent one
            if (!availableSafras.includes(selectedSafra) && selectedSafra !== "todas") {
                setSelectedSafra(availableSafras[0])
            } else if (selectedSafra === "todas") {
                setSelectedSafra(availableSafras[0])
            }
        }
    }, [selectedCultura, availableSafras])

    const filterByModalidade = (modalidade: string) => {
        if (modalidade === 'sementes') {
            return inventoryData.filter(item =>
                item.categoria_linha?.toLowerCase().includes('semente') ||
                item.nome_produto?.toLowerCase().includes('semente')
            )
        } else if (modalidade === 'graos_colhidos') {
            const graosKeywords = ['soja', 'milho', 'feijão', 'feijao', 'grão', 'grao', 'grãos', 'graos']
            return inventoryData.filter(item => {
                const isSemente = item.categoria_linha?.toLowerCase().includes('semente') ||
                    item.nome_produto?.toLowerCase().includes('semente')
                const isGrao = graosKeywords.some(keyword =>
                    item.categoria_linha?.toLowerCase().includes(keyword) ||
                    item.nome_produto?.toLowerCase().includes(keyword)
                )
                return isGrao && !isSemente
            })
        } else {
            const keywords = MODALIDADES[modalidade as keyof typeof MODALIDADES] || []
            return inventoryData.filter(item =>
                keywords.some((keyword: string) =>
                    item.categoria_linha?.toLowerCase().includes(keyword.toLowerCase()) ||
                    item.nome_produto?.toLowerCase().includes(keyword.toLowerCase())
                )
            )
        }
    }

    const totalProduction = Math.round(productivityData.reduce((sum, item) => sum + (item.producao_liquida_sacas || 0), 0))
    const totalArea = parseFloat(productivityData.reduce((sum, item) => sum + (item.area_colhida_ha || 0), 0).toFixed(2))
    const avgProductivity = totalArea > 0 ? (totalProduction / totalArea).toFixed(2) : '0'

    // KPIs de Contratos (IGNORANDO FAZENDA conforme solicitado)
    // O usuário quer que os KPIs de contratos e o preço médio sejam globais para a Cultura/Safra selecionada
    const globalContracts = contractData.filter(c => {
        // Filter by Cultura
        const matchesCultura = selectedCultura === "todas" || c.cultura?.toLowerCase().includes(selectedCultura.toLowerCase())

        // Filter by Safra
        const matchesSafra = selectedSafra === "todas" || c.safra === selectedSafra

        // IGNORING Fazenda filter for contracts as requested
        return matchesCultura && matchesSafra
    })

    // Filter Stock (IGNORANDO FAZENDA conforme solicitado para manter consistência com Contratos)
    const filteredStock = inventoryData.filter(s => {
        const graosKeywords = ['soja', 'milho', 'feijão', 'feijao', 'grão', 'grao']
        const isSemente = s.categoria_linha?.toLowerCase().includes('semente') || s.nome_produto?.toLowerCase().includes('semente')

        // Check if it's a grain
        const isGrao = graosKeywords.some((k: string) =>
            s.categoria_linha?.toLowerCase().includes(k) ||
            s.nome_produto?.toLowerCase().includes(k)
        )

        if (!isGrao || isSemente) return false

        // Filter by specific culture
        if (selectedCultura !== "todas") {
            return s.nome_produto?.toLowerCase().includes(selectedCultura.toLowerCase()) ||
                s.categoria_linha?.toLowerCase().includes(selectedCultura.toLowerCase())
        }
        return true
    })

    const totalEstoque = Math.round(filteredStock.reduce((sum, g) => sum + (g.quantidade_estoque || 0), 0))
    const totalVendido = Math.round(globalContracts.reduce((sum, c) => sum + (c.qtd_contrato_sacas || 0), 0))
    const totalPendente = Math.round(globalContracts.reduce((sum, c) => sum + (c.qtd_pendente_sacas || 0), 0))
    const totalEmbarcado = totalVendido - totalPendente
    const disponivelVenda = totalEstoque - totalPendente

    const sementesStock = filterByModalidade('sementes')
    const graosColhidosStock = filterByModalidade('graos_colhidos')
    const combustiveisStock = filterByModalidade('combustiveis')
    const quimicosStock = filterByModalidade('quimicos')
    const fertilizantesStock = filterByModalidade('fertilizantes')

    const valorSementes = sementesStock.reduce((sum, i) => sum + (i.valor_total_estoque || 0), 0)
    const kgSementes = sementesStock.reduce((sum, i) => sum + (i.quantidade_estoque || 0), 0)
    const sacasGraosColhidos = graosColhidosStock.reduce((sum, i) => sum + (i.quantidade_estoque || 0), 0)
    const valorGraosColhidos = graosColhidosStock.reduce((sum, i) => sum + (i.valor_total_estoque || 0), 0)
    const litrosCombustiveis = combustiveisStock.reduce((sum, i) => sum + (i.quantidade_estoque || 0), 0)
    const valorCombustiveis = combustiveisStock.reduce((sum, i) => sum + (i.valor_total_estoque || 0), 0)
    const valorQuimicos = quimicosStock.reduce((sum, i) => sum + (i.valor_total_estoque || 0), 0)
    const valorFertilizantes = fertilizantesStock.reduce((sum, i) => sum + (i.valor_total_estoque || 0), 0)

    // Cost KPIs
    // Using costAplicacaoData as requested by user for more accurate farm/safra/cultura breakdown
    const totalCost = costAplicacaoData.reduce((sum, c) => sum + (c.custo_total || 0), 0)
    const costPerHa = totalArea > 0 ? totalCost / totalArea : 0
    const costPerBag = totalProduction > 0 ? totalCost / totalProduction : 0

    // Revenue and Profit KPIs
    // Using globalContracts for price calculation (Market Price)
    // Using totalProduction (Farm Specific) for volume
    const validContracts = globalContracts.filter(c => c.preco_por_saca && c.qtd_contrato_sacas)
    const totalContractQuantity = validContracts.reduce((sum, c) => sum + (c.qtd_contrato_sacas || 0), 0)
    const weightedAvgPrice = totalContractQuantity > 0
        ? validContracts.reduce((sum, c) => sum + ((c.preco_por_saca || 0) * (c.qtd_contrato_sacas || 0)), 0) / totalContractQuantity
        : 0

    // Gross Revenue = Farm Production * Global Avg Price
    const grossRevenue = totalProduction * weightedAvgPrice
    const netProfit = grossRevenue - totalCost
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0
    const revenuePerHa = totalArea > 0 ? grossRevenue / totalArea : 0
    const profitPerHa = totalArea > 0 ? netProfit / totalArea : 0

    if (loading) return <div className="p-8 flex items-center gap-3 text-gray-500"><span className="animate-pulse">⏳</span> Carregando dashboard...</div>

    return (
        <div className="p-3 md:p-4 space-y-3 md:space-y-4 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 min-h-screen">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Analítico</h1>
                    <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
                        Análise de <span className="font-semibold text-blue-600">{selectedCultura.toUpperCase()}</span> -
                        Safra <span className="font-semibold text-blue-600">{selectedSafra}</span>
                        <span className="text-xs text-gray-400 ml-2">(áreas em rotação não são somadas)</span>
                    </p>
                </div>

                <div className="flex-shrink-0">
                    <Card className="border-none shadow-sm bg-gradient-to-r from-blue-50/40 via-indigo-50/40 to-blue-50/40">
                        <CardContent className="p-1.5 px-3">
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
                                        {availableCulturas.map(c => (
                                            <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedSafra} onValueChange={setSelectedSafra}>
                                    <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-indigo-100 focus:ring-indigo-100 rounded-xl">
                                        <SelectValue placeholder="Safra" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableSafras.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedFazenda} onValueChange={setSelectedFazenda}>
                                    <SelectTrigger className="w-[180px] h-8 text-sm bg-white/60 border-indigo-100 focus:ring-indigo-100 rounded-xl">
                                        <SelectValue placeholder="Fazenda" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas as fazendas</SelectItem>
                                        {availableFazendas.map(f => (
                                            <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AIInsights
                context={{
                    safra: selectedSafra,
                    fazenda: selectedFazenda,
                    cultura: selectedCultura
                }}
                data={{
                    kpis: {
                        production: {
                            total: totalProduction,
                            area: totalArea,
                            productivity: avgProductivity
                        },
                        financial: {
                            revenue: grossRevenue,
                            cost: totalCost,
                            profit: netProfit,
                            roi: roi,
                            profit_margin: profitMargin,
                            weighted_avg_price: weightedAvgPrice
                        },
                        inventory: {
                            seeds_value: valorSementes,
                            chemicals_value: valorQuimicos,
                            fertilizers_value: valorFertilizantes
                        }
                    }
                }}
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <Card className="bg-gradient-to-br from-purple-100/60 to-purple-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl py-2 gap-0">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-purple-700">Produção Total</CardTitle>
                        <div className="p-3 bg-purple-200/50 rounded-2xl">
                            <Leaf className="h-5 w-5 text-purple-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2 px-4">
                        <div className="text-3xl font-bold text-purple-900">{totalProduction.toLocaleString()}</div>
                        <p className="text-xs text-purple-600">sacas</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-100/60 to-emerald-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl py-2 gap-0">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-emerald-700">Área Total</CardTitle>
                        <div className="p-3 bg-emerald-200/50 rounded-2xl">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2 px-4">
                        <div className="text-3xl font-bold text-emerald-900">{totalArea.toLocaleString()}</div>
                        <p className="text-xs text-emerald-600">hectares</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-100/60 to-blue-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl py-2 gap-0">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-blue-700">Produtividade Média</CardTitle>
                        <div className="p-3 bg-blue-200/50 rounded-2xl">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2 px-4">
                        <div className="text-3xl font-bold text-blue-900">{avgProductivity}</div>
                        <p className="text-xs text-blue-600">sc/ha</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-100/60 to-amber-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl py-2 gap-0">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-amber-700">Contratos</CardTitle>
                        <div className="p-3 bg-amber-200/50 rounded-2xl">
                            <DollarSign className="h-5 w-5 text-amber-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-1 pt-0 px-4">
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">Total Estoque:</span>
                                <span className="text-sm font-semibold text-gray-800">{totalEstoque.toLocaleString()} sc</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-blue-600">Total Vendido:</span>
                                <span className="text-sm font-semibold text-blue-700">{totalVendido.toLocaleString()} sc</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-green-600">Total Embarcado:</span>
                                <span className="text-sm font-semibold text-green-700">{totalEmbarcado.toLocaleString()} sc</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-orange-600">A Embarcar:</span>
                                <span className="text-sm font-semibold text-orange-700">{totalPendente.toLocaleString()} sc</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-amber-200/50">
                                <span className="text-xs text-purple-600">Disponível:</span>
                                <span className="text-sm font-bold text-purple-700">{disponivelVenda.toLocaleString()} sc</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Cost & Financial Analysis KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-2">
                <Link href="/custos" className="block">
                    <Card className="bg-gradient-to-br from-red-100/60 to-red-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl cursor-pointer py-1.5 gap-0">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-3 pt-1">
                            <CardTitle className="text-sm font-medium text-red-700">Custo Total</CardTitle>
                            <div className="p-3 bg-red-200/50 rounded-2xl">
                                <Receipt className="h-4 w-4 text-red-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                            <div className="text-lg font-bold text-red-900">
                                {totalCost > 0 ? totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'N/A'}
                            </div>
                            <p className="text-xs text-red-600 mt-1">
                                {selectedFazenda === 'todas' ? 'todas as fazendas' : selectedFazenda}
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/custos" className="block">
                    <Card className="bg-gradient-to-br from-orange-100/60 to-orange-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl cursor-pointer py-1.5 gap-0">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-3 pt-1">
                            <CardTitle className="text-sm font-medium text-orange-700">Custo/ha</CardTitle>
                            <div className="p-3 bg-orange-200/50 rounded-2xl">
                                <BarChart3 className="h-4 w-4 text-orange-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                            <div className="text-lg font-bold text-orange-900">
                                {costPerHa > 0 ? costPerHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'N/A'}
                            </div>
                            <p className="text-xs text-orange-600 mt-1">por hectare</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/custos" className="block">
                    <Card className="bg-gradient-to-br from-rose-100/60 to-rose-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl cursor-pointer py-1.5 gap-0">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-3 pt-1">
                            <CardTitle className="text-sm font-medium text-rose-700">Custo/sc</CardTitle>
                            <div className="p-3 bg-rose-200/50 rounded-2xl">
                                <Wheat className="h-4 w-4 text-rose-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                            <div className="text-lg font-bold text-rose-900">
                                {costPerBag > 0 ? costPerBag.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A'}
                            </div>
                            <p className="text-xs text-rose-600 mt-1">por saca</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/contratos" className="block">
                    <Card className="bg-gradient-to-br from-emerald-100/60 to-emerald-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl cursor-pointer py-1.5 gap-0">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-3 pt-1">
                            <CardTitle className="text-sm font-medium text-emerald-700">Receita Bruta</CardTitle>
                            <div className="p-3 bg-emerald-200/50 rounded-2xl">
                                <DollarSign className="h-4 w-4 text-emerald-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                            <div className="text-lg font-bold text-emerald-900">
                                {grossRevenue >= 0
                                    ? grossRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                                    : 'N/A'}
                            </div>
                            <p className="text-xs text-emerald-600 mt-1">produção × preço médio</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/graficos" className="block">
                    <Card className="bg-gradient-to-br from-teal-100/60 to-teal-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl cursor-pointer py-1.5 gap-0">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-3 pt-1">
                            <CardTitle className="text-sm font-medium text-teal-700">Receita/ha</CardTitle>
                            <div className="p-3 bg-teal-200/50 rounded-2xl">
                                <TrendingUp className="h-4 w-4 text-teal-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                            <div className="text-lg font-bold text-teal-900">
                                {revenuePerHa >= 0
                                    ? revenuePerHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                                    : 'N/A'}
                            </div>
                            <p className="text-xs text-teal-600 mt-1">receita por hectare</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/contratos" className="block">
                    <Card className="bg-gradient-to-br from-green-100/60 to-green-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl cursor-pointer py-1.5 gap-0">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-3 pt-1">
                            <CardTitle className="text-sm font-medium text-green-700">Lucro/ha</CardTitle>
                            <div className="p-3 bg-green-200/50 rounded-2xl">
                                <Coins className="h-4 w-4 text-green-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                            <div className={`text-lg font-bold ${profitPerHa >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                                {(grossRevenue >= 0 || totalCost > 0)
                                    ? profitPerHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                                    : 'N/A'}
                            </div>
                            <p className="text-xs text-green-600 mt-1">lucro por hectare</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/graficos" className="block">
                    <Card className="bg-gradient-to-br from-indigo-100/60 to-indigo-50/40 border-none shadow-lg hover:shadow-xl transition-all rounded-3xl cursor-pointer py-1.5 gap-0">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-3 pt-1">
                            <CardTitle className="text-sm font-medium text-indigo-700">ROI</CardTitle>
                            <div className="p-3 bg-indigo-200/50 rounded-2xl">
                                <Percent className="h-4 w-4 text-indigo-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                            <div className={`text-lg font-bold ${roi >= 0 ? 'text-indigo-900' : 'text-red-900'}`}>
                                {totalCost > 0
                                    ? `${roi.toFixed(1)}%`
                                    : 'N/A'}
                            </div>
                            <p className="text-xs text-indigo-600 mt-1">retorno investimento</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <Card className="bg-white/90 backdrop-blur border-gray-100 shadow-lg rounded-3xl py-2 gap-0 overflow-hidden">
                <CardHeader className="px-4 pb-1 pt-2">
                    <CardTitle className="text-gray-700">Estoque por Modalidade</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">Clique em uma modalidade para ver o estoque</p>
                </CardHeader>
                <CardContent className="px-3 pb-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
                        <Link href="/estoque?tab=sementes" className="block">
                            <div className="text-center p-3 bg-lime-50 rounded-2xl hover:bg-lime-100 transition-all cursor-pointer hover:shadow-lg">
                                <Flower2 className="h-6 w-6 text-lime-600 mx-auto mb-1" />
                                <p className="text-sm text-lime-700 font-medium mb-1">Sementes</p>
                                <p className="text-xl font-bold text-lime-900">
                                    {Math.round(kgSementes).toLocaleString('pt-BR')} kg
                                </p>
                                <p className="text-xs text-lime-700 mt-1">
                                    {valorSementes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-lime-500 mt-1">{sementesStock.length} itens</p>
                            </div>
                        </Link>

                        <Link href="/estoque?tab=graos" className="block">
                            <div className="text-center p-3 bg-amber-50 rounded-2xl hover:bg-amber-100 transition-all cursor-pointer hover:shadow-lg">
                                <Wheat className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                                <p className="text-sm text-amber-700 font-medium mb-1">Grãos Colhidos</p>
                                <p className="text-xl font-bold text-amber-900">
                                    {Math.round(sacasGraosColhidos).toLocaleString('pt-BR')} sc
                                </p>
                                <p className="text-xs text-amber-700 mt-1">
                                    {valorGraosColhidos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-amber-500 mt-1">{graosColhidosStock.length} itens</p>
                            </div>
                        </Link>

                        <Link href="/estoque?tab=combustiveis" className="block">
                            <div className="text-center p-3 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-all cursor-pointer hover:shadow-lg">
                                <Fuel className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                                <p className="text-sm text-orange-700 font-medium mb-1">Combustíveis</p>
                                <p className="text-xl font-bold text-orange-900">
                                    {Math.round(litrosCombustiveis).toLocaleString('pt-BR')} L
                                </p>
                                <p className="text-xs text-orange-700 mt-1">
                                    {valorCombustiveis.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-orange-500 mt-1">{combustiveisStock.length} itens</p>
                            </div>
                        </Link>

                        <Link href="/estoque?tab=quimicos" className="block">
                            <div className="text-center p-3 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-all cursor-pointer hover:shadow-lg">
                                <FlaskConical className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                                <p className="text-sm text-blue-700 font-medium mb-1">Químicos</p>
                                <p className="text-xl font-bold text-blue-900">
                                    {valorQuimicos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-blue-600 mt-1">{quimicosStock.length} itens</p>
                            </div>
                        </Link>

                        <Link href="/estoque?tab=fertilizantes" className="block">
                            <div className="text-center p-3 bg-green-50 rounded-2xl hover:bg-green-100 transition-all cursor-pointer hover:shadow-lg">
                                <Sprout className="h-6 w-6 text-green-600 mx-auto mb-1" />
                                <p className="text-sm text-green-700 font-medium mb-1">Fertilizantes</p>
                                <p className="text-xl font-bold text-green-900">
                                    {valorFertilizantes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-green-600 mt-1">{fertilizantesStock.length} itens</p>
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div >
    )
}
